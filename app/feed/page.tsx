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

  // Mock usernames for activity generation
  const mockUsernames = [
    'CryptoGuru2024', 'OpinionWhale', 'TrendSpotter', 'MarketMaven', 'BearishBob',
    'BullishBella', 'VolatileVic', 'SteadySteve', 'DiamondHands', 'PaperTrader',
    'AlgoAssassin', 'PatternPundit', 'ChartChampion', 'RiskyRita', 'SafetySteven'
  ];

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

  // Generate mock activity (simulates other users trading)
  const generateMockActivity = (): ActivityFeedItem[] => {
    const activities: ActivityFeedItem[] = [];
    const activityTypes = ['buy', 'sell', 'bet_place', 'bet_win', 'generate'] as const;
    
    // Generate 50 mock activities
    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const username = mockUsernames[Math.floor(Math.random() * mockUsernames.length)];
      
      const baseActivity = {
        id: `mock_${i}`,
        username,
        timestamp,
        relativeTime: getRelativeTime(timestamp)
      };

      if (type === 'buy' || type === 'sell') {
        const opinionIndex = Math.floor(Math.random() * opinions.length);
        const opinion = opinions[opinionIndex];
        const price = Math.floor(Math.random() * 100) + 10;
        const quantity = Math.floor(Math.random() * 3) + 1;
        
        activities.push({
          ...baseActivity,
          type,
          opinionText: opinion?.text || 'Random market opinion about future trends',
          amount: type === 'buy' ? -price * quantity : price * quantity,
          price,
          quantity
        });
      } else if (type === 'bet_place') {
        const targetUser = mockUsernames[Math.floor(Math.random() * mockUsernames.length)];
        const betType = Math.random() > 0.5 ? 'increase' : 'decrease';
        const targetPercentage = [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)];
        const timeframe = [1, 3, 7, 14, 30][Math.floor(Math.random() * 5)];
        const amount = Math.floor(Math.random() * 500) + 50;
        
        activities.push({
          ...baseActivity,
          type,
          targetUser,
          betType,
          targetPercentage,
          timeframe,
          amount: -amount
        });
      } else if (type === 'bet_win') {
        const targetUser = mockUsernames[Math.floor(Math.random() * mockUsernames.length)];
        const amount = Math.floor(Math.random() * 1000) + 100;
        
        activities.push({
          ...baseActivity,
          type,
          targetUser,
          amount
        });
      } else if (type === 'generate') {
        const amount = Math.floor(Math.random() * 50) + 10;
        
        activities.push({
          ...baseActivity,
          type,
          amount,
          opinionText: 'Generated new opinion for the marketplace'
        });
      }
    }

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Load user's actual transactions
  const loadUserTransactions = (): ActivityFeedItem[] => {
    try {
      const storedTransactions = localStorage.getItem('transactions');
      if (!storedTransactions) return [];

      const transactions = JSON.parse(storedTransactions);
      return transactions.map((t: any, index: number) => ({
        id: t.id || `user_${index}`,
        type: t.type,
        username: currentUser.username,
        opinionText: t.opinionText || t.description,
        amount: t.amount,
        timestamp: new Date(t.date).toISOString(),
        relativeTime: getRelativeTime(new Date(t.date).toISOString()),
        targetUser: t.description?.includes('bet on') ? 'Target User' : undefined
      }));
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
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
    
    switch (type) {
      case 'buy':
        return (
          <span>
            <strong>{username}</strong> bought {quantity} {quantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${price}</strong> each
          </span>
        );
      case 'sell':
        return (
          <span>
            <strong>{username}</strong> sold {quantity} {quantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${price}</strong> each
          </span>
        );
      case 'bet_place':
        return (
          <span>
            <strong>{username}</strong> bet <strong>${Math.abs(amount)}</strong> that{' '}
            <strong>{targetUser}</strong>'s portfolio will {betType} by {targetPercentage}% in {timeframe} days
          </span>
        );
      case 'bet_win':
        return (
          <span>
            <strong>{username}</strong> won <strong>${amount}</strong> from a portfolio bet on{' '}
            <strong>{targetUser}</strong>!
          </span>
        );
      case 'bet_loss':
        return (
          <span>
            <strong>{username}</strong> lost <strong>${Math.abs(amount)}</strong> on a portfolio bet
          </span>
        );
      case 'generate':
        return (
          <span>
            <strong>{username}</strong> generated a new opinion and earned <strong>${amount}</strong>
          </span>
        );
      default:
        return (
          <span>
            <strong>{username}</strong> performed an action for <strong>${Math.abs(amount)}</strong>
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
    if (opinions.length > 0) {
      // Combine user transactions with mock activity
      const userTransactions = loadUserTransactions();
      const mockActivities = generateMockActivity();
      
      // Merge and sort by timestamp
      const allActivities = [...userTransactions, ...mockActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivityFeed(allActivities);

      // Update relative times every minute
      const interval = setInterval(() => {
        setActivityFeed(prevFeed => 
          prevFeed.map(activity => ({
            ...activity,
            relativeTime: getRelativeTime(activity.timestamp)
          }))
        );
      }, 60000);

      return () => clearInterval(interval);
    }
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
              Real-time marketplace activity from all traders
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
            LIVE • {filteredActivities.length} Recent Activities
          </div>

          {/* Feed Content */}
          <div className={styles.feedContent}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyFeed}>
                <p>📭</p>
                <p>No activity found for this filter</p>
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const isUserActivity = activity.username === currentUser.username;
                
                return (
                  <div 
                    key={activity.id}
                    className={`${styles.activityItem} ${isUserActivity ? styles.userActivity : ''}`}
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