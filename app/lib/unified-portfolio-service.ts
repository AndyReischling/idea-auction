// =============================================================================
// Unified Portfolio Service - Real-time portfolio synchronization
// =============================================================================

'use client';

import {
  calculatePortfolioStats,
  getUserPositionsWithCurrentPrices,
  getBettingPositionsWithCurrentValues,
  getShortPositionsWithCurrentValues,
  calculateTotalExposure,
  getCombinedPortfolioPositions
} from './portfolio-utils';
import { realtimeDataService } from './realtime-data-service';
import { doc, onSnapshot, collection, query, where, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

// Portfolio subscription callback types
type PortfolioStatsCallback = (stats: any) => void;
type PositionsCallback = (positions: any) => void;
type ExposureCallback = (exposure: any) => void;

interface PortfolioSubscription {
  id: string;
  userId: string;
  type: 'stats' | 'positions' | 'exposure' | 'combined';
  callback: (data: any) => void;
  unsubscribe?: Unsubscribe;
  lastUpdate: Date;
  isActive: boolean;
}

/**
 * Unified Portfolio Service - Manages all portfolio-related data synchronization
 * Provides real-time updates for portfolio stats, positions, bets, and shorts
 */
export class UnifiedPortfolioService {
  private static instance: UnifiedPortfolioService;
  private subscriptions = new Map<string, PortfolioSubscription>();
  private cache = new Map<string, any>();
  private updateIntervals = new Map<string, NodeJS.Timeout>();

  private constructor() {
    // Set up cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  static getInstance(): UnifiedPortfolioService {
    if (!UnifiedPortfolioService.instance) {
      UnifiedPortfolioService.instance = new UnifiedPortfolioService();
    }
    return UnifiedPortfolioService.instance;
  }

  /**
   * Subscribe to real-time portfolio statistics
   */
  subscribeToPortfolioStats(userId: string, callback: PortfolioStatsCallback): string {
    const subscriptionId = `portfolio_stats_${userId}_${Date.now()}`;
    
    // Create initial data fetch
    this.fetchPortfolioStats(userId).then(callback);
    
    // Set up real-time updates every 30 seconds
    const updateInterval = setInterval(async () => {
      try {
        const stats = await this.fetchPortfolioStats(userId);
        callback(stats);
      } catch (error) {
        console.error('Error updating portfolio stats:', error);
      }
    }, 30000);

    // Set up Firestore listeners for real-time changes
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, async () => {
      try {
        const stats = await this.fetchPortfolioStats(userId);
        callback(stats);
      } catch (error) {
        console.error('Error in portfolio stats subscription:', error);
      }
    });

    const subscription: PortfolioSubscription = {
      id: subscriptionId,
      userId,
      type: 'stats',
      callback,
      unsubscribe,
      lastUpdate: new Date(),
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateIntervals.set(subscriptionId, updateInterval);

    console.log(`📊 Portfolio stats subscription created: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Subscribe to real-time trading positions (opinions holdings)
   */
  subscribeToTradingPositions(userId: string, callback: PositionsCallback): string {
    const subscriptionId = `trading_positions_${userId}_${Date.now()}`;
    
    // Create initial data fetch
    this.fetchTradingPositions(userId).then(callback);
    
    // Set up real-time updates every 15 seconds (more frequent for trading data)
    const updateInterval = setInterval(async () => {
      try {
        const positions = await this.fetchTradingPositions(userId);
        callback(positions);
      } catch (error) {
        console.error('Error updating trading positions:', error);
      }
    }, 15000);

    // Set up Firestore listener for user changes
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, async () => {
      try {
        const positions = await this.fetchTradingPositions(userId);
        callback(positions);
      } catch (error) {
        console.error('Error in trading positions subscription:', error);
      }
    });

    const subscription: PortfolioSubscription = {
      id: subscriptionId,
      userId,
      type: 'positions',
      callback,
      unsubscribe,
      lastUpdate: new Date(),
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateIntervals.set(subscriptionId, updateInterval);

    console.log(`💼 Trading positions subscription created: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Subscribe to real-time betting and shorts positions
   */
  subscribeToRiskPositions(userId: string, callback: PositionsCallback): string {
    const subscriptionId = `risk_positions_${userId}_${Date.now()}`;
    
    // Create initial data fetch
    this.fetchRiskPositions(userId).then(callback);
    
    // Set up real-time updates every 20 seconds
    const updateInterval = setInterval(async () => {
      try {
        const positions = await this.fetchRiskPositions(userId);
        callback(positions);
      } catch (error) {
        console.error('Error updating risk positions:', error);
      }
    }, 20000);

    // Set up Firestore listeners for bets and shorts collections
    const betsQuery = query(
      collection(db, 'advanced-bets'),
      where('userId', '==', userId)
    );
    const shortsQuery = query(
      collection(db, 'short-positions'),
      where('userId', '==', userId)
    );

    const betsUnsub = onSnapshot(betsQuery, async () => {
      try {
        const positions = await this.fetchRiskPositions(userId);
        callback(positions);
      } catch (error) {
        console.error('Error in bets subscription:', error);
      }
    });

    const shortsUnsub = onSnapshot(shortsQuery, async () => {
      try {
        const positions = await this.fetchRiskPositions(userId);
        callback(positions);
      } catch (error) {
        console.error('Error in shorts subscription:', error);
      }
    });

    const subscription: PortfolioSubscription = {
      id: subscriptionId,
      userId,
      type: 'positions',
      callback,
      unsubscribe: () => {
        betsUnsub();
        shortsUnsub();
      },
      lastUpdate: new Date(),
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateIntervals.set(subscriptionId, updateInterval);

    console.log(`🎯 Risk positions subscription created: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Subscribe to complete portfolio overview (all data combined)
   */
  subscribeToCompletePortfolio(userId: string, callback: (data: any) => void): string {
    const subscriptionId = `complete_portfolio_${userId}_${Date.now()}`;
    
    // Create initial data fetch
    this.fetchCompletePortfolio(userId).then(callback);
    
    // Set up real-time updates every 30 seconds
    const updateInterval = setInterval(async () => {
      try {
        const portfolio = await this.fetchCompletePortfolio(userId);
        callback(portfolio);
      } catch (error) {
        console.error('Error updating complete portfolio:', error);
      }
    }, 30000);

    // Set up multiple Firestore listeners
    const userRef = doc(db, 'users', userId);
    const betsQuery = query(collection(db, 'advanced-bets'), where('userId', '==', userId));
    const shortsQuery = query(collection(db, 'short-positions'), where('userId', '==', userId));

    const userUnsub = onSnapshot(userRef, async () => {
      try {
        const portfolio = await this.fetchCompletePortfolio(userId);
        callback(portfolio);
      } catch (error) {
        console.error('Error in user subscription:', error);
      }
    });

    const betsUnsub = onSnapshot(betsQuery, async () => {
      try {
        const portfolio = await this.fetchCompletePortfolio(userId);
        callback(portfolio);
      } catch (error) {
        console.error('Error in bets subscription:', error);
      }
    });

    const shortsUnsub = onSnapshot(shortsQuery, async () => {
      try {
        const portfolio = await this.fetchCompletePortfolio(userId);
        callback(portfolio);
      } catch (error) {
        console.error('Error in shorts subscription:', error);
      }
    });

    const subscription: PortfolioSubscription = {
      id: subscriptionId,
      userId,
      type: 'combined',
      callback,
      unsubscribe: () => {
        userUnsub();
        betsUnsub();
        shortsUnsub();
      },
      lastUpdate: new Date(),
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.updateIntervals.set(subscriptionId, updateInterval);

    console.log(`🔄 Complete portfolio subscription created: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a portfolio subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      // Clean up Firestore subscription
      if (subscription.unsubscribe) {
        subscription.unsubscribe();
      }
      
      // Clean up interval
      const interval = this.updateIntervals.get(subscriptionId);
      if (interval) {
        clearInterval(interval);
        this.updateIntervals.delete(subscriptionId);
      }
      
      // Remove subscription
      this.subscriptions.delete(subscriptionId);
      
      console.log(`🗑️ Portfolio subscription cleaned up: ${subscriptionId}`);
    }
  }

  /**
   * Get cached portfolio data (useful for immediate UI updates)
   */
  getCachedData(userId: string, type: string): any | null {
    const cacheKey = `${userId}_${type}`;
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Manually refresh all portfolio data for a user
   */
  async refreshPortfolio(userId: string): Promise<void> {
    try {
      console.log(`🔄 Manually refreshing portfolio for user: ${userId}`);
      
      // Fetch fresh data
      const [stats, positions, risks, complete] = await Promise.all([
        this.fetchPortfolioStats(userId),
        this.fetchTradingPositions(userId),
        this.fetchRiskPositions(userId),
        this.fetchCompletePortfolio(userId)
      ]);

      // Update cache
      this.cache.set(`${userId}_stats`, stats);
      this.cache.set(`${userId}_positions`, positions);
      this.cache.set(`${userId}_risks`, risks);
      this.cache.set(`${userId}_complete`, complete);

      // Notify all active subscriptions for this user
      for (const [subscriptionId, subscription] of this.subscriptions) {
        if (subscription.userId === userId && subscription.isActive) {
          try {
            switch (subscription.type) {
              case 'stats':
                subscription.callback(stats);
                break;
              case 'positions':
                if (subscriptionId.includes('trading')) {
                  subscription.callback(positions);
                } else if (subscriptionId.includes('risk')) {
                  subscription.callback(risks);
                }
                break;
              case 'combined':
                subscription.callback(complete);
                break;
            }
          } catch (error) {
            console.error(`Error notifying subscription ${subscriptionId}:`, error);
          }
        }
      }
      
      console.log(`✅ Portfolio refresh completed for user: ${userId}`);
    } catch (error) {
      console.error('Error refreshing portfolio:', error);
    }
  }

  // Private methods for data fetching
  private async fetchPortfolioStats(userId: string) {
    const stats = await calculatePortfolioStats(userId);
    this.cache.set(`${userId}_stats`, stats);
    return stats;
  }

  private async fetchTradingPositions(userId: string) {
    const positions = await getUserPositionsWithCurrentPrices(userId);
    this.cache.set(`${userId}_positions`, positions);
    return positions;
  }

  private async fetchRiskPositions(userId: string) {
    const [bets, shorts] = await Promise.all([
      getBettingPositionsWithCurrentValues(userId),
      getShortPositionsWithCurrentValues(userId)
    ]);
    const risks = { bets, shorts };
    this.cache.set(`${userId}_risks`, risks);
    return risks;
  }

  private async fetchCompletePortfolio(userId: string) {
    const complete = await getCombinedPortfolioPositions(userId);
    this.cache.set(`${userId}_complete`, complete);
    return complete;
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.subscriptions.size} portfolio subscriptions`);
    
    // Clean up all subscriptions
    for (const [subscriptionId] of this.subscriptions) {
      this.unsubscribe(subscriptionId);
    }
    
    // Clear cache
    this.cache.clear();
    
    console.log('✅ Portfolio service cleanup completed');
  }
}

// Export singleton instance
export const unifiedPortfolioService = UnifiedPortfolioService.getInstance(); 