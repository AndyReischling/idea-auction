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
  recentPerformance: number; // 7-day performance
  rank: number;
  isCurrentUser?: boolean; // Flag to identify current user
}

interface AdvancedBet {
  id: string;
  bettor: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number; // days
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

// Interface for bot user data
interface BotUser {
  username: string;
  portfolio: OpinionAsset[];
  joinDate: string;
  // Add any other bot-specific properties
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
  
  // Advanced betting form state
  const [betForm, setBetForm] = useState({
    betType: 'increase' as 'increase' | 'decrease',
    targetPercentage: 10,
    amount: 100,
    timeFrame: 7
  });

  // SAFE SLICE FUNCTION
  const safeSlice = (text: string | null | undefined, maxLength: number = 40): string => {
    if (!text || typeof text !== 'string') return 'Unknown opinion';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Get opinion market data
  const getOpinionMarketData = (opinionText: string) => {
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    return marketData[opinionText] || { currentPrice: 10, timesPurchased: 0 };
  };

  // Calculate portfolio volatility based on holdings
  const calculatePortfolioVolatility = (opinions: OpinionAsset[]): number => {
    if (opinions.length === 0) return 1.0;
    
    let totalVolatility = 0;
    opinions.forEach(opinion => {
      const text = opinion.text.toLowerCase();
      let opinionVolatility = 1.0;
      
      // High volatility keywords
      if (text.includes('crypto') || text.includes('bitcoin')) opinionVolatility += 0.8;
      if (text.includes('controversial') || text.includes('hot take')) opinionVolatility += 0.5;
      if (text.includes('prediction') || text.includes('future')) opinionVolatility += 0.3;
      if (text.includes('politics')) opinionVolatility += 0.6;
      
      // Low volatility keywords
      if (text.includes('safe') || text.includes('obvious')) opinionVolatility -= 0.3;
      
      totalVolatility += Math.max(0.5, Math.min(3.0, opinionVolatility));
    });
    
    return totalVolatility / opinions.length;
  };

  // Get current user's portfolio from localStorage
  const getCurrentUserPortfolio = (): OpinionAsset[] => {
    try {
      const portfolio = localStorage.getItem('userPortfolio');
      if (portfolio) {
        return JSON.parse(portfolio);
      }
    } catch (error) {
      console.error('Error loading user portfolio:', error);
    }
    return [];
  };

  // Get bot users from localStorage
  const getBotUsers = (): BotUser[] => {
    try {
      const bots = localStorage.getItem('botUsers');
      if (bots) {
        return JSON.parse(bots);
      }
    } catch (error) {
      console.error('Error loading bot users:', error);
    }
    return [];
  };

  // Get other real users (you might need to implement this based on your user system)
  const getOtherUsers = (): any[] => {
    try {
      const otherUsers = localStorage.getItem('otherUsers');
      if (otherUsers) {
        return JSON.parse(otherUsers);
      }
    } catch (error) {
      console.error('Error loading other users:', error);
    }
    return [];
  };

  // Convert user data to PublicUserData format
  const convertToPublicUserData = (
    username: string,
    portfolio: OpinionAsset[],
    joinDate: string,
    isCurrentUser: boolean = false
  ): PublicUserData => {
    let totalValue = 0;
    let totalCost = 0;

    // Calculate portfolio value and cost
    portfolio.forEach(asset => {
      const marketData = getOpinionMarketData(asset.text);
      const currentPrice = marketData.currentPrice || asset.currentPrice;
      totalValue += currentPrice * asset.quantity;
      totalCost += asset.purchasePrice * asset.quantity;
    });

    const gainsLosses = totalValue - totalCost;
    const performancePercentage = totalCost > 0 ? ((gainsLosses / totalCost) * 100) : 0;
    const volatility = calculatePortfolioVolatility(portfolio);
    
    // For real users, you might want to calculate actual recent performance
    // For now, using a placeholder calculation
    const recentPerformance = performancePercentage * 0.3; // Simplified calculation

    // Get top performing opinions
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
      rank: 0, // Will be set after sorting
      isCurrentUser
    };
  };

