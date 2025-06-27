'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import styles from './page.module.css';
import './global.css'; 

interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn';
  opinionId?: string;
  opinionText?: string;
  amount: number;
  date: string;
}

interface AdvancedBet {
  id: string;
  bettor: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number;
  initialPortfolioValue: number;
  currentPortfolioValue: number;
  placedDate: string;
  expiryDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
  multiplier: number;
  potentialPayout: number;
  volatilityRating: 'Low' | 'Medium' | 'High';
}

export default function UserProfile() {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });

  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [myBets, setMyBets] = useState<AdvancedBet[]>([]);
  const [botsRunning, setBotsRunning] = useState<boolean>(false);

  // Load data from localStorage
  useEffect(() => {
    try {
      // Load existing opinions for sidebar - FILTER OUT NULL VALUES
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
          setAllOpinions(validOpinions);
        }
      }

      // Load user profile
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
      }

      // Load owned opinions
      const storedAssets = localStorage.getItem('ownedOpinions');
      if (storedAssets) {
        setOwnedOpinions(JSON.parse(storedAssets));
      }

      // Load transactions
      const storedTransactions = localStorage.getItem('transactions');
      if (storedTransactions) {
        setRecentTransactions(JSON.parse(storedTransactions));
      }

      // Load my bets
      const storedBets = localStorage.getItem('advancedBets');
      if (storedBets) {
        const allBets = JSON.parse(storedBets);
        // Filter to only show current user's bets
        const userBets = allBets.filter((bet: AdvancedBet) => bet.bettor === userProfile.username);
        setMyBets(userBets);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [userProfile.username]);

  // Monitor bot status (simplified version)
  useEffect(() => {
    const checkBotStatus = () => {
      const botsEnabled = localStorage.getItem('botsAutoStart') === 'true';
      setBotsRunning(botsEnabled);
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save user profile to localStorage
  const saveUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  // Simplified bot control handlers
  const handleStartBots = () => {
    localStorage.setItem('botsAutoStart', 'true');
    setBotsRunning(true);
    console.log('🤖 Bots enabled globally');
  };

  const handleStopBots = () => {
    localStorage.setItem('botsAutoStart', 'false');
    setBotsRunning(false);
    console.log('🛑 Bots disabled globally');
  };

  // Calculate portfolio value
  const portfolioValue = ownedOpinions.reduce((total, opinion) => 
    total + (opinion.currentPrice * opinion.quantity), 0
  );

  // Calculate total gains/losses
  const totalGainsLosses = ownedOpinions.reduce((total, opinion) => 
    total + ((opinion.currentPrice - opinion.purchasePrice) * opinion.quantity), 0
  );

  // SAFE SLICE FUNCTION - prevents null errors
  const safeSlice = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text || typeof text !== 'string') return 'Unknown text';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Calculate days remaining for active bets
  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }))} />
      
      <main className="main-content">
        {/* Header with Navigation Buttons */}
        <div className="header-section">
          {/* User Header */}
          <div className="user-header">
            <div className="user-avatar">
              {userProfile.username[0].toUpperCase()}
            </div>
            <div className="user-info">
              <h1>{userProfile.username}</h1>
              <p>Member since {userProfile.joinDate}</p>
              <p>Opinion Trader & Collector</p>
              {/* Bot status indicator */}
              <p style={{ 
                fontSize: '12px', 
                color: botsRunning ? '#10b981' : '#ef4444',
                fontWeight: '600',
                marginTop: '4px'
              }}>
                🤖 Bots: {botsRunning ? 'Active Globally' : 'Inactive'}
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="navigation-buttons">
            <a href="/users" className="nav-button traders">
              📊 View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              📡 Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
              ✨ Generate Opinions
            </a>
            {/* Bot Control button */}
            <a href="/admin" className="nav-button admin" style={{ 
              backgroundColor: '#8b5cf6',
              color: 'white',
              textDecoration: 'none'
            }}>
              🤖 Bot Control
            </a>
          </div>
        </div>

        {/* Global Bot Controls */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: botsRunning ? '#f0fdf4' : '#fef2f2',
          borderRadius: '8px',
          border: `1px solid ${botsRunning ? '#bbf7d0' : '#fecaca'}`
        }}>
          <button
            onClick={botsRunning ? handleStopBots : handleStartBots}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: botsRunning ? '#ef4444' : '#10b981',
              color: 'white',
              transition: 'all 0.2s ease'
            }}
          >
            {botsRunning ? '⏹️ Stop Global Bots' : '▶️ Start Global Bots'}
          </button>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: '#64748b',
            marginLeft: '10px'
          }}>
            {botsRunning ? 
              '🟢 AI traders are active across all pages - they\'ll keep trading even when you navigate away' : 
              '🔴 AI traders are paused globally'
            }
          </span>
        </div>

        {/* Wallet Overview */}
        <div className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3>💰 Wallet Balance</h3>
            <p>${userProfile.balance.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.portfolio}`}>
            <h3>📊 Portfolio Value</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.pnl} ${totalGainsLosses >= 0 ? styles.positive : styles.negative}`}>
            <h3>📈 P&L</h3>
            <p>{totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.bets}`}>
            <h3>🎲 Active Bets</h3>
            <p>{myBets.filter(bet => bet.status === 'active').length}</p>
          </div>
        </div>

        {/* Opinion Portfolio */}
        <section className="section">
          <h2 className="section-title">💼 Your Opinion Portfolio</h2>
          
          {ownedOpinions.length === 0 ? (
            <div className="empty-state">
              <p>You don't own any opinions yet!</p>
              <p>Start by buying some opinions from the marketplace.</p>
              {botsRunning && (
                <p style={{ color: '#8b5cf6', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are creating market activity across the platform right now!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-2">
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                // Find the opinion index in allOpinions array for proper routing
                const opinionIndex = allOpinions.findIndex(op => op === opinion.text);
                const opinionId = opinionIndex !== -1 ? opinionIndex : opinion.id;
                
                return (
                  <a key={opinion.id} href={`/opinion/${opinionId}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card-header">
                      <div className="card-content">
                        <p>{safeSlice(opinion.text, 80)}</p>
                        <p className="card-subtitle">Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}</p>
                      </div>
                      <div className={styles.opinionPricing}>
                        <p>Bought: ${opinion.purchasePrice}</p>
                        <p>Current: ${opinion.currentPrice}</p>
                        <p className={gainLoss >= 0 ? 'status-positive' : 'status-negative'}>
                          {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* My Betting History */}
        <section className="section">
          <h2 className="section-title">🎲 My Portfolio Bets</h2>
          
          {myBets.length === 0 ? (
            <div className="empty-state">
              <p>You haven't placed any portfolio bets yet!</p>
              <p>Visit the <a href="/users">Traders page</a> to bet on other traders' performance.</p>
              {botsRunning && (
                <p style={{ color: '#8b5cf6', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are actively placing bets on portfolios - check the Live Feed to see their activity!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-2">
              {myBets.slice(0, 10).map((bet) => {
                const daysRemaining = bet.status === 'active' ? getDaysRemaining(bet.expiryDate) : null;
                
                return (
                  <div key={bet.id} className="card">
                    <div className="card-header">
                      <div className="card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className={`${styles.betStatus} ${styles[bet.status]}`}>
                            {bet.status}
                          </span>
                          {bet.status === 'active' && daysRemaining !== null && (
                            <span className="card-subtitle">
                              {daysRemaining} days left
                            </span>
                          )}
                        </div>
                        
                        <p className="card-subtitle">
                          Betting ${bet.amount} on {bet.targetUser}'s portfolio to {bet.betType} by {bet.targetPercentage}%
                        </p>
                        
                        <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                          <span>Timeframe: {bet.timeFrame} days</span>
                          <span>Volatility: {bet.volatilityRating}</span>
                          <span>Multiplier: {bet.multiplier}x</span>
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p className="card-subtitle">Placed: {bet.placedDate}</p>
                        <p className={bet.status === 'won' ? 'status-positive' : bet.status === 'lost' ? 'status-negative' : 'status-neutral'}>
                          {bet.status === 'won' ? `Won $${bet.potentialPayout}` :
                           bet.status === 'lost' ? `Lost $${bet.amount}` :
                           bet.status === 'active' ? `Potential: $${bet.potentialPayout}` :
                           'Expired'}
                        </p>
                        {bet.status === 'active' && (
                          <p className="card-subtitle">Expires: {bet.expiryDate}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {myBets.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/users" className="btn btn-secondary">View all {myBets.length} bets →</a>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="section">
          <h2 className="section-title">📋 Recent Activity</h2>
          
          {recentTransactions.length === 0 ? (
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>No recent transactions.</p>
              {botsRunning && (
                <p style={{ color: '#8b5cf6', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are creating transactions globally - visit the <a href="/feed" style={{ color: '#8b5cf6' }}>Live Feed</a> to see all activity!
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="card">
                  <div className="card-header">
                    <div className="card-content">
                      <p>
                        {transaction.type === 'buy' ? '🛒 Bought' : transaction.type === 'sell' ? '💰 Sold' : '✨ Earned'} Opinion
                      </p>
                      <p className="card-subtitle">
                        {transaction.opinionText || 'Generated opinion'} • {transaction.date}
                      </p>
                    </div>
                    <span className={`${styles.activityAmount} ${transaction.amount >= 0 ? 'status-positive' : 'status-negative'}`}>
                      {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}