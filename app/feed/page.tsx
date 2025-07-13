"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FirebaseActivityItem } from '../lib/firebase-activity';
import AuthButton from '../components/AuthButton';
import Sidebar from '../components/Sidebar';
import styles from './page.module.css';
import { 
  Rss, 
  ScanSmiley, 
  Balloon, 
  Wallet,
  CurrencyDollar,
  HandPeace,
  DiceSix,
  ChartLineDown,
  Plus
} from '@phosphor-icons/react';

interface ActivityFeedItem extends FirebaseActivityItem {
  relativeTime: string;
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
  const router = useRouter();
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'shorts' | 'generates'>('all');
  const [botCount, setBotCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const feedQuery = query(
      collection(db, 'activity-feed'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(feedQuery, (snapshot) => {
      const items: ActivityFeedItem[] = snapshot.docs.map((doc) => {
        const data = doc.data() as FirebaseActivityItem;
        return {
          ...data,
          id: doc.id,
          relativeTime: formatRelative(data.timestamp),
        };
      });
      setActivityFeed(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const botDocRef = doc(db, "bot-container-1752273492815", "bots", "0");
  
    const unsubscribe = onSnapshot(botDocRef, (snapshot) => {
      const data = snapshot.data();
      if (data) {
        // Explicitly construct the botData array
        const botData: BotProfile[] = Object.entries(data).map(([key, bot]: [string, any]) => ({
          id: bot.id,
          username: bot.username,
          balance: bot.balance,
          joinDate: bot.joinDate,
          totalEarnings: bot.totalEarnings,
          totalLosses: bot.totalLosses,
          lastActive: bot.lastActive,
          isActive: bot.isActive,
          personality: bot.personality,
          tradingStrategy: bot.tradingStrategy,
          riskTolerance: bot.riskTolerance,
        }));
  
        setBotCount(botData.length);
  
        const botActivities: ActivityFeedItem[] = botData.map(bot => ({
          id: bot.id,
          type: 'generate',
          username: bot.username,
          opinionText: bot.personality.description,
          timestamp: Timestamp.fromDate(new Date(bot.lastActive)),
          relativeTime: formatRelative(bot.lastActive),
          amount: bot.totalEarnings - bot.totalLosses,
        }));
  
        setActivityFeed(prev => [...botActivities, ...prev].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds));
      }
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

  if (!user) {
    return (
      <div className={styles.authContainer}>
        <AuthButton />
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <Sidebar />
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <h1><Rss size={32}/> Live Feed</h1>
        </header>

        <div className={styles.feedSection}>
          {loading ? (
            <div className={styles.loading}>Loading…</div>
          ) : filteredActivities.map((activity) => (
            <div key={activity.id} className={styles.activityItem}>
              <div className={styles.activityIcon} style={{backgroundColor: getActivityColor(activity.type)}}>
                {getActivityIcon(activity.type)}
              </div>
              <div className={styles.activityContent}>
                <span>{activity.username}</span> {activity.type} "{activity.opinionText}" ({activity.relativeTime})
                <span>{activity.amount >= 0 ? '+' : '-'}${Math.abs(activity.amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}