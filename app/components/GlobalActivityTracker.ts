// components/GlobalActivityTracker.ts
// Unified system that works with your existing feed architecture

export interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'short_place' | 'short_win' | 'short_loss' | 'bet_place' | 'bet_win' | 'bet_loss' | 'generate';
  username: string;
  opinionText?: string;
  opinionId?: string | number;
  amount: number;
  price?: number;
  quantity?: number;
  timestamp: string;
  relativeTime?: string;
  isBot: boolean;
  botId?: string;
}

class GlobalActivityTracker {
  private currentUser: any = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (typeof window === 'undefined') return;
    
    // Load current user from localStorage
    try {
      const storedUser = localStorage.getItem('userProfile');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      } else {
        this.currentUser = {
          username: 'OpinionTrader123',
          balance: 10000,
          joinDate: new Date().toLocaleDateString(),
          totalEarnings: 0,
          totalLosses: 0
        };
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.currentUser = {
        username: 'OpinionTrader123',
        balance: 10000,
        joinDate: new Date().toLocaleDateString(),
        totalEarnings: 0,
        totalLosses: 0
      };
    }

    this.initialized = true;
    // console.log('🔧 Global Activity Tracker initialized with user:', this.currentUser?.username);
  }

  private safeGetFromStorage(key: string, defaultValue: any = null) {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }

  public getCurrentUser() {
    return this.currentUser;
  }

  public setCurrentUser(user: any) {
    this.currentUser = user;
    // console.log('🔧 Global Activity Tracker user updated:', user?.username);
  }

  // CORE METHOD: Add to global feed (works with existing feed system)
  public addToGlobalFeed(activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) {
    if (!this.initialized) this.initialize();
    
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      relativeTime: this.getRelativeTime(activity.timestamp),
      // Ensure proper decimal precision
      amount: Math.round(activity.amount * 100) / 100,
      price: activity.price ? Math.round(activity.price * 100) / 100 : activity.price
    };

    // Get existing global feed
    const existingFeed = this.safeGetFromStorage('globalActivityFeed', []);
    
    // Add new activity to beginning and keep last 200 items
    const updatedFeed = [newActivity, ...existingFeed].slice(0, 200);
    
    // Save back to localStorage
    this.safeSetToStorage('globalActivityFeed', updatedFeed);
    
    // Dispatch event for real-time updates (works with existing feed page)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('globalActivityUpdate', {
        detail: { activity: newActivity, totalCount: updatedFeed.length }
      }));
      
      window.dispatchEvent(new CustomEvent('newTransaction', {
        detail: newActivity
      }));
    }

    // console.log(`🔥 Added to globalActivityFeed: ${activity.username} ${activity.type} ${activity.opinionText?.slice(0, 30)}...`);
  }

  private getRelativeTime(timestamp: string): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  // WRAPPER: trackTrade function (calls addToGlobalFeed)
  public trackTrade(action: 'buy' | 'sell', opinion: string, quantity: number, price: number, totalCost: number) {
    if (!this.currentUser) {
      console.warn('⚠️ trackTrade called but no current user set');
      return;
    }

    this.addToGlobalFeed({
      type: action,
      username: this.currentUser.username,
      opinionText: opinion,
      amount: action === 'buy' ? -Math.abs(totalCost) : Math.abs(totalCost),
      price: price,
      quantity: quantity,
      timestamp: new Date().toISOString(),
      isBot: false
    });

    // console.log(`🔥 trackTrade: ${this.currentUser.username} ${action} ${quantity}x "${opinion.slice(0, 30)}..." @ $${price.toFixed(2)} = $${totalCost.toFixed(2)}`);
  }

  // WRAPPER: interceptBuyTransaction function  
  public interceptBuyTransaction(opinion: string, quantity: number, price: number) {
    if (!this.currentUser) {
      console.warn('⚠️ interceptBuyTransaction called but no current user set');
      return;
    }

    const totalCost = quantity * price;
    this.addToGlobalFeed({
      type: 'buy',
      username: this.currentUser.username,
      opinionText: opinion,
      amount: -Math.abs(totalCost),
      price: price,
      quantity: quantity,
      timestamp: new Date().toISOString(),
      isBot: false
    });

    // console.log(`🔥 interceptBuyTransaction: ${this.currentUser.username} bought ${quantity}x "${opinion.slice(0, 30)}..." @ $${price.toFixed(2)}`);
  }

  // WRAPPER: interceptSellTransaction function
  public interceptSellTransaction(opinion: string, quantity: number, price: number) {
    if (!this.currentUser) {
      console.warn('⚠️ interceptSellTransaction called but no current user set');
      return;
    }

    const totalReceived = quantity * price;
    this.addToGlobalFeed({
      type: 'sell',
      username: this.currentUser.username,
      opinionText: opinion,
      amount: Math.abs(totalReceived),
      price: price,
      quantity: quantity,
      timestamp: new Date().toISOString(),
      isBot: false
    });

    console.log(`🔥 interceptSellTransaction: ${this.currentUser.username} sold ${quantity}x "${opinion.slice(0, 30)}..." @ $${price.toFixed(2)}`);
  }

  // Method to track short position activities
  public trackShortActivity(type: 'short_place' | 'short_win' | 'short_loss', opinionText: string, amount: number, additionalData?: any) {
    if (!this.currentUser) {
      console.warn('⚠️ trackShortActivity called but no current user set');
      return;
    }

    this.addToGlobalFeed({
      type: type,
      username: this.currentUser.username,
      opinionText: opinionText,
      amount: amount,
      timestamp: new Date().toISOString(),
      isBot: false,
      ...additionalData
    });

    console.log(`🔥 trackShortActivity: ${this.currentUser.username} ${type} "${opinionText.slice(0, 30)}..." = $${amount.toFixed(2)}`);
  }

  // Method to track opinion generation
  public trackOpinionGeneration(opinionText: string, earnings: number = 0) {
    if (!this.currentUser) {
      console.warn('⚠️ trackOpinionGeneration called but no current user set');
      return;
    }

    this.addToGlobalFeed({
      type: 'earn',
      username: this.currentUser.username,
      opinionText: opinionText,
      amount: earnings,
      timestamp: new Date().toISOString(),
      isBot: false
    });

    console.log(`🔥 trackOpinionGeneration: ${this.currentUser.username} generated "${opinionText.slice(0, 30)}..." earned $${earnings.toFixed(2)}`);
  }

  // HELPER: Get all activities (works with existing loadRealActivity)
  public getActivities(): ActivityFeedItem[] {
    return this.safeGetFromStorage('globalActivityFeed', []);
  }

  // HELPER: Force refresh of feed page
  public forceRefreshFeed() {
    if (typeof window !== 'undefined' && (window as any).forceRefreshFeed) {
      console.log('🔄 Triggering feed refresh...');
      (window as any).forceRefreshFeed();
    }
  }

  // HELPER: Statistics
  public getActivityStats() {
    const activities = this.getActivities();
    const stats = {
      total: activities.length,
      botActivities: activities.filter(a => a.isBot).length,
      humanActivities: activities.filter(a => !a.isBot).length,
      buyActivities: activities.filter(a => a.type === 'buy').length,
      sellActivities: activities.filter(a => a.type === 'sell').length,
      shortActivities: activities.filter(a => a.type.includes('short')).length,
      earnActivities: activities.filter(a => a.type === 'earn').length,
      last24Hours: activities.filter(a => {
        const activityTime = new Date(a.timestamp).getTime();
        return Date.now() - activityTime < 24 * 60 * 60 * 1000;
      }).length
    };

    console.log('📊 Activity Statistics:', stats);
    return stats;
  }
}

