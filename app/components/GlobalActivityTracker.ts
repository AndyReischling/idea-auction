// components/GlobalActivityTracker.ts
// Unified system that works with your existing feed architecture

import { firebaseDataService, ActivityFeedItem, UserProfile } from '../lib/firebase-data-service';

interface ActivityTracker {
  id: string;
  type: string;
  username: string;
  opinionText?: string;
  targetUser?: string;
  betType?: string;
  targetPercentage?: number;
  amount?: number;
  quantity?: number;
  timestamp: Date;
  isBot?: boolean;
}

class GlobalActivityTracker {
  private static instance: GlobalActivityTracker;
  private currentUser: UserProfile | null = null;
  private subscribers: Map<string, (activity: ActivityTracker) => void> = new Map();

  private constructor() {
    this.initializeGlobalUser();
  }

  public static getInstance(): GlobalActivityTracker {
    if (!GlobalActivityTracker.instance) {
      GlobalActivityTracker.instance = new GlobalActivityTracker();
    }
    return GlobalActivityTracker.instance;
  }

  // Initialize user from Firebase via auth context
  private async initializeGlobalUser() {
    if (typeof window === 'undefined') return;

    try {
      // Get auth user if available
      const authContext = (window as any).authContext;
      if (authContext?.user?.uid) {
        this.currentUser = authContext.userProfile;
        console.log('🔄 GlobalActivityTracker: Initialized with Firebase user:', this.currentUser?.username);
      } else {
        console.log('⚠️ GlobalActivityTracker: No authenticated user found');
      }
    } catch (error) {
      console.error('❌ Error initializing global user:', error);
    }
  }

