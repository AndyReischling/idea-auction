"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import Sidebar from '../components/Sidebar';
import AuthButton from '../components/AuthButton';
import AuthStatusIndicator from '../components/AuthStatusIndicator';
import ActivityDetailModal from '../ActivityDetailModal';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Fire, 
  CurrencyDollar, 
  HandPeace, 
  DiceSix, 
  ChartLineDown, 
  Plus,
  User,
  Eye
} from '@phosphor-icons/react';

interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'short' | 'generate' | 'bet';
  username: string;
  userId?: string;
  opinionText?: string;
  amount: number;
  price?: number;
  quantity?: number;
  timestamp: any;
  relativeTime: string;
  isBot?: boolean;
}

interface UserProfile {
  username: string;
  balance: number;
}

interface BotProfile {
  id: string;
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  lastActive: string;
  isActive: boolean;
  personality: any;
  tradingStrategy: any;
  riskTolerance: string;
}

const formatRelative = (ts: string | Timestamp) => {
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function FeedPage() {
  const { user } = useAuth();
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'shorts' | 'generates'>('all');
  const [botCount, setBotCount] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  const handleActivityClick = (activity: ActivityFeedItem) => {
    setSelectedActivity(activity);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedActivity(null);
  };

  // Update current time on client side only
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    
    // Set initial time
    updateTime();
    
    // Update time every second
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Query both collections
    const transactionsQuery = query(
      collection(db, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const activityFeedQuery = query(
      collection(db, 'activity-feed'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    let transactionsData: ActivityFeedItem[] = [];
    let activityFeedData: ActivityFeedItem[] = [];

    const mergeAndSetData = () => {
      // Merge both datasets
      const allItems = [...transactionsData, ...activityFeedData];
      
      // Sort by timestamp and take the most recent 200 items
      const sortedItems = allItems
        .sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.seconds || 0;
          return bTime - aTime;
        })
        .slice(0, 200);

      setActivityFeed(sortedItems);
      setLoading(false);
    };

    // Subscribe to transactions collection
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      transactionsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: `transactions-${doc.id}`,
          type: data.type,
          username: data.username || 'Anonymous',
          userId: data.userId,
          opinionText: data.opinionText,
          amount: data.amount || 0,
          price: data.price,
          quantity: data.quantity,
          timestamp: data.timestamp,
          relativeTime: formatRelative(data.timestamp),
          isBot: data.isBot || false,
        };
      });
      mergeAndSetData();
    });

    // Subscribe to activity-feed collection
    const unsubscribeActivityFeed = onSnapshot(activityFeedQuery, (snapshot) => {
      activityFeedData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: `activity-feed-${doc.id}`,
          type: data.type || data.action || 'generate',
          username: data.username || data.user || 'Anonymous',
          userId: data.userId,
          opinionText: data.opinionText || data.text || data.description,
          amount: data.amount || data.value || 0,
          price: data.price,
          quantity: data.quantity,
          timestamp: data.timestamp,
          relativeTime: formatRelative(data.timestamp),
          isBot: data.isBot || false,
        };
      });
      mergeAndSetData();
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeActivityFeed();
    };
  }, []);

  useEffect(() => {
    const botsCollectionRef = collection(db, "autonomous-bots");
  
    const unsubscribe = onSnapshot(botsCollectionRef, (snapshot) => {
      const botData: BotProfile[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username,
          balance: data.balance,
          joinDate: data.joinDate,
          totalEarnings: data.totalEarnings,
          totalLosses: data.totalLosses,
          lastActive: data.lastActive,
          isActive: data.isActive,
          personality: data.personality,
          tradingStrategy: data.tradingStrategy,
          riskTolerance: data.riskTolerance,
        };
      });
  
      setBotCount(botData.length);
  
      const botActivities: ActivityFeedItem[] = botData.map(bot => ({
        id: bot.id,
        type: 'generate',
        username: bot.username,
        opinionText: bot.personality?.description || 'Bot activity',
        timestamp: Timestamp.fromDate(new Date(bot.lastActive)),
        relativeTime: formatRelative(bot.lastActive),
        amount: bot.totalEarnings - bot.totalLosses,
      }));
  
      setActivityFeed(prev => [...botActivities, ...prev].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds));
    });
  
    return () => unsubscribe();
  }, []);
  

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'generate': return '#3b82f6';
      case 'sell': return '#dc2626';
      case 'buy': return '#16a34a';
      case 'bet': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getActivityIcon = (type: string) => {
    if (type === 'buy') return <CurrencyDollar color="white" size={20} />;
    if (type === 'sell') return <HandPeace color="white" size={20} />;
    if (type === 'bet') return <DiceSix color="white" size={20} />;
    if (type === 'short') return <ChartLineDown color="white" size={20} />;
    return <Plus color="white" size={20} />;
  };

  const filteredActivities = activityFeed.filter(a => {
    switch (filter) {
      case 'trades': return ['buy', 'sell'].includes(a.type);
      case 'bets': return a.type.includes('bet');
      case 'shorts': return a.type.includes('short');
      case 'generates': return ['generate', 'earn'].includes(a.type);
      default: return true;
    }
  });

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content" style={{ paddingTop: '110px' }}>
        {/* Header */}
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">
              <Fire size={24} />
            </div>
            <div className="user-info">
              <div className="user-name">Live Feed</div>
              <p>Real-time trading activity</p>
              <p>Active traders: {botCount}</p>
            </div>
          </div>

          <div className="navigation-buttons">
            <AuthStatusIndicator />
            <a href="/users" className="nav-button">
              <User size={20} /> Traders
            </a>
            <a href="/" className="nav-button">
              <Eye size={20} /> Market
            </a>
            <AuthButton />
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{
          margin: '40px 20px 20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          border: '2px solid var(--border-primary)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            fontSize: 'var(--font-size-sm)',
            fontWeight: '500',
          }}>
            <span style={{ marginRight: '20px', color: 'var(--black)', fontWeight: '600' }}>FILTER:</span>
            {[
              { key: 'all', label: `All Activity (${activityFeed.length})` },
              { key: 'trades', label: `Trades (${activityFeed.filter(a => ['buy', 'sell'].includes(a.type)).length})` },
              { key: 'bets', label: `Bets (${activityFeed.filter(a => a.type.includes('bet')).length})` },
              { key: 'shorts', label: `Shorts (${activityFeed.filter(a => a.type.includes('short')).length})` },
              { key: 'generates', label: `Generates (${activityFeed.filter(a => ['generate', 'earn'].includes(a.type)).length})` },
            ].map((tab, index) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                style={{
                  background: filter === tab.key ? 'var(--info)' : 'transparent',
                  color: filter === tab.key ? 'white' : 'var(--black)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '500',
                  marginRight: index < 4 ? '8px' : '0',
                  transition: 'all var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Summary */}
        <div style={{
          margin: '20px 20px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          border: '2px solid var(--border-primary)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: '500',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--red)' }}>LIVE</span> • {filteredActivities.length} Recent Activities • 🤖 {botCount} bots • 👤 8 users • Last refresh: {currentTime}
        </div>

        {/* Activity Feed */}
        <div style={{ margin: '20px' }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-secondary)',
            }}>
              Loading…
            </div>
          ) : filteredActivities.map((activity) => (
            <div key={activity.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 24px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-primary)',
              marginBottom: '8px',
              transition: 'all var(--transition)',
              cursor: 'pointer',
            }}
            onClick={() => handleActivityClick(activity)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-purple)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              {/* Activity Icon */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: getActivityColor(activity.type),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
                flexShrink: 0,
              }}>
                {getActivityIcon(activity.type)}
              </div>

              {/* Activity Content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}>
                  <span style={{ fontWeight: '600' }}>{activity.username || 'Anonymous'}</span>
                  {activity.username && activity.username.toLowerCase().includes('bot') && (
                    <span style={{
                      background: 'var(--yellow)',
                      color: 'var(--black)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '10px',
                      fontWeight: '700',
                      marginLeft: '8px',
                    }}>
                      BOT
                    </span>
                  )}
                  <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>
                    {activity.type}
                  </span>
                                     <span style={{ fontWeight: '500' }}>
                     "{(activity.opinionText || '').slice(0, 60)}..."
                   </span>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-tertiary)',
                }}>
                  {activity.relativeTime}
                </div>
              </div>

              {/* Amount */}
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '700',
                fontFamily: 'var(--font-number)',
                color: activity.amount >= 0 ? 'var(--green)' : 'var(--red)',
                textAlign: 'right',
                minWidth: '80px',
              }}>
                {activity.amount >= 0 ? '+' : ''}${activity.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Activity Detail Modal */}
      {showModal && selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={handleCloseModal}
          currentUser={user}
          onUpdateUser={() => {}}
        />
      )}
    </div>
  );
}