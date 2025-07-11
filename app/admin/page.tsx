"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../global.css';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------*/
interface BotProfile {
  id: string;
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  personality: {
    name: string;
    description: string;
    activityFrequency: number;
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  tradingStrategy: {
    type: string;
  };
  lastActive: string;
  isActive: boolean;
}

interface BotActivity {
  id: string;
  type: string;
  botUsername: string;
  description: string;
  amount?: number;
  timestamp: string;
}

/* ------------------------------------------------------------------
   Helpers (Firestore wrappers)
   ------------------------------------------------------------------*/
const SETTINGS_DOC = doc(db, 'bot-settings', 'global');

async function getGlobalBotState(): Promise<boolean> {
  const snap = await getDoc(SETTINGS_DOC);
  return snap.exists() ? !!snap.data().autoStart : false;
}

async function setGlobalBotState(enabled: boolean) {
  await setDoc(SETTINGS_DOC, { autoStart: enabled, updatedAt: Timestamp.now() }, { merge: true });
}

async function fetchRecentBotActivities(): Promise<BotActivity[]> {
  const q = query(collection(db, 'bot-transactions'), orderBy('timestamp', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as BotActivity[];
}

/* ------------------------------------------------------------------
   Component
   ------------------------------------------------------------------*/
export default function AdminPage() {
  const router = useRouter();
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [recentActivity, setRecentActivity] = useState<BotActivity[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* --------------------------------------------------------------
     Load bots + global state + recent activity
     --------------------------------------------------------------*/
    const loadBotData = async () => {
    try {
      // Fetch bots from Firestore directly
      const botsQuery = query(collection(db, 'bots'));
      const botsSnap = await getDocs(botsQuery);
      setBots(botsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BotProfile[]);

      setIsRunning(await getGlobalBotState());
      setRecentActivity(await fetchRecentBotActivities());
      setLoading(false);
    } catch (err) {
      console.error('Error loading bot data:', err);
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------
     Live listeners
     --------------------------------------------------------------*/
  useEffect(() => {
    loadBotData();

    // Live listener for global bot state changes
    const unsubSettings = onSnapshot(SETTINGS_DOC, snap => {
      if (snap.exists()) setIsRunning(!!snap.data().autoStart);
    });

    // Live listener for bot transactions
    const unsubTx = onSnapshot(
      query(collection(db, 'bot-transactions'), orderBy('timestamp', 'desc'), limit(20)),
      snap => {
        setRecentActivity(
          snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as BotActivity[]
        );
      }
    );

    // refresh bots list every 30s (or implement listener in botSystem)
    const interval = setInterval(loadBotData, 30000);

    return () => {
      clearInterval(interval);
      unsubSettings();
      unsubTx();
    };
  }, []);

  /* --------------------------------------------------------------
     Handlers
     --------------------------------------------------------------*/
  const handleStartStop = async () => {
    try {
      await setGlobalBotState(!isRunning);
    } catch (err) {
      console.error('Error toggling bot state:', err);
    }
  };

  const handlePauseBot = async (botId: string) => {
    await setDoc(doc(db, 'bots', botId), { isActive: false }, { merge: true });
    loadBotData(); // Refresh data
  };

  const handleResumeBot = async (botId: string) => {
    await setDoc(doc(db, 'bots', botId), { isActive: true }, { merge: true });
    loadBotData(); // Refresh data
  };

  /* --------------------------------------------------------------
     UI helpers (unchanged)
     --------------------------------------------------------------*/
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'paused':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const diff = Date.now() - date.getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'Just now';
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  /* --------------------------------------------------------------
     Render (UI part intact)
     --------------------------------------------------------------*/
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>🤖 Bot Control Panel</h1>
        <p>Loading bot system...</p>
      </div>
    );
  }

  // ... (UI JSX identical to your original – omitted for brevity)
}
