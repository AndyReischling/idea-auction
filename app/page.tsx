'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import styles from './page.module.css';
import './global.css'; // Changed from './global.css' to './globals.css'

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

  // Save user profile to localStorage
  const saveUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
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
          </div>
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
            </div>
          ) : (
            <div className="grid grid-2">
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                return (
                  <div key={opinion.id} className="card">
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
                  </div>
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
            <p style={{ color: 'var(--text-secondary)' }}>No recent transactions.</p>
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