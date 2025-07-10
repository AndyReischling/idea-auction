'use client';

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc,
  getDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { firebaseActivityService } from './firebase-activity';
import { marketDataSyncService } from './market-data-sync';
import { dataReconciliationService } from './data-reconciliation';

// Migration status tracking
interface MigrationStatus {
  stage: 'pending' | 'in_progress' | 'completed' | 'error' | 'rollback';
  progress: number;
  totalItems: number;
  completedItems: number;
  errors: string[];
  lastUpdate: string;
  dataTypes: {
    [key: string]: {
      status: 'pending' | 'migrating' | 'completed' | 'error';
      itemCount: number;
      migratedCount: number;
      errors: string[];
    };
  };
}

// Data type definitions
interface LocalStorageDataTypes {
  userProfile: any;
  opinions: string[];
  opinionMarketData: { [key: string]: any };
  transactions: any[];
  globalActivityFeed: any[];
  botTransactions: any[];
  ownedOpinions: any[];
  advancedBets: any[];
  shortPositions: any[];
  autonomousBots: any[];
  botOpinions: any[];
  portfolioSnapshots: any[];
  semanticEmbeddings: any[];
  otherUsers: any[];
  activityFeed: any[];
  opinionAttributions: any;
  botsAutoStart: string;
}

export class UnifiedMigrationService {
  private static instance: UnifiedMigrationService;
  private migrationStatus: MigrationStatus;
  private realtimeUnsubscribes: (() => void)[] = [];
  private isOnline: boolean = true;
  private migrationInProgress: boolean = false;

  // Firebase collections
  private collections = {
    users: collection(db, 'users'),
    opinions: collection(db, 'opinions'),
    marketData: collection(db, 'market-data'),
    transactions: collection(db, 'transactions'),
    activityFeed: collection(db, 'activity-feed'),
    userPortfolios: collection(db, 'user-portfolios'),
    bots: collection(db, 'bots'),
    advancedBets: collection(db, 'advanced-bets'),
    shortPositions: collection(db, 'short-positions'),
    embeddings: collection(db, 'embeddings'),
    migrationStatus: collection(db, 'migration-status'),
    localStorageBackup: collection(db, 'localStorage_backup')
  };

  private constructor() {
    this.migrationStatus = {
      stage: 'pending',
      progress: 0,
      totalItems: 0,
      completedItems: 0,
      errors: [],
      lastUpdate: new Date().toISOString(),
      dataTypes: {}
    };
    
    this.setupNetworkMonitoring();
    this.initializeDataTypes();
  }

  public static getInstance(): UnifiedMigrationService {
    if (!UnifiedMigrationService.instance) {
      UnifiedMigrationService.instance = new UnifiedMigrationService();
    }
    return UnifiedMigrationService.instance;
  }

  // Initialize all data types for migration tracking
  private initializeDataTypes(): void {
    const dataTypes = [
      'userProfile', 'opinions', 'opinionMarketData', 'transactions',
      'globalActivityFeed', 'botTransactions', 'ownedOpinions', 
      'advancedBets', 'shortPositions', 'autonomousBots', 'botOpinions',
      'portfolioSnapshots', 'semanticEmbeddings', 'otherUsers',
      'activityFeed', 'opinionAttributions', 'botsAutoStart'
    ];

    dataTypes.forEach(type => {
      this.migrationStatus.dataTypes[type] = {
        status: 'pending',
        itemCount: 0,
        migratedCount: 0,
        errors: []
      };
    });
  }

