'use client';

import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  writeBatch,
  serverTimestamp,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from 'firebase/auth';

interface LocalStorageItem {
  key: string;
  value: string;
  parsedValue: any;
  isJSON: boolean;
  size: number;
  extractedAt: string;
}

interface SyncResult {
  success: boolean;
  dataType: string;
  itemsProcessed: number;
  errors: string[];
  collectionUsed: string;
}

interface SyncProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

export class LocalStorageToFirebaseService {
  private static instance: LocalStorageToFirebaseService;
  private currentUser: User | null = null;
  private syncProgress: SyncProgress = {
    total: 0,
    completed: 0,
    current: '',
    errors: []
  };

  // Data type mappings to Firebase collections
  private readonly dataTypeMapping = {
    'userProfile': 'users',
    'opinions': 'opinions',
    'transactions': 'transactions',
    'globalActivityFeed': 'activity-feed',
    'opinionMarketData': 'market-data',
    'portfolioData': 'user-portfolios',
    'autonomousBots': 'bots',
    'advancedBets': 'advanced-bets',
    'shortPositions': 'short-positions',
    'embeddings': 'embeddings',
    'portfolioSnapshots': 'portfolio-snapshots',
    'botTransactions': 'bot-transactions',
    'priceHistory': 'price-history',
    'userPreferences': 'user-preferences'
  };

  private constructor() {
    this.setupAuthListener();
  }

  public static getInstance(): LocalStorageToFirebaseService {
    if (!LocalStorageToFirebaseService.instance) {
      LocalStorageToFirebaseService.instance = new LocalStorageToFirebaseService();
    }
    return LocalStorageToFirebaseService.instance;
  }

