import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, writeBatch, getDocs } from 'firebase/firestore';

// Define all localStorage keys used in the application
const LOCALSTORAGE_KEYS = [
  'userProfile',
  'opinions', 
  'opinionMarketData',
  'transactions',
  'globalActivityFeed',
  'botTransactions',
  'ownedOpinions',
  'advancedBets',
  'shortPositions',
  'autonomousBots',
  'botOpinions',
  'portfolioSnapshots',
  'semanticEmbeddings',
  'otherUsers',
  'activityFeed',
  'opinionAttributions',
  'botsAutoStart',
  'botsInitialized'
];

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedKeys: string[];
  errors: string[];
  totalItemsMigrated: number;
}

export class FirebaseMigrationService {
  private userId: string;
  private batch: any;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Complete migration from localStorage to Firebase
   */
  async migrateAllData(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      message: '',
      migratedKeys: [],
      errors: [],
      totalItemsMigrated: 0
    };

    try {
      console.log('🚀 Starting complete localStorage to Firebase migration...');
      
      // Check if user has localStorage data
      const hasLocalData = this.hasLocalStorageData();
      if (!hasLocalData) {
        return {
          success: true,
          message: 'No localStorage data found to migrate',
          migratedKeys: [],
          errors: [],
          totalItemsMigrated: 0
        };
      }

      // Initialize batch
      this.batch = writeBatch(db);

      // Migrate user profile first (most critical)
      await this.migrateUserProfile(result);

      // Migrate opinions and market data
      await this.migrateOpinions(result);
      await this.migrateMarketData(result);

      // Migrate transactions
      await this.migrateTransactions(result);
      await this.migrateBotTransactions(result);

      // Migrate portfolio data
      await this.migrateOwnedOpinions(result);
      await this.migratePortfolioSnapshots(result);

      // Migrate betting data
      await this.migrateAdvancedBets(result);
      await this.migrateShortPositions(result);

      // Migrate activity feeds
      await this.migrateActivityFeeds(result);

      // Migrate bot data
      await this.migrateAutonomousBots(result);
      await this.migrateBotOpinions(result);

      // Migrate other data
      await this.migrateOtherUsers(result);
      await this.migrateSemanticEmbeddings(result);
      await this.migrateOpinionAttributions(result);
      await this.migrateBotSettings(result);

      // Commit all changes
      await this.batch.commit();

      result.success = true;
      result.message = `Successfully migrated ${result.totalItemsMigrated} items from localStorage to Firebase`;
      
      console.log('✅ Migration completed successfully');
      return result;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.success = false;
      result.message = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Clear localStorage after successful migration
   */
  async clearLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    console.log('🧹 Clearing localStorage after successful migration...');
    
    LOCALSTORAGE_KEYS.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`✅ Cleared localStorage key: ${key}`);
      } catch (error) {
        console.error(`❌ Failed to clear localStorage key ${key}:`, error);
      }
    });
  }

  /**
   * Check if localStorage has any data worth migrating
   */
  private hasLocalStorageData(): boolean {
    if (typeof window === 'undefined') return false;
    
    return LOCALSTORAGE_KEYS.some(key => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return false;
        
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0;
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * Safe localStorage getter
   */
  private getFromLocalStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Migrate user profile
   */
  private async migrateUserProfile(result: MigrationResult): Promise<void> {
    const localProfile: any = this.getFromLocalStorage('userProfile', null);
    if (!localProfile) return;

    try {
      const userDocRef = doc(db, 'users', this.userId);
      const existingDoc = await getDoc(userDocRef);
      
      const profileData = {
        username: localProfile.username || 'User',
        balance: Number(localProfile.balance) || 10000,
        totalEarnings: Number(localProfile.totalEarnings) || 0,
        totalLosses: Number(localProfile.totalLosses) || 0,
        joinDate: localProfile.joinDate || serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(!existingDoc.exists() && { createdAt: serverTimestamp() })
      };

      this.batch.set(userDocRef, profileData, { merge: true });
      
      result.migratedKeys.push('userProfile');
      result.totalItemsMigrated++;
      console.log('✅ User profile prepared for migration');
    } catch (error) {
      console.error('❌ Error migrating user profile:', error);
      result.errors.push(`userProfile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate opinions
   */
  private async migrateOpinions(result: MigrationResult): Promise<void> {
    const localOpinions: string[] = this.getFromLocalStorage('opinions', []);
    if (!localOpinions.length) return;

    try {
      for (const opinion of localOpinions) {
        const opinionId = `opinion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const opinionDocRef = doc(db, 'opinions', opinionId);
        
        const opinionData = {
          text: opinion,
          authorId: this.userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        this.batch.set(opinionDocRef, opinionData);
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('opinions');
      console.log(`✅ ${localOpinions.length} opinions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating opinions:', error);
      result.errors.push(`opinions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate market data
   */
  private async migrateMarketData(result: MigrationResult): Promise<void> {
    const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
    if (!Object.keys(localMarketData).length) return;

    try {
      for (const [opinionText, marketData] of Object.entries(localMarketData)) {
        const marketId = `market_${opinionText.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
        const marketDocRef = doc(db, 'market-data', marketId);
        
        const marketDataObj = {
          opinionText,
          timesPurchased: (marketData as any).timesPurchased || 0,
          timesSold: (marketData as any).timesSold || 0,
          currentPrice: (marketData as any).currentPrice || 10.0,
          basePrice: (marketData as any).basePrice || 10.0,
          updatedAt: serverTimestamp()
        };

        this.batch.set(marketDocRef, marketDataObj, { merge: true });
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('opinionMarketData');
      console.log(`✅ ${Object.keys(localMarketData).length} market data items prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating market data:', error);
      result.errors.push(`opinionMarketData: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate transactions
   */
  private async migrateTransactions(result: MigrationResult): Promise<void> {
    const localTransactions: any[] = this.getFromLocalStorage('transactions', []);
    if (!localTransactions.length) return;

    try {
      for (const transaction of localTransactions) {
        const transactionId = transaction.id || `transaction_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const transactionDocRef = doc(db, 'transactions', transactionId);
        
        const transactionData = {
          userId: this.userId,
          type: transaction.type || 'buy',
          opinionText: transaction.opinionText || 'Unknown Opinion',
          amount: Number(transaction.amount) || 0,
          price: Number(transaction.price) || 10.0,
          quantity: Number(transaction.quantity) || 1,
          timestamp: transaction.timestamp || serverTimestamp(),
          date: transaction.date || new Date().toISOString()
        };

        this.batch.set(transactionDocRef, transactionData);
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('transactions');
      console.log(`✅ ${localTransactions.length} transactions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating transactions:', error);
      result.errors.push(`transactions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate bot transactions
   */
  private async migrateBotTransactions(result: MigrationResult): Promise<void> {
    const localBotTransactions: any[] = this.getFromLocalStorage('botTransactions', []);
    if (!localBotTransactions.length) return;

    try {
      for (const transaction of localBotTransactions) {
        const transactionId = transaction.id || `bot_transaction_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const transactionDocRef = doc(db, 'bot-transactions', transactionId);
        
        const transactionData = {
          userId: this.userId,
          botId: transaction.botId || 'unknown-bot',
          type: transaction.type || 'buy',
          opinionText: transaction.opinionText || 'Unknown Opinion',
          amount: Number(transaction.amount) || 0,
          price: Number(transaction.price) || 10.0,
          quantity: Number(transaction.quantity) || 1,
          timestamp: transaction.timestamp || serverTimestamp(),
          date: transaction.date || new Date().toISOString()
        };

        this.batch.set(transactionDocRef, transactionData);
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('botTransactions');
      console.log(`✅ ${localBotTransactions.length} bot transactions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating bot transactions:', error);
      result.errors.push(`botTransactions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate owned opinions
   */
  private async migrateOwnedOpinions(result: MigrationResult): Promise<void> {
    const localOwnedOpinions = this.getFromLocalStorage('ownedOpinions', []);
    if (!localOwnedOpinions.length) return;

    try {
      const userPortfolioRef = doc(db, 'user-portfolios', this.userId);
      const portfolioData = {
        userId: this.userId,
        ownedOpinions: localOwnedOpinions,
        updatedAt: serverTimestamp()
      };

      this.batch.set(userPortfolioRef, portfolioData, { merge: true });
      
      result.migratedKeys.push('ownedOpinions');
      result.totalItemsMigrated++;
      console.log(`✅ ${localOwnedOpinions.length} owned opinions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating owned opinions:', error);
      result.errors.push(`ownedOpinions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate portfolio snapshots
   */
  private async migratePortfolioSnapshots(result: MigrationResult): Promise<void> {
    const localSnapshots = this.getFromLocalStorage('portfolioSnapshots', []);
    if (!localSnapshots.length) return;

    try {
      const snapshotsRef = doc(db, 'portfolio-snapshots', this.userId);
      const snapshotsData = {
        userId: this.userId,
        snapshots: localSnapshots,
        updatedAt: serverTimestamp()
      };

      this.batch.set(snapshotsRef, snapshotsData, { merge: true });
      
      result.migratedKeys.push('portfolioSnapshots');
      result.totalItemsMigrated++;
      console.log(`✅ ${localSnapshots.length} portfolio snapshots prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating portfolio snapshots:', error);
      result.errors.push(`portfolioSnapshots: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate advanced bets
   */
  private async migrateAdvancedBets(result: MigrationResult): Promise<void> {
    const localBets: any[] = this.getFromLocalStorage('advancedBets', []);
    if (!localBets.length) return;

    try {
      for (const bet of localBets) {
        const betId = bet.id || `bet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const betDocRef = doc(db, 'advanced-bets', betId);
        
        const betData = {
          userId: this.userId,
          targetUser: bet.targetUser || 'unknown',
          betType: bet.betType || 'gain',
          targetPercentage: Number(bet.targetPercentage) || 0,
          betAmount: Number(bet.betAmount) || 0,
          potentialWinnings: Number(bet.potentialWinnings) || 0,
          placedDate: bet.placedDate || serverTimestamp(),
          expiryDate: bet.expiryDate || serverTimestamp(),
          status: bet.status || 'active',
          updatedAt: serverTimestamp()
        };

        this.batch.set(betDocRef, betData);
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('advancedBets');
      console.log(`✅ ${localBets.length} advanced bets prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating advanced bets:', error);
      result.errors.push(`advancedBets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate short positions
   */
  private async migrateShortPositions(result: MigrationResult): Promise<void> {
    const localShorts: any[] = this.getFromLocalStorage('shortPositions', []);
    if (!localShorts.length) return;

    try {
      for (const short of localShorts) {
        const shortId = short.id || `short_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const shortDocRef = doc(db, 'short-positions', shortId);
        
        const shortData = {
          userId: this.userId,
          opinionId: short.opinionId || 'unknown',
          opinionText: short.opinionText || 'Unknown Opinion',
          betAmount: Number(short.betAmount) || 0,
          targetDropPercentage: Number(short.targetDropPercentage) || 0,
          potentialWinnings: Number(short.potentialWinnings) || 0,
          startingPrice: Number(short.startingPrice) || 10.0,
          targetPrice: Number(short.targetPrice) || 5.0,
          createdDate: short.createdDate || serverTimestamp(),
          expirationDate: short.expirationDate || serverTimestamp(),
          status: short.status || 'active',
          updatedAt: serverTimestamp()
        };

        this.batch.set(shortDocRef, shortData);
        result.totalItemsMigrated++;
      }
      
      result.migratedKeys.push('shortPositions');
      console.log(`✅ ${localShorts.length} short positions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating short positions:', error);
      result.errors.push(`shortPositions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate activity feeds
   */
  private async migrateActivityFeeds(result: MigrationResult): Promise<void> {
    const globalFeed = this.getFromLocalStorage('globalActivityFeed', []);
    const userFeed = this.getFromLocalStorage('activityFeed', []);
    
    if (globalFeed.length) {
      try {
        const globalFeedRef = doc(db, 'global-activity-feed', 'global');
        const globalFeedData = {
          activities: globalFeed,
          updatedAt: serverTimestamp()
        };

        this.batch.set(globalFeedRef, globalFeedData, { merge: true });
        result.migratedKeys.push('globalActivityFeed');
        result.totalItemsMigrated++;
      } catch (error) {
        result.errors.push(`globalActivityFeed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (userFeed.length) {
      try {
        const userFeedRef = doc(db, 'user-activity-feeds', this.userId);
        const userFeedData = {
          userId: this.userId,
          activities: userFeed,
          updatedAt: serverTimestamp()
        };

        this.batch.set(userFeedRef, userFeedData, { merge: true });
        result.migratedKeys.push('activityFeed');
        result.totalItemsMigrated++;
      } catch (error) {
        result.errors.push(`activityFeed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Migrate autonomous bots
   */
  private async migrateAutonomousBots(result: MigrationResult): Promise<void> {
    const localBots = this.getFromLocalStorage('autonomousBots', []);
    if (!localBots.length) return;

    try {
      const botsRef = doc(db, 'autonomous-bots', this.userId);
      const botsData = {
        userId: this.userId,
        bots: localBots,
        updatedAt: serverTimestamp()
      };

      this.batch.set(botsRef, botsData, { merge: true });
      
      result.migratedKeys.push('autonomousBots');
      result.totalItemsMigrated++;
      console.log(`✅ ${localBots.length} autonomous bots prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating autonomous bots:', error);
      result.errors.push(`autonomousBots: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate bot opinions
   */
  private async migrateBotOpinions(result: MigrationResult): Promise<void> {
    const localBotOpinions = this.getFromLocalStorage('botOpinions', {});
    if (!Object.keys(localBotOpinions).length) return;

    try {
      const botOpinionsRef = doc(db, 'bot-opinions', this.userId);
      const botOpinionsData = {
        userId: this.userId,
        opinions: localBotOpinions,
        updatedAt: serverTimestamp()
      };

      this.batch.set(botOpinionsRef, botOpinionsData, { merge: true });
      
      result.migratedKeys.push('botOpinions');
      result.totalItemsMigrated++;
      console.log(`✅ Bot opinions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating bot opinions:', error);
      result.errors.push(`botOpinions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate other users
   */
  private async migrateOtherUsers(result: MigrationResult): Promise<void> {
    const localOtherUsers = this.getFromLocalStorage('otherUsers', []);
    if (!localOtherUsers.length) return;

    try {
      const otherUsersRef = doc(db, 'other-users', this.userId);
      const otherUsersData = {
        userId: this.userId,
        users: localOtherUsers,
        updatedAt: serverTimestamp()
      };

      this.batch.set(otherUsersRef, otherUsersData, { merge: true });
      
      result.migratedKeys.push('otherUsers');
      result.totalItemsMigrated++;
      console.log(`✅ ${localOtherUsers.length} other users prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating other users:', error);
      result.errors.push(`otherUsers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate semantic embeddings
   */
  private async migrateSemanticEmbeddings(result: MigrationResult): Promise<void> {
    const localEmbeddings = this.getFromLocalStorage('semanticEmbeddings', []);
    if (!localEmbeddings.length) return;

    try {
      const embeddingsRef = doc(db, 'semantic-embeddings', this.userId);
      const embeddingsData = {
        userId: this.userId,
        embeddings: localEmbeddings,
        updatedAt: serverTimestamp()
      };

      this.batch.set(embeddingsRef, embeddingsData, { merge: true });
      
      result.migratedKeys.push('semanticEmbeddings');
      result.totalItemsMigrated++;
      console.log(`✅ ${localEmbeddings.length} semantic embeddings prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating semantic embeddings:', error);
      result.errors.push(`semanticEmbeddings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate opinion attributions
   */
  private async migrateOpinionAttributions(result: MigrationResult): Promise<void> {
    const localAttributions = this.getFromLocalStorage('opinionAttributions', {});
    if (!Object.keys(localAttributions).length) return;

    try {
      const attributionsRef = doc(db, 'opinion-attributions', this.userId);
      const attributionsData = {
        userId: this.userId,
        attributions: localAttributions,
        updatedAt: serverTimestamp()
      };

      this.batch.set(attributionsRef, attributionsData, { merge: true });
      
      result.migratedKeys.push('opinionAttributions');
      result.totalItemsMigrated++;
      console.log(`✅ Opinion attributions prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating opinion attributions:', error);
      result.errors.push(`opinionAttributions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate bot settings
   */
  private async migrateBotSettings(result: MigrationResult): Promise<void> {
    const botsAutoStart = this.getFromLocalStorage('botsAutoStart', 'false');
    const botsInitialized = this.getFromLocalStorage('botsInitialized', 'false');

    try {
      const settingsRef = doc(db, 'user-settings', this.userId);
      const settingsData = {
        userId: this.userId,
        botsAutoStart: String(botsAutoStart) === 'true',
        botsInitialized: String(botsInitialized) === 'true',
        updatedAt: serverTimestamp()
      };

      this.batch.set(settingsRef, settingsData, { merge: true });
      
      result.migratedKeys.push('botsAutoStart', 'botsInitialized');
      result.totalItemsMigrated++;
      console.log(`✅ Bot settings prepared for migration`);
    } catch (error) {
      console.error('❌ Error migrating bot settings:', error);
      result.errors.push(`botSettings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Utility function to run migration for current user
 */
export async function runMigration(userId: string): Promise<MigrationResult> {
  const migrationService = new FirebaseMigrationService(userId);
  const result = await migrationService.migrateAllData();
  
  if (result.success) {
    // Clear localStorage after successful migration
    await migrationService.clearLocalStorage();
  }
  
  return result;
} 