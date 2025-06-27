'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import styles from '../page.module.css';

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
  botId?: string;
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

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet_win' | 'bet_loss' | 'bet_place' | 'short_place' | 'short_win' | 'short_loss';
  amount: number;
  date: string;
  description?: string;
  opinionText?: string;
}

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
  progress?: number;
}

export default function UserDetailPage() {
  const { username } = useParams();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [combinedBettingActivity, setCombinedBettingActivity] = useState<BettingActivity[]>([]);
  const [isBot, setIsBot] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);

  const safeSlice = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text || typeof text !== 'string') return 'Unknown text';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const getCurrentPrice = (opinionText: string): number => {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinionText]) {
        return marketData[opinionText].currentPrice;
      }
      return 10;
    } catch (error) {
      return 10;
    }
  };

  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getHoursRemaining = (expirationDate: string): number => {
    const expiry = new Date(expirationDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(0, diffHours);
  };

  const getUserShorts = (username: string, botId?: string): ShortPosition[] => {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      return shorts.filter((short: ShortPosition) => {
        if (botId) {
          return short.botId === botId;
        } else {
          return !short.botId && username === decodeURIComponent(username as string);
        }
      });
    } catch {
      return [];
    }
  };

  const getUserBets = (username: string): AdvancedBet[] => {
    try {
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      return bets.filter((bet: AdvancedBet) => bet.bettor === username);
    } catch {
      return [];
    }
  };

  const combineBettingActivities = (bets: AdvancedBet[], shorts: ShortPosition[]) => {
    const activities: BettingActivity[] = [];

    bets.forEach(bet => {
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

    shorts.forEach(short => {
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

    activities.sort((a, b) => new Date(b.placedDate).getTime() - new Date(a.placedDate).getTime());
    return activities;
  };

  const getUserBotTransactions = (botId: string): Transaction[] => {
    try {
      const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      return botTransactions
        .filter((t: any) => t.botId === botId)
        .map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          date: t.date,
          description: t.opinionText || t.description,
          opinionText: t.opinionText
        }))
        .slice(0, 10);
    } catch {
      return [];
    }
  };

  const loadUserData = async () => {
    const targetUsername = decodeURIComponent(username as string);
    
    try {
      const bots = JSON.parse(localStorage.getItem('autonomousBots') || '[]');
      const bot = bots.find((b: any) => b.username === targetUsername);
      
      if (bot) {
        setIsBot(true);
        setBotId(bot.id);
        setUserProfile({
          username: bot.username,
          balance: bot.balance,
          joinDate: bot.joinDate,
          totalEarnings: bot.totalEarnings,
          totalLosses: bot.totalLosses
        });

        const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
        const userOpinions = botOpinions
          .filter((opinion: any) => opinion.botId === bot.id)
          .map((opinion: any) => ({
            id: opinion.id,
            text: opinion.text,
            purchasePrice: opinion.purchasePrice,
            currentPrice: getCurrentPrice(opinion.text),
            purchaseDate: opinion.purchaseDate,
            quantity: opinion.quantity
          }));
        setOwnedOpinions(userOpinions);
        setRecentTransactions(getUserBotTransactions(bot.id));
      } else {
        const currentUserProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (currentUserProfile.username === targetUsername) {
          setUserProfile(currentUserProfile);
          
          const ownedOpinions = JSON.parse(localStorage.getItem('ownedOpinions') || '[]');
          const updatedOpinions = ownedOpinions.map((opinion: OpinionAsset) => ({
            ...opinion,
            currentPrice: getCurrentPrice(opinion.text)
          }));
          setOwnedOpinions(updatedOpinions);

          const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
          setRecentTransactions(transactions.slice(0, 10));
        }
      }

      const userBets = getUserBets(targetUsername);
      const userShorts = getUserShorts(targetUsername, bot?.id);
      const activities = combineBettingActivities(userBets, userShorts);
      setCombinedBettingActivity(activities);

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('opinions');
    if (stored) {
      const parsed = JSON.parse(stored);
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setAllOpinions(validOpinions);
    }

    if (username) {
      loadUserData();
    }
  }, [username]);

  if (!userProfile) {
    return (
      <div className="page-container">
        <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
        <main className="main-content">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading user profile...</p>
          </div>
        </main>
      </div>
    );
  }

  const portfolioValue = ownedOpinions.reduce((total, opinion) => 
    total + (opinion.currentPrice * opinion.quantity), 0
  );

  const totalGainsLosses = ownedOpinions.reduce((total, opinion) => 
    total + ((opinion.currentPrice - opinion.purchasePrice) * opinion.quantity), 0
  );

  const totalActiveBets = combinedBettingActivity.filter(activity => activity.status === 'active').length;

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main className="main-content">
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">
              {userProfile.username[0].toUpperCase()}
            </div>
            <div className="user-info">
              <h1>{isBot ? '🤖 ' : ''}{userProfile.username}</h1>
              <p>Member since {userProfile.joinDate}</p>
              <p>{isBot ? 'Autonomous Trading Bot' : 'Opinion Trader & Collector'}</p>
              {isBot && (
                <p style={{ 
                  fontSize: '12px', 
                  color: '#10b981',
                  fontWeight: '600',
                  marginTop: '4px'
                }}>
                  🤖 Algorithmic Trading Strategies
                </p>
              )}
            </div>
          </div>

          <div className="navigation-buttons">
            <button
              onClick={() => router.back()}
              className="nav-button"
              style={{ backgroundColor: '#6b7280' }}
            >
              ← Back
            </button>
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

        <div className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3>💰 {isBot ? 'Bot Balance' : 'Wallet Balance'}</h3>
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
            <p>{totalActiveBets}</p>
          </div>
        </div>

        <section className="section">
          <h2 className="section-title">💼 {isBot ? 'Bot' : 'User'} Opinion Portfolio</h2>
          
          {ownedOpinions.length === 0 ? (
            <div className="empty-state">
              <p>{isBot ? 'This bot doesn\'t own any opinions yet!' : 'This user doesn\'t own any opinions yet!'}</p>
              <p>{isBot ? 'The bot is still learning and will start trading soon.' : 'They haven\'t started buying opinions from the marketplace.'}</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
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

        <section className="section">
          <h2 className="section-title">🎲 {isBot ? 'Bot' : 'User'} Portfolio Bets & Short Positions</h2>
          
          {combinedBettingActivity.length === 0 ? (
            <div className="empty-state">
              <p>{isBot ? 'This bot hasn\'t placed any bets or short positions yet!' : 'This user hasn\'t placed any bets or short positions yet!'}</p>
              <p>{isBot ? 'The bot will start making strategic bets as it develops confidence.' : 'They can bet on portfolios or short specific opinions.'}</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {combinedBettingActivity.slice(0, 10).map((activity) => {
                return (
                  <div key={activity.id} className="card">
                    <div className="card-header">
                      <div className="card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`${styles.betType} ${styles[activity.type]}`}>
                              {activity.type === 'portfolio_bet' ? '📊 Portfolio' : '📉 Short'}
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
                        
                        <p style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {activity.title}
                        </p>
                        <p className="card-subtitle">
                          {activity.subtitle}
                        </p>
                        
                        {activity.type === 'short_bet' && activity.opinionText && (
                          <p className="card-subtitle" style={{ 
                            fontStyle: 'italic', 
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            "{safeSlice(activity.opinionText, 60)}"
                          </p>
                        )}
                        
                        {activity.type === 'short_bet' && activity.status === 'active' && activity.progress !== undefined && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>Progress to target:</span>
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
                        
                        <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                          {activity.additionalInfo && <span>{activity.additionalInfo}</span>}
                          {activity.multiplier && <span>Multiplier: {activity.multiplier}x</span>}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p className="card-subtitle">Placed: {activity.placedDate}</p>
                        <p className={
                          activity.status === 'won' ? 'status-positive' : 
                          activity.status === 'lost' ? 'status-negative' : 
                          'status-neutral'
                        }>
                          {activity.status === 'won' ? `Won $${activity.potentialPayout}` :
                           activity.status === 'lost' ? `Lost $${activity.amount}` :
                           activity.status === 'active' ? `Potential: $${activity.potentialPayout}` :
                           'Expired'}
                        </p>
                        {activity.status === 'active' && (
                          <p className="card-subtitle">Expires: {activity.expiryDate}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {combinedBettingActivity.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <p className="btn btn-secondary">Showing 10 of {combinedBettingActivity.length} total bets</p>
            </div>
          )}
        </section>

        <section className="section">
          <h2 className="section-title">📋 Recent Activity</h2>
          
          {recentTransactions.length === 0 ? (
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>No recent transactions.</p>
              {isBot && (
                <p style={{ color: '#10b981', fontSize: '14px', marginTop: '10px' }}>
                  🤖 This bot will start trading once the market becomes active!
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentTransactions.map((transaction) => {
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
                  case 'bet_place':
                    emoji = '🎲';
                    activityText = 'Placed Portfolio Bet';
                    break;
                  case 'bet_win':
                    emoji = '🎉';
                    activityText = 'Won Portfolio Bet';
                    break;
                  case 'bet_loss':
                    emoji = '💸';
                    activityText = 'Lost Portfolio Bet';
                    break;
                  default:
                    emoji = '📝';
                    activityText = 'Transaction';
                }
                
                return (
                  <div key={transaction.id} className="card">
                    <div className="card-header">
                      <div className="card-content">
                        <p>
                          {emoji} {activityText}
                        </p>
                        <p className="card-subtitle">
                          {transaction.opinionText || transaction.description || 'Transaction activity'} • {transaction.date}
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

        {isBot && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f0f9ff', 
            border: '1px solid #e0f2fe', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#0369a1' }}>
              🤖 This is an <strong>Autonomous Trading Bot</strong> with algorithmic strategies • 
              Portfolio updates automatically based on market conditions
            </p>
          </div>
        )}
      </main>
    </div>
  );
}