  private setupAuthListener(): void {
    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
    });
  }

  /**
   * Main function to push all localStorage data to Firebase
   */
  public async pushAllLocalStorageToFirebase(
    onProgress?: (progress: SyncProgress) => void,
    onComplete?: (results: SyncResult[]) => void
  ): Promise<SyncResult[]> {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to sync data');
    }

    console.log('🚀 Starting localStorage to Firebase sync...');
    
    // Extract all localStorage data
    const localStorageData = this.extractAllLocalStorageData();
    
    // Reset progress
    this.syncProgress = {
      total: localStorageData.length,
      completed: 0,
      current: 'Starting sync...',
      errors: []
    };

    const results: SyncResult[] = [];

    // Process each localStorage item
    for (const item of localStorageData) {
      this.syncProgress.current = `Processing ${item.key}...`;
      onProgress?.(this.syncProgress);

      try {
        const result = await this.processLocalStorageItem(item);
        results.push(result);
        
        if (result.success) {
          console.log(`✅ Successfully synced ${item.key} to ${result.collectionUsed}`);
        } else {
          console.error(`❌ Failed to sync ${item.key}:`, result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing ${item.key}:`, errorMessage);
        
        results.push({
          success: false,
          dataType: item.key,
          itemsProcessed: 0,
          errors: [errorMessage],
          collectionUsed: 'none'
        });
      }

      this.syncProgress.completed++;
      onProgress?.(this.syncProgress);
    }

    // Final backup of all data
    await this.createFullBackup(localStorageData);

    console.log('🎉 localStorage to Firebase sync completed!');
    console.log(`📊 Results: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);
    
    onComplete?.(results);
    return results;
  }

  /**
   * Extract all localStorage data
   */
  private extractAllLocalStorageData(): LocalStorageItem[] {
    const items: LocalStorageItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          let parsedValue;
          let isJSON = false;
          
          try {
            parsedValue = JSON.parse(value);
            isJSON = true;
          } catch {
            parsedValue = value;
            isJSON = false;
          }
          
          items.push({
            key,
            value,
            parsedValue,
            isJSON,
            size: new Blob([value]).size,
            extractedAt: new Date().toISOString()
          });
        }
      }
    }
    
    console.log(`📦 Extracted ${items.length} localStorage items`);
    return items;
  }

  /**
   * Process a single localStorage item
   */
  private async processLocalStorageItem(item: LocalStorageItem): Promise<SyncResult> {
    const dataType = this.identifyDataType(item.key);
    const collectionName = this.getCollectionName(dataType);
    
    try {
      if (dataType === 'userProfile') {
        return await this.syncUserProfile(item);
      } else if (dataType === 'opinions') {
        return await this.syncOpinions(item);
      } else if (dataType === 'transactions') {
        return await this.syncTransactions(item);
      } else if (dataType === 'globalActivityFeed') {
        return await this.syncActivityFeed(item);
      } else if (dataType === 'opinionMarketData') {
        return await this.syncMarketData(item);
      } else if (dataType === 'portfolioData') {
        return await this.syncPortfolio(item);
      } else if (dataType === 'autonomousBots') {
        return await this.syncBots(item);
      } else if (dataType === 'advancedBets') {
        return await this.syncAdvancedBets(item);
      } else if (dataType === 'shortPositions') {
        return await this.syncShortPositions(item);
      } else {
        // Generic sync for other data types
        return await this.syncGenericData(item, collectionName);
      }
    } catch (error) {
      return {
        success: false,
        dataType,
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: collectionName
      };
    }
  }

  /**
   * Sync user profile data
   */
  private async syncUserProfile(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !this.currentUser) {
      return {
        success: false,
        dataType: 'userProfile',
        itemsProcessed: 0,
        errors: ['Invalid profile data or no user authenticated'],
        collectionUsed: 'users'
      };
    }

    try {
      const profileData = {
        ...item.parsedValue,
        syncedFromLocalStorage: true,
        lastSyncedAt: serverTimestamp(),
        localStorageBackup: item.parsedValue
      };

      await setDoc(doc(db, 'users', this.currentUser.uid), profileData, { merge: true });
      
      return {
        success: true,
        dataType: 'userProfile',
        itemsProcessed: 1,
        errors: [],
        collectionUsed: 'users'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'userProfile',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'users'
      };
    }
  }

  /**
   * Sync opinions data
   */
  private async syncOpinions(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'opinions',
        itemsProcessed: 0,
        errors: ['Invalid opinions data format'],
        collectionUsed: 'opinions'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const opinion of item.parsedValue) {
        if (typeof opinion === 'string' && opinion.trim().length > 0) {
          const opinionDoc = doc(collection(db, 'opinions'));
          batch.set(opinionDoc, {
            text: opinion,
            userId: this.currentUser?.uid,
            createdAt: serverTimestamp(),
            syncedFromLocalStorage: true,
            originalIndex: processed
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'opinions',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'opinions'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'opinions',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'opinions'
      };
    }
  }

  /**
   * Sync transactions data
   */
  private async syncTransactions(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'transactions',
        itemsProcessed: 0,
        errors: ['Invalid transactions data format'],
        collectionUsed: 'transactions'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const transaction of item.parsedValue) {
        if (transaction && typeof transaction === 'object') {
          const transactionDoc = doc(collection(db, 'transactions'));
          batch.set(transactionDoc, {
            ...transaction,
            userId: this.currentUser?.uid,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp()
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'transactions',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'transactions'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'transactions',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'transactions'
      };
    }
  }

  /**
   * Sync activity feed data
   */
  private async syncActivityFeed(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'globalActivityFeed',
        itemsProcessed: 0,
        errors: ['Invalid activity feed data format'],
        collectionUsed: 'activity-feed'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const activity of item.parsedValue) {
        if (activity && typeof activity === 'object') {
          const activityDoc = doc(collection(db, 'activity-feed'));
          batch.set(activityDoc, {
            ...activity,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp(),
            timestamp: activity.timestamp || serverTimestamp()
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'globalActivityFeed',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'activity-feed'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'globalActivityFeed',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'activity-feed'
      };
    }
  }

  /**
   * Sync market data
   */
  private async syncMarketData(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || typeof item.parsedValue !== 'object') {
      return {
        success: false,
        dataType: 'opinionMarketData',
        itemsProcessed: 0,
        errors: ['Invalid market data format'],
        collectionUsed: 'market-data'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const [opinionText, marketData] of Object.entries(item.parsedValue)) {
        if (marketData && typeof marketData === 'object') {
          const marketDoc = doc(collection(db, 'market-data'));
          batch.set(marketDoc, {
            opinionText,
            ...marketData,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp()
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'opinionMarketData',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'market-data'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'opinionMarketData',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'market-data'
      };
    }
  }

  /**
   * Sync portfolio data
   */
  private async syncPortfolio(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !this.currentUser) {
      return {
        success: false,
        dataType: 'portfolioData',
        itemsProcessed: 0,
        errors: ['Invalid portfolio data or no user authenticated'],
        collectionUsed: 'user-portfolios'
      };
    }

    try {
      const portfolioData = {
        ...item.parsedValue,
        userId: this.currentUser.uid,
        syncedFromLocalStorage: true,
        syncedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'user-portfolios', this.currentUser.uid), portfolioData, { merge: true });
      
      return {
        success: true,
        dataType: 'portfolioData',
        itemsProcessed: 1,
        errors: [],
        collectionUsed: 'user-portfolios'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'portfolioData',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'user-portfolios'
      };
    }
  }

  /**
   * Sync bots data
   */
  private async syncBots(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'autonomousBots',
        itemsProcessed: 0,
        errors: ['Invalid bots data format'],
        collectionUsed: 'bots'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const bot of item.parsedValue) {
        if (bot && typeof bot === 'object' && bot.id) {
          const botDoc = doc(db, 'bots', bot.id);
          batch.set(botDoc, {
            ...bot,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp()
          }, { merge: true });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'autonomousBots',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'bots'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'autonomousBots',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'bots'
      };
    }
  }

  /**
   * Sync advanced bets data
   */
  private async syncAdvancedBets(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'advancedBets',
        itemsProcessed: 0,
        errors: ['Invalid advanced bets data format'],
        collectionUsed: 'advanced-bets'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const bet of item.parsedValue) {
        if (bet && typeof bet === 'object') {
          const betDoc = doc(collection(db, 'advanced-bets'));
          batch.set(betDoc, {
            ...bet,
            userId: this.currentUser?.uid,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp()
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'advancedBets',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'advanced-bets'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'advancedBets',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'advanced-bets'
      };
    }
  }

  /**
   * Sync short positions data
   */
  private async syncShortPositions(item: LocalStorageItem): Promise<SyncResult> {
    if (!item.isJSON || !Array.isArray(item.parsedValue)) {
      return {
        success: false,
        dataType: 'shortPositions',
        itemsProcessed: 0,
        errors: ['Invalid short positions data format'],
        collectionUsed: 'short-positions'
      };
    }

    try {
      const batch = writeBatch(db);
      let processed = 0;

      for (const position of item.parsedValue) {
        if (position && typeof position === 'object') {
          const positionDoc = doc(collection(db, 'short-positions'));
          batch.set(positionDoc, {
            ...position,
            userId: this.currentUser?.uid,
            syncedFromLocalStorage: true,
            syncedAt: serverTimestamp()
          });
          processed++;
        }
      }

      await batch.commit();
      
      return {
        success: true,
        dataType: 'shortPositions',
        itemsProcessed: processed,
        errors: [],
        collectionUsed: 'short-positions'
      };
    } catch (error) {
      return {
        success: false,
        dataType: 'shortPositions',
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: 'short-positions'
      };
    }
  }

  /**
   * Generic sync for other data types
   */
  private async syncGenericData(item: LocalStorageItem, collectionName: string): Promise<SyncResult> {
    try {
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        key: item.key,
        value: item.value,
        parsedValue: item.parsedValue,
        isJSON: item.isJSON,
        size: item.size,
        userId: this.currentUser?.uid,
        syncedFromLocalStorage: true,
        syncedAt: serverTimestamp(),
        extractedAt: item.extractedAt
      });
      
      return {
        success: true,
        dataType: item.key,
        itemsProcessed: 1,
        errors: [],
        collectionUsed: collectionName
      };
    } catch (error) {
      return {
        success: false,
        dataType: item.key,
        itemsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        collectionUsed: collectionName
      };
    }
  }

  /**
   * Create a complete backup of all localStorage data
   */
  private async createFullBackup(items: LocalStorageItem[]): Promise<void> {
    if (!this.currentUser) return;

    try {
      const backupDoc = doc(collection(db, 'localStorage_backup'));
      await setDoc(backupDoc, {
        userId: this.currentUser.uid,
        userEmail: this.currentUser.email,
        totalItems: items.length,
        totalSize: items.reduce((sum, item) => sum + item.size, 0),
        items: items,
        createdAt: serverTimestamp(),
        syncMethod: 'comprehensive_sync'
      });
      
      console.log('💾 Full localStorage backup created successfully');
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
    }
  }

  /**
   * Identify data type from localStorage key
   */
  private identifyDataType(key: string): string {
    const keyMappings = {
      'userProfile': 'userProfile',
      'opinions': 'opinions',
      'transactions': 'transactions',
      'globalActivityFeed': 'globalActivityFeed',
      'opinionMarketData': 'opinionMarketData',
      'portfolioData': 'portfolioData',
      'autonomousBots': 'autonomousBots',
      'advancedBets': 'advancedBets',
      'shortPositions': 'shortPositions',
      'embeddings': 'embeddings',
      'portfolioSnapshots': 'portfolioSnapshots',
      'botTransactions': 'botTransactions',
      'priceHistory': 'priceHistory',
      'userPreferences': 'userPreferences'
    };

    return keyMappings[key] || 'generic';
  }

  /**
   * Get Firebase collection name for data type
   */
  private getCollectionName(dataType: string): string {
    return this.dataTypeMapping[dataType] || 'localStorage_backup';
  }

  /**
   * Get current sync progress
   */
  public getSyncProgress(): SyncProgress {
    return this.syncProgress;
  }

  /**
   * Quick sync for specific data types
   */
  public async syncSpecificData(keys: string[]): Promise<SyncResult[]> {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to sync data');
    }

    const results: SyncResult[] = [];
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        const item: LocalStorageItem = {
          key,
          value,
          parsedValue: (() => {
            try { return JSON.parse(value); } catch { return value; }
          })(),
          isJSON: (() => {
            try { JSON.parse(value); return true; } catch { return false; }
          })(),
          size: new Blob([value]).size,
          extractedAt: new Date().toISOString()
        };

        const result = await this.processLocalStorageItem(item);
        results.push(result);
      }
    }

    return results;
  }
}

// Export singleton instance
export const localStorageToFirebaseService = LocalStorageToFirebaseService.getInstance(); 