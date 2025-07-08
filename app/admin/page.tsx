'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../global.css';

// Define BotProfile interface locally
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

export default function AdminPage() {
  const router = useRouter();
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [recentActivity, setRecentActivity] = useState<BotActivity[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBotData = async () => {
    try {
      const { default: botSystem } = await import('../components/autonomous-bots');
      setBots(botSystem.getBots());
      
      // Check bot status from localStorage
      const botsEnabled = localStorage.getItem('botsAutoStart') === 'true';
      setIsRunning(botsEnabled);
      
      // Load recent bot transactions
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      const botProfiles = botSystem.getBots();
      const botMap = botProfiles.reduce((map: any, bot: any) => {
        map[bot.id] = bot.username;
        return map;
      }, {});

      const activities: BotActivity[] = transactions
        .slice(-20) // Last 20 transactions
        .map((transaction: any) => ({
          id: transaction.id,
          type: transaction.type,
          botUsername: botMap[transaction.botId] || 'Unknown Bot',
          description: getActivityDescription(transaction),
          amount: transaction.amount,
          timestamp: transaction.date
        }))
        .reverse(); // Most recent first
      
      setRecentActivity(activities);
      setLoading(false);
    } catch (error) {
      console.error('Error loading bot data:', error);
      setLoading(false);
    }
  };

  const getActivityDescription = (transaction: any): string => {
    switch (transaction.type) {
      case 'buy':
        return `bought opinion: "${transaction.opinionText?.slice(0, 40)}..." for $${Math.abs(transaction.amount)}`;
      case 'sell':
        return `sold opinion: "${transaction.opinionText?.slice(0, 40)}..." for $${transaction.amount}`;
      case 'bet':
        return transaction.opinionText || `placed portfolio bet for $${Math.abs(transaction.amount)}`;
      case 'earn':
        return `generated opinion: "${transaction.opinionText?.slice(0, 40)}..." and earned $${transaction.amount}`;
      default:
        return `performed ${transaction.type} action`;
    }
  };

  useEffect(() => {
    loadBotData();
    
    // Set up interval to refresh data every 10 seconds
    const interval = setInterval(loadBotData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Simplified bot control handlers
  const handleStartStop = () => {
    if (isRunning) {
      localStorage.setItem('botsAutoStart', 'false');
      setIsRunning(false);
      console.log('🛑 Bots disabled globally');
    } else {
      localStorage.setItem('botsAutoStart', 'true');
      setIsRunning(true);
      console.log('🤖 Bots enabled globally');
    }
    // Quick refresh after action
    setTimeout(loadBotData, 1000);
  };

  const handlePauseBot = async (botId: string) => {
    try {
      const { default: botSystem } = await import('../components/autonomous-bots');
      botSystem.pauseBot(botId);
      await loadBotData();
    } catch (error) {
      console.error('Error pausing bot:', error);
    }
  };

  const handleResumeBot = async (botId: string) => {
    try {
      const { default: botSystem } = await import('../components/autonomous-bots');
      botSystem.resumeBot(botId);
      await loadBotData();
    } catch (error) {
      console.error('Error resuming bot:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'paused': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch {
      return 'Unknown time';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>🤖 Bot Control Panel</h1>
        <p>Loading bot system...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        color: 'white'
      }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>
            🤖 Global Bot Control Panel
          </h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Manage your AI traders running across the entire platform
          </p>
        </div>
        <button
          onClick={handleStartStop}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: isRunning ? '#ef4444' : '#10b981',
            color: 'white',
            transition: 'all 0.2s ease'
          }}
        >
          {isRunning ? '⏹️ Stop All Bots' : '▶️ Start All Bots'}
        </button>
      </div>

      {/* System Status */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>
            {isRunning ? '🟢' : '🔴'}
          </div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Global Status</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {isRunning ? 'Bots Active Globally' : 'Bots Stopped'}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤖</div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Active Bots</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {bots.filter(bot => bot.isActive).length} / {bots.length}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Total Bot Capital</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {formatCurrency(bots.reduce((sum, bot) => sum + bot.balance, 0))}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Recent Actions</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {recentActivity.length} activities
          </p>
        </div>
      </div>

      {/* Bot List */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          marginBottom: '20px', 
          color: '#1e293b' 
        }}>
          🤖 Bot Traders
        </h2>
        
        {bots.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            textAlign: 'center',
            color: '#64748b'
          }}>
            <p>No bots initialized yet. Enable bots to see them appear here.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: '20px' 
          }}>
            {bots.map((bot) => (
              <div 
                key={bot.id} 
                style={{ 
                  padding: '20px', 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '18px' }}>
                      {bot.username}
                    </h3>
                    <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>
                      {bot.personality?.name || 'AI Trader'}
                    </p>
                    <div style={{ 
                      display: 'inline-block', 
                      padding: '4px 8px', 
                      backgroundColor: getStatusColor(bot.isActive ? 'active' : 'paused'), 
                      color: 'white', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      fontWeight: '600' 
                    }}>
                      {bot.isActive ? 'ACTIVE' : 'PAUSED'}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowDetails(showDetails === bot.id ? null : bot.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      color: '#374151'
                    }}
                  >
                    {showDetails === bot.id ? 'Hide' : 'Details'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Balance
                    </p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      {formatCurrency(bot.balance)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Risk Level
                    </p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      {bot.riskTolerance}
                    </p>
                  </div>
                </div>

                {showDetails === bot.id && (
                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px', 
                    marginBottom: '16px' 
                  }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                      <strong>Strategy:</strong> {bot.tradingStrategy?.type || 'Unknown'}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                      <strong>Description:</strong> {bot.personality?.description || 'AI Trading Bot'}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                      <strong>Activity Frequency:</strong> Every {bot.personality?.activityFrequency || 5} minutes
                    </p>
                    <p style={{ margin: '0', fontSize: '14px', color: '#64748b' }}>
                      <strong>Last Active:</strong> {formatTimeAgo(bot.lastActive)}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  {bot.isActive ? (
                    <button
                      onClick={() => handlePauseBot(bot.id)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        fontSize: '14px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      ⏸️ Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResumeBot(bot.id)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        fontSize: '14px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      ▶️ Resume
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          marginBottom: '20px', 
          color: '#1e293b' 
        }}>
          📈 Recent Bot Activity
        </h2>
        
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {recentActivity.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <p>📭</p>
              <p>No recent bot activity.</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                {isRunning ? 'Bots are starting up - activity will appear soon!' : 'Enable bots to see them in action!'}
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  style={{ 
                    padding: '16px 20px', 
                    borderBottom: index < recentActivity.length - 1 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#8b5cf6' 
                      }}>
                        🤖 {activity.botUsername}
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        padding: '2px 6px', 
                        backgroundColor: '#e0e7ff', 
                        color: '#3730a3', 
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        fontWeight: '500'
                      }}>
                        {activity.type}
                      </span>
                    </div>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      color: '#64748b',
                      lineHeight: '1.4'
                    }}>
                      {activity.description}
                    </p>
                  </div>
                  
                  <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                    {activity.amount && (
                      <p style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: activity.amount > 0 ? '#10b981' : '#ef4444'
                      }}>
                        {activity.amount > 0 ? '+' : ''}{formatCurrency(activity.amount)}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <button 
          onClick={() => router.push('/')}
          style={{ 
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            marginRight: '12px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
        <a 
          href="/feed" 
          style={{ 
            padding: '12px 24px',
            backgroundColor: '#10b981',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600'
          }}
        >
          📡 View Live Feed
        </a>
      </div>
    </div>
  );
}