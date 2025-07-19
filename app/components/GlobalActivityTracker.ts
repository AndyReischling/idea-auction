'use client';

import { db } from '../lib/firebase';
import { createActivityId } from '../lib/document-id-utils';
import { updateUserPortfolio, getUserPortfolio } from '../lib/portfolio-utils';
import { realtimeDataService } from '../lib/realtime-data-service';
import {
  collection,
  query,
  onSnapshot,
  Unsubscribe,
  doc,
  updateDoc,
  increment,
  getDoc,
} from 'firebase/firestore';

interface UserData {
  uid: string;
  username: string;
  balance: number;
  totalEarnings: number;
  totalLosses: number;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Singleton service that manages global activity tracking and portfolio synchronization
 * Subscribes to Firestore changes and updates user portfolio stats in real-time
 */
class GlobalActivityTracker {
  private static instance: GlobalActivityTracker;
  private unsubscribe: Unsubscribe | null = null;
  private currentUser: UserData | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GlobalActivityTracker {
    if (!GlobalActivityTracker.instance) {
      GlobalActivityTracker.instance = new GlobalActivityTracker();
    }
    return GlobalActivityTracker.instance;
  }

  /**
   * Initialize the tracker with auth context
   */
  initializeWithAuthContext(): void {
    if (this.isInitialized) return;
    
    console.log('🔧 GlobalActivityTracker: Initializing with auth context...');
    this.isInitialized = true;
    
    // Set up global activity subscription
    this.setupGlobalSubscription();
  }

  /**
   * Update the current user being tracked
   */
  updateCurrentUser(userData: UserData): void {
    this.currentUser = userData;
    console.log('👤 GlobalActivityTracker: Updated current user →', userData.username);
    console.log('👤 GlobalActivityTracker: User data:', userData);
    
    // If not initialized yet, initialize now
    if (!this.isInitialized) {
      console.log('🔧 GlobalActivityTracker: Not initialized yet, initializing now...');
      this.initializeWithAuthContext();
    } else {
      console.log('✅ GlobalActivityTracker: Already initialized, user updated');
    }
  }

  /**
   * Set up global Firestore subscription
   */
  private setupGlobalSubscription(): void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    console.log('🔧 GlobalActivityTracker: Setting up Firestore subscription to activity-feed...');

    // Subscribe to activity-feed instead of users collection for better performance
    // and to avoid permission issues with listening to all user documents
    const q = query(collection(db, 'activity-feed'));
    this.unsubscribe = onSnapshot(q, 
      (snap) => {
        console.log(`🔥 GlobalActivityTracker: Received ${snap.size} documents, ${snap.docChanges().length} changes`);
        
        snap.docChanges().forEach((change) => {
          console.log(`[Activity] ${change.type}:`, change.doc.data());
          
          // Additional activity tracking logic can be added here
          this.processActivityChange(change);
        });
      },
      (error) => {
        console.error('❌ GlobalActivityTracker subscription error:', error);
        
        // Provide specific error handling
        if (error.message.includes('permission') || (error as any).code === 'permission-denied') {
          console.error('🔒 Permission denied for activity-feed subscription');
          console.error('🔧 Check Firestore security rules and user authentication');
        } else if ((error as any).code === 'unavailable') {
          console.error('🌐 Firebase unavailable - will retry automatically');
        } else {
          console.error('🚨 Unexpected subscription error:', error.message);
        }
        
        // Optionally attempt to reinitialize after a delay
        setTimeout(() => {
          console.log('🔄 Attempting to reinitialize GlobalActivityTracker subscription...');
          this.setupGlobalSubscription();
        }, 10000); // Retry after 10 seconds
      }
    );
  }

  /**
   * Process activity changes and update portfolio statistics
   */
  private async processActivityChange(change: any): Promise<void> {
    try {
      const data = change.doc.data();
      const changeType = change.type;
      
      // Skip processing for 'removed' changes
      if (changeType === 'removed') {
        return;
      }
      
      // Determine the correct username and userId based on the activity type
      let activityUser = data.username || 'unknown';
      let userId = data.userId;
      
      // Check if this is a bot activity and skip portfolio updates for bots
      if (data.isBot || data.botId || change.doc.id.startsWith('bot_')) {
        activityUser = data.username || data.botUsername || `Bot-${change.doc.id}`;
        console.log(`🤖 Bot activity detected, skipping portfolio sync: ${activityUser}`);
        return;
      }
      
      // Process different types of activity for portfolio synchronization
      switch (data.type) {
        case 'buy':
        case 'sell':
          await this.handleTradeActivity(data, userId);
          break;
        case 'bet_place':
        case 'bet_win':
        case 'bet_loss':
          await this.handleBettingActivity(data, userId);
          break;
        case 'short_place':
        case 'short_win':
        case 'short_loss':
          await this.handleShortsActivity(data, userId);
          break;
        case 'earn':
          await this.handleEarningsActivity(data, userId);
          break;
        default:
          console.log(`📊 Unhandled activity type: ${data.type}`);
      }
      
      // Log activity for debugging
      console.log(`🔄 Processed activity ${changeType}:`, {
        docId: change.doc.id,
        type: data.type,
        user: activityUser,
        amount: data.amount,
        opinionText: data.opinionText
      });
    } catch (error) {
      console.error('❌ Error processing activity change:', error);
    }
  }
  
