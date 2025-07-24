'use client';

import { useEffect, useState } from 'react';
// Import the bot system - adjust path as needed
import botSystem from './autonomous-bots';

// Define BotProfile interface locally since we can't import it
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

export default function BotControlPanel() {
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [recentActivity, setRecentActivity] = useState<BotActivity[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    // Load initial bot data
    loadBotData();
    
    // Set up interval to refresh data less frequently to improve performance
    const interval = setInterval(loadBotData, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadBotData = () => {
    setBots(botSystem.getBots());
    setIsRunning(botSystem.isSystemRunning());
    
    // Load recent bot transactions
    const transactions = botSystem.getBotTransactions();
    const activities: BotActivity[] = transactions
      .slice(-20) // Last 20 transactions
      .map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        botUsername: transaction.botId ? getBotUsername(transaction.botId) : 'Unknown',
        description: getActivityDescription(transaction),
        amount: transaction.amount,
        timestamp: transaction.date
      }))
      .reverse(); // Most recent first
    
    setRecentActivity(activities);
  };

  const getBotUsername = (botId: string): string => {
    const bot = bots.find(b => b.id === botId);
    return bot ? bot.username : 'Unknown Bot';
  };

  const getActivityDescription = (transaction: any): string => {
    switch (transaction.type) {
      case 'buy':
        return `Purchased opinion: "${transaction.opinionText?.slice(0, 40)}..."`;
      case 'sell':
        return `Sold opinion: "${transaction.opinionText?.slice(0, 40)}..."`;
      case 'bet':
        return transaction.opinionText || 'Placed portfolio bet';
      case 'earn':
        return `Generated opinion: "${transaction.opinionText?.slice(0, 40)}..."`;
      default:
        return 'Unknown activity';
    }
  };

  const handleStartStop = () => {
    if (isRunning) {
      botSystem.stopBots();
    } else {
      botSystem.startBots();
    }
    setIsRunning(!isRunning);
  };

  const handlePauseBot = (botId: string) => {
    botSystem.pauseBot(botId);
    loadBotData();
  };

  const handleResumeBot = (botId: string) => {
    botSystem.resumeBot(botId);
    loadBotData();
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

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
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
            🤖 Autonomous Bot Control Panel
          </h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Manage your AI traders and monitor their market activity
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
          onMouseOver={(e) => (e.target as HTMLButtonElement).style.transform = 'scale(1.05)'}
          onMouseOut={(e) => (e.target as HTMLButtonElement).style.transform = 'scale(1)'}
        >
          {isRunning ? '⏹️ Stop Bots' : '▶️ Start Bots'}
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
          backgroundColor: '#f8fafc', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>
            {isRunning ? '🟢' : '🔴'}
          </div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>System Status</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {isRunning ? 'Active' : 'Stopped'}
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8fafc', 
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
          backgroundColor: '#f8fafc', 
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
          backgroundColor: '#f8fafc', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
          <h3 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Recent Actions</h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            {recentActivity.length} today
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
                    {bot.personality.name}
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
                    <strong>Strategy:</strong> {bot.tradingStrategy.type}
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                    <strong>Description:</strong> {bot.personality.description}
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>
                    <strong>Activity Frequency:</strong> Every {bot.personality.activityFrequency} minutes
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', color: '#64748b' }}>
                    <strong>Last Active:</strong> {new Date(bot.lastActive).toLocaleString()}
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
              No recent bot activity. Start the bots to see them in action!
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
                        color: '#3b82f6' 
                      }}>
                        {activity.botUsername}
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
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}