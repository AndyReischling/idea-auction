'use client';

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc,
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { firebaseActivityService } from './firebase-activity';

interface MigrationStatus {
  id: string;
  userId: string;
  dataType: 'activities' | 'profiles' | 'market-data' | 'portfolios' | 'bots' | 'bets' | 'embeddings';
  itemCount: number;
  migratedCount: number;
  lastMigration: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  checksum: string;
  conflicts: string[];
}

interface ConflictResolution {
  strategy: 'firebase_wins' | 'localStorage_wins' | 'merge' | 'manual';
  resolvedAt: string;
  resolvedBy: string;
}

export class DataReconciliationService {
  private static instance: DataReconciliationService;
  private migrationCollection = collection(db, 'migration_status');
  private conflictsCollection = collection(db, 'data_conflicts');

  public static getInstance(): DataReconciliationService {
    if (!DataReconciliationService.instance) {
      DataReconciliationService.instance = new DataReconciliationService();
    }
    return DataReconciliationService.instance;
  }

  // Check what data has been migrated for a user
  async getMigrationStatus(userId: string): Promise<MigrationStatus[]> {
    try {
      const q = query(
        this.migrationCollection,
        where('userId', '==', userId),
        orderBy('lastMigration', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const statuses: MigrationStatus[] = [];
      
      querySnapshot.forEach((doc) => {
        statuses.push({ id: doc.id, ...doc.data() } as MigrationStatus);
      });
      
      return statuses;
    } catch (error) {
      console.error('Error getting migration status:', error);
      return [];
    }
  }

  // Generate checksum for data to detect changes
  private generateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  // Safe localStorage helper
  private safeGetFromStorage(key: string, defaultValue: any = null): any {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }

  // Update migration status
  private async updateMigrationStatus(
    userId: string,
    dataType: MigrationStatus['dataType'],
    itemCount: number,
    migratedCount: number,
    status: MigrationStatus['status'],
    checksum: string,
    conflicts: string[] = []
  ): Promise<void> {
    const statusDoc = {
      userId,
      dataType,
      itemCount,
      migratedCount,
      lastMigration: new Date().toISOString(),
      status,
      checksum,
      conflicts,
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(this.migrationCollection, `${userId}_${dataType}`),
      statusDoc,
      { merge: true }
    );
  }

  // Reconcile activity feed data
  async reconcileActivities(userId: string): Promise<{
    migrated: number;
    skipped: number;
    conflicts: string[];
  }> {
    console.log('🔄 Starting activity reconciliation...');
    
    const conflicts: string[] = [];
    let migrated = 0;
    let skipped = 0;

    try {
      // Get current migration status
      const currentStatus = await this.getMigrationStatus(userId);
      const activityStatus = currentStatus.find(s => s.dataType === 'activities');
      
      // Get localStorage activities
      const localActivities = this.safeGetFromStorage('globalActivityFeed', []);
      const localChecksum = this.generateChecksum(localActivities);
      
      // Check if data has changed since last migration
      if (activityStatus && activityStatus.checksum === localChecksum) {
        console.log('📊 Activity data unchanged, skipping migration');
        return { migrated: 0, skipped: localActivities.length, conflicts: [] };
      }

      // Get Firebase activities to check for conflicts
      const firebaseActivities = await firebaseActivityService.getRecentActivities(500);
      const firebaseActivityIds = new Set(firebaseActivities.map(a => a.id));

      // Process each local activity
      for (const activity of localActivities) {
        try {
          // Check if already exists in Firebase
          if (firebaseActivityIds.has(activity.id)) {
            skipped++;
            continue;
          }

          // Check for potential conflicts (same user, type, amount, similar time)
          const potentialConflict = firebaseActivities.find(fa => 
            fa.username === activity.username &&
            fa.type === activity.type &&
            Math.abs(fa.amount - activity.amount) < 0.01 &&
            Math.abs(new Date(fa.timestamp).getTime() - new Date(activity.timestamp).getTime()) < 30000
          );

          if (potentialConflict) {
            conflicts.push(`Activity conflict: ${activity.username} ${activity.type} ${activity.amount}`);
            // For now, skip conflicts - could implement resolution logic here
            skipped++;
            continue;
          }

          // Migrate to Firebase
          await firebaseActivityService.addActivity({
            type: activity.type,
            username: activity.username,
            userId: activity.username === userId ? userId : undefined,
            opinionText: activity.opinionText,
            opinionId: activity.opinionId,
            amount: activity.amount,
            price: activity.price,
            quantity: activity.quantity,
            targetUser: activity.targetUser,
            betType: activity.betType,
            targetPercentage: activity.targetPercentage,
            timeframe: activity.timeframe,
            isBot: activity.isBot,
            metadata: {
              source: 'reconciliation',
              originalTimestamp: activity.timestamp,
              migrationDate: new Date().toISOString()
            }
          });

          migrated++;
        } catch (error) {
          console.error('Error migrating activity:', error);
          conflicts.push(`Migration error: ${activity.id}`);
        }
      }

      // Update migration status
      await this.updateMigrationStatus(
        userId,
        'activities',
        localActivities.length,
        migrated,
        conflicts.length > 0 ? 'failed' : 'completed',
        localChecksum,
        conflicts
      );

      console.log(`✅ Activity reconciliation complete: ${migrated} migrated, ${skipped} skipped, ${conflicts.length} conflicts`);
      return { migrated, skipped, conflicts };

    } catch (error) {
      console.error('❌ Activity reconciliation failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateMigrationStatus(userId, 'activities', 0, 0, 'failed', '', [errorMessage]);
      throw error;
    }
  }

  // Reconcile user profile data
  async reconcileUserProfile(userId: string): Promise<{
    updated: boolean;
    conflicts: string[];
  }> {
    console.log('🔄 Starting user profile reconciliation...');
    
    const conflicts: string[] = [];

    try {
      // Get localStorage profile
      const localProfile = this.safeGetFromStorage('userProfile', null);
      if (!localProfile) {
        return { updated: false, conflicts: ['No local profile found'] };
      }

      // Get Firebase profile
      const firebaseProfileDoc = await getDoc(doc(db, 'users', userId));
      const firebaseProfile = firebaseProfileDoc.exists() ? firebaseProfileDoc.data() : null;

      if (!firebaseProfile) {
        // No Firebase profile, create one
        const newProfile = {
          ...localProfile,
          uid: userId,
          // Ensure numeric values are properly formatted
          balance: Number(localProfile.balance) || 10000,
          totalEarnings: Number(localProfile.totalEarnings) || 0,
          totalLosses: Number(localProfile.totalLosses) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'users', userId), newProfile);
        console.log('✅ Created new Firebase profile from localStorage');
        return { updated: true, conflicts: [] };
      }

      // Compare profiles and resolve conflicts - localStorage ALWAYS wins for financial data
      const updates: any = {};
      
      // Balance: localStorage ALWAYS wins (most recent transaction data)
      const localBalance = Number(localProfile.balance) || 10000;
      const firebaseBalance = Number(firebaseProfile.balance) || 10000;
      
      if (localBalance !== firebaseBalance) {
        conflicts.push(`Balance mismatch: local=${localBalance}, firebase=${firebaseBalance} - localStorage wins`);
        updates.balance = localBalance;
        console.log(`🔄 Syncing balance: Firebase ${firebaseBalance} → localStorage ${localBalance}`);
      }

      // Earnings and losses: localStorage ALWAYS wins (most recent transaction data)
      const localEarnings = Number(localProfile.totalEarnings) || 0;
      const firebaseEarnings = Number(firebaseProfile.totalEarnings) || 0;
      
      if (localEarnings !== firebaseEarnings) {
        conflicts.push(`Earnings mismatch: local=${localEarnings}, firebase=${firebaseEarnings} - localStorage wins`);
        updates.totalEarnings = localEarnings;
        console.log(`🔄 Syncing earnings: Firebase ${firebaseEarnings} → localStorage ${localEarnings}`);
      }
      
      const localLosses = Number(localProfile.totalLosses) || 0;
      const firebaseLosses = Number(firebaseProfile.totalLosses) || 0;
      
      if (localLosses !== firebaseLosses) {
        conflicts.push(`Losses mismatch: local=${localLosses}, firebase=${firebaseLosses} - localStorage wins`);
        updates.totalLosses = localLosses;
        console.log(`🔄 Syncing losses: Firebase ${firebaseLosses} → localStorage ${localLosses}`);
      }

      // Username: Keep Firebase version if different (username changes should come from Firebase)
      if (localProfile.username !== firebaseProfile.username) {
        conflicts.push(`Username mismatch: local=${localProfile.username}, firebase=${firebaseProfile.username} - Firebase wins`);
        // Update localStorage with Firebase username
        const updatedLocalProfile = {
          ...localProfile,
          username: firebaseProfile.username
        };
        this.safeSetToStorage('userProfile', updatedLocalProfile);
        console.log(`🔄 Syncing username: localStorage ${localProfile.username} → Firebase ${firebaseProfile.username}`);
      }

      // Update Firebase if there are changes
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', userId), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Firebase profile updated with localStorage financial data');
        
        await this.updateMigrationStatus(
          userId,
          'profiles',
          1,
          1,
          'completed',
          this.generateChecksum(localProfile),
          conflicts
        );
        
        return { updated: true, conflicts };
      }

      return { updated: false, conflicts };
    } catch (error) {
      console.error('❌ User profile reconciliation failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateMigrationStatus(userId, 'profiles', 0, 0, 'failed', '', [errorMessage]);
      throw error;
    }
  }

  // Reconcile market data
  async reconcileMarketData(userId: string): Promise<{
    migrated: number;
    conflicts: string[];
  }> {
    console.log('🔄 Starting market data reconciliation...');
    
    const conflicts: string[] = [];
    let migrated = 0;

    try {
      // Get localStorage market data
      const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
      const opinions = Object.keys(localMarketData);
      
      if (opinions.length === 0) {
        return { migrated: 0, conflicts: ['No market data found'] };
      }

      // For each opinion, sync market data to Firebase
      for (const opinionText of opinions) {
        const marketData = localMarketData[opinionText];
        
        try {
          // Create or update market data document
          const marketDocRef = doc(db, 'market-data', btoa(opinionText).replace(/[^a-zA-Z0-9]/g, ''));
          
          // Ensure all required fields have valid values
          const sanitizedMarketData = {
            opinionText: String(opinionText || ''),
            timesPurchased: Number(marketData.timesPurchased) || 0,
            timesSold: Number(marketData.timesSold) || 0,
            currentPrice: Number(marketData.currentPrice) || 10.00,
            basePrice: Number(marketData.basePrice) || 10.00,
            lastUpdated: serverTimestamp(),
            updatedBy: String(userId || 'unknown'),
            // Additional fields to prevent Firebase errors
            liquidityScore: Number(marketData.liquidityScore) || 0,
            dailyVolume: Number(marketData.dailyVolume) || 0
          };

          await setDoc(marketDocRef, sanitizedMarketData, { merge: true });

          migrated++;
        } catch (error) {
          console.error(`Error migrating market data for opinion: ${opinionText}`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          conflicts.push(`Market data error: ${opinionText} - ${errorMessage}`);
        }
      }

      await this.updateMigrationStatus(
        userId,
        'market-data',
        opinions.length,
        migrated,
        conflicts.length > 0 ? 'failed' : 'completed',
        this.generateChecksum(localMarketData),
        conflicts
      );

      console.log(`✅ Market data reconciliation complete: ${migrated} opinions migrated, ${conflicts.length} conflicts`);
      return { migrated, conflicts };

          } catch (error) {
        console.error('❌ Market data reconciliation failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.updateMigrationStatus(userId, 'market-data', 0, 0, 'failed', '', [errorMessage]);
        throw error;
    }
  }

  // Complete reconciliation of all data types
  async completeReconciliation(userId: string): Promise<{
    activities: { migrated: number; skipped: number; conflicts: string[] };
    profile: { updated: boolean; conflicts: string[] };
    marketData: { migrated: number; conflicts: string[] };
  }> {
    console.log('🔄 Starting complete data reconciliation...');
    
    const results = {
      activities: { migrated: 0, skipped: 0, conflicts: [] as string[] },
      profile: { updated: false, conflicts: [] as string[] },
      marketData: { migrated: 0, conflicts: [] as string[] }
    };

    try {
      // Reconcile activities
      results.activities = await this.reconcileActivities(userId);
      
      // Reconcile user profile
      results.profile = await this.reconcileUserProfile(userId);
      
      // Reconcile market data
      results.marketData = await this.reconcileMarketData(userId);

      console.log('✅ Complete reconciliation finished:', results);
      return results;

    } catch (error) {
      console.error('❌ Complete reconciliation failed:', error);
      throw error;
    }
  }

  // Get reconciliation summary for user
  async getReconciliationSummary(userId: string): Promise<{
    lastReconciliation: string | null;
    dataTypes: MigrationStatus[];
    totalConflicts: number;
    needsReconciliation: boolean;
  }> {
    const statuses = await this.getMigrationStatus(userId);
    const totalConflicts = statuses.reduce((total, status) => total + status.conflicts.length, 0);
    const needsReconciliation = statuses.some(status => 
      status.status === 'failed' || status.status === 'pending'
    );
    
    const lastReconciliation = statuses.length > 0 
      ? statuses[0].lastMigration 
      : null;

    return {
      lastReconciliation,
      dataTypes: statuses,
      totalConflicts,
      needsReconciliation
    };
  }

  // Clean up localStorage data after successful migration
  async cleanupLocalStorageAfterMigration(userId: string): Promise<{
    cleaned: string[];
    kept: string[];
    errors: string[];
  }> {
    console.log('🧹 Starting localStorage cleanup after migration...');
    
    const cleaned: string[] = [];
    const kept: string[] = [];
    const errors: string[] = [];

    try {
      // Get migration status to check what can be safely cleaned
      const statuses = await this.getMigrationStatus(userId);
      const completedMigrations = statuses.filter(status => status.status === 'completed');
      
      // Define what localStorage keys correspond to each data type
      const dataTypeKeys: { [key: string]: string[] } = {
        'activities': ['globalActivityFeed', 'botTransactions', 'transactions'],
        'market-data': ['opinionMarketData'],
        'profiles': [], // Don't clean userProfile as it's needed for backward compatibility
        'portfolios': ['ownedOpinions'],
        'bots': ['autonomousBots'],
        'bets': ['advancedBets'],
        'embeddings': ['semanticEmbeddings']
      };

      // Clean up data for completed migrations
      for (const status of completedMigrations) {
        const keysToClean = dataTypeKeys[status.dataType] || [];
        
        for (const key of keysToClean) {
          try {
            // Create backup before deletion
            const data = this.safeGetFromStorage(key, null);
            if (data) {
              // Store backup in a special backup key
              const backupKey = `backup_${key}_${Date.now()}`;
              this.safeSetToStorage(backupKey, {
                originalKey: key,
                data: data,
                migratedAt: status.lastMigration,
                backupCreatedAt: new Date().toISOString()
              });
              
              // Remove original data
              if (typeof window !== 'undefined') {
                localStorage.removeItem(key);
              }
              
              cleaned.push(key);
              console.log(`✅ Cleaned up ${key} (backup created as ${backupKey})`);
            } else {
              kept.push(key + ' (no data)');
            }
          } catch (error) {
            errors.push(`Error cleaning ${key}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Don't clean these keys - they're needed for backward compatibility
      const keepKeys = ['userProfile', 'opinions', 'portfolioSnapshots'];
      kept.push(...keepKeys);

      console.log(`🧹 Cleanup complete: ${cleaned.length} cleaned, ${kept.length} kept, ${errors.length} errors`);
      return { cleaned, kept, errors };

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      return { cleaned, kept, errors };
    }
  }

  // Restore localStorage from backup
  async restoreFromBackup(backupKey: string): Promise<boolean> {
    try {
      const backupData = this.safeGetFromStorage(backupKey, null);
      if (!backupData || !backupData.originalKey || !backupData.data) {
        console.error('❌ Invalid backup data');
        return false;
      }

      // Restore original data
      this.safeSetToStorage(backupData.originalKey, backupData.data);
      
      // Remove backup
      if (typeof window !== 'undefined') {
        localStorage.removeItem(backupKey);
      }

      console.log(`✅ Restored ${backupData.originalKey} from backup`);
      return true;
    } catch (error) {
      console.error('❌ Restore failed:', error);
      return false;
    }
  }

  // List available backups
  listBackups(): Array<{
    backupKey: string;
    originalKey: string;
    migratedAt: string;
    backupCreatedAt: string;
  }> {
    if (typeof window === 'undefined') return [];
    
    const backups: Array<{
      backupKey: string;
      originalKey: string;
      migratedAt: string;
      backupCreatedAt: string;
    }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('backup_')) {
        try {
          const backupData = this.safeGetFromStorage(key, null);
          if (backupData && backupData.originalKey) {
            backups.push({
              backupKey: key,
              originalKey: backupData.originalKey,
              migratedAt: backupData.migratedAt,
              backupCreatedAt: backupData.backupCreatedAt
            });
          }
        } catch (error) {
          console.error(`Error reading backup ${key}:`, error);
        }
      }
    }

    return backups.sort((a, b) => 
      new Date(b.backupCreatedAt).getTime() - new Date(a.backupCreatedAt).getTime()
    );
  }

  // Safe cleanup with user confirmation
  async safeCleanupWithConfirmation(userId: string): Promise<{
    cleaned: string[];
    kept: string[];
    errors: string[];
  }> {
    console.log('🔍 Checking if cleanup is safe...');
    
    // Check migration status first
    const summary = await this.getReconciliationSummary(userId);
    
    if (summary.needsReconciliation) {
      console.warn('⚠️ Cleanup not recommended - reconciliation needed');
      return {
        cleaned: [],
        kept: [],
        errors: ['Cleanup not safe - reconciliation needed first']
      };
    }

    if (summary.totalConflicts > 0) {
      console.warn('⚠️ Cleanup not recommended - conflicts detected');
      return {
        cleaned: [],
        kept: [],
        errors: ['Cleanup not safe - conflicts detected']
      };
    }

    // All checks passed, proceed with cleanup
    console.log('✅ Cleanup is safe to proceed');
    return await this.cleanupLocalStorageAfterMigration(userId);
  }
}

// Export singleton instance
export const dataReconciliationService = DataReconciliationService.getInstance(); 