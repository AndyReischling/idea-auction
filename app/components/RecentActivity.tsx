'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
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

export default function RecentActivity({ userId, maxItems = 15, title = "Recent Activity" }: RecentActivityProps) {
  const [activities, setActivities] = useState<LocalActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        
        if (userId) {
          // Query both collections for user activities
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('userId', '==', userId),
            limit(100)
          );

          const activityFeedQuery = query(
            collection(db, 'activity-feed'),
            where('userId', '==', userId),
            limit(100)
          );

          const [transactionsSnapshot, activityFeedSnapshot] = await Promise.all([
            getDocs(transactionsQuery),
            getDocs(activityFeedQuery)
          ]);

          const userActivities: LocalActivityItem[] = [];

          // Process transactions
          transactionsSnapshot.forEach((doc) => {
            const data = doc.data();
            userActivities.push({
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
              timestamp: data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString(),
              relativeTime: getRelativeTime(data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()),
              isBot: data.isBot || false
            });
          });

          // Process activity feed
          activityFeedSnapshot.forEach((doc) => {
            const data = doc.data();
            userActivities.push({
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
              timestamp: data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString(),
              relativeTime: getRelativeTime(data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()),
              isBot: data.isBot || false
            });
          });

          // Sort by timestamp (newest first) and take the most recent activities
          userActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivities(userActivities.slice(0, maxItems));
        } else {
          // Get all recent activities from both collections
          const transactionsQuery = query(
            collection(db, 'transactions'),
            limit(50)
          );

          const activityFeedQuery = query(
            collection(db, 'activity-feed'),
            limit(50)
          );

          const [transactionsSnapshot, activityFeedSnapshot] = await Promise.all([
            getDocs(transactionsQuery),
            getDocs(activityFeedQuery)
          ]);

          const allActivities: LocalActivityItem[] = [];

          // Process transactions
          transactionsSnapshot.forEach((doc) => {
            const data = doc.data();
            allActivities.push({
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
              timestamp: data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString(),
              relativeTime: getRelativeTime(data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()),
              isBot: data.isBot || false
            });
          });

          // Process activity feed
          activityFeedSnapshot.forEach((doc) => {
            const data = doc.data();
            allActivities.push({
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
              timestamp: data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString(),
              relativeTime: getRelativeTime(data.timestamp?.toDate?.() ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()),
              isBot: data.isBot || false
            });
          });

          // Sort by timestamp (newest first) and take the most recent activities
          allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivities(allActivities.slice(0, maxItems));
        }
      } catch (err) {
        console.error('Error loading activities:', err);
        setError('Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
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