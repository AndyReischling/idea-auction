'use client';

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from 'firebase/auth';

// Data interfaces
interface RealtimeDataConfig {
  useFirebase: boolean;
  enableLocalStorageFallback: boolean;
  syncInterval: number;
  offlineMode: boolean;
}

interface DataSubscription {
  id: string;
  collection: string;
  userId?: string;
  callback: (data: any) => void;
  unsubscribe?: Unsubscribe;
  lastUpdate?: string;
  isActive: boolean;
}

interface CachedData {
  [key: string]: {
    data: any;
    timestamp: string;
    source: 'firebase' | 'localStorage';
    isStale: boolean;
  };
}

export class RealtimeDataService {
  private static instance: RealtimeDataService;
  private subscriptions: Map<string, DataSubscription> = new Map();
  private cache: CachedData = {};
  private config: RealtimeDataConfig;
  private isOnline: boolean = true;
  private currentUser: User | null = null;

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
    embeddings: collection(db, 'embeddings')
  };

  private constructor() {
    this.config = {
      useFirebase: true,
      enableLocalStorageFallback: true,
      syncInterval: 5000, // 5 seconds
      offlineMode: false
    };
    
    this.setupNetworkMonitoring();
    this.setupAuthListener();
  }

  public static getInstance(): RealtimeDataService {
    if (!RealtimeDataService.instance) {
      RealtimeDataService.instance = new RealtimeDataService();
    }
    return RealtimeDataService.instance;
  }

  // Setup network monitoring
  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.config.offlineMode = false;
        console.log('🌐 Network online - switching to Firebase mode');
        this.refreshAllSubscriptions();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.config.offlineMode = true;
        console.log('🌐 Network offline - switching to localStorage mode');
      });
    }
  }

  // Setup auth listener
  private setupAuthListener(): void {
    if (typeof window !== 'undefined') {
      auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        if (user) {
          console.log('👤 User authenticated - enabling Firebase data sync');
          this.config.useFirebase = true;
          this.refreshAllSubscriptions();
        } else {
          console.log('👤 User signed out - switching to localStorage only');
          this.config.useFirebase = false;
          this.stopAllSubscriptions();
        }
      });
    }
  }

  // CORE DATA METHODS

  /**
   * Get user profile with real-time updates
   */
  async getUserProfile(userId?: string): Promise<any> {
    const targetUserId = userId || this.currentUser?.uid;
    if (!targetUserId) return this.getFromLocalStorage('userProfile', null);

    const cacheKey = `userProfile_${targetUserId}`;
    
    // Return cached data if available and not stale
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) {
      return this.cache[cacheKey].data;
    }

    try {
      if (this.config.useFirebase && this.isOnline) {
        const userDoc = await getDoc(doc(this.collections.users, targetUserId));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          this.updateCache(cacheKey, profile, 'firebase');
          
          // Also update localStorage for backward compatibility
          if (targetUserId === this.currentUser?.uid) {
            this.saveToLocalStorage('userProfile', profile);
          }
          
          return profile;
        }
      }
    } catch (error) {
      console.error('Error fetching user profile from Firebase:', error);
    }

    // Fallback to localStorage
    const localProfile = this.getFromLocalStorage('userProfile', null);
    if (localProfile) {
      this.updateCache(cacheKey, localProfile, 'localStorage');
    }
    
    return localProfile;
  }

  /**
   * Subscribe to user profile changes
   */
  subscribeToUserProfile(userId: string, callback: (profile: any) => void): string {
    const subscriptionId = `userProfile_${userId}`;
    
    if (this.config.useFirebase && this.isOnline) {
      const unsubscribe = onSnapshot(
        doc(this.collections.users, userId),
        (doc) => {
          if (doc.exists()) {
            const profile = doc.data();
            this.updateCache(`userProfile_${userId}`, profile, 'firebase');
            
            // Update localStorage for backward compatibility
            if (userId === this.currentUser?.uid) {
              this.saveToLocalStorage('userProfile', profile);
            }
            
            callback(profile);
          }
        },
        (error) => {
          console.error('User profile subscription error:', error);
          // Fallback to localStorage data
          const localProfile = this.getFromLocalStorage('userProfile', null);
          if (localProfile) {
            callback(localProfile);
          }
        }
      );
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'users',
        userId,
        callback,
        unsubscribe,
        isActive: true
      });
    } else {
      // Fallback to localStorage with polling
      const localProfile = this.getFromLocalStorage('userProfile', null);
      if (localProfile) {
        callback(localProfile);
      }
      
      // Poll for localStorage changes
      const interval = setInterval(() => {
        const currentProfile = this.getFromLocalStorage('userProfile', null);
        if (currentProfile) {
          callback(currentProfile);
        }
      }, this.config.syncInterval);
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'users',
        userId,
        callback,
        unsubscribe: () => clearInterval(interval),
        isActive: true
      });
    }
    
    return subscriptionId;
  }

  /**
   * Get opinions with real-time updates
   */
  async getOpinions(): Promise<string[]> {
    const cacheKey = 'opinions';
    
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) {
      return this.cache[cacheKey].data;
    }

    try {
      if (this.config.useFirebase && this.isOnline) {
        const opinionsSnapshot = await getDocs(
          query(this.collections.opinions, orderBy('createdAt', 'desc'))
        );
        
        const opinions: string[] = [];
        opinionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.text) {
            opinions.push(data.text);
          }
        });
        
        this.updateCache(cacheKey, opinions, 'firebase');
        this.saveToLocalStorage('opinions', opinions);
        
        return opinions;
      }
    } catch (error) {
      console.error('Error fetching opinions from Firebase:', error);
    }

    // Fallback to localStorage
    const localOpinions = this.getFromLocalStorage('opinions', []);
    this.updateCache(cacheKey, localOpinions, 'localStorage');
    
    return localOpinions;
  }

  /**
   * Subscribe to opinions changes
   */
  subscribeToOpinions(callback: (opinions: string[]) => void): string {
    const subscriptionId = 'opinions';
    
    if (this.config.useFirebase && this.isOnline) {
      const unsubscribe = onSnapshot(
        query(this.collections.opinions, orderBy('createdAt', 'desc')),
        (snapshot) => {
          const opinions: string[] = [];
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.text) {
              opinions.push(data.text);
            }
          });
          
          this.updateCache('opinions', opinions, 'firebase');
          this.saveToLocalStorage('opinions', opinions);
          callback(opinions);
        },
        (error) => {
          console.error('Opinions subscription error:', error);
          const localOpinions = this.getFromLocalStorage('opinions', []);
          callback(localOpinions);
        }
      );
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'opinions',
        callback,
        unsubscribe,
        isActive: true
      });
    } else {
      // Fallback to localStorage with polling
      const localOpinions = this.getFromLocalStorage('opinions', []);
      callback(localOpinions);
      
      const interval = setInterval(() => {
        const currentOpinions = this.getFromLocalStorage('opinions', []);
        callback(currentOpinions);
      }, this.config.syncInterval);
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'opinions',
        callback,
        unsubscribe: () => clearInterval(interval),
        isActive: true
      });
    }
    
    return subscriptionId;
  }

  /**
   * Get market data with real-time updates
   */
  async getMarketData(): Promise<any> {
    const cacheKey = 'marketData';
    
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) {
      return this.cache[cacheKey].data;
    }

    try {
      if (this.config.useFirebase && this.isOnline) {
        const marketSnapshot = await getDocs(this.collections.marketData);
        const marketData: any = {};
        
        marketSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.opinionText) {
            marketData[data.opinionText] = {
              timesPurchased: data.timesPurchased || 0,
              timesSold: data.timesSold || 0,
              currentPrice: data.currentPrice || 10.00,
              basePrice: data.basePrice || 10.00,
              lastUpdated: data.lastUpdated
            };
          }
        });
        
        this.updateCache(cacheKey, marketData, 'firebase');
        this.saveToLocalStorage('opinionMarketData', marketData);
        
        return marketData;
      }
    } catch (error) {
      console.error('Error fetching market data from Firebase:', error);
    }

    // Fallback to localStorage
    const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
    this.updateCache(cacheKey, localMarketData, 'localStorage');
    
    return localMarketData;
  }

  /**
   * Subscribe to market data changes
   */
  subscribeToMarketData(callback: (marketData: any) => void): string {
    const subscriptionId = 'marketData';
    
    if (this.config.useFirebase && this.isOnline) {
      const unsubscribe = onSnapshot(
        this.collections.marketData,
        (snapshot) => {
          const marketData: any = {};
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.opinionText) {
              marketData[data.opinionText] = {
                timesPurchased: data.timesPurchased || 0,
                timesSold: data.timesSold || 0,
                currentPrice: data.currentPrice || 10.00,
                basePrice: data.basePrice || 10.00,
                lastUpdated: data.lastUpdated
              };
            }
          });
          
          this.updateCache('marketData', marketData, 'firebase');
          this.saveToLocalStorage('opinionMarketData', marketData);
          callback(marketData);
        },
        (error) => {
          console.error('Market data subscription error:', error);
          const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
          callback(localMarketData);
        }
      );
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'market-data',
        callback,
        unsubscribe,
        isActive: true
      });
    } else {
      // Fallback to localStorage with polling
      const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
      callback(localMarketData);
      
      const interval = setInterval(() => {
        const currentMarketData = this.getFromLocalStorage('opinionMarketData', {});
        callback(currentMarketData);
      }, this.config.syncInterval);
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'market-data',
        callback,
        unsubscribe: () => clearInterval(interval),
        isActive: true
      });
    }
    
    return subscriptionId;
  }

  /**
   * Get activity feed with real-time updates
   */
  async getActivityFeed(limitCount: number = 100): Promise<any[]> {
    const cacheKey = `activityFeed_${limitCount}`;
    
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) {
      return this.cache[cacheKey].data;
    }

    try {
      if (this.config.useFirebase && this.isOnline) {
        const activitySnapshot = await getDocs(
          query(this.collections.activityFeed, orderBy('timestamp', 'desc'), limit(limitCount))
        );
        
        const activities: any[] = [];
        activitySnapshot.docs.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp
          });
        });
        
        this.updateCache(cacheKey, activities, 'firebase');
        this.saveToLocalStorage('globalActivityFeed', activities);
        
        return activities;
      }
    } catch (error) {
      console.error('Error fetching activity feed from Firebase:', error);
    }

    // Fallback to localStorage
    const localActivityFeed = this.getFromLocalStorage('globalActivityFeed', []);
    this.updateCache(cacheKey, localActivityFeed, 'localStorage');
    
    return localActivityFeed.slice(0, limitCount);
  }

  /**
   * Subscribe to activity feed changes
   */
  subscribeToActivityFeed(callback: (activities: any[]) => void, limitCount: number = 100): string {
    const subscriptionId = `activityFeed_${limitCount}`;
    
    if (this.config.useFirebase && this.isOnline) {
      const unsubscribe = onSnapshot(
        query(this.collections.activityFeed, orderBy('timestamp', 'desc'), limit(limitCount)),
        (snapshot) => {
          const activities: any[] = [];
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            activities.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp
            });
          });
          
          this.updateCache(`activityFeed_${limitCount}`, activities, 'firebase');
          this.saveToLocalStorage('globalActivityFeed', activities);
          callback(activities);
        },
        (error) => {
          console.error('Activity feed subscription error:', error);
          const localActivityFeed = this.getFromLocalStorage('globalActivityFeed', []);
          callback(localActivityFeed.slice(0, limitCount));
        }
      );
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'activity-feed',
        callback,
        unsubscribe,
        isActive: true
      });
    } else {
      // Fallback to localStorage with polling
      const localActivityFeed = this.getFromLocalStorage('globalActivityFeed', []);
      callback(localActivityFeed.slice(0, limitCount));
      
      const interval = setInterval(() => {
        const currentActivityFeed = this.getFromLocalStorage('globalActivityFeed', []);
        callback(currentActivityFeed.slice(0, limitCount));
      }, this.config.syncInterval);
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'activity-feed',
        callback,
        unsubscribe: () => clearInterval(interval),
        isActive: true
      });
    }
    
    return subscriptionId;
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userId?: string): Promise<any[]> {
    const targetUserId = userId || this.currentUser?.uid;
    if (!targetUserId) return this.getFromLocalStorage('transactions', []);

    const cacheKey = `transactions_${targetUserId}`;
    
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) {
      return this.cache[cacheKey].data;
    }

    try {
      if (this.config.useFirebase && this.isOnline) {
        const transactionsSnapshot = await getDocs(
          query(this.collections.transactions, where('userId', '==', targetUserId), orderBy('timestamp', 'desc'))
        );
        
        const transactions: any[] = [];
        transactionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          transactions.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp
          });
        });
        
        this.updateCache(cacheKey, transactions, 'firebase');
        
        // Update localStorage for backward compatibility
        if (targetUserId === this.currentUser?.uid) {
          this.saveToLocalStorage('transactions', transactions);
        }
        
        return transactions;
      }
    } catch (error) {
      console.error('Error fetching transactions from Firebase:', error);
    }

    // Fallback to localStorage
    const localTransactions = this.getFromLocalStorage('transactions', []);
    this.updateCache(cacheKey, localTransactions, 'localStorage');
    
    return localTransactions;
  }

  /**
   * Subscribe to user transactions
   */
  subscribeToUserTransactions(userId: string, callback: (transactions: any[]) => void): string {
    const subscriptionId = `transactions_${userId}`;
    
    if (this.config.useFirebase && this.isOnline) {
      const unsubscribe = onSnapshot(
        query(this.collections.transactions, where('userId', '==', userId), orderBy('timestamp', 'desc')),
        (snapshot) => {
          const transactions: any[] = [];
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            transactions.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp
            });
          });
          
          this.updateCache(`transactions_${userId}`, transactions, 'firebase');
          
          // Update localStorage for backward compatibility
          if (userId === this.currentUser?.uid) {
            this.saveToLocalStorage('transactions', transactions);
          }
          
          callback(transactions);
        },
        (error) => {
          console.error('Transactions subscription error:', error);
          const localTransactions = this.getFromLocalStorage('transactions', []);
          callback(localTransactions);
        }
      );
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'transactions',
        userId,
        callback,
        unsubscribe,
        isActive: true
      });
    } else {
      // Fallback to localStorage with polling
      const localTransactions = this.getFromLocalStorage('transactions', []);
      callback(localTransactions);
      
      const interval = setInterval(() => {
        const currentTransactions = this.getFromLocalStorage('transactions', []);
        callback(currentTransactions);
      }, this.config.syncInterval);
      
      this.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        collection: 'transactions',
        userId,
        callback,
        unsubscribe: () => clearInterval(interval),
        isActive: true
      });
    }
    
    return subscriptionId;
  }

  // WRITE OPERATIONS

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: any): Promise<void> {
    try {
      if (this.config.useFirebase && this.isOnline) {
        await updateDoc(doc(this.collections.users, userId), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ User profile updated in Firebase');
      }
    } catch (error) {
      console.error('Error updating user profile in Firebase:', error);
    }

    // Always update localStorage for immediate UI updates
    const currentProfile = this.getFromLocalStorage('userProfile', {});
    const updatedProfile = { ...currentProfile, ...updates };
    this.saveToLocalStorage('userProfile', updatedProfile);
    
    // Update cache
    this.updateCache(`userProfile_${userId}`, updatedProfile, 'localStorage');
  }

  /**
   * Add new opinion
   */
  async addOpinion(opinion: string, userId: string): Promise<void> {
    try {
      if (this.config.useFirebase && this.isOnline) {
        const opinionId = btoa(opinion).replace(/[^a-zA-Z0-9]/g, '');
        await setDoc(doc(this.collections.opinions, opinionId), {
          text: opinion,
          createdBy: userId,
          createdAt: serverTimestamp(),
          status: 'active'
        });
        
        console.log('✅ Opinion added to Firebase');
      }
    } catch (error) {
      console.error('Error adding opinion to Firebase:', error);
    }

    // Always update localStorage for immediate UI updates
    const currentOpinions = this.getFromLocalStorage('opinions', []);
    const updatedOpinions = [opinion, ...currentOpinions];
    this.saveToLocalStorage('opinions', updatedOpinions);
    
    // Update cache
    this.updateCache('opinions', updatedOpinions, 'localStorage');
  }

  /**
   * Add transaction
   */
  async addTransaction(transaction: any): Promise<void> {
    try {
      if (this.config.useFirebase && this.isOnline && this.currentUser) {
        await setDoc(doc(this.collections.transactions, transaction.id), {
          ...transaction,
          userId: this.currentUser.uid,
          timestamp: serverTimestamp()
        });
        
        console.log('✅ Transaction added to Firebase');
      }
    } catch (error) {
      console.error('Error adding transaction to Firebase:', error);
    }

    // Always update localStorage for immediate UI updates
    const currentTransactions = this.getFromLocalStorage('transactions', []);
    const updatedTransactions = [transaction, ...currentTransactions];
    this.saveToLocalStorage('transactions', updatedTransactions);
    
    // Update cache
    if (this.currentUser) {
      this.updateCache(`transactions_${this.currentUser.uid}`, updatedTransactions, 'localStorage');
    }
  }

  // SUBSCRIPTION MANAGEMENT

  /**
   * Unsubscribe from data updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription && subscription.unsubscribe) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      console.log(`🔄 Unsubscribed from ${subscriptionId}`);
    }
  }

  /**
   * Stop all subscriptions
   */
  stopAllSubscriptions(): void {
    this.subscriptions.forEach((subscription, id) => {
      if (subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    });
    this.subscriptions.clear();
    console.log('🔄 All subscriptions stopped');
  }

  /**
   * Refresh all active subscriptions
   */
  private refreshAllSubscriptions(): void {
    const activeSubscriptions = Array.from(this.subscriptions.values());
    
    // Stop all current subscriptions
    this.stopAllSubscriptions();
    
    // Restart subscriptions based on type
    activeSubscriptions.forEach(subscription => {
      if (subscription.isActive) {
        switch (subscription.collection) {
          case 'users':
            if (subscription.userId) {
              this.subscribeToUserProfile(subscription.userId, subscription.callback);
            }
            break;
          case 'opinions':
            this.subscribeToOpinions(subscription.callback);
            break;
          case 'market-data':
            this.subscribeToMarketData(subscription.callback);
            break;
          case 'activity-feed':
            this.subscribeToActivityFeed(subscription.callback);
            break;
          case 'transactions':
            if (subscription.userId) {
              this.subscribeToUserTransactions(subscription.userId, subscription.callback);
            }
            break;
        }
      }
    });
  }

  // CACHE MANAGEMENT

  /**
   * Update cache with new data
   */
  private updateCache(key: string, data: any, source: 'firebase' | 'localStorage'): void {
    this.cache[key] = {
      data,
      timestamp: new Date().toISOString(),
      source,
      isStale: false
    };
    
    // Mark cache as stale after 30 seconds
    setTimeout(() => {
      if (this.cache[key]) {
        this.cache[key].isStale = true;
      }
    }, 30000);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {};
  }

  // UTILITY METHODS

  /**
   * Safe localStorage get
   */
  private getFromLocalStorage<T>(key: string, defaultValue: T): T {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage set
   */
  private saveToLocalStorage<T>(key: string, value: T): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): RealtimeDataConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RealtimeDataConfig>): void {
    this.config = { ...this.config, ...updates };
    
    if (updates.useFirebase !== undefined) {
      this.refreshAllSubscriptions();
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { [key: string]: any } {
    const status: { [key: string]: any } = {};
    
    Object.entries(this.cache).forEach(([key, value]) => {
      status[key] = {
        source: value.source,
        timestamp: value.timestamp,
        isStale: value.isStale,
        hasData: value.data !== null && value.data !== undefined
      };
    });
    
    return status;
  }
}

// Export singleton instance
export const realtimeDataService = RealtimeDataService.getInstance(); 