// Create global instance
const globalActivityTracker = new GlobalActivityTracker();

// Make it globally accessible - EXACTLY the functions your opinion page expects
if (typeof window !== 'undefined') {
  (window as any).globalActivityTracker = globalActivityTracker;
  
  // PRIMARY FUNCTIONS - these are what your opinion page calls
  (window as any).addToGlobalFeed = globalActivityTracker.addToGlobalFeed.bind(globalActivityTracker);
  (window as any).trackTrade = globalActivityTracker.trackTrade.bind(globalActivityTracker);
  (window as any).interceptBuyTransaction = globalActivityTracker.interceptBuyTransaction.bind(globalActivityTracker);
  (window as any).interceptSellTransaction = globalActivityTracker.interceptSellTransaction.bind(globalActivityTracker);
  
  // ADDITIONAL FUNCTIONS
  (window as any).trackShortActivity = globalActivityTracker.trackShortActivity.bind(globalActivityTracker);
  (window as any).trackOpinionGeneration = globalActivityTracker.trackOpinionGeneration.bind(globalActivityTracker);
  
  // DEBUG FUNCTIONS
  (window as any).getActivityStats = globalActivityTracker.getActivityStats.bind(globalActivityTracker);
  (window as any).getGlobalActivities = globalActivityTracker.getActivities.bind(globalActivityTracker);
  (window as any).forceRefreshFeed = globalActivityTracker.forceRefreshFeed.bind(globalActivityTracker);
  
  // Console logs temporarily disabled for auth debugging
  // console.log('🌐 Global Activity Tracker loaded - provides functions expected by opinion page!');
  // console.log('📱 Available functions that your code expects:');
  // console.log('  ✅ addToGlobalFeed(activity)');
  // console.log('  ✅ trackTrade(action, opinion, quantity, price, totalCost)');
  // console.log('  ✅ interceptBuyTransaction(opinion, quantity, price)');
  // console.log('  ✅ interceptSellTransaction(opinion, quantity, price)');
  // console.log('📱 Additional functions:');
  // console.log('  - trackShortActivity(type, opinionText, amount)');
  // console.log('  - trackOpinionGeneration(opinionText, earnings)');
  // console.log('  - getActivityStats() - View activity statistics');
  // console.log('  - getGlobalActivities() - View all activities');
}

export default globalActivityTracker;