  /**
   * Handle trading activity (buy/sell) and update portfolio
   */
  private async handleTradeActivity(data: any, userId: string): Promise<void> {
    if (!userId || !data.opinionId || !data.opinionText) {
      console.warn('⚠️ Missing required trade data:', { userId, opinionId: data.opinionId, opinionText: data.opinionText });
      return;
    }
    
    try {
      const quantity = data.type === 'buy' ? (data.quantity || 1) : -(data.quantity || 1);
      const price = data.price || 10;
      const transactionId = `${data.type}_${Date.now()}_${userId}`;
      
      // Update portfolio using existing utility
      await updateUserPortfolio(
        userId,
        data.opinionId,
        data.opinionText,
        quantity,
        price,
        transactionId
      );
      
      // Update user stats
      await this.updateUserStats(userId, {
        balanceChange: data.type === 'buy' ? -(data.amount || quantity * price) : (data.amount || quantity * price),
        tradesCount: 1
      });
      
      console.log(`📈 Updated portfolio for ${data.type} trade:`, {
        userId,
        opinionText: data.opinionText,
        quantity,
        price
      });
      
    } catch (error) {
      console.error('❌ Error handling trade activity:', error);
    }
  }
  
  /**
   * Handle betting activity and update user balance/stats
   */
  private async handleBettingActivity(data: any, userId: string): Promise<void> {
    if (!userId) return;
    
    try {
      let balanceChange = 0;
      let earningsChange = 0;
      let lossesChange = 0;
      
      switch (data.type) {
        case 'bet_place':
          balanceChange = -(data.amount || 0);
          break;
        case 'bet_win':
          balanceChange = data.amount || 0;
          earningsChange = data.amount || 0;
          break;
        case 'bet_loss':
          lossesChange = Math.abs(data.amount || 0);
          break;
      }
      
      await this.updateUserStats(userId, {
        balanceChange,
        earningsChange,
        lossesChange
      });
      
      console.log(`🎯 Updated user stats for betting activity:`, {
        userId,
        type: data.type,
        balanceChange,
        earningsChange,
        lossesChange
      });
      
    } catch (error) {
      console.error('❌ Error handling betting activity:', error);
    }
  }
  
  /**
   * Handle shorting activity and update user balance/stats
   */
  private async handleShortsActivity(data: any, userId: string): Promise<void> {
    if (!userId) return;
    
    try {
      let balanceChange = 0;
      let earningsChange = 0;
      let lossesChange = 0;
      
      switch (data.type) {
        case 'short_place':
          balanceChange = -(data.betAmount || data.amount || 0);
          break;
        case 'short_win':
          balanceChange = data.potentialWinnings || data.amount || 0;
          earningsChange = data.potentialWinnings || data.amount || 0;
          break;
        case 'short_loss':
          lossesChange = Math.abs(data.betAmount || data.amount || 0);
          break;
      }
      
      await this.updateUserStats(userId, {
        balanceChange,
        earningsChange,
        lossesChange
      });
      
      console.log(`📉 Updated user stats for shorting activity:`, {
        userId,
        type: data.type,
        balanceChange,
        earningsChange,
        lossesChange
      });
      
    } catch (error) {
      console.error('❌ Error handling shorting activity:', error);
    }
  }
  
  /**
   * Handle earnings activity and update user balance
   */
  private async handleEarningsActivity(data: any, userId: string): Promise<void> {
    if (!userId) return;
    
    try {
      await this.updateUserStats(userId, {
        balanceChange: data.amount || 0,
        earningsChange: data.amount || 0
      });
      
      console.log(`💰 Updated user stats for earnings:`, {
        userId,
        amount: data.amount
      });
      
    } catch (error) {
      console.error('❌ Error handling earnings activity:', error);
    }
  }
  
  /**
   * Update user statistics in Firestore
   */
  private async updateUserStats(userId: string, changes: {
    balanceChange?: number;
    earningsChange?: number;
    lossesChange?: number;
    tradesCount?: number;
  }): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };
      
      if (changes.balanceChange !== undefined && changes.balanceChange !== 0) {
        updateData.balance = increment(changes.balanceChange);
      }
      
      if (changes.earningsChange !== undefined && changes.earningsChange > 0) {
        updateData.totalEarnings = increment(changes.earningsChange);
      }
      
      if (changes.lossesChange !== undefined && changes.lossesChange > 0) {
        updateData.totalLosses = increment(changes.lossesChange);
      }
      
      if (changes.tradesCount !== undefined && changes.tradesCount > 0) {
        updateData.totalTrades = increment(changes.tradesCount);
      }
      
      await updateDoc(userRef, updateData);
      
    } catch (error) {
      console.error('❌ Error updating user stats:', error);
    }
  }

  /**
   * Clean up subscriptions
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * Get current user data
   */
  getCurrentUser(): UserData | null {
    return this.currentUser;
  }

  /**
   * Check if tracker is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export default GlobalActivityTracker.getInstance();
