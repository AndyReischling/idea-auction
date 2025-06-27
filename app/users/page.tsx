'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';

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

interface PublicUserData {
  username: string;
  portfolioValue: number;
  totalGainsLosses: number;
  opinionsCount: number;
  joinDate: string;
  performancePercentage: number;
  topOpinions: OpinionAsset[];
  volatility: number;
  recentPerformance: number;
  rank: number;
  isCurrentUser?: boolean;
  isBot?: boolean;
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
  type: 'buy' | 'sell' | 'earn' | 'bet_win' | 'bet_loss' | 'bet_place';
  amount: number;
  date: string;
  description?: string;
}

export default function UsersPage() {
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });
  const [publicUsers, setPublicUsers] = useState<PublicUserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<PublicUserData | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [activeBets, setActiveBets] = useState<AdvancedBet[]>([]);
  const [message, setMessage] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'performance' | 'volatility'>('value');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  const [betForm, setBetForm] = useState<{
    betType: 'increase' | 'decrease';
    targetPercentage: number;
    amount: number;
    timeFrame: number;
  }>({
    betType: 'increase',
    targetPercentage: 10,
    amount: 100,
    timeFrame: 7
  });

  const safeSlice = (text: string | null | undefined, maxLength: number = 40): string => {
    if (!text || typeof text !== 'string') return 'Unknown opinion';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  const getOpinionMarketData = (opinionText: string) => {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      return marketData[opinionText] || { currentPrice: 10, timesPurchased: 0 };
    } catch {
      return { currentPrice: 10, timesPurchased: 0 };
    }
  };

  const calculatePortfolioVolatility = (opinions: OpinionAsset[]): number => {
    if (opinions.length === 0) return 1.0;
    
    let totalVolatility = 0;
    opinions.forEach(opinion => {
      const text = opinion.text.toLowerCase();
      let opinionVolatility = 1.0;
      
      if (text.includes('crypto') || text.includes('bitcoin')) opinionVolatility += 0.8;
      if (text.includes('controversial') || text.includes('hot take')) opinionVolatility += 0.5;
      if (text.includes('prediction') || text.includes('future')) opinionVolatility += 0.3;
      if (text.includes('politics')) opinionVolatility += 0.6;
      if (text.includes('safe') || text.includes('obvious')) opinionVolatility -= 0.3;
      
      totalVolatility += Math.max(0.5, Math.min(3.0, opinionVolatility));
    });
    
    return totalVolatility / opinions.length;
  };

  const getCurrentUserPortfolio = (): OpinionAsset[] => {
    try {
      const portfolio = localStorage.getItem('userPortfolio');
      if (portfolio) {
        return JSON.parse(portfolio);
      }
      
      const ownedOpinions = localStorage.getItem('ownedOpinions');
      if (ownedOpinions) {
        return JSON.parse(ownedOpinions);
      }
    } catch (error) {
      console.error('Error loading user portfolio:', error);
    }
    return [];
  };

  const getBotUsers = (): any[] => {
    try {
      const bots = localStorage.getItem('autonomousBots');
      if (bots) {
        return JSON.parse(bots);
      }
    } catch (error) {
      console.error('Error loading bot users:', error);
    }
    return [];
  };

  const getBotPortfolio = (botId: string): OpinionAsset[] => {
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      return botOpinions
        .filter((opinion: any) => opinion.botId === botId)
        .map((opinion: any) => ({
          id: opinion.id,
          text: opinion.text,
          purchasePrice: opinion.purchasePrice,
          currentPrice: getOpinionMarketData(opinion.text).currentPrice || opinion.currentPrice,
          purchaseDate: opinion.purchaseDate,
          quantity: opinion.quantity
        }));
    } catch (error) {
      console.error('Error loading bot portfolio:', error);
      return [];
    }
  };

  const calculate7DayPerformance = (performancePercentage: number, isBot: boolean = false): number => {
    if (isBot) {
      const variation = (Math.random() - 0.5) * 20;
      return Math.max(-50, Math.min(50, performancePercentage * 0.4 + variation));
    }
    return performancePercentage * 0.3;
  };

  const convertToPublicUserData = (
    username: string,
    portfolio: OpinionAsset[],
    joinDate: string,
    isCurrentUser: boolean = false,
    isBot: boolean = false,
    botId?: string
  ): PublicUserData => {
    let totalValue = 0;
    let totalCost = 0;

    portfolio.forEach(asset => {
      const marketData = getOpinionMarketData(asset.text);
      const currentPrice = marketData.currentPrice || asset.currentPrice;
      totalValue += currentPrice * asset.quantity;
      totalCost += asset.purchasePrice * asset.quantity;
    });

    const gainsLosses = totalValue - totalCost;
    const performancePercentage = totalCost > 0 ? ((gainsLosses / totalCost) * 100) : 0;
    const volatility = calculatePortfolioVolatility(portfolio);
    const recentPerformance = calculate7DayPerformance(performancePercentage, isBot);

    const topOpinions = [...portfolio]
      .map(opinion => ({
        ...opinion,
        currentPrice: getOpinionMarketData(opinion.text).currentPrice || opinion.currentPrice
      }))
      .sort((a, b) => 
        ((b.currentPrice - b.purchasePrice) * b.quantity) - ((a.currentPrice - a.purchasePrice) * a.quantity)
      )
      .slice(0, 5);

    return {
      username,
      portfolioValue: totalValue,
      totalGainsLosses: gainsLosses,
      opinionsCount: portfolio.length,
      joinDate,
      performancePercentage,
      topOpinions,
      volatility,
      recentPerformance,
      rank: 0,
      isCurrentUser,
      isBot,
      botId
    };
  };

  const getAllUsers = (): PublicUserData[] => {
    const allUsers: PublicUserData[] = [];

    console.log('🔄 Loading all users (real + bots)...');

    const currentUserPortfolio = getCurrentUserPortfolio();
    if (currentUserPortfolio.length > 0) {
      const currentUserData = convertToPublicUserData(
        currentUser.username,
        currentUserPortfolio,
        currentUser.joinDate,
        true
      );
      allUsers.push(currentUserData);
    }

    const botUsers = getBotUsers();
    botUsers.forEach(bot => {
      const botPortfolio = getBotPortfolio(bot.id);
      const botData = convertToPublicUserData(
        bot.username,
        botPortfolio,
        bot.joinDate,
        false,
        true,
        bot.id
      );
      allUsers.push(botData);
    });

    try {
      const otherUsers = JSON.parse(localStorage.getItem('otherUsers') || '[]');
      otherUsers.forEach((user: any) => {
        const userData = convertToPublicUserData(
          user.username,
          user.portfolio || [],
          user.joinDate || new Date().toLocaleDateString()
        );
        allUsers.push(userData);
      });
    } catch (error) {
      console.log('ℹ️ No other real users found');
    }

    allUsers.sort((a, b) => b.portfolioValue - a.portfolioValue);
    allUsers.forEach((user, index) => {
      user.rank = index + 1;
    });

    return allUsers;
  };

  const forceRefreshUsers = () => {
    console.log('🔄 Force refreshing user data...');
    const users = getAllUsers();
    setPublicUsers(users);
    setLastRefresh(Date.now());
  };

  const calculateBetMultiplier = (
    betType: 'increase' | 'decrease',
    targetPercentage: number,
    timeFrame: number,
    userVolatility: number,
    recentPerformance: number
  ): number => {
    const percentageDifficulty = Math.pow(Math.abs(targetPercentage) / 10, 1.2);
    const timeDifficulty = Math.pow((30 - Math.min(timeFrame, 30)) / 30, 0.8) + 0.3;
    const volatilityFactor = Math.max(0.8, Math.min(2.0, userVolatility));
    
    const trendAlignment = betType === 'increase' 
      ? (recentPerformance > 5 ? 0.7 : recentPerformance < -5 ? 1.4 : 1.0)
      : (recentPerformance < -5 ? 0.7 : recentPerformance > 5 ? 1.4 : 1.0);
    
    const marketDifficulty = targetPercentage > 20 ? Math.pow(targetPercentage / 20, 1.5) : 1.0;
    const baseDifficulty = percentageDifficulty * timeDifficulty * volatilityFactor * trendAlignment * marketDifficulty;
    const multiplier = Math.max(1.1, Math.min(15.0, 1 + baseDifficulty * 0.8));
    
    return Math.round(multiplier * 100) / 100;
  };

  const placeBet = () => {
    if (!selectedUser) return;

    if (selectedUser.isCurrentUser) {
      setMessage('You cannot bet on your own portfolio!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (betForm.amount <= 0 || betForm.amount > currentUser.balance) {
      setMessage('Invalid bet amount or insufficient funds!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const multiplier = calculateBetMultiplier(
      betForm.betType,
      betForm.targetPercentage,
      betForm.timeFrame,
      selectedUser.volatility,
      selectedUser.recentPerformance
    );

    const potentialPayout = Math.round(betForm.amount * multiplier);
    const volatilityRating = selectedUser.volatility > 2.0 ? 'High' : 
                            selectedUser.volatility > 1.3 ? 'Medium' : 'Low';

    const newBet: AdvancedBet = {
      id: Date.now().toString(),
      bettor: currentUser.username,
      targetUser: selectedUser.username,
      betType: betForm.betType,
      targetPercentage: betForm.targetPercentage,
      amount: betForm.amount,
      timeFrame: betForm.timeFrame,
      initialPortfolioValue: selectedUser.portfolioValue,
      currentPortfolioValue: selectedUser.portfolioValue,
      placedDate: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + betForm.timeFrame * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: 'active',
      multiplier,
      potentialPayout,
      volatilityRating
    };

    const updatedBets = [...activeBets, newBet];
    setActiveBets(updatedBets);
    localStorage.setItem('advancedBets', JSON.stringify(updatedBets));

    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - betForm.amount
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'bet_place',
      amount: -betForm.amount,
      date: new Date().toLocaleDateString(),
      description: `Bet on ${selectedUser.username}: ${betForm.betType} ${betForm.targetPercentage}% in ${betForm.timeFrame}d`
    };

    const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));

    setMessage(`Bet placed! $${betForm.amount} on ${selectedUser.username} portfolio ${betForm.betType === 'increase' ? 'increasing' : 'decreasing'} by ${betForm.targetPercentage}% in ${betForm.timeFrame} days. Potential payout: $${potentialPayout} (${multiplier}x)`);
    setShowBetModal(false);
    setTimeout(() => setMessage(''), 8000);
  };

  const resolveBet = (bet: AdvancedBet) => {
    const randomChange = (Math.random() - 0.5) * 40;
    const newPortfolioValue = bet.initialPortfolioValue * (1 + randomChange / 100);
    const actualChange = ((newPortfolioValue - bet.initialPortfolioValue) / bet.initialPortfolioValue) * 100;

    let won = false;
    if (bet.betType === 'increase') {
      won = actualChange >= bet.targetPercentage;
    } else {
      won = actualChange <= -bet.targetPercentage;
    }

    const updatedBet = {
      ...bet,
      status: won ? 'won' as const : 'lost' as const,
      currentPortfolioValue: newPortfolioValue
    };

    const updatedBets = activeBets.map(b => b.id === bet.id ? updatedBet : b);
    setActiveBets(updatedBets);
    localStorage.setItem('advancedBets', JSON.stringify(updatedBets));

    if (won) {
      const updatedUser = {
        ...currentUser,
        balance: currentUser.balance + bet.potentialPayout,
        totalEarnings: currentUser.totalEarnings + bet.potentialPayout
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('userProfile', JSON.stringify(updatedUser));

      setMessage(`🎉 Bet won! You received $${bet.potentialPayout} from your ${bet.betType} bet on ${bet.targetUser}!`);
    } else {
      setMessage(`😞 Bet lost. ${bet.targetUser} portfolio ${bet.betType === 'increase' ? 'did not increase' : 'did not decrease'} by ${bet.targetPercentage}% (actual: ${actualChange.toFixed(1)}%)`);
    }

    setTimeout(() => setMessage(''), 5000);
  };

  const sortUsers = (users: PublicUserData[]) => {
    switch (sortBy) {
      case 'performance':
        return [...users].sort((a, b) => b.performancePercentage - a.performancePercentage);
      case 'volatility':
        return [...users].sort((a, b) => b.volatility - a.volatility);
      default:
        return [...users].sort((a, b) => b.portfolioValue - a.portfolioValue);
    }
  };

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getPerformanceClass = (percentage: number) => {
    if (percentage >= 0) return 'positive';
    return 'negative';
  };

  const getVolatilityClass = (volatility: number) => {
    if (volatility > 2.0) return 'high';
    if (volatility > 1.3) return 'medium';
    return 'low';
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validOpinions = parsed.filter(op => op && typeof op === 'string' && op.trim().length > 0);
          setAllOpinions(validOpinions);
        }
      }

      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        setCurrentUser(JSON.parse(storedProfile));
      }

      const storedBets = localStorage.getItem('advancedBets');
      if (storedBets) {
        setActiveBets(JSON.parse(storedBets));
      }

    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  useEffect(() => {
    if (allOpinions.length > 0 && currentUser.username) {
      const users = getAllUsers();
      setPublicUsers(users);
    }
  }, [allOpinions, currentUser]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      const users = getAllUsers();
      if (users.length !== publicUsers.length) {
        setPublicUsers(users);
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [publicUsers.length]);

  const sortedUsers = sortUsers(publicUsers);
  const botCount = sortedUsers.filter(u => u.isBot).length;
  const humanCount = sortedUsers.filter(u => !u.isBot).length;

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main className="main-content">
        <div className={styles.pageHeader}>
          <div className={styles.headerTitle}>
            <h1>🏆 Portfolio Leaderboard & Betting</h1>
            <p>Portfolio betting with real traders & autonomous bots ({botCount} bots, {humanCount} humans)</p>
          </div>
          
          <div className={styles.headerActions}>
            <div className={styles.walletDisplay}>
              <p>💰 Wallet</p>
              <p>${currentUser.balance.toLocaleString()}</p>
            </div>

            <button 
              onClick={forceRefreshUsers}
              className="nav-button"
              style={{ backgroundColor: '#8b5cf6' }}
            >
              🔄 Refresh
            </button>

            <a href="/generate" className="nav-button generate">
              ✨ Generate Opinions
            </a>
            <a href="/" className="nav-button traders">
              👤 My Profile
            </a>
            <a href="/feed" className="nav-button feed">
              📡 Feed
            </a>
          </div>
        </div>

        <div className={styles.sortControls}>
          <span className={styles.sortLabel}>Sort by:</span>
          {(['value', 'performance', 'volatility'] as const).map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`${styles.sortButton} ${sortBy === option ? styles.active : ''}`}
            >
              {option === 'value' ? 'Portfolio Value' : option}
            </button>
          ))}
          <span className={styles.lastRefresh}>
            Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>

        {activeBets.length > 0 && (
          <section className={styles.activeBetsSection}>
            <h2 className={styles.activeBetsTitle}>
              🎲 My Active Bets ({activeBets.filter((b: AdvancedBet) => b.status === 'active').length})
            </h2>
            <div className={styles.activeBetsGrid}>
              {activeBets.filter((b: AdvancedBet) => b.status === 'active').slice(0, 5).map((bet: AdvancedBet) => (
                <div key={bet.id} className={styles.activeBetCard}>
                  <div className={styles.activeBetInfo}>
                    <p>
                      ${bet.amount} on {bet.targetUser} {bet.betType === 'increase' ? '📈' : '📉'} {bet.targetPercentage}%
                    </p>
                    <p>
                      {bet.timeFrame} days • {bet.volatilityRating} volatility • Expires: {bet.expiryDate}
                    </p>
                  </div>
                  <div className={styles.activeBetResults}>
                    <p>Win: ${bet.potentialPayout} ({bet.multiplier}x)</p>
                    <button
                      onClick={() => resolveBet(bet)}
                      className={styles.simulateButton}
                    >
                      Simulate Result
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <h2 className="section-title">📊 Portfolio Leaderboard ({sortedUsers.length})</h2>
          
          {sortedUsers.length === 0 ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              backgroundColor: 'white', 
              borderRadius: '12px',
              margin: '20px 0' 
            }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🤖</p>
              <h3 style={{ margin: '0 0 8px 0' }}>No Users Found</h3>
              <p style={{ margin: '0 0 16px 0', color: '#666' }}>
                Enable bots from the admin panel to see them appear here!
              </p>
              <button 
                onClick={forceRefreshUsers}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh Now
              </button>
            </div>
          ) : (
            <div className="grid grid-1">
              {sortedUsers.map((user) => (
                <div 
                  key={user.username} 
                  className={`${styles.userCard} ${user.isCurrentUser ? styles.currentUserCard : ''} ${user.isBot ? styles.botUserCard : ''}`}
                  onClick={() => {
                    setSelectedUser(user);
                    setShowBetModal(true);
                  }}
                >
                  <div className={styles.userCardHeader}>
                    <div className={styles.userInfo}>
                      <div className={`${styles.rankAvatar} ${user.rank <= 3 ? styles.topThree : ''}`}>
                        {getRankDisplay(user.rank)}
                      </div>
                      <div className={styles.userDetails}>
                        <h3>
                          {user.isBot ? '🤖 ' : ''}{user.username}
                          {user.isCurrentUser && <span className={styles.youLabel}> (You)</span>}
                        </h3>
                        <p>{user.opinionsCount} opinions • Joined {user.joinDate}</p>
                      </div>
                    </div>
                    
                    <div className={styles.portfolioStats}>
                      <p className={styles.portfolioValue}>
                        ${user.portfolioValue.toLocaleString()}
                      </p>
                      <p className={`${styles.portfolioGains} ${getPerformanceClass(user.totalGainsLosses)}`}>
                        {user.totalGainsLosses >= 0 ? '+' : ''}${user.totalGainsLosses.toFixed(0)} 
                        ({user.performancePercentage >= 0 ? '+' : ''}{user.performancePercentage.toFixed(1)}%)
                      </p>
                    </div>
                  </div>

                  <div className={styles.performanceMetrics}>
                    <div className={`${styles.metricCard} ${styles.performance}`}>
                      <p>7-Day Performance</p>
                      <p className={`${styles.metricValue} ${getPerformanceClass(user.recentPerformance)}`}>
                        {user.recentPerformance >= 0 ? '+' : ''}{user.recentPerformance.toFixed(1)}%
                      </p>
                    </div>
                    <div className={`${styles.metricCard} ${styles.volatility}`}>
                      <p>Volatility</p>
                      <p className={`${styles.metricValue} ${getVolatilityClass(user.volatility)}`}>
                        {user.volatility > 2.0 ? 'High' : user.volatility > 1.3 ? 'Medium' : 'Low'}
                      </p>
                    </div>
                    <div className={styles.metricCard}>
                      <p>Holdings</p>
                      <p className={styles.metricValue}>{user.opinionsCount}</p>
                    </div>
                  </div>
                  
                  <div className={styles.holdingsPreview}>
                    <p className={styles.holdingsTitle}>Top Holdings:</p>
                    <div className={styles.holdingsContent}>
                      {user.topOpinions.length > 0 ? (
                        user.topOpinions.slice(0, 2).map((opinion, i) => (
                          <span key={i}>
                            &quot;{safeSlice(opinion.text, 40)}&quot; (${opinion.currentPrice})
                            {i < 1 && user.topOpinions.length > 1 ? ' • ' : ''}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666', fontStyle: 'italic' }}>No holdings yet</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showBetModal && selectedUser && (
          <div 
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowBetModal(false);
                setSelectedUser(null);
              }
            }}
          >
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  🎯 Bet on {selectedUser.isBot ? '🤖 ' : ''}{selectedUser.username} Portfolio
                  {selectedUser.isCurrentUser && <span className={styles.cantBetWarning}> (Cannot bet on yourself)</span>}
                </h2>
                <button
                  onClick={() => {
                    setShowBetModal(false);
                    setSelectedUser(null);
                  }}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              {selectedUser.isCurrentUser ? (
                <div className={styles.cantBetMessage}>
                  <p>🚫 You cannot place bets on your own portfolio.</p>
                  <p>Choose another trader to bet on their performance!</p>
                </div>
              ) : (
                <>
                  {selectedUser.isBot && (
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#f0f9ff', 
                      border: '1px solid #bae6fd', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <p style={{ margin: 0, color: '#0369a1' }}>
                        🤖 You are betting on an <strong>Autonomous Trading Bot</strong> with algorithmic strategies
                      </p>
                    </div>
                  )}

                  <div className={styles.portfolioSummary}>
                    <div className={styles.summaryItem}>
                      <p>Current Value</p>
                      <p>${selectedUser.portfolioValue.toLocaleString()}</p>
                    </div>
                    <div className={styles.summaryItem}>
                      <p>Recent Performance</p>
                      <p className={getPerformanceClass(selectedUser.recentPerformance)}>
                        {selectedUser.recentPerformance >= 0 ? '+' : ''}{selectedUser.recentPerformance.toFixed(1)}%
                      </p>
                    </div>
                    <div className={styles.summaryItem}>
                      <p>Volatility</p>
                      <p className={getVolatilityClass(selectedUser.volatility)}>
                        {selectedUser.volatility > 2.0 ? 'High' : selectedUser.volatility > 1.3 ? 'Medium' : 'Low'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.bettingForm}>
                    <h3 className={styles.formTitle}>📊 Custom Portfolio Bet</h3>
                    
                    <div className={styles.formGroup}>
                      <p className={styles.formLabel}>Direction:</p>
                      <div className={styles.directionButtons}>
                        <button
                          onClick={() => setBetForm({ ...betForm, betType: 'increase' as 'increase' | 'decrease' })}
                          className={`${styles.directionButton} ${styles.increase} ${betForm.betType === 'increase' ? styles.active : ''}`}
                        >
                          📈 INCREASE
                        </button>
                        <button
                          onClick={() => setBetForm({ ...betForm, betType: 'decrease' as 'increase' | 'decrease' })}
                          className={`${styles.directionButton} ${styles.decrease} ${betForm.betType === 'decrease' ? styles.active : ''}`}
                        >
                          📉 DECREASE
                        </button>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Target Percentage: {betForm.targetPercentage}%
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={betForm.targetPercentage}
                        onChange={(e) => setBetForm({ ...betForm, targetPercentage: parseInt(e.target.value) })}
                        className={styles.rangeInput}
                      />
                      <div className={styles.rangeLabels}>
                        <span>5% (Easy)</span>
                        <span>25% (Medium)</span>
                        <span>50% (Hard)</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Timeframe: {betForm.timeFrame} days
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={betForm.timeFrame}
                        onChange={(e) => setBetForm({ ...betForm, timeFrame: parseInt(e.target.value) })}
                        className={styles.rangeInput}
                      />
                      <div className={styles.rangeLabels}>
                        <span>1 day (Hard)</span>
                        <span>15 days</span>
                        <span>30 days (Easy)</span>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Bet Amount:</label>
                      <input
                        type="number"
                        value={betForm.amount}
                        onChange={(e) => setBetForm({ ...betForm, amount: parseInt(e.target.value) || 0 })}
                        placeholder="Enter amount..."
                        min="1"
                        max={currentUser.balance}
                        className={styles.amountInput}
                      />
                      <div className={styles.quickAmounts}>
                        {[50, 100, 250, 500].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setBetForm({ ...betForm, amount })}
                            disabled={amount > currentUser.balance}
                            className={styles.quickAmountButton}
                          >
                            ${amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    {betForm.amount > 0 && (
                      <div className={styles.betSummary}>
                        <p>Bet Summary:</p>
                        <p>
                          Betting ${betForm.amount} that {selectedUser.isBot ? '🤖 ' : ''}{selectedUser.username} portfolio will{' '}
                          <strong>{betForm.betType}</strong> by <strong>{betForm.targetPercentage}%</strong>{' '}
                          within <strong>{betForm.timeFrame} days</strong>
                        </p>
                        <p>
                          Multiplier: <strong>
                            {calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              selectedUser.volatility,
                              selectedUser.recentPerformance
                            ).toFixed(2)}x
                          </strong> • 
                          Potential Payout: <strong>
                            ${Math.round(betForm.amount * calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              selectedUser.volatility,
                              selectedUser.recentPerformance
                            ))}
                          </strong>
                        </p>
                      </div>
                    )}

                    <button
                      onClick={placeBet}
                      disabled={betForm.amount <= 0 || betForm.amount > currentUser.balance}
                      className={styles.placeBetButton}
                    >
                      {betForm.amount <= 0 ? 'Enter Bet Amount' :
                       betForm.amount > currentUser.balance ? 'Insufficient Funds' :
                       `Place Bet: ${betForm.amount}`}
                    </button>
                  </div>

                  <div className={styles.modalHoldings}>
                    <h3>Top Holdings ({selectedUser.opinionsCount} total)</h3>
                    {selectedUser.topOpinions.length > 0 ? (
                      <div className={styles.holdingsGrid}>
                        {selectedUser.topOpinions.map((opinion, index) => (
                          <div key={index} className={styles.holdingItem}>
                            <div>
                              <p className={styles.holdingText}>
                                &quot;{safeSlice(opinion.text, 60)}&quot;
                              </p>
                            </div>
                            <div className={styles.holdingStats}>
                              <p>${opinion.currentPrice}</p>
                              <p className={(opinion.currentPrice - opinion.purchasePrice) >= 0 ? styles.positive : styles.negative}>
                                {(opinion.currentPrice - opinion.purchasePrice) >= 0 ? '+' : ''}${(opinion.currentPrice - opinion.purchasePrice).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '20px', 
                        textAlign: 'center', 
                        color: '#666',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px'
                      }}>
                        <p>📭 No holdings to display</p>
                        <p style={{ fontSize: '14px' }}>
                          {selectedUser.isBot ? 'This bot has not made any trades yet' : 'This user has not purchased any opinions yet'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className={`${styles.statusMessage} ${message.includes('won') || message.includes('placed') ? styles.success : styles.error}`}>
            {message}
          </div>
        )}

        {botCount > 0 && (
          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            backgroundColor: '#f0f9ff', 
            border: '1px solid #e0f2fe', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#0369a1' }}>
              🤖 <strong>{botCount}</strong> autonomous trading bots active • 
              Real portfolios with algorithmic strategies • 
              Updated every 30 seconds
            </p>
          </div>
        )}
      </main>
    </div>
  );
}