  // Network monitoring for offline handling
  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 Network online - resuming Firebase operations');
        this.resumeMigrationIfNeeded();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('🌐 Network offline - using localStorage fallback');
      });
    }
  }

  // Safe localStorage operations
  private safeGetFromStorage<T>(key: string, defaultValue: T): T {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage<T>(key: string, value: T): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }

  // MAIN MIGRATION METHODS

  /**
   * Start complete migration from localStorage to Firebase
   */
  async startMigration(userId: string): Promise<MigrationStatus> {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    if (!userId) {
      throw new Error('User ID required for migration');
    }

    console.log('🚀 Starting unified migration for user:', userId);
    this.migrationInProgress = true;
    this.migrationStatus.stage = 'in_progress';
    this.migrationStatus.lastUpdate = new Date().toISOString();

    try {
      // 1. Create backup of localStorage data
      await this.createBackup(userId);

      // 2. Analyze localStorage data
      const analysisResult = await this.analyzeLocalStorageData();
      this.migrationStatus.totalItems = analysisResult.totalItems;

      // 3. Migrate each data type
      await this.migrateUserProfile(userId);
      await this.migrateOpinions(userId);
      await this.migrateMarketData(userId);
      await this.migrateTransactions(userId);
      await this.migrateActivityFeeds(userId);
      await this.migratePortfolioData(userId);
      await this.migrateBotData(userId);
      await this.migrateBettingData(userId);
      await this.migrateEmbeddings(userId);

      // 4. Verify data integrity
      await this.verifyDataIntegrity(userId);

      // 5. Enable real-time sync
      await this.enableRealtimeSync(userId);

      this.migrationStatus.stage = 'completed';
      this.migrationStatus.progress = 100;
      console.log('✅ Migration completed successfully');

      return this.migrationStatus;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.migrationStatus.stage = 'error';
      this.migrationStatus.errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Create backup of all localStorage data
   */
  private async createBackup(userId: string): Promise<void> {
    console.log('💾 Creating localStorage backup...');
    
    const backupData: any = {};
    const localStorageKeys = Object.keys(localStorage);
    
    localStorageKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          backupData[key] = {
            value,
            timestamp: new Date().toISOString(),
            isJSON: this.isValidJSON(value)
          };
        }
      } catch (error) {
        console.error(`Error backing up key ${key}:`, error);
      }
    });

    // Save backup to Firebase
    const backupDoc = doc(this.collections.localStorageBackup, `backup-${userId}-${Date.now()}`);
    await setDoc(backupDoc, {
      userId,
      backupData,
      createdAt: serverTimestamp(),
      type: 'pre-migration-backup'
    });

    console.log('✅ Backup created successfully');
  }

  /**
   * Analyze localStorage data to get migration statistics
   */
  private async analyzeLocalStorageData(): Promise<{ totalItems: number; dataTypes: any }> {
    console.log('📊 Analyzing localStorage data...');
    
    let totalItems = 0;
    const dataTypes: any = {};

    // Count items in each data type
    Object.keys(this.migrationStatus.dataTypes).forEach(dataType => {
      const data = this.safeGetFromStorage(dataType, null);
      let itemCount = 0;

      if (data !== null) {
        if (Array.isArray(data)) {
          itemCount = data.length;
        } else if (typeof data === 'object') {
          itemCount = Object.keys(data).length;
        } else {
          itemCount = 1;
        }
      }

      this.migrationStatus.dataTypes[dataType].itemCount = itemCount;
      totalItems += itemCount;
      dataTypes[dataType] = itemCount;
    });

    console.log(`📊 Analysis complete: ${totalItems} total items across ${Object.keys(dataTypes).length} data types`);
    return { totalItems, dataTypes };
  }

  /**
   * Migrate user profile data
   */
  private async migrateUserProfile(userId: string): Promise<void> {
    console.log('👤 Migrating user profile...');
    this.migrationStatus.dataTypes.userProfile.status = 'migrating';

    try {
      const localProfile = this.safeGetFromStorage('userProfile', null);
      
      if (localProfile) {
        // Check if Firebase profile exists
        const firebaseProfileDoc = await getDoc(doc(this.collections.users, userId));
        
        if (firebaseProfileDoc.exists()) {
          // Merge profiles, preferring localStorage for balance and stats
          const firebaseProfile = firebaseProfileDoc.data();
          const mergedProfile = {
            ...firebaseProfile,
            balance: localProfile.balance || firebaseProfile.balance,
            totalEarnings: localProfile.totalEarnings || firebaseProfile.totalEarnings,
            totalLosses: localProfile.totalLosses || firebaseProfile.totalLosses,
            updatedAt: serverTimestamp()
          };

          await updateDoc(doc(this.collections.users, userId), mergedProfile);
        } else {
          // Create new profile
          await setDoc(doc(this.collections.users, userId), {
            ...localProfile,
            uid: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        this.migrationStatus.dataTypes.userProfile.migratedCount = 1;
      }

      this.migrationStatus.dataTypes.userProfile.status = 'completed';
      console.log('✅ User profile migrated');
    } catch (error) {
      console.error('❌ User profile migration failed:', error);
      this.migrationStatus.dataTypes.userProfile.status = 'error';
      this.migrationStatus.dataTypes.userProfile.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate opinions data
   */
  private async migrateOpinions(userId: string): Promise<void> {
    console.log('💡 Migrating opinions...');
    this.migrationStatus.dataTypes.opinions.status = 'migrating';

    try {
      const localOpinions = this.safeGetFromStorage('opinions', []);
      
      if (localOpinions.length > 0) {
        const batch = writeBatch(db);
        
        localOpinions.forEach((opinion: string, index: number) => {
          const opinionId = btoa(opinion).replace(/[^a-zA-Z0-9]/g, '');
          const opinionRef = doc(this.collections.opinions, opinionId);
          
          batch.set(opinionRef, {
            text: opinion,
            createdBy: userId,
            createdAt: serverTimestamp(),
            status: 'active',
            metadata: {
              originalIndex: index,
              migratedFrom: 'localStorage'
            }
          }, { merge: true });
        });

        await batch.commit();
        this.migrationStatus.dataTypes.opinions.migratedCount = localOpinions.length;
      }

      this.migrationStatus.dataTypes.opinions.status = 'completed';
      console.log(`✅ ${localOpinions.length} opinions migrated`);
    } catch (error) {
      console.error('❌ Opinions migration failed:', error);
      this.migrationStatus.dataTypes.opinions.status = 'error';
      this.migrationStatus.dataTypes.opinions.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate market data
   */
  private async migrateMarketData(userId: string): Promise<void> {
    console.log('📈 Migrating market data...');
    this.migrationStatus.dataTypes.opinionMarketData.status = 'migrating';

    try {
      const result = await marketDataSyncService.syncAllMarketDataToFirebase(userId);
      this.migrationStatus.dataTypes.opinionMarketData.migratedCount = result.synced;
      
      if (result.failed > 0) {
        this.migrationStatus.dataTypes.opinionMarketData.errors.push(`${result.failed} items failed to sync`);
      }

      this.migrationStatus.dataTypes.opinionMarketData.status = 'completed';
      console.log(`✅ Market data migrated: ${result.synced} synced, ${result.failed} failed`);
    } catch (error) {
      console.error('❌ Market data migration failed:', error);
      this.migrationStatus.dataTypes.opinionMarketData.status = 'error';
      this.migrationStatus.dataTypes.opinionMarketData.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate transaction data
   */
  private async migrateTransactions(userId: string): Promise<void> {
    console.log('💰 Migrating transactions...');
    this.migrationStatus.dataTypes.transactions.status = 'migrating';

    try {
      const localTransactions = this.safeGetFromStorage('transactions', []);
      
      if (localTransactions.length > 0) {
        const batch = writeBatch(db);
        
        localTransactions.forEach((transaction: any) => {
          const transactionRef = doc(this.collections.transactions, transaction.id || `${userId}-${Date.now()}-${Math.random()}`);
          
          batch.set(transactionRef, {
            ...transaction,
            userId,
            timestamp: serverTimestamp(),
            migratedFrom: 'localStorage'
          });
        });

        await batch.commit();
        this.migrationStatus.dataTypes.transactions.migratedCount = localTransactions.length;
      }

      this.migrationStatus.dataTypes.transactions.status = 'completed';
      console.log(`✅ ${localTransactions.length} transactions migrated`);
    } catch (error) {
      console.error('❌ Transactions migration failed:', error);
      this.migrationStatus.dataTypes.transactions.status = 'error';
      this.migrationStatus.dataTypes.transactions.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate activity feeds
   */
  private async migrateActivityFeeds(userId: string): Promise<void> {
    console.log('📊 Migrating activity feeds...');
    this.migrationStatus.dataTypes.globalActivityFeed.status = 'migrating';

    try {
      const globalFeed = this.safeGetFromStorage('globalActivityFeed', []);
      const botTransactions = this.safeGetFromStorage('botTransactions', []);
      const activityFeed = this.safeGetFromStorage('activityFeed', []);

      const allActivities = [...globalFeed, ...botTransactions, ...activityFeed];
      
      if (allActivities.length > 0) {
        // Use existing Firebase activity service
        let migratedCount = 0;
        
        for (const activity of allActivities) {
          try {
            await firebaseActivityService.addActivity({
              type: activity.type || 'generate',
              username: activity.username || 'unknown',
              userId,
              opinionText: activity.opinionText,
              opinionId: activity.opinionId,
              amount: Number(activity.amount) || 0,
              price: activity.price ? Number(activity.price) : undefined,
              quantity: activity.quantity ? Number(activity.quantity) : undefined,
              isBot: activity.isBot || false,
              botId: activity.botId,
              metadata: {
                migratedFrom: 'localStorage',
                originalTimestamp: activity.timestamp
              }
            });
            migratedCount++;
          } catch (error) {
            console.error('Error migrating activity:', error);
          }
        }

        this.migrationStatus.dataTypes.globalActivityFeed.migratedCount = migratedCount;
      }

      this.migrationStatus.dataTypes.globalActivityFeed.status = 'completed';
      console.log(`✅ ${allActivities.length} activities migrated`);
    } catch (error) {
      console.error('❌ Activity feeds migration failed:', error);
      this.migrationStatus.dataTypes.globalActivityFeed.status = 'error';
      this.migrationStatus.dataTypes.globalActivityFeed.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate portfolio data
   */
  private async migratePortfolioData(userId: string): Promise<void> {
    console.log('📊 Migrating portfolio data...');
    this.migrationStatus.dataTypes.ownedOpinions.status = 'migrating';

    try {
      const ownedOpinions = this.safeGetFromStorage('ownedOpinions', []);
      const portfolioSnapshots = this.safeGetFromStorage('portfolioSnapshots', []);

      const portfolioData = {
        userId,
        ownedOpinions: ownedOpinions || [],
        portfolioSnapshots: portfolioSnapshots || [],
        lastUpdated: serverTimestamp(),
        migratedFrom: 'localStorage'
      };

      await setDoc(doc(this.collections.userPortfolios, userId), portfolioData, { merge: true });

      this.migrationStatus.dataTypes.ownedOpinions.migratedCount = ownedOpinions.length + portfolioSnapshots.length;
      this.migrationStatus.dataTypes.ownedOpinions.status = 'completed';
      console.log(`✅ Portfolio data migrated: ${ownedOpinions.length} owned opinions, ${portfolioSnapshots.length} snapshots`);
    } catch (error) {
      console.error('❌ Portfolio data migration failed:', error);
      this.migrationStatus.dataTypes.ownedOpinions.status = 'error';
      this.migrationStatus.dataTypes.ownedOpinions.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate bot data
   */
  private async migrateBotData(userId: string): Promise<void> {
    console.log('🤖 Migrating bot data...');
    this.migrationStatus.dataTypes.autonomousBots.status = 'migrating';

    try {
      const autonomousBots = this.safeGetFromStorage('autonomousBots', []);
      const botOpinions = this.safeGetFromStorage('botOpinions', []);
      const botsAutoStart = this.safeGetFromStorage('botsAutoStart', 'false');

      if (autonomousBots.length > 0) {
        const batch = writeBatch(db);
        
        autonomousBots.forEach((bot: any, index: number) => {
          const botRef = doc(this.collections.bots, bot.id || `${userId}-bot-${index}`);
          
          batch.set(botRef, {
            ...bot,
            userId,
            lastUpdated: serverTimestamp(),
            migratedFrom: 'localStorage'
          });
        });

        await batch.commit();
      }

      // Store bot settings
      await setDoc(doc(this.collections.users, userId), {
        botSettings: {
          autoStart: botsAutoStart === 'true',
          botOpinions: botOpinions || [],
          migratedFrom: 'localStorage'
        }
      }, { merge: true });

      this.migrationStatus.dataTypes.autonomousBots.migratedCount = autonomousBots.length;
      this.migrationStatus.dataTypes.autonomousBots.status = 'completed';
      console.log(`✅ ${autonomousBots.length} bots migrated`);
    } catch (error) {
      console.error('❌ Bot data migration failed:', error);
      this.migrationStatus.dataTypes.autonomousBots.status = 'error';
      this.migrationStatus.dataTypes.autonomousBots.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate betting data
   */
  private async migrateBettingData(userId: string): Promise<void> {
    console.log('🎲 Migrating betting data...');
    this.migrationStatus.dataTypes.advancedBets.status = 'migrating';

    try {
      const advancedBets = this.safeGetFromStorage('advancedBets', []);
      const shortPositions = this.safeGetFromStorage('shortPositions', []);

      // Migrate advanced bets
      if (advancedBets.length > 0) {
        const batch = writeBatch(db);
        
        advancedBets.forEach((bet: any) => {
          const betRef = doc(this.collections.advancedBets, bet.id || `${userId}-bet-${Date.now()}`);
          
          batch.set(betRef, {
            ...bet,
            bettorId: userId,
            timestamp: serverTimestamp(),
            migratedFrom: 'localStorage'
          });
        });

        await batch.commit();
      }

      // Migrate short positions
      if (shortPositions.length > 0) {
        const batch = writeBatch(db);
        
        shortPositions.forEach((position: any) => {
          const positionRef = doc(this.collections.shortPositions, position.id || `${userId}-short-${Date.now()}`);
          
          batch.set(positionRef, {
            ...position,
            userId,
            timestamp: serverTimestamp(),
            migratedFrom: 'localStorage'
          });
        });

        await batch.commit();
      }

      this.migrationStatus.dataTypes.advancedBets.migratedCount = advancedBets.length + shortPositions.length;
      this.migrationStatus.dataTypes.advancedBets.status = 'completed';
      console.log(`✅ Betting data migrated: ${advancedBets.length} bets, ${shortPositions.length} shorts`);
    } catch (error) {
      console.error('❌ Betting data migration failed:', error);
      this.migrationStatus.dataTypes.advancedBets.status = 'error';
      this.migrationStatus.dataTypes.advancedBets.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Migrate semantic embeddings
   */
  private async migrateEmbeddings(userId: string): Promise<void> {
    console.log('🔍 Migrating semantic embeddings...');
    this.migrationStatus.dataTypes.semanticEmbeddings.status = 'migrating';

    try {
      const semanticEmbeddings = this.safeGetFromStorage('semanticEmbeddings', []);
      
      if (semanticEmbeddings.length > 0) {
        const batch = writeBatch(db);
        
        semanticEmbeddings.forEach((embedding: any, index: number) => {
          const embeddingRef = doc(this.collections.embeddings, embedding.id || `${userId}-embedding-${index}`);
          
          batch.set(embeddingRef, {
            ...embedding,
            userId,
            createdAt: serverTimestamp(),
            migratedFrom: 'localStorage'
          });
        });

        await batch.commit();
        this.migrationStatus.dataTypes.semanticEmbeddings.migratedCount = semanticEmbeddings.length;
      }

      this.migrationStatus.dataTypes.semanticEmbeddings.status = 'completed';
      console.log(`✅ ${semanticEmbeddings.length} embeddings migrated`);
    } catch (error) {
      console.error('❌ Embeddings migration failed:', error);
      this.migrationStatus.dataTypes.semanticEmbeddings.status = 'error';
      this.migrationStatus.dataTypes.semanticEmbeddings.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Verify data integrity after migration
   */
  private async verifyDataIntegrity(userId: string): Promise<void> {
    console.log('✅ Verifying data integrity...');
    
    try {
      // Check if user profile exists
      const userDoc = await getDoc(doc(this.collections.users, userId));
      if (!userDoc.exists()) {
        throw new Error('User profile not found after migration');
      }

      // Check if portfolio exists
      const portfolioDoc = await getDoc(doc(this.collections.userPortfolios, userId));
      if (!portfolioDoc.exists()) {
        console.warn('Portfolio not found - this may be expected if user had no portfolio data');
      }

      // Verify some transactions exist if they were in localStorage
      const localTransactions = this.safeGetFromStorage('transactions', []);
      if (localTransactions.length > 0) {
        const transactionsQuery = query(
          this.collections.transactions,
          where('userId', '==', userId),
          limit(1)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        if (transactionsSnapshot.empty) {
          console.warn('No transactions found in Firebase despite localStorage data');
        }
      }

      console.log('✅ Data integrity verification completed');
    } catch (error) {
      console.error('❌ Data integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Enable real-time sync after migration
   */
  private async enableRealtimeSync(userId: string): Promise<void> {
    console.log('🔄 Enabling real-time sync...');
    
    try {
      // Start market data sync
      marketDataSyncService.startRealtimeSync(userId);
      
      // Start activity feed sync
      this.startActivityFeedSync(userId);
      
      // Start user profile sync
      this.startUserProfileSync(userId);
      
      console.log('✅ Real-time sync enabled');
    } catch (error) {
      console.error('❌ Failed to enable real-time sync:', error);
      throw error;
    }
  }

  /**
   * Start activity feed real-time sync
   */
  private startActivityFeedSync(userId: string): void {
    const unsubscribe = onSnapshot(
      query(this.collections.activityFeed, orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
        const activities: any[] = [];
        snapshot.docs.forEach((doc) => {
          activities.push({ id: doc.id, ...doc.data() });
        });
        
        // Update localStorage for backward compatibility
        this.safeSetToStorage('globalActivityFeed', activities);
        
        // Dispatch event for UI updates
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('activityFeedUpdated', {
            detail: { activities }
          }));
        }
      },
      (error) => {
        console.error('Activity feed sync error:', error);
      }
    );
    
    this.realtimeUnsubscribes.push(unsubscribe);
  }

  /**
   * Start user profile real-time sync
   */
  private startUserProfileSync(userId: string): void {
    const unsubscribe = onSnapshot(
      doc(this.collections.users, userId),
      (doc) => {
        if (doc.exists()) {
          const profile = doc.data();
          
          // Update localStorage for backward compatibility
          this.safeSetToStorage('userProfile', profile);
          
          // Dispatch event for UI updates
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('userProfileUpdated', {
              detail: { profile }
            }));
          }
        }
      },
      (error) => {
        console.error('User profile sync error:', error);
      }
    );
    
    this.realtimeUnsubscribes.push(unsubscribe);
  }

  /**
   * Get current migration status
   */
  getMigrationStatus(): MigrationStatus {
    return { ...this.migrationStatus };
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    try {
      const userDoc = await getDoc(doc(this.collections.users, user.uid));
      const hasLocalData = this.hasLocalStorageData();
      
      return hasLocalData && !userDoc.exists();
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Check if localStorage has data
   */
  private hasLocalStorageData(): boolean {
    if (typeof window === 'undefined') return false;
    
    const importantKeys = ['userProfile', 'opinions', 'transactions', 'opinionMarketData'];
    return importantKeys.some(key => {
      const data = this.safeGetFromStorage(key, null);
      return data !== null && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);
    });
  }

  /**
   * Resume migration if it was interrupted
   */
  private async resumeMigrationIfNeeded(): Promise<void> {
    if (this.migrationStatus.stage === 'in_progress' && !this.migrationInProgress) {
      console.log('🔄 Resuming interrupted migration...');
      const user = auth.currentUser;
      if (user) {
        await this.startMigration(user.uid);
      }
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollbackMigration(userId: string): Promise<void> {
    console.log('🔄 Rolling back migration...');
    
    try {
      // Find latest backup
      const backupQuery = query(
        this.collections.localStorageBackup,
        where('userId', '==', userId),
        where('type', '==', 'pre-migration-backup'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const backupSnapshot = await getDocs(backupQuery);
      
      if (backupSnapshot.empty) {
        throw new Error('No backup found for rollback');
      }
      
      const backupDoc = backupSnapshot.docs[0];
      const backupData = backupDoc.data().backupData;
      
      // Restore localStorage from backup
      Object.entries(backupData).forEach(([key, data]: [string, any]) => {
        localStorage.setItem(key, data.value);
      });
      
      this.migrationStatus.stage = 'rollback';
      console.log('✅ Migration rolled back successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup - stop all real-time subscriptions
   */
  stopRealtimeSync(): void {
    this.realtimeUnsubscribes.forEach(unsubscribe => unsubscribe());
    this.realtimeUnsubscribes = [];
  }

  // Utility methods
  private isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const unifiedMigrationService = UnifiedMigrationService.getInstance(); 