  // Generate enhanced mock users (keeping some for demo purposes)
  const generateMockUsers = (): PublicUserData[] => {
    const mockUsernames = [
      'CryptoGuru2024', 'OpinionWhale', 'TrendSpotter', 'MarketMaven', 'BearishBob',
      'BullishBella', 'VolatileVic', 'SteadySteve', 'RiskyRita', 'SafetySteven'
    ];

    const users = mockUsernames.map((username, index) => {
      // Generate random portfolios for demo
      const portfolioSize = Math.floor(Math.random() * 12) + 3; // 3-15 opinions
      const mockOpinions: OpinionAsset[] = [];
      let totalValue = 0;
      let totalCost = 0;

      for (let i = 0; i < portfolioSize; i++) {
        const opinionIndex = Math.floor(Math.random() * allOpinions.length);
        if (allOpinions[opinionIndex]) {
          const purchasePrice = Math.floor(Math.random() * 80) + 10;
          const marketData = getOpinionMarketData(allOpinions[opinionIndex]);
          const currentPrice = marketData.currentPrice;
          
          const asset: OpinionAsset = {
            id: `${username}-${i}`,
            text: allOpinions[opinionIndex],
            purchasePrice,
            currentPrice,
            purchaseDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            quantity: Math.floor(Math.random() * 3) + 1
          };
          
          mockOpinions.push(asset);
          totalValue += currentPrice * asset.quantity;
          totalCost += purchasePrice * asset.quantity;
        }
      }

      const gainsLosses = totalValue - totalCost;
      const performancePercentage = totalCost > 0 ? ((gainsLosses / totalCost) * 100) : 0;
      const volatility = calculatePortfolioVolatility(mockOpinions);
      const recentPerformance = (Math.random() - 0.5) * 60; // -30% to +30%

      return {
        username,
        portfolioValue: totalValue,
        totalGainsLosses: gainsLosses,
        opinionsCount: mockOpinions.length,
        joinDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        performancePercentage,
        topOpinions: mockOpinions.sort((a, b) => 
          ((b.currentPrice - b.purchasePrice) * b.quantity) - ((a.currentPrice - a.purchasePrice) * a.quantity)
        ).slice(0, 5),
        volatility,
        recentPerformance,
        rank: 0 // Will be set after sorting
      };
    });

    return users;
  };

  // Get all users (real + mock)
  const getAllUsers = (): PublicUserData[] => {
    const allUsers: PublicUserData[] = [];

    // Add current user
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

    // Add bot users
    const botUsers = getBotUsers();
    botUsers.forEach(bot => {
      const botData = convertToPublicUserData(
        bot.username,
        bot.portfolio,
        bot.joinDate
      );
      allUsers.push(botData);
    });

    // Add other real users
    const otherUsers = getOtherUsers();
    otherUsers.forEach(user => {
      const userData = convertToPublicUserData(
        user.username,
        user.portfolio || [],
        user.joinDate || new Date().toLocaleDateString()
      );
      allUsers.push(userData);
    });

    // Add some mock users for demonstration (you can remove this later)
    if (allOpinions.length > 0) {
      const mockUsers = generateMockUsers();
      allUsers.push(...mockUsers);
    }

    // Sort by portfolio value and assign ranks
    allUsers.sort((a, b) => b.portfolioValue - a.portfolioValue);
    allUsers.forEach((user, index) => user.rank = index + 1);

    return allUsers;
  };

  // Calculate advanced bet multiplier
  const calculateBetMultiplier = (
    betType: 'increase' | 'decrease',
    targetPercentage: number,
    timeFrame: number,
    userVolatility: number,
    recentPerformance: number
  ): number => {
    // Base difficulty from target percentage (exponential)
    const percentageDifficulty = Math.pow(Math.abs(targetPercentage) / 10, 1.2);
    
    // Time pressure (shorter = harder, exponential curve)
    const timeDifficulty = Math.pow((30 - Math.min(timeFrame, 30)) / 30, 0.8) + 0.3;
    
    // Volatility affects predictability
    const volatilityFactor = Math.max(0.8, Math.min(2.0, userVolatility));
    
    // Trend alignment (betting against trend is harder)
    const trendAlignment = betType === 'increase' 
      ? (recentPerformance > 5 ? 0.7 : recentPerformance < -5 ? 1.4 : 1.0)
      : (recentPerformance < -5 ? 0.7 : recentPerformance > 5 ? 1.4 : 1.0);
    
    // Market conditions (higher percentage moves are exponentially harder)
    const marketDifficulty = targetPercentage > 20 ? Math.pow(targetPercentage / 20, 1.5) : 1.0;
    
    const baseDifficulty = percentageDifficulty * timeDifficulty * volatilityFactor * trendAlignment * marketDifficulty;
    const multiplier = Math.max(1.1, Math.min(15.0, 1 + baseDifficulty * 0.8));
    
    return Math.round(multiplier * 100) / 100;
  };

  // Place advanced bet
  const placeBet = () => {
    if (!selectedUser) return;

    // Prevent betting on yourself
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

    // Update bets
    const updatedBets = [...activeBets, newBet];
    setActiveBets(updatedBets);
    localStorage.setItem('advancedBets', JSON.stringify(updatedBets));

    // Update user balance
    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - betForm.amount
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));

    // Add transaction
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

