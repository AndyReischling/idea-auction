'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';

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

  // Get activity icon and color
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'buy': return { icon: '🛒', color: '#28a745', bg: '#d4edda' };
      case 'sell': return { icon: '💰', color: '#17a2b8', bg: '#d1ecf1' };
      case 'bet_place': return { icon: '🎲', color: '#6f42c1', bg: '#e2d9f3' };
      case 'bet_win': return { icon: '🎉', color: '#28a745', bg: '#d4edda' };
      case 'bet_loss': return { icon: '😞', color: '#dc3545', bg: '#f8d7da' };
      case 'generate': return { icon: '✨', color: '#ffc107', bg: '#fff3cd' };
      default: return { icon: '📊', color: '#6c757d', bg: '#f8f9fa' };
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={opinions} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem' 
        }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#333' }}>
              📡 Live Trading Feed
            </h1>
            <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '1.1rem' }}>
              Real-time marketplace activity from all traders
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Generate Opinions Button */}
            <a
              href="/generate"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ✨ Generate Opinions
            </a>

            {/* Navigation Buttons */}
            <a href="/users" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6f42c1', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              👥 Traders
            </a>
            <a href="/" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#007bff', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              👤 My Wallet
            </a>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <span style={{ marginRight: '1rem', fontWeight: 'bold', color: '#666' }}>Filter:</span>
          {(['all', 'trades', 'bets', 'generates'] as const).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: filter === filterType ? '#007bff' : 'white',
                color: filter === filterType ? 'white' : '#333',
                border: '1px solid #007bff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: filter === filterType ? 'bold' : 'normal',
                textTransform: 'capitalize'
              }}
            >
              {filterType === 'all' ? `All Activity (${activityFeed.length})` :
               filterType === 'trades' ? `Trades (${activityFeed.filter(a => a.type === 'buy' || a.type === 'sell').length})` :
               filterType === 'bets' ? `Bets (${activityFeed.filter(a => a.type.includes('bet')).length})` :
               `Generates (${activityFeed.filter(a => a.type === 'generate').length})`}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Feed Header */}
          <div style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            🔴 LIVE • {filteredActivities.length} Recent Activities
          </div>

          {/* Feed Content */}
          <div style={{
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: '0'
          }}>
            {filteredActivities.length === 0 ? (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#6c757d'
              }}>
                <p style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>📭</p>
                <p style={{ margin: 0 }}>No activity found for this filter</p>
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const { icon, color, bg } = getActivityIcon(activity.type);
                const isUserActivity = activity.username === currentUser.username;
                
                return (
                  <div 
                    key={activity.id}
                    style={{
                      padding: '1rem 1.5rem',
                      borderBottom: index < filteredActivities.length - 1 ? '1px solid #f1f3f4' : 'none',
                      backgroundColor: isUserActivity ? '#f0f8ff' : 'transparent',
                      borderLeft: isUserActivity ? '4px solid #007bff' : 'none',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      {/* Activity Icon */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0
                      }}>
                        {icon}
                      </div>

                      {/* Activity Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.95rem',
                          lineHeight: '1.4',
                          color: '#495057',
                          marginBottom: '0.25rem'
                        }}>
                          {formatActivityDescription(activity)}
                          {isUserActivity && (
                            <span style={{
                              marginLeft: '0.5rem',
                              padding: '0.125rem 0.5rem',
                              backgroundColor: '#007bff',
                              color: 'white',
                              borderRadius: '10px',
                              fontSize: '0.7rem',
                              fontWeight: 'bold'
                            }}>
                              YOU
                            </span>
                          )}
                        </div>
                        
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#6c757d',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{activity.relativeTime}</span>
                          <span style={{
                            fontWeight: 'bold',
                            color: activity.amount >= 0 ? '#28a745' : '#dc3545'
                          }}>
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
        <div style={{
          marginTop: '2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#d4edda',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>
              {activityFeed.filter(a => a.type === 'buy').length}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#155724' }}>Total Purchases</div>
          </div>
          
          <div style={{
            padding: '1rem',
            backgroundColor: '#d1ecf1',
            borderRadius: '8px',
            border: '1px solid #b8daff',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0c5460' }}>
              {activityFeed.filter(a => a.type === 'sell').length}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#0c5460' }}>Total Sales</div>
          </div>
          
          <div style={{
            padding: '1rem',
            backgroundColor: '#e2d9f3',
            borderRadius: '8px',
            border: '1px solid #d4c4fb',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#6f42c1' }}>
              {activityFeed.filter(a => a.type.includes('bet')).length}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#6f42c1' }}>Active Bets</div>
          </div>
          
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffeaa7',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#856404' }}>
              ${activityFeed.reduce((sum, a) => sum + Math.abs(a.amount), 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#856404' }}>Total Volume</div>
          </div>
        </div>
      </main>
    </div>
  );
}