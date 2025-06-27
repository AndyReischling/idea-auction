'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';

interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'bet_place' | 'bet_win' | 'bet_loss' | 'generate';
  username: string;
  opinionText?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  timestamp: string;
  relativeTime: string;
}

interface UserProfile {
  username: string;
  balance: number;
}

export default function FeedPage() {
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000
  });
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'generates'>('all');

  // Function to add activity to global feed
  const addToGlobalFeed = (activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) => {
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: `${Date.now()}_${Math.random()}`,
      relativeTime: getRelativeTime(activity.timestamp)
    };

    // Get existing global feed
    const existingFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
    
    // Add new activity to beginning and keep last 100 items
    const updatedFeed = [newActivity, ...existingFeed].slice(0, 100);
    
    // Save back to localStorage
    localStorage.setItem('globalActivityFeed', JSON.stringify(updatedFeed));
    
    // Update local state
    setActivityFeed(updatedFeed);
  };

  // Get relative time string
  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // Load all real activity from various sources
  const loadRealActivity = (): ActivityFeedItem[] => {
    const activities: ActivityFeedItem[] = [];

    try {
      // 1. Load from global activity feed (where bots and real activity should be stored)
      const globalFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
      activities.push(...globalFeed);

      // 2. Load user's personal transactions if not already in global feed
      const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      userTransactions.forEach((t: any) => {
        // Only add if not already in global feed
        const exists = activities.some(a => a.id === t.id);
        if (!exists) {
          activities.push({
            id: t.id || `user_${Date.now()}`,
            type: t.type,
            username: currentUser.username,
            opinionText: t.opinionText || t.description,
            amount: t.amount,
            timestamp: new Date(t.date || Date.now()).toISOString(),
            relativeTime: getRelativeTime(new Date(t.date || Date.now()).toISOString()),
            targetUser: t.description?.includes('bet on') ? 'Target User' : undefined
          });
        }
      });

      // 3. Load betting activity
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      bets.forEach((bet: any) => {
        // Add bet placement activity
        const placeBetExists = activities.some(a => a.id === `bet_place_${bet.id}`);
        if (!placeBetExists) {
          activities.push({
            id: `bet_place_${bet.id}`,
            type: 'bet_place',
            username: bet.bettor,
            amount: -bet.amount,
            targetUser: bet.targetUser,
            betType: bet.betType,
            targetPercentage: bet.targetPercentage,
            timeframe: bet.timeFrame,
            timestamp: new Date(bet.placedDate).toISOString(),
            relativeTime: getRelativeTime(new Date(bet.placedDate).toISOString())
          });
        }

        // Add bet result activity if resolved
        if (bet.status === 'won' || bet.status === 'lost') {
          const resultExists = activities.some(a => a.id === `bet_result_${bet.id}`);
          if (!resultExists) {
            activities.push({
              id: `bet_result_${bet.id}`,
              type: bet.status === 'won' ? 'bet_win' : 'bet_loss',
              username: bet.bettor,
              amount: bet.status === 'won' ? bet.potentialPayout : -bet.amount,
              targetUser: bet.targetUser,
              timestamp: new Date().toISOString(), // Use current time as resolution time
              relativeTime: getRelativeTime(new Date().toISOString())
            });
          }
        }
      });

      // 4. Simulate some bot activity if the global feed is empty (for demo purposes)
      if (activities.length < 10) {
        const botUsernames = ['AI_Trader_001', 'AI_Trader_042', 'Bot_Alpha', 'Bot_Beta', 'SmartBot_99'];
        
        for (let i = 0; i < 20; i++) {
          const botUsername = botUsernames[Math.floor(Math.random() * botUsernames.length)];
          const timestamp = new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000).toISOString(); // Last 2 hours
          const opinionIndex = Math.floor(Math.random() * opinions.length);
          const opinion = opinions[opinionIndex];
          
          if (opinion) {
            const isBuy = Math.random() > 0.5;
            const price = Math.floor(Math.random() * 50) + 10;
            const quantity = Math.floor(Math.random() * 3) + 1;
            
            activities.push({
              id: `bot_${i}_${timestamp}`,
              type: isBuy ? 'buy' : 'sell',
              username: botUsername,
              opinionText: opinion.text,
              amount: isBuy ? -price * quantity : price * quantity,
              price,
              quantity,
              timestamp,
              relativeTime: getRelativeTime(timestamp)
            });
          }
        }
      }

    } catch (error) {
      console.error('Error loading activity:', error);
    }

    // Sort by timestamp (newest first) and remove duplicates
    const uniqueActivities = activities
      .filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return uniqueActivities;
  };

  // Get activity icon class
  const getActivityIconClass = (type: string) => {
    switch (type) {
      case 'buy': return styles.buy;
      case 'sell': return styles.sell;
      case 'bet_place': return styles.betPlace;
      case 'bet_win': return styles.betWin;
      case 'bet_loss': return styles.betLoss;
      case 'generate': return styles.generate;
      default: return styles.buy;
    }
  };

  // Get activity icon emoji
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'buy': return '🛒';
      case 'sell': return '💰';
      case 'bet_place': return '🎲';
      case 'bet_win': return '🎉';
      case 'bet_loss': return '😞';
      case 'generate': return '✨';
      default: return '📊';
    }
  };

  // Format activity description
  const formatActivityDescription = (activity: ActivityFeedItem) => {
    const { type, username, opinionText, amount, price, quantity, targetUser, betType, targetPercentage, timeframe } = activity;
    
    const isBot = username.includes('AI_') || username.includes('Bot_');
    const userPrefix = isBot ? '🤖 ' : '';
    
    switch (type) {
      case 'buy':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> bought {quantity} {quantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${price}</strong> each
          </span>
        );
      case 'sell':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> sold {quantity} {quantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${price}</strong> each
          </span>
        );
      case 'bet_place':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> bet <strong>${Math.abs(amount)}</strong> that{' '}
            <strong>{targetUser}</strong>'s portfolio will {betType} by {targetPercentage}% in {timeframe} days
          </span>
        );
      case 'bet_win':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> won <strong>${amount}</strong> from a portfolio bet on{' '}
            <strong>{targetUser}</strong>! 🎉
          </span>
        );
      case 'bet_loss':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> lost <strong>${Math.abs(amount)}</strong> on a portfolio bet
          </span>
        );
      case 'generate':
        return (
          <span>
            {userPrefix}<strong>{username}</strong> generated a new opinion and earned <strong>${amount}</strong>
          </span>
        );
      default:
        return (
          <span>
            {userPrefix}<strong>{username}</strong> performed an action for <strong>${Math.abs(amount)}</strong>
          </span>
        );
    }
  };

  // Filter activities
  const filterActivities = (activities: ActivityFeedItem[]) => {
    switch (filter) {
      case 'trades':
        return activities.filter(a => a.type === 'buy' || a.type === 'sell');
      case 'bets':
        return activities.filter(a => a.type === 'bet_place' || a.type === 'bet_win' || a.type === 'bet_loss');
      case 'generates':
        return activities.filter(a => a.type === 'generate');
      default:
        return activities;
    }
  };

  // Get filter count
  const getFilterCount = (filterType: string) => {
    switch (filterType) {
      case 'all':
        return activityFeed.length;
      case 'trades':
        return activityFeed.filter(a => a.type === 'buy' || a.type === 'sell').length;
      case 'bets':
        return activityFeed.filter(a => a.type.includes('bet')).length;
      case 'generates':
        return activityFeed.filter(a => a.type === 'generate').length;
      default:
        return 0;
    }
  };

  // Get amount class
  const getAmountClass = (amount: number) => {
    return amount >= 0 ? styles.positive : styles.negative;
  };

  // Make addToGlobalFeed available globally for other components to use
  useEffect(() => {
    (window as any).addToGlobalFeed = addToGlobalFeed;
    
    return () => {
      delete (window as any).addToGlobalFeed;
    };
  }, []);

  useEffect(() => {
    // Load opinions for sidebar
    const stored = localStorage.getItem('opinions');
    if (stored) {
      const parsed = JSON.parse(stored);
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setOpinions(validOpinions.map((text: string, i: number) => ({ id: i.toString(), text })));
    }

    // Load current user
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      setCurrentUser(JSON.parse(storedProfile));
    }
  }, []);

  useEffect(() => {
    // Load real activity
    const realActivity = loadRealActivity();
    setActivityFeed(realActivity);

    // Update relative times every minute
    const interval = setInterval(() => {
      setActivityFeed(prevFeed => 
        prevFeed.map(activity => ({
          ...activity,
          relativeTime: getRelativeTime(activity.timestamp)
        }))
      );
    }, 60000);

    // Refresh activity every 10 seconds to pick up new activity
    const refreshInterval = setInterval(() => {
      const newActivity = loadRealActivity();
      setActivityFeed(newActivity);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [opinions, currentUser]);

  const filteredActivities = filterActivities(activityFeed);

  return (
    <div className="page-container">
      <Sidebar opinions={opinions} />
      
      <main className="main-content">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.headerTitle}>
              📡 Live Trading Feed
            </h1>
            <p className={styles.headerSubtitle}>
              Real-time marketplace activity from all traders & bots
            </p>
          </div>
          
          <div className={styles.headerActions}>
            {/* Generate Opinions Button */}
            <a href="/generate" className="nav-button generate">
              ✨ Generate Opinions
            </a>

            {/* Navigation Buttons */}
            <a href="/users" className="nav-button traders">
              👥 Traders
            </a>
            <a href="/" className="nav-button traders">
              👤 My Wallet
            </a>
          </div>
        </div>

        {/* Filter Controls */}
        <div className={styles.filterControls}>
          <span className={styles.filterLabel}>Filter:</span>
          {(['all', 'trades', 'bets', 'generates'] as const).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`${styles.filterButton} ${filter === filterType ? styles.active : ''}`}
            >
              {filterType === 'all' ? `All Activity (${getFilterCount(filterType)})` :
               filterType === 'trades' ? `Trades (${getFilterCount(filterType)})` :
               filterType === 'bets' ? `Bets (${getFilterCount(filterType)})` :
               `Generates (${getFilterCount(filterType)})`}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div className={styles.feedContainer}>
          {/* Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.liveIndicator}></div>
            LIVE • {filteredActivities.length} Recent Activities • Updates every 10s
          </div>

          {/* Feed Content */}
          <div className={styles.feedContent}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyFeed}>
                <p>📭</p>
                <p>No activity found. Start trading to see live activity!</p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  🤖 Enable bots from the homepage to see automated trading activity
                </p>
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const isUserActivity = activity.username === currentUser.username;
                const isBotActivity = activity.username.includes('AI_') || activity.username.includes('Bot_');
                
                return (
                  <div 
                    key={activity.id}
                    className={`${styles.activityItem} ${isUserActivity ? styles.userActivity : ''} ${isBotActivity ? styles.botActivity : ''}`}
                  >
                    <div className={styles.activityLayout}>
                      {/* Activity Icon */}
                      <div className={`${styles.activityIcon} ${getActivityIconClass(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>

                      {/* Activity Content */}
                      <div className={styles.activityContent}>
                        <div className={styles.activityDescription}>
                          {formatActivityDescription(activity)}
                          {isUserActivity && (
                            <span className={styles.userBadge}>
                              YOU
                            </span>
                          )}
                          {isBotActivity && (
                            <span className={styles.botBadge}>
                              BOT
                            </span>
                          )}
                        </div>
                        
                        <div className={styles.activityMeta}>
                          <span className={styles.activityTime}>{activity.relativeTime}</span>
                          <span className={`${styles.activityAmount} ${getAmountClass(activity.amount)}`}>
                            {activity.amount >= 0 ? '+' : ''}${Math.abs(activity.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Market Stats */}
        <div className={styles.marketStats}>
          <div className={`${styles.statCard} ${styles.purchases}`}>
            <div className={`${styles.statNumber} ${styles.purchases}`}>
              {activityFeed.filter(a => a.type === 'buy').length}
            </div>
            <div className={styles.statLabel}>Total Purchases</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.sales}`}>
            <div className={`${styles.statNumber} ${styles.sales}`}>
              {activityFeed.filter(a => a.type === 'sell').length}
            </div>
            <div className={styles.statLabel}>Total Sales</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.bets}`}>
            <div className={`${styles.statNumber} ${styles.bets}`}>
              {activityFeed.filter(a => a.type.includes('bet')).length}
            </div>
            <div className={styles.statLabel}>Active Bets</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.volume}`}>
            <div className={`${styles.statNumber} ${styles.volume}`}>
              ${activityFeed.reduce((sum, a) => sum + Math.abs(a.amount), 0).toLocaleString()}
            </div>
            <div className={styles.statLabel}>Total Volume</div>
          </div>
        </div>
      </main>
    </div>
  );
}