    setMessage(`Bet placed! $${betForm.amount} on ${selectedUser.username}'s portfolio ${betForm.betType === 'increase' ? 'increasing' : 'decreasing'} by ${betForm.targetPercentage}% in ${betForm.timeFrame} days. Potential payout: $${potentialPayout} (${multiplier}x)`);
    setShowBetModal(false);
    setTimeout(() => setMessage(''), 8000);
  };

  // Simulate bet resolution (for demo purposes)
  const resolveBet = (bet: AdvancedBet) => {
    // Simulate portfolio value change
    const randomChange = (Math.random() - 0.5) * 40; // -20% to +20% change
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
      status: won ? 'won' : 'lost' as 'won' | 'lost',
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
      setMessage(`😞 Bet lost. ${bet.targetUser}'s portfolio ${bet.betType === 'increase' ? 'didn\'t increase' : 'didn\'t decrease'} by ${bet.targetPercentage}% (actual: ${actualChange.toFixed(1)}%)`);
    }

    setTimeout(() => setMessage(''), 5000);
  };

  // Sort users
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
    // Load opinions for sidebar
    try {
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validOpinions = parsed.filter(op => op && typeof op === 'string' && op.trim().length > 0);
          setAllOpinions(validOpinions);
        }
      }

      // Load current user
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        setCurrentUser(JSON.parse(storedProfile));
      }

      // Load active bets
      const storedBets = localStorage.getItem('advancedBets');
      if (storedBets) {
        setActiveBets(JSON.parse(storedBets));
      }

    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  useEffect(() => {
    // Generate all users (real + mock) after opinions are loaded
    if (allOpinions.length > 0) {
      const users = getAllUsers();
      setPublicUsers(users);
    }
  }, [allOpinions, currentUser]);

  const sortedUsers = sortUsers(publicUsers);

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main className="main-content">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerTitle}>
            <h1>🏆 Portfolio Leaderboard & Betting</h1>
            <p>Advanced portfolio betting with custom targets & timeframes</p>
          </div>
          
          <div className={styles.headerActions}>
            {/* Wallet Balance */}
            <div className={styles.walletDisplay}>
              <p>💰 Wallet</p>
              <p>${currentUser.balance.toLocaleString()}</p>
            </div>

            {/* Navigation Buttons */}
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

        {/* Sort Controls */}
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
        </div>

        {/* My Active Bets */}
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

        {/* User Leaderboard */}
        <section className="section">
          <h2 className="section-title">📊 Traders ({sortedUsers.length})</h2>
          
          <div className="grid grid-1">
            {sortedUsers.map((user) => (
              <div 
                key={user.username} 
                className={`${styles.userCard} ${user.isCurrentUser ? styles.currentUserCard : ''}`}
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
                        {user.username}
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

                {/* Performance Metrics */}
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
                
                {/* Top Holdings Preview */}
                <div className={styles.holdingsPreview}>
                  <p className={styles.holdingsTitle}>Top Holdings:</p>
                  <div className={styles.holdingsContent}>
                    {user.topOpinions.slice(0, 2).map((opinion, i) => (
                      <span key={i}>
                        "{safeSlice(opinion.text, 40)}" (${opinion.currentPrice})
                        {i < 1 && user.topOpinions.length > 1 ? ' • ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Advanced Bet Modal */}
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
                  🎯 Bet on {selectedUser.username}'s Portfolio
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
                  {/* Portfolio Summary */}
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

                  {/* Betting Form */}
                  <div className={styles.bettingForm}>
                    <h3 className={styles.formTitle}>📊 Custom Portfolio Bet</h3>
                    
                    {/* Bet Direction */}
                    <div className={styles.formGroup}>
                      <p className={styles.formLabel}>Direction:</p>
                      <div className={styles.directionButtons}>
                        <button
                          onClick={() => setBetForm({ ...betForm, betType: 'increase' })}
                          className={`${styles.directionButton} ${styles.increase} ${betForm.betType === 'increase' ? styles.active : ''}`}
                        >
                          📈 INCREASE
                        </button>
                        <button
                          onClick={() => setBetForm({ ...betForm, betType: 'decrease' })}
                          className={`${styles.directionButton} ${styles.decrease} ${betForm.betType === 'decrease' ? styles.active : ''}`}
                        >
                          📉 DECREASE
                        </button>
                      </div>
                    </div>

                    {/* Target Percentage */}
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

                    {/* Timeframe */}
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

                    {/* Bet Amount */}
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

                    {/* Bet Summary */}
                    {betForm.amount > 0 && (
                      <div className={styles.betSummary}>
                        <p>Bet Summary:</p>
                        <p>
                          Betting ${betForm.amount} that {selectedUser.username}'s portfolio will{' '}
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

                  {/* Holdings Preview */}
                  <div className={styles.modalHoldings}>
                    <h3>Top Holdings ({selectedUser.opinionsCount} total)</h3>
                    <div className={styles.holdingsGrid}>
                      {selectedUser.topOpinions.map((opinion, index) => (
                        <div key={index} className={styles.holdingItem}>
                          <div>
                            <p className={styles.holdingText}>
                              "{safeSlice(opinion.text, 60)}"
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
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div className={`${styles.statusMessage} ${message.includes('won') || message.includes('placed') ? styles.success : styles.error}`}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}