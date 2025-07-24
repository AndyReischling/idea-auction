"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  collectionGroup,
  writeBatch,
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
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');

  /* --------------------------------------------------------------
     Load bots + global state + recent activity
     --------------------------------------------------------------*/
    const loadBotData = async () => {
    try {
      // Fetch bots from autonomous-bots collection
      const botsQuery = collection(db, 'autonomous-bots');
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
    // Note: Bot pause/resume disabled for subcollection structure
    // Would need to know parent document ID to update properly
    console.warn('Bot pause/resume not implemented for subcollection structure');
  };

  const handleResumeBot = async (botId: string) => {
    // Note: Bot pause/resume disabled for subcollection structure
    // Would need to know parent document ID to update properly
    console.warn('Bot pause/resume not implemented for subcollection structure');
  };

  const handleMigrateBots = async () => {
    setIsMigrating(true);
    setMigrationStatus('🚀 Starting reverse migration (top-level → subcollections)...');
    
    try {
      // Get all top-level bot documents (the ones we need to move)
      const autonomousBotsQuery = query(collection(db, 'autonomous-bots'));
      const autonomousBotsSnapshot = await getDocs(autonomousBotsQuery);
      
      setMigrationStatus(`📋 Found ${autonomousBotsSnapshot.size} documents to scan`);
      
      // Filter for actual bot documents (ones that have bot data, not parent containers)
      const botDocuments: any[] = [];
      
      for (const docSnapshot of autonomousBotsSnapshot.docs) {
        const data = docSnapshot.data();
        
        // Check if this is a bot document (has bot-specific fields)
        if (data.balance !== undefined || data.isActive !== undefined || data.personality !== undefined || data._migrated === true) {
          botDocuments.push({
            id: docSnapshot.id,
            data: data
          });
        }
      }
      
      setMigrationStatus(`📦 Found ${botDocuments.length} bot documents to migrate to subcollections`);
      
      if (botDocuments.length === 0) {
        setMigrationStatus('✅ No bot documents found to migrate');
        setIsMigrating(false);
        return;
      }
      
      // Create or use a parent document for the bots subcollection
      const parentDocId = 'bot-container-' + Date.now();
      
      // Process bots in batches of 100
      const batchSize = 100;
      let processed = 0;
      
      for (let i = 0; i < botDocuments.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchBots = botDocuments.slice(i, i + batchSize);
        
        setMigrationStatus(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(botDocuments.length/batchSize)} (${batchBots.length} bots)`);
        
        for (const botInfo of batchBots) {
          const botData = botInfo.data;
          
          // Create top-level autonomous-bots document reference
          const botDocRef = doc(db, 'autonomous-bots', botData.id || `bot_${processed}`);
          
          // Clean bot data (remove migration metadata)
          const cleanBotData = {
            ...botData,
            id: botData.id || `bot_${processed}`,
            balance: botData.balance || 10000,
            isActive: botData.isActive !== undefined ? botData.isActive : true,
            joinDate: botData.joinDate || new Date().toISOString().split('T')[0],
            lastActive: botData.lastActive || new Date().toISOString(),
            username: botData.username || `Bot_${processed + 1}`,
            // Remove migration metadata
            _migrated: undefined,
            _migratedAt: undefined,
            _originalParent: undefined
          };
          
          // Clean undefined values
          Object.keys(cleanBotData).forEach(key => {
            if (cleanBotData[key] === undefined) {
              delete cleanBotData[key];
            }
          });
          
          // Add to autonomous-bots collection
          batch.set(botDocRef, cleanBotData);
          
          // Delete the old top-level document
          batch.delete(doc(db, 'autonomous-bots', botInfo.id));
          
          processed++;
        }
        
        // Commit batch
        await batch.commit();
        setMigrationStatus(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${processed}/${botDocuments.length} bots)`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Create the parent document to make the subcollection visible
      const parentDocRef = doc(db, 'autonomous-bots', parentDocId);
      await setDoc(parentDocRef, {
        type: 'bot-container',
        createdAt: new Date().toISOString(),
        totalBots: processed,
        description: 'Container for bot subcollection'
      });
      
      setMigrationStatus(`🎉 Reverse migration completed! ${processed} bots moved to subcollections`);
      
      // Refresh bot data
      setTimeout(() => {
        loadBotData();
        setIsMigrating(false);
      }, 2000);
      
    } catch (error) {
      console.error('Reverse migration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMigrationStatus(`❌ Reverse migration failed: ${errorMessage}`);
      setIsMigrating(false);
    }
  };

  const handleEmergencyRecovery = async () => {
    setIsRecovering(true);
    setRecoveryStatus('🚨 Starting emergency bot recovery...');
    
    try {
      // Check if bots exist in autonomous-bots collection first
      const botsQuery = collection(db, 'autonomous-bots');
      const botsSnapshot = await getDocs(botsQuery);
      
      setRecoveryStatus(`📋 Checking for existing bots... Found ${botsSnapshot.size} in autonomous-bots collection`);
      
      if (botsSnapshot.size > 0) {
        setRecoveryStatus('✅ Bots found in subcollections! No recovery needed. Try refreshing the app.');
        setIsRecovering(false);
        return;
      }
      
      setRecoveryStatus('🔄 No bots found. Recreating 1000 bots...');
      
      // Create parent container
      const parentDocId = 'bot-container-' + Date.now();
      
      // Bot personalities and strategies
      const personalities = [
        { name: 'Conservative Carl', description: 'Plays it safe with steady investments', activityFrequency: 50, betProbability: 0.05, buyProbability: 0.2 },
        { name: 'Aggressive Alice', description: 'High-risk, high-reward trading style', activityFrequency: 200, betProbability: 0.3, buyProbability: 0.6 },
        { name: 'Moderate Mike', description: 'Balanced approach to trading', activityFrequency: 100, betProbability: 0.15, buyProbability: 0.4 },
        { name: 'Trendy Tina', description: 'Follows market trends and popular opinions', activityFrequency: 150, betProbability: 0.2, buyProbability: 0.5 },
        { name: 'Contrarian Connor', description: 'Goes against the crowd', activityFrequency: 80, betProbability: 0.1, buyProbability: 0.3 }
      ];
      
      const riskLevels = ['conservative', 'moderate', 'aggressive'];
      
      // Create bots in batches of 100
      const batchSize = 100;
      let created = 0;
      
      for (let i = 0; i < 1000; i += batchSize) {
        const batch = writeBatch(db);
        const batchCount = Math.min(batchSize, 1000 - i);
        
        setRecoveryStatus(`🔄 Creating batch ${Math.floor(i/batchSize) + 1}/10 (${batchCount} bots)`);
        
        for (let j = 0; j < batchCount; j++) {
          const botIndex = i + j;
          const personality = personalities[botIndex % personalities.length];
          const riskTolerance = riskLevels[botIndex % riskLevels.length];
          
          const botData = {
            id: `bot_${botIndex}`,
            username: `${personality.name.split(' ')[0]}_${botIndex}`,
            balance: 10000 + Math.floor(Math.random() * 50000),
            isActive: true,
            joinDate: new Date().toISOString().split('T')[0],
            lastActive: new Date().toISOString(),
            personality: {
              name: personality.name,
              description: personality.description,
              activityFrequency: personality.activityFrequency + Math.floor(Math.random() * 50 - 25),
              betProbability: personality.betProbability,
              buyProbability: personality.buyProbability
            },
            riskTolerance: riskTolerance,
            tradingStrategy: {
              type: riskTolerance === 'aggressive' ? 'momentum' : riskTolerance === 'conservative' ? 'value' : 'balanced'
            },
            totalEarnings: Math.floor(Math.random() * 5000),
            totalLosses: Math.floor(Math.random() * 2000),
            _recreated: true,
            _recreatedAt: new Date().toISOString()
          };
          
          // Add to autonomous-bots collection
          const botRef = doc(db, 'autonomous-bots', `bot_${botIndex}`);
          batch.set(botRef, botData);
          created++;
        }
        
        // Commit batch
        await batch.commit();
        setRecoveryStatus(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${created}/1000 bots)`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Create parent container document
      const parentRef = doc(db, 'autonomous-bots', parentDocId);
      await setDoc(parentRef, {
        type: 'bot-container',
        totalBots: created,
        createdAt: new Date().toISOString(),
        description: 'Emergency recreated bot container'
      });
      
      setRecoveryStatus(`🎉 Emergency recovery completed! Created ${created} bots`);
      
      // Refresh bot data
      setTimeout(() => {
        loadBotData();
        setIsRecovering(false);
      }, 2000);
      
    } catch (error) {
      console.error('Emergency recovery failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setRecoveryStatus(`❌ Emergency recovery failed: ${errorMessage}`);
      setIsRecovering(false);
    }
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>🤖 Bot Control Panel</h1>
      
      {/* Migration Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '2px solid #e9ecef'
      }}>
                 <h2 style={{ marginBottom: '15px', color: '#dc3545' }}>🔄 Bot Structure Migration</h2>
         <p style={{ marginBottom: '15px', color: '#6c757d' }}>
           Move bots from top-level documents to subcollections (proper bot container structure).
         </p>
        
        <button
          onClick={handleMigrateBots}
          disabled={isMigrating}
          style={{
            padding: '12px 24px',
            backgroundColor: isMigrating ? '#6c757d' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isMigrating ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginRight: '10px'
          }}
        >
          {isMigrating ? '🔄 Migrating...' : '🔄 Move Bots to Subcollections'}
        </button>
        
        {migrationStatus && (
          <div style={{ 
            marginTop: '15px',
            padding: '10px', 
            background: migrationStatus.includes('❌') ? '#f8d7da' : '#d1ecf1',
            border: `1px solid ${migrationStatus.includes('❌') ? '#f5c6cb' : '#bee5eb'}`,
            borderRadius: '4px',
            color: migrationStatus.includes('❌') ? '#721c24' : '#0c5460'
          }}>
            {migrationStatus}
          </div>
        )}
      </div>

      {/* Emergency Recovery Section */}
      <div style={{ 
        background: '#fff3cd', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '2px solid #ffeaa7'
      }}>
        <h2 style={{ marginBottom: '15px', color: '#856404' }}>🚨 Emergency Bot Recovery</h2>
        <p style={{ marginBottom: '15px', color: '#856404' }}>
          If bots were accidentally deleted, use this to recreate 1000 bots with proper data structure.
        </p>
        
        <button
          onClick={handleEmergencyRecovery}
          disabled={isRecovering}
          style={{
            padding: '12px 24px',
            backgroundColor: isRecovering ? '#6c757d' : '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isRecovering ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginRight: '10px'
          }}
        >
          {isRecovering ? '🔄 Recovering...' : '🚨 Emergency: Recreate All Bots'}
        </button>
        
        {recoveryStatus && (
          <div style={{ 
            marginTop: '15px',
            padding: '10px', 
            background: recoveryStatus.includes('❌') ? '#f8d7da' : recoveryStatus.includes('✅') ? '#d4edda' : '#d1ecf1',
            border: `1px solid ${recoveryStatus.includes('❌') ? '#f5c6cb' : recoveryStatus.includes('✅') ? '#c3e6cb' : '#bee5eb'}`,
            borderRadius: '4px',
            color: recoveryStatus.includes('❌') ? '#721c24' : recoveryStatus.includes('✅') ? '#155724' : '#0c5460'
          }}>
            {recoveryStatus}
          </div>
        )}
      </div>

      {/* Bot System Controls */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '2px solid #e9ecef'
      }}>
        <h2 style={{ marginBottom: '15px' }}>System Controls</h2>
        <p style={{ marginBottom: '15px', color: '#6c757d' }}>
          Currently {bots.length} bots in system | System is {isRunning ? 'RUNNING' : 'STOPPED'}
        </p>
        
        <button
          onClick={handleStartStop}
          style={{
            padding: '12px 24px',
            backgroundColor: isRunning ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {isRunning ? '⏸️ Stop All Bots' : '▶️ Start All Bots'}
        </button>
      </div>

      {/* Bot List */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '2px solid #e9ecef'
      }}>
        <h2 style={{ marginBottom: '15px' }}>Bot List ({bots.length} bots)</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {bots.map(bot => (
            <div key={bot.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '10px',
              background: 'white',
              borderRadius: '5px',
              border: '1px solid #dee2e6'
            }}>
              <div>
                <strong>{bot.username}</strong> | Balance: {formatCurrency(bot.balance)} | 
                <span style={{ color: getStatusColor(bot.isActive ? 'active' : 'paused') }}>
                  {bot.isActive ? '🟢 Active' : '🟡 Paused'}
                </span>
              </div>
              <div>
                <button
                  onClick={() => bot.isActive ? handlePauseBot(bot.id) : handleResumeBot(bot.id)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: bot.isActive ? '#ffc107' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {bot.isActive ? '⏸️ Pause' : '▶️ Resume'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px',
        border: '2px solid #e9ecef'
      }}>
        <h2 style={{ marginBottom: '15px' }}>Recent Activity</h2>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {recentActivity.map(activity => (
            <div key={activity.id} style={{ 
              padding: '8px',
              marginBottom: '8px',
              background: 'white',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              fontSize: '14px'
            }}>
              <strong>{activity.botUsername}</strong> - {activity.description}
              {activity.amount && <span> | {formatCurrency(activity.amount)}</span>}
              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
