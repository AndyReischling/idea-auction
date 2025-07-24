'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FirebaseActivityService } from '../lib/firebase-activity';
import type { LocalActivityItem } from '../lib/firebase-activity';
import { 
  ShoppingCart, 
  TrendUp, 
  TrendDown, 
  CurrencyDollar, 
  Lightbulb, 
  User,
  Clock,
  Robot
} from '@phosphor-icons/react';

interface RecentActivityProps {
  userId?: string; // If provided, filter activities for specific user
  maxItems?: number;
  title?: string;
}

// Helper function to check if a userId corresponds to a bot
async function checkIfUserIsBot(userId: string): Promise<boolean> {
  try {
    // Check if userId exists in autonomous-bots collection
    const botDoc = await getDoc(doc(db, 'autonomous-bots', userId));
    if (botDoc.exists()) {
      return true;
    }

    // Also check users collection for isBot flag
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData?.isBot === true || userData?.botId != null;
    }

    return false;
  } catch (error) {
    console.error('Error checking if user is bot:', error);
    return false; // Default to regular user on error
  }
}

export default function RecentActivity({ userId, maxItems = 15, title = "Recent Activity" }: RecentActivityProps) {
  const [activities, setActivities] = useState<LocalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        
        if (userId) {
          // Set up real-time subscriptions for user activities
          const unsubscriptions: (() => void)[] = [];
          
          // First, check if this userId is a bot by checking the autonomous-bots collection
          const isUserBot = await checkIfUserIsBot(userId);
          console.log(`🔍 RecentActivity: Checking activities for userId: ${userId}, isBot: ${isUserBot}`);
          
          // 🔍 DEBUG: Additional logging to track data flow
          console.log('🔍 RecentActivity COMPONENT DEBUG:');
          console.log('📍 Component received userId:', userId);
          console.log('📍 Component received title:', title);
          console.log('📊 About to query collections with this userId:', userId);

          // REAL-TIME SUBSCRIPTION 1: User transactions (always included for both bots and users)
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('userId', '==', userId),
            limit(100)
          );
          const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
            const transactionActivities: LocalActivityItem[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              
              // ✅ CRITICAL FIX: Verify userId matches to prevent data leakage
              if (data.userId !== userId) {
                console.warn('⚠️ RecentActivity: Skipping activity with mismatched userId:', {
                  expectedUserId: userId,
                  actualUserId: data.userId,
                  docId: doc.id
                });
                return; // Skip this activity
              }
              
              const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : (data.date || new Date().toISOString());
              
              let username = data.username || data.metadata?.username || 'Anonymous';
              if (data.botId && username === 'Anonymous') {
                username = `Bot_${data.botId}`;
              }
              
              const activity = {
                id: `transactions-${doc.id}`,
                type: data.type,
                username: username,
                opinionText: data.opinionText,
                opinionId: data.opinionId,
                amount: data.amount || 0,
                price: data.price || data.metadata?.price,
                quantity: data.quantity || data.metadata?.quantity,
                targetUser: data.targetUser || data.metadata?.targetUser,
                betType: data.betType || data.metadata?.betType,
                targetPercentage: data.targetPercentage || data.metadata?.targetPercentage,
                timeframe: data.timeframe,
                timestamp: timestamp,
                relativeTime: getRelativeTime(timestamp),
                isBot: data.isBot || !!data.botId
              };
              
              // 🔍 DEBUG: Log each activity being added
              console.log('🔍 RecentActivity: Found valid transaction activity:', {
                docId: doc.id,
                expectedUserId: userId,
                actualUserId: data.userId,
                username: activity.username,
                type: activity.type,
                opinionText: activity.opinionText?.slice(0, 50) + '...',
                isBot: activity.isBot
              });
              
              transactionActivities.push(activity);
            });
            
            // Update state with combined activities
            setActivities(prevActivities => {
              const otherActivities = prevActivities.filter(a => !a.id.startsWith('transactions-'));
              const combined = [...transactionActivities, ...otherActivities];
              combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return combined.slice(0, maxItems);
            });
          });
          unsubscriptions.push(unsubscribeTransactions);

          // REAL-TIME SUBSCRIPTION 2: Activity feed for user (always included)
          const activityFeedQuery = query(
            collection(db, 'activity-feed'),
            where('userId', '==', userId),
            limit(100)
          );
          const unsubscribeActivityFeed = onSnapshot(activityFeedQuery, (snapshot) => {
            const activityFeedItems: LocalActivityItem[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              
              // ✅ CRITICAL FIX: Verify userId matches to prevent data leakage
              if (data.userId !== userId) {
                console.warn('⚠️ RecentActivity: Skipping activity-feed with mismatched userId:', {
                  expectedUserId: userId,
                  actualUserId: data.userId,
                  docId: doc.id
                });
                return; // Skip this activity
              }
              
              const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString();
              
              let username = data.username || data.user || 'Anonymous';
              if (data.botId && (username === 'Anonymous' || !username)) {
                username = `Bot_${data.botId}`;
              }
              
              console.log('🔍 RecentActivity: Found valid activity-feed item:', {
                docId: doc.id,
                expectedUserId: userId,
                actualUserId: data.userId,
                username: username,
                type: data.type || data.action || 'generate'
              });
              
              activityFeedItems.push({
                id: `activity-feed-${doc.id}`,
                type: data.type || data.action || 'generate',
                username: username,
                opinionText: data.opinionText || data.text || data.description,
                opinionId: data.opinionId,
                amount: data.amount || data.value || 0,
                price: data.price,
                quantity: data.quantity,
                targetUser: data.targetUser,
                betType: data.betType,
                targetPercentage: data.targetPercentage,
                timeframe: data.timeframe,
                timestamp: timestamp,
                relativeTime: getRelativeTime(timestamp),
                isBot: data.isBot || !!data.botId
              });
            });
            
            // Update state with combined activities
            setActivities(prevActivities => {
              const otherActivities = prevActivities.filter(a => !a.id.startsWith('activity-feed-'));
              const combined = [...activityFeedItems, ...otherActivities];
              combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return combined.slice(0, maxItems);
            });
          });
          unsubscriptions.push(unsubscribeActivityFeed);

          // REAL-TIME SUBSCRIPTION 3 & 4: Bot-specific activities (ONLY if userId is actually a bot)
          if (isUserBot) {
            console.log(`🤖 User ${userId} is a bot - including bot-specific activity subscriptions`);
            
            // Bot transactions
            const botTransactionsQuery = query(
              collection(db, 'transactions'),
              where('botId', '==', userId),
              limit(100)
            );
            const unsubscribeBotTransactions = onSnapshot(botTransactionsQuery, (snapshot) => {
              const botTransactionActivities: LocalActivityItem[] = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : (data.date || new Date().toISOString());
                
                let username = data.username || data.metadata?.username || `Bot_${data.botId}`;
                
                botTransactionActivities.push({
                  id: `bot-transactions-${doc.id}`,
                  type: data.type,
                  username: username,
                  opinionText: data.opinionText,
                  opinionId: data.opinionId,
                  amount: data.amount || 0,
                  price: data.price || data.metadata?.price,
                  quantity: data.quantity || data.metadata?.quantity,
                  targetUser: data.targetUser || data.metadata?.targetUser,
                  betType: data.betType || data.metadata?.betType,
                  targetPercentage: data.targetPercentage || data.metadata?.targetPercentage,
                  timeframe: data.timeframe,
                  timestamp: timestamp,
                  relativeTime: getRelativeTime(timestamp),
                  isBot: true
                });
              });
              
              // Update state with combined activities
              setActivities(prevActivities => {
                const otherActivities = prevActivities.filter(a => !a.id.startsWith('bot-transactions-'));
                const combined = [...botTransactionActivities, ...otherActivities];
                combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                return combined.slice(0, maxItems);
              });
            });
            unsubscriptions.push(unsubscribeBotTransactions);

            // Bot activity feed
            const botActivityFeedQuery = query(
              collection(db, 'activity-feed'),
              where('botId', '==', userId),
              limit(100)
            );
            const unsubscribeBotActivityFeed = onSnapshot(botActivityFeedQuery, (snapshot) => {
              const botActivityFeedItems: LocalActivityItem[] = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString();
                
                let username = data.username || data.user || `Bot_${data.botId || doc.id}`;
                
                botActivityFeedItems.push({
                  id: `bot-activity-feed-${doc.id}`,
                  type: data.type || data.action || 'generate',
                  username: username,
                  opinionText: data.opinionText || data.text || data.description,
                  opinionId: data.opinionId,
                  amount: data.amount || data.value || 0,
                  price: data.price,
                  quantity: data.quantity,
                  targetUser: data.targetUser,
                  betType: data.betType,
                  targetPercentage: data.targetPercentage,
                  timeframe: data.timeframe,
                  timestamp: timestamp,
                  relativeTime: getRelativeTime(timestamp),
                  isBot: true
                });
              });
              
              // Update state with combined activities
              setActivities(prevActivities => {
                const otherActivities = prevActivities.filter(a => !a.id.startsWith('bot-activity-feed-'));
                const combined = [...botActivityFeedItems, ...otherActivities];
                combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                return combined.slice(0, maxItems);
              });
            });
            unsubscriptions.push(unsubscribeBotActivityFeed);
          } else {
            console.log(`👤 User ${userId} is a regular user - skipping bot-specific activity subscriptions`);
          }

          console.log('🔄 Set up real-time activity subscriptions for user:', userId);
          
          // Return cleanup function for all subscriptions
          return () => {
            console.log('🧹 Cleaning up activity subscriptions');
            unsubscriptions.forEach(unsub => unsub());
          };
        } else {
          // Get all recent activities from both collections with real-time updates
          const unsubscriptions: (() => void)[] = [];

          // REAL-TIME SUBSCRIPTION: All transactions
          const transactionsQuery = query(
            collection(db, 'transactions'),
            limit(50)
          );
          const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
            const transactionActivities: LocalActivityItem[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString();
              transactionActivities.push({
                id: `transactions-${doc.id}`,
                type: data.type,
                username: data.username || 'Anonymous',
                opinionText: data.opinionText,
                opinionId: data.opinionId,
                amount: data.amount || 0,
                price: data.price,
                quantity: data.quantity,
                targetUser: data.targetUser,
                betType: data.betType,
                targetPercentage: data.targetPercentage,
                timeframe: data.timeframe,
                timestamp: timestamp,
                relativeTime: getRelativeTime(timestamp),
                isBot: data.isBot || false
              });
            });
            
            // Update state with combined activities
            setActivities(prevActivities => {
              const otherActivities = prevActivities.filter(a => !a.id.startsWith('transactions-'));
              const combined = [...transactionActivities, ...otherActivities];
              combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return combined.slice(0, maxItems);
            });
          });
          unsubscriptions.push(unsubscribeTransactions);

          // REAL-TIME SUBSCRIPTION: All activity feed
          const activityFeedQuery = query(
            collection(db, 'activity-feed'),
            limit(50)
          );
          const unsubscribeActivityFeed = onSnapshot(activityFeedQuery, (snapshot) => {
            const activityFeedItems: LocalActivityItem[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              const timestamp = data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString();
              activityFeedItems.push({
                id: `activity-feed-${doc.id}`,
                type: data.type || data.action || 'generate',
                username: data.username || data.user || 'Anonymous',
                opinionText: data.opinionText || data.text || data.description,
                opinionId: data.opinionId,
                amount: data.amount || data.value || 0,
                price: data.price,
                quantity: data.quantity,
                targetUser: data.targetUser,
                betType: data.betType,
                targetPercentage: data.targetPercentage,
                timeframe: data.timeframe,
                timestamp: timestamp,
                relativeTime: getRelativeTime(timestamp),
                isBot: data.isBot || false
              });
            });
            
            // Update state with combined activities
            setActivities(prevActivities => {
              const otherActivities = prevActivities.filter(a => !a.id.startsWith('activity-feed-'));
              const combined = [...activityFeedItems, ...otherActivities];
              combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return combined.slice(0, maxItems);
            });
          });
          unsubscriptions.push(unsubscribeActivityFeed);

          console.log('🔄 Set up real-time activity subscriptions for all activities');
          
          // Return cleanup function for all subscriptions
          return () => {
            console.log('🧹 Cleaning up global activity subscriptions');
            unsubscriptions.forEach(unsub => unsub());
          };
        }
      } catch (err) {
        console.error('Error setting up activity subscriptions:', err);
        setError('Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    // Store cleanup function
    let cleanup: (() => void) | undefined;
    
    loadActivities().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [userId, maxItems]);

  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <ShoppingCart size={16} />;
      case 'sell':
        return <TrendDown size={16} />;
      case 'bet':
      case 'bet_place':
        return <TrendUp size={16} />;
      case 'bet_win':
        return <TrendUp size={16} />;
      case 'bet_loss':
        return <TrendDown size={16} />;
      case 'earn':
        return <CurrencyDollar size={16} />;
      case 'generate':
        return <Lightbulb size={16} />;
      case 'short_place':
      case 'short_win':
      case 'short_loss':
        return <TrendDown size={16} />;
      default:
        return <User size={16} />;
    }
  };

  const getActivityDescription = (activity: LocalActivityItem): string => {
    switch (activity.type) {
      case 'buy':
        return `bought ${activity.quantity || 1}× "${activity.opinionText || 'opinion'}"`;
      case 'sell':
        return `sold ${activity.quantity || 1}× "${activity.opinionText || 'opinion'}"`;
      case 'bet':
      case 'bet_place':
        return activity.targetUser 
          ? `bet ${activity.betType === 'increase' ? '📈' : '📉'} ${activity.targetPercentage}% on ${activity.targetUser}`
          : `placed a bet on "${activity.opinionText || 'opinion'}"`;
      case 'bet_win':
        return `won a bet on "${activity.opinionText || activity.targetUser || 'opinion'}"`;
      case 'bet_loss':
        return `lost a bet on "${activity.opinionText || activity.targetUser || 'opinion'}"`;
      case 'earn':
        return `earned from "${activity.opinionText || 'opinion'}"`;
      case 'generate':
        return `generated a new opinion`;
      case 'short_place':
        return `shorted "${activity.opinionText || 'opinion'}"`;
      case 'short_win':
        return `won short position on "${activity.opinionText || 'opinion'}"`;
      case 'short_loss':
        return `lost short position on "${activity.opinionText || 'opinion'}"`;
      default:
        return `did ${activity.type}`;
    }
  };

  const getAmountColor = (type: string, amount: number): string => {
    if (type === 'earn' || type === 'bet_win' || type === 'short_win' || amount > 0) {
      return 'var(--green)';
    }
    if (type === 'bet_loss' || type === 'short_loss' || amount < 0) {
      return 'var(--red)';
    }
    return 'var(--text-secondary)';
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        margin: '40px 32px 20px',
        border: '2px solid var(--border-primary)',
        maxWidth: '1200px',
        marginLeft: '24px',
        marginRight: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-base)'
        }}>
          Loading activities...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        margin: '40px 32px 20px',
        border: '2px solid var(--border-primary)',
        maxWidth: '1200px',
        marginLeft: '24px',
        marginRight: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--red)',
          fontSize: 'var(--font-size-base)'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--white)',
      borderRadius: 'var(--radius-lg)',
      padding: '40px',
      margin: '40px 32px 20px',
      border: '2px solid var(--border-primary)',
      maxWidth: '1200px',
      marginLeft: '24px',
      marginRight: '24px'
    }}>
      <h2 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: '700',
        margin: '0 0 24px 0',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Clock size={24} />
        {title}
      </h2>

      {activities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-base)',
          padding: '20px 0'
        }}>
          No recent activity
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          background: 'var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}>
          {activities.map((activity) => (
            <div
              key={activity.id}
              style={{
                background: 'var(--white)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'background-color var(--transition)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--white)';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-light)',
                color: 'var(--text-secondary)',
                flexShrink: 0
              }}>
                {getActivityIcon(activity.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    {activity.username}
                  </span>
                  {activity.isBot && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-light)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <Robot size={12} />
                      BOT
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {getActivityDescription(activity)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
                flexShrink: 0
              }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  color: getAmountColor(activity.type, activity.amount)
                }}>
                  {activity.amount !== 0 && (
                    <>
                      {activity.amount > 0 ? '+' : ''}
                      ${Math.abs(activity.amount).toFixed(2)}
                    </>
                  )}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)'
                }}>
                  {activity.relativeTime}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 