  // Update current user (called by auth context when user changes)
  public updateCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    console.log('👤 GlobalActivityTracker: User updated:', user?.username || 'None');
  }

  // Add Firebase sync for balance updates
  private async syncBalanceToFirebase() {
    if (!this.currentUser || typeof window === 'undefined') return;

    try {
      // Get auth user if available
      const authContext = (window as any).authContext;
      if (!authContext?.user?.uid) {
        // console.log('⚠️ No authenticated user found for Firebase sync');
        return;
      }

      const userId = authContext.user.uid;
      
      console.log('🔄 Syncing balance to Firebase:', this.currentUser.balance);
      
      // Update Firebase directly using the auth context methods
      if (authContext.updateBalance) {
        await authContext.updateBalance(this.currentUser.balance);
      }
      
      // Update earnings if needed
      if (authContext.updateEarnings) {
        await authContext.updateEarnings(
          this.currentUser.totalEarnings || 0,
          this.currentUser.totalLosses || 0
        );
      }
      
      console.log('✅ Balance synced to Firebase successfully');
    } catch (error) {
      console.error('❌ Error syncing balance to Firebase:', error);
    }
  }

  // Track user activity and persist to Firebase
  async trackActivity(
    type: string,
    details: {
      opinionText?: string;
      targetUser?: string;
      betType?: string;
      targetPercentage?: number;
      amount?: number;
      quantity?: number;
      isBot?: boolean;
    }
  ) {
    if (!this.currentUser) {
      console.warn('⚠️ Cannot track activity: No current user');
      return;
    }

    try {
      const activity: ActivityTracker = {
        id: `activity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type,
        username: this.currentUser.username,
        timestamp: new Date(),
        ...details
      };

      console.log('📊 Tracking activity:', activity);

      // Add to Firebase activity feed
      await firebaseDataService.addActivityFeedItem({
        userId: this.currentUser.uid,
        type: activity.type,
        username: activity.username,
        opinionText: activity.opinionText,
        targetUser: activity.targetUser,
        betType: activity.betType,
        targetPercentage: activity.targetPercentage,
        amount: activity.amount,
        quantity: activity.quantity,
        timestamp: activity.timestamp,
        isBot: activity.isBot || false
      });

      // Notify subscribers
      this.notifySubscribers(activity);

      console.log('✅ Activity tracked and saved to Firebase');
    } catch (error) {
      console.error('❌ Error tracking activity:', error);
    }
  }

  // Track transaction-specific activities
  async trackTransaction(
    type: 'buy' | 'sell' | 'earn',
    opinionText: string,
    amount: number,
    price: number,
    quantity: number = 1,
    isBot: boolean = false
  ) {
    await this.trackActivity(type, {
      opinionText,
      amount,
      quantity,
      isBot
    });

    // Also create the transaction record in Firebase
    if (this.currentUser) {
      try {
        if (isBot) {
          // Create bot transaction
          await firebaseDataService.createBotTransaction({
            userId: this.currentUser.uid,
            botId: 'auto-bot', // Default bot ID for now
            type,
            opinionText,
            amount,
            price,
            quantity,
            timestamp: new Date(),
            date: new Date()
          });
        } else {
          // Create user transaction
          await firebaseDataService.createTransaction({
            userId: this.currentUser.uid,
            type,
            opinionText,
            amount,
            price,
            quantity,
            timestamp: new Date(),
            date: new Date()
          });
        }

        console.log('✅ Transaction record created in Firebase');
      } catch (error) {
        console.error('❌ Error creating transaction record:', error);
      }
    }
  }

  // Track betting activities
  async trackBet(
    type: 'bet_place' | 'bet_win' | 'bet_loss',
    targetUser: string,
    betType: 'gain' | 'loss',
    targetPercentage: number,
    amount: number,
    isBot: boolean = false
  ) {
    await this.trackActivity(type, {
      targetUser,
      betType,
      targetPercentage,
      amount,
      isBot
    });
  }

  // Track short position activities
  async trackShort(
    type: 'short_place' | 'short_win' | 'short_loss',
    opinionText: string,
    amount: number,
    isBot: boolean = false
  ) {
    await this.trackActivity(type, {
      opinionText,
      amount,
      isBot
    });
  }

  // Track opinion generation
  async trackOpinionGeneration(opinionText: string, isBot: boolean = false) {
    await this.trackActivity(isBot ? 'bot_generate' : 'generate', {
      opinionText,
      isBot
    });
  }

  // Update user balance and sync to Firebase
  async updateBalance(newBalance: number) {
    if (!this.currentUser) {
      console.warn('⚠️ Cannot update balance: No current user');
      return;
    }

    const oldBalance = this.currentUser.balance;
    this.currentUser.balance = newBalance;

    // Calculate earnings/losses
    const change = newBalance - oldBalance;
    if (change > 0) {
      this.currentUser.totalEarnings = (this.currentUser.totalEarnings || 0) + change;
    } else if (change < 0) {
      this.currentUser.totalLosses = (this.currentUser.totalLosses || 0) + Math.abs(change);
    }

    console.log('💰 Balance updated:', { oldBalance, newBalance, change });

    // Sync to Firebase
    await this.syncBalanceToFirebase();
  }

  // Get current user balance from Firebase
  async getCurrentBalance(): Promise<number> {
    if (!this.currentUser) return 10000;

    try {
      // Get fresh data from Firebase
      const authContext = (window as any).authContext;
      if (authContext?.user?.uid) {
        const profile = await firebaseDataService.getUserProfile(authContext.user.uid);
        if (profile) {
          this.currentUser = profile;
          return profile.balance;
        }
      }
    } catch (error) {
      console.error('❌ Error getting current balance from Firebase:', error);
    }

    return this.currentUser.balance;
  }

  // Get user activity feed from Firebase
  async getUserActivityFeed(limit: number = 50): Promise<ActivityTracker[]> {
    if (!this.currentUser) return [];

    try {
      const activities = await firebaseDataService.getUserActivityFeed(this.currentUser.uid, limit);
      return activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        username: activity.username,
        opinionText: activity.opinionText,
        targetUser: activity.targetUser,
        betType: activity.betType,
        targetPercentage: activity.targetPercentage,
        amount: activity.amount,
        quantity: activity.quantity,
        timestamp: activity.timestamp,
        isBot: activity.isBot
      }));
    } catch (error) {
      console.error('❌ Error getting user activity feed:', error);
      return [];
    }
  }

  // Get global activity feed from Firebase
  async getGlobalActivityFeed(limit: number = 100): Promise<ActivityTracker[]> {
    try {
      const activities = await firebaseDataService.getGlobalActivityFeed(limit);
      return activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        username: activity.username,
        opinionText: activity.opinionText,
        targetUser: activity.targetUser,
        betType: activity.betType,
        targetPercentage: activity.targetPercentage,
        amount: activity.amount,
        quantity: activity.quantity,
        timestamp: activity.timestamp,
        isBot: activity.isBot
      }));
    } catch (error) {
      console.error('❌ Error getting global activity feed:', error);
      return [];
    }
  }

  // Subscribe to activity updates
  subscribe(callback: (activity: ActivityTracker) => void): string {
    const id = `activity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.subscribers.set(id, callback);
    return id;
  }

  // Unsubscribe from activity updates
  unsubscribe(id: string) {
    this.subscribers.delete(id);
  }

  // Notify subscribers of new activity
  private notifySubscribers(activity: ActivityTracker) {
    this.subscribers.forEach(callback => {
      try {
        callback(activity);
      } catch (error) {
        console.error('❌ Error notifying activity subscriber:', error);
      }
    });
  }

  // Get current user info
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // Real-time activity feed subscription
  subscribeToGlobalActivityFeed(callback: (activities: ActivityTracker[]) => void, limit: number = 100): string {
    return firebaseDataService.subscribeToGlobalActivityFeed((activities) => {
      const trackerActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        username: activity.username,
        opinionText: activity.opinionText,
        targetUser: activity.targetUser,
        betType: activity.betType,
        targetPercentage: activity.targetPercentage,
        amount: activity.amount,
        quantity: activity.quantity,
        timestamp: activity.timestamp,
        isBot: activity.isBot
      }));
      callback(trackerActivities);
    }, limit);
  }

  // Unsubscribe from Firebase subscriptions
  unsubscribeFromFirebase(subscriptionId: string) {
    firebaseDataService.unsubscribe(subscriptionId);
  }

  // Clean up all subscriptions
  cleanup() {
    this.subscribers.clear();
    firebaseDataService.unsubscribeAll();
  }
}

// Export singleton instance
export default GlobalActivityTracker.getInstance();
export default globalActivityTracker;
export default globalActivityTracker;