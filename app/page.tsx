'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import styles from './page.module.css';
import './global.css'; 
import { ArrowLeft, PiggyBank, ScanSmiley, RssSimple, Balloon, RocketLaunch, ChartLineUp, ChartLineDown, Skull, FlowerLotus, Ticket, CheckSquare, CaretRight, CaretDown, Robot } from "@phosphor-icons/react";


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
  type: 'buy' | 'sell' | 'earn' | 'short_win' | 'short_loss' | 'short_place';
  opinionId?: string;
  opinionText?: string;
  shortId?: string;
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

interface ShortPosition {
  id: string;
  opinionText: string;
  opinionId: string;
  betAmount: number;
  targetDropPercentage: number;
  startingPrice: number;
  targetPrice: number;
  potentialWinnings: number;
  expirationDate: string;
  createdDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
}

// Combined betting activity type
interface BettingActivity {
  id: string;
  type: 'portfolio_bet' | 'short_bet';
  title: string;
  subtitle: string;
  amount: number;
  potentialPayout: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  placedDate: string;
  expiryDate: string;
  daysRemaining?: number;
  additionalInfo?: string;
  multiplier?: number;
  volatilityRating?: string;
  targetUser?: string;
  opinionText?: string;
  progress?: number; // For shorts, percentage towards target
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
  const [myShorts, setMyShorts] = useState<ShortPosition[]>([]);
  const [combinedBettingActivity, setCombinedBettingActivity] = useState<BettingActivity[]>([]);
  const [botsRunning, setBotsRunning] = useState<boolean>(false);

