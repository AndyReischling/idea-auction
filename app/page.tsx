'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';

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

  // Get bet status color
  const getBetStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' };
      case 'won': return { bg: '#d4edda', color: '#155724', border: '#c3e6cb' };
      case 'lost': return { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' };
      case 'expired': return { bg: '#e2e3e5', color: '#383d41', border: '#d6d8db' };
      default: return { bg: '#f8f9fa', color: '#6c757d', border: '#dee2e6' };
    }
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }))} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1200px' }}>
        {/* Header with Navigation Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}>
          {/* User Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef',
            flex: 1,
            marginRight: '1rem'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold',
              marginRight: '1.5rem'
            }}>
              {userProfile.username[0].toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', margin: 0, color: '#333' }}>{userProfile.username}</h1>
              <p style={{ margin: '0.25rem 0', color: '#666' }}>Member since {userProfile.joinDate}</p>
              <p style={{ margin: 0, color: '#666' }}>Opinion Trader & Collector</p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href="/users"
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📊 View Traders
            </a>
            <a
              href="/feed"
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📡 Live Feed
            </a>
            <a
              href="/generate"
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ✨ Generate Opinions
            </a>
          </div>
        </div>

        {/* Wallet Overview */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#e8f5e8', 
            borderRadius: '8px', 
            border: '1px solid #c3e6c3' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#155724' }}>💰 Wallet Balance</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#155724' }}>
              ${userProfile.balance.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px', 
            border: '1px solid #bbdefb' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0d47a1' }}>📊 Portfolio Value</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#0d47a1' }}>
              ${portfolioValue.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: totalGainsLosses >= 0 ? '#e8f5e8' : '#ffebee', 
            borderRadius: '8px', 
            border: `1px solid ${totalGainsLosses >= 0 ? '#c3e6c3' : '#ffcdd2'}` 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: totalGainsLosses >= 0 ? '#155724' : '#c62828' }}>
              📈 P&L
            </h3>
            <p style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              margin: 0, 
              color: totalGainsLosses >= 0 ? '#155724' : '#c62828' 
            }}>
              {totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#fff3e0', 
            borderRadius: '8px', 
            border: '1px solid #ffcc02' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#e65100' }}>🎲 Active Bets</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#e65100' }}>
              {myBets.filter(bet => bet.status === 'active').length}
            </p>
          </div>
        </div>

        {/* Opinion Portfolio */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            💼 Your Opinion Portfolio
          </h2>
          
          {ownedOpinions.length === 0 ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              color: '#666'
            }}>
              <p>You don't own any opinions yet!</p>
              <p>Start by buying some opinions from the marketplace.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                return (
                  <div key={opinion.id} style={{ 
                    padding: '1rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    backgroundColor: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                          {safeSlice(opinion.text, 80)}
                        </p>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                          Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                          Bought: ${opinion.purchasePrice}
                        </p>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>
                          Current: ${opinion.currentPrice}
                        </p>
                        <p style={{ 
                          margin: '0', 
                          fontWeight: 'bold',
                          color: gainLoss >= 0 ? '#28a745' : '#dc3545' 
                        }}>
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
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            🎲 My Portfolio Bets
          </h2>
          
          {myBets.length === 0 ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              color: '#666'
            }}>
              <p>You haven't placed any portfolio bets yet!</p>
              <p>Visit the <a href="/users" style={{ color: '#007bff' }}>Traders page</a> to bet on other traders' performance.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {myBets.slice(0, 10).map((bet) => {
                const statusColors = getBetStatusColor(bet.status);
                const daysRemaining = bet.status === 'active' ? getDaysRemaining(bet.expiryDate) : null;
                
                return (
                  <div key={bet.id} style={{ 
                    padding: '1rem', 
                    backgroundColor: statusColors.bg,
                    border: `1px solid ${statusColors.border}`,
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: statusColors.color,
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                            {bet.status}
                          </span>
                          {bet.status === 'active' && daysRemaining !== null && (
                            <span style={{ fontSize: '0.85rem', color: statusColors.color, fontWeight: 'bold' }}>
                              {daysRemaining} days left
                            </span>
                          )}
                        </div>
                        
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: statusColors.color }}>
                          Betting ${bet.amount} on {bet.targetUser}'s portfolio to {bet.betType} by {bet.targetPercentage}%
                        </p>
                        
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#666' }}>
                          <span>Timeframe: {bet.timeFrame} days</span>
                          <span>Volatility: {bet.volatilityRating}</span>
                          <span>Multiplier: {bet.multiplier}x</span>
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                          Placed: {bet.placedDate}
                        </p>
                        <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1.1rem', color: statusColors.color }}>
                          {bet.status === 'won' ? `Won $${bet.potentialPayout}` :
                           bet.status === 'lost' ? `Lost $${bet.amount}` :
                           bet.status === 'active' ? `Potential: $${bet.potentialPayout}` :
                           'Expired'}
                        </p>
                        {bet.status === 'active' && (
                          <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                            Expires: {bet.expiryDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {myBets.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <a 
                href="/users" 
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none', 
                  fontWeight: 'bold' 
                }}
              >
                View all {myBets.length} bets →
              </a>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            📋 Recent Activity
          </h2>
          
          {recentTransactions.length === 0 ? (
            <p style={{ color: '#666' }}>No recent transactions.</p>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} style={{ 
                  padding: '1rem', 
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: 'bold' }}>
                      {transaction.type === 'buy' ? '🛒 Bought' : transaction.type === 'sell' ? '💰 Sold' : '✨ Earned'} Opinion
                    </p>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                      {transaction.opinionText || 'Generated opinion'} • {transaction.date}
                    </p>
                  </div>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: transaction.amount >= 0 ? '#28a745' : '#dc3545'
                  }}>
                    {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}