  // Get current price for an opinion
  const getCurrentPrice = (opinionText: string): number => {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinionText]) {
        return marketData[opinionText].currentPrice;
      }
      return 10; // Default base price
    } catch (error) {
      return 10;
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Calculate hours remaining for shorts
  const getHoursRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(0, diffHours);
  };

  // Combine betting activities
  const combineBettingActivities = () => {
    const activities: BettingActivity[] = [];

    // Add portfolio bets
    myBets.forEach(bet => {
      activities.push({
        id: `bet_${bet.id}`,
        type: 'portfolio_bet',
        title: `Portfolio Bet: ${bet.targetUser}`,
        subtitle: `Betting $${bet.amount} on ${bet.betType} by ${bet.targetPercentage}%`,
        amount: bet.amount,
        potentialPayout: bet.potentialPayout,
        status: bet.status,
        placedDate: bet.placedDate,
        expiryDate: bet.expiryDate,
        daysRemaining: bet.status === 'active' ? getDaysRemaining(bet.expiryDate) : undefined,
        additionalInfo: `${bet.timeFrame} days | ${bet.volatilityRating} volatility`,
        multiplier: bet.multiplier,
        volatilityRating: bet.volatilityRating,
        targetUser: bet.targetUser
      });
    });

    // Add short positions
    myShorts.forEach(short => {
      const currentPrice = getCurrentPrice(short.opinionText);
      const progress = ((short.startingPrice - currentPrice) / (short.startingPrice - short.targetPrice)) * 100;
      const hoursRemaining = short.status === 'active' ? getHoursRemaining(short.expirationDate) : 0;
      
      activities.push({
        id: `short_${short.id}`,
        type: 'short_bet',
        title: `Short Bet: Opinion #${short.opinionId}`,
        subtitle: `Betting $${short.betAmount} on ${short.targetDropPercentage}% price drop`,
        amount: short.betAmount,
        potentialPayout: short.potentialWinnings,
        status: short.status,
        placedDate: new Date(short.createdDate).toLocaleDateString(),
        expiryDate: new Date(short.expirationDate).toLocaleDateString(),
        daysRemaining: short.status === 'active' ? Math.ceil(hoursRemaining / 24) : undefined,
        additionalInfo: `$${short.startingPrice} → $${short.targetPrice} | ${hoursRemaining}h remaining`,
        opinionText: short.opinionText,
        progress: Math.max(0, Math.min(100, progress))
      });
    });

    // Sort by date (most recent first)
    activities.sort((a, b) => new Date(b.placedDate).getTime() - new Date(a.placedDate).getTime());
    
    setCombinedBettingActivity(activities);
  };

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

      // Load short positions
      const storedShorts = localStorage.getItem('shortPositions');
      if (storedShorts) {
        const allShorts = JSON.parse(storedShorts) as ShortPosition[];
        setMyShorts(allShorts);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [userProfile.username]);

  // Update combined activities when bets or shorts change
  useEffect(() => {
    combineBettingActivities();
  }, [myBets, myShorts]);

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

  // Calculate total active bets (both portfolio and shorts)
  const totalActiveBets = combinedBettingActivity.filter(activity => activity.status === 'active').length;

  // SAFE SLICE FUNCTION - prevents null errors
  const safeSlice = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text || typeof text !== 'string') return 'Unknown text';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
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
              <div className="user-name">
                <div>{userProfile.username}</div>
                <div style={{ 
                  fontSize: '12px', 
                  color: botsRunning ? '#10b981' : '#ef4444',
                  fontWeight: '400',
                  marginTop: '4px'
                }}>
                  🤖 Bots: {botsRunning ? 'Active Globally' : 'Inactive'}
                </div>
              </div>
              <p>Member since {userProfile.joinDate} Opinion Trader & Collector</p>
              {/* Bot status indicator */} 
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="navigation-buttons">
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={24} /> View Traders
            </a>
            <a href="/feed" className="nav-button feed">
            <RssSimple size={24} /> Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
            <Balloon size={24} /> Generate
            </a>
            {/* Bot Control button */}
            <a href="/admin" className="nav-button admin" style={{ 
              textDecoration: 'none'
            }}>
              <Robot size={24} /> Bot Control
            </a>
          </div>
        </div>

        {/* Global Bot Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: botsRunning ? '#C1DECA' : '#DDB4B4',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: botsRunning ? '#4B6453' : '#8E3A3A',
            marginLeft: '10px'
          }}>
            {botsRunning ? 
              'AI traders are active across all pages - they\'ll keep trading even when you navigate away' : 
              'AI traders are paused globally'
            }
          </div>
          <button
            onClick={botsRunning ? handleStopBots : handleStartBots}
            style={{
              padding: '0px 16px',
              fontSize: '14px',
              fontWeight: '400',
              cursor: 'pointer',
              background: 'none',
              // backgroundColor: botsRunning ? '#DDB4B4' : '#C1DECA',
              color: 'black',
              transition: 'all 0.2s ease',
              border: 'none',
            }}
          >
            {botsRunning ? 'Stop Global Bots' : 'Start Global Bots'}
          </button>
        </div>

        {/* Wallet Overview */}
        <div className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3>Wallet Balance</h3>
            <p>${userProfile.balance.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.portfolio}`}>
            <h3>Portfolio Value</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.pnl} ${totalGainsLosses >= 0 ? styles.positive : styles.negative}`}>
            <h3>P&L</h3>
            <p>{totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.bets}`}>
            <h3>Active Bets</h3>
            <p>{totalActiveBets}</p>
          </div>
        </div>

        {/* Opinion Portfolio */}
        <section className="section">
          <h2 className="section-title">My Opinion Portfolio</h2>
          
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
            <div className="grid grid-2 p-grid">
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                // Find the opinion index in allOpinions array for proper routing
                const opinionIndex = allOpinions.findIndex(op => op === opinion.text);
                const opinionId = opinionIndex !== -1 ? opinionIndex : opinion.id;
                
                return (
                  <a key={opinion.id} href={`/opinion/${opinionId}`} className="card p-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="p-card-header">
                      <div className="card-content">
                        <p className="p-card-opinion-text">{safeSlice(opinion.text, 80)}</p>
                        <p className="card-subtitle">Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}</p>
                      </div>
                      <div className={styles.opinionPricing}>
                        <p>Bought: ${opinion.purchasePrice}</p>
                        <div className={styles.currentPricing}>
                          <p>${opinion.currentPrice}</p>
                          <p className={gainLoss >= 0 ? 'status-positive' : 'status-negative'} style={{ margin: '0px' }}>
                            {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Enhanced My Betting Activity */}
        <section className="section">
          <h2 className="section-title">My Portfolio Bets & Short Positions</h2>
          
          {combinedBettingActivity.length === 0 ? (
            <div className="empty-state">
              <p>You haven't placed any bets or short positions yet!</p>
              <p>Visit the <a href="/users">Traders page</a> to bet on portfolios or short specific opinions.</p>
              {botsRunning && (
                <p style={{ color: '#633FD0', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are actively placing bets and shorts - check the Live Feed to see their activity!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-2 s-grid" >
              {combinedBettingActivity.slice(0, 10).map((activity) => {
                return (
                  <div key={activity.id} className="card s-card">
                    <div className="card-header s-card-header">
                      <div className="card-content s-card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="s-card-tag">
                              {activity.type === 'portfolio_bet' ? 'Portfolio' : 'Short'}
                            </span>
                            <span className={`${styles.betStatus} ${styles[activity.status]}`}>
                              {activity.status}
                            </span>
                          </div>
                          {activity.status === 'active' && activity.daysRemaining !== null && (
                            <span className="card-subtitle">
                              {activity.daysRemaining} days left
                            </span>
                          )}
                        </div>
                        
                        <p className="card-title s-card-title">
                          {activity.opinionText ? safeSlice(activity.opinionText, 50) : activity.title}
                        </p>
                        <p className="card-subtitle">
                          {activity.subtitle}
                        </p>
                        
                        {/* Progress bar for active shorts */}
                        {activity.type === 'short_bet' && activity.status === 'active' && activity.progress !== undefined && (
                          <div style={{ marginTop: '18px', width: "100%"}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', width: "100%" }}>
                              <span style={{ marginRight: '4px' }}>Progress to target:</span>
                              <span>{activity.progress.toFixed(1)}%</span>
                            </div>
                            <div style={{ 
                              width: '100%', 
                              height: '6px', 
                              backgroundColor: '#e5e7eb', 
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, activity.progress)}%`,
                                height: '100%',
                                backgroundColor: activity.progress >= 100 ? '#10b981' : activity.progress >= 50 ? '#f59e0b' : '#ef4444',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginTop: '8px', width: "100%" }}>
                          {activity.additionalInfo && <span>{activity.additionalInfo}</span>}
                          {activity.multiplier && <span>Multiplier: {activity.multiplier}x</span>}
                        </div>
                      </div>
                      
                      <div className="s-card-amount"> 
                        <p className="card-subtitle">Placed: {activity.placedDate}</p>
                        <p className={
                          activity.status === 'won' ? 'status-positive' : 
                          activity.status === 'lost' ? 'status-negative' : 
                          'status-neutral'
                        } style={{ margin: '0px' }}>
                          {activity.status === 'won' ? <>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-number)' }}>${activity.potentialPayout}</span>
                        </> :
                           activity.status === 'lost' ? <>
                           <span style={{ fontWeight: 70, fontFamily: 'var(--font-number)' }}>${activity.amount}</span>
                         </> :
                           activity.status === 'active' ? <>
                           <span style={{ fontWeight: 700, fontFamily: 'var(--font-number)', marginRight: '8px' }}>${activity.potentialPayout}</span>
                           {activity.status === 'active' && (
                          <span className="card-subtitle" >Expires: {activity.expiryDate}</span>
                          )}
                         </> :
                           'Expired'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {combinedBettingActivity.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/users" className="btn btn-secondary">View all {combinedBettingActivity.length} bets →</a>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="section">
          <h2 className="section-title">Recent Activity</h2>
          
          {recentTransactions.length === 0 ? (
            <div>
              <p style={{ color: 'var(--text-secondary)', padding: '60px 20px', textAlign: 'center', marginBottom: '60px' }}>No recent transactions.</p>
              {botsRunning && (
                <p style={{ color: '#633FD0', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are creating transactions globally - visit the <a href="/feed" style={{ color: '#BFB6D7' }}>Live Feed</a> to see all activity!
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '84px' }}>
              {recentTransactions.map((transaction, index) => {
                let activityText = '';
                let emoji = '';
                
                switch (transaction.type) {
                  case 'buy':
                    emoji = '🛒';
                    activityText = 'Bought Opinion';
                    break;
                  case 'sell':
                    emoji = '💰';
                    activityText = 'Sold Opinion';
                    break;
                  case 'earn':
                    emoji = '✨';
                    activityText = 'Generated Opinion';
                    break;
                  case 'short_place':
                    emoji = '📉';
                    activityText = 'Placed Short Bet';
                    break;
                  case 'short_win':
                    emoji = '🎉';
                    activityText = 'Won Short Bet';
                    break;
                  case 'short_loss':
                    emoji = '💸';
                    activityText = 'Lost Short Bet';
                    break;
                  default:
                    emoji = '📝';
                    activityText = 'Transaction';
                }
                
return (
  <div key={`transaction-${index}-${transaction.id}`} className="card">
    <div className="card-header">
      <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '0px 0px 0x' }}>
        <p style={{ margin: '0px', fontWeight: '400',fontSize: '14px' }}>
          {emoji} {activityText}
        </p>
        <p className="card-subtitle">
          {transaction.opinionText || 'Opinion activity'} • {transaction.date}
        </p>
      </div>
      <span className={`${styles.activityAmount} ${transaction.amount >= 0 ? 'status-positive' : 'status-negative'}`}>
        {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
      </span>
    </div>
  </div>
);
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}