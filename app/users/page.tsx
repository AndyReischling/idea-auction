'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';

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

  // Generate enhanced mock users
  const generateMockUsers = (): PublicUserData[] => {
    const mockUsernames = [
      'CryptoGuru2024', 'OpinionWhale', 'TrendSpotter', 'MarketMaven', 'BearishBob',
      'BullishBella', 'VolatileVic', 'SteadySteve', 'RiskyRita', 'SafetySteven',
      'DiamondHands', 'PaperTrader', 'AlgoAssassin', 'PatternPundit', 'ChartChampion'
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

    // Sort by portfolio value and assign ranks
    users.sort((a, b) => b.portfolioValue - a.portfolioValue);
    users.forEach((user, index) => user.rank = index + 1);

    return users;
  };

  // Place advanced bet
  const placeBet = () => {
    if (!selectedUser) return;

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

  const getPerformanceColor = (percentage: number) => {
    if (percentage > 30) return '#28a745';
    if (percentage > 10) return '#6f9654';
    if (percentage > 0) return '#ffc107';
    if (percentage > -10) return '#fd7e14';
    return '#dc3545';
  };

  const getVolatilityColor = (volatility: number) => {
    if (volatility > 2.0) return '#dc3545';
    if (volatility > 1.3) return '#ffc107';
    return '#28a745';
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
    // Generate mock users after opinions are loaded
    if (allOpinions.length > 0) {
      const users = generateMockUsers();
      setPublicUsers(users);
    }
  }, [allOpinions]);

  const sortedUsers = sortUsers(publicUsers);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1400px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem' 
        }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#333' }}>
              🏆 Portfolio Leaderboard & Betting
            </h1>
            <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '1.1rem' }}>
              Advanced portfolio betting with custom targets & timeframes
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Wallet Balance */}
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#e8f5e8',
              borderRadius: '6px',
              border: '1px solid #c3e6c3',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>💰 Wallet</p>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#155724' }}>
                ${currentUser.balance.toLocaleString()}
              </p>
            </div>

            {/* Navigation Buttons */}
            <a href="/generate" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              ✨ Generate Opinions
            </a>
            <a href="/" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#007bff', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              👤 My Profile
            </a>
          </div>
        </div>

<a
  href="/feed"
  style={{
    padding: '0.75rem 1.5rem',
    backgroundColor: '#dc3545',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  }}
>
  📡 Feed
</a>

        {/* Sort Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <span style={{ marginRight: '1rem', fontWeight: 'bold', color: '#666' }}>Sort by:</span>
          {(['value', 'performance', 'volatility'] as const).map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: sortBy === option ? '#007bff' : 'white',
                color: sortBy === option ? 'white' : '#333',
                border: '1px solid #007bff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: sortBy === option ? 'bold' : 'normal',
                textTransform: 'capitalize'
              }}
            >
              {option === 'value' ? 'Portfolio Value' : option}
            </button>
          ))}
        </div>

        {/* My Active Bets */}
        {activeBets.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
              🎲 My Active Bets ({activeBets.filter((b: AdvancedBet) => b.status === 'active').length})
            </h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {activeBets.filter((b: AdvancedBet) => b.status === 'active').slice(0, 5).map((bet: AdvancedBet) => (
                <div key={bet.id} style={{
                  padding: '1rem',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffeaa7',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                      ${bet.amount} on {bet.targetUser} {bet.betType === 'increase' ? '📈' : '📉'} {bet.targetPercentage}%
                    </p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                      {bet.timeFrame} days • {bet.volatilityRating} volatility • Expires: {bet.expiryDate}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#28a745' }}>
                      Win: ${bet.potentialPayout} ({bet.multiplier}x)
                    </p>
                    <button
                      onClick={() => resolveBet(bet)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
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
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            📊 Traders ({sortedUsers.length})
          </h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {sortedUsers.map((user) => (
              <div key={user.username} style={{
                padding: '1.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e9ecef',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              onClick={() => {
                setSelectedUser(user);
                setShowBetModal(true);
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: user.rank <= 3 ? '#ffd700' : '#007bff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      border: user.rank <= 3 ? '3px solid #ffd700' : 'none'
                    }}>
                      {getRankDisplay(user.rank)}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
                        {user.username}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        {user.opinionsCount} opinions • Joined {user.joinDate}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 'bold', color: '#333' }}>
                      ${user.portfolioValue.toLocaleString()}
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: getPerformanceColor(user.performancePercentage)
                    }}>
                      {user.totalGainsLosses >= 0 ? '+' : ''}${user.totalGainsLosses.toFixed(0)} 
                      ({user.performancePercentage >= 0 ? '+' : ''}{user.performancePercentage.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: '0.75rem', 
                  marginBottom: '1rem' 
                }}>
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '6px', 
                    textAlign: 'center' 
                  }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#666' }}>7-Day Performance</p>
                    <p style={{ 
                      margin: 0, 
                      fontWeight: 'bold', 
                      color: getPerformanceColor(user.recentPerformance),
                      fontSize: '0.9rem'
                    }}>
                      {user.recentPerformance >= 0 ? '+' : ''}{user.recentPerformance.toFixed(1)}%
                    </p>
                  </div>
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '6px', 
                    textAlign: 'center' 
                  }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#666' }}>Volatility</p>
                    <p style={{ 
                      margin: 0, 
                      fontWeight: 'bold', 
                      color: getVolatilityColor(user.volatility),
                      fontSize: '0.9rem'
                    }}>
                      {user.volatility > 2.0 ? 'High' : user.volatility > 1.3 ? 'Medium' : 'Low'}
                    </p>
                  </div>
                  <div style={{ 
                    padding: '0.75rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '6px', 
                    textAlign: 'center' 
                  }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#666' }}>Holdings</p>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {user.opinionsCount}
                    </p>
                  </div>
                </div>
                
                {/* Top Holdings Preview */}
                <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>
                    Top Holdings:
                  </p>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
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
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBetModal(false);
              setSelectedUser(null);
            }
          }}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                  🎯 Bet on {selectedUser.username}'s Portfolio
                </h2>
                <button
                  onClick={() => {
                    setShowBetModal(false);
                    setSelectedUser(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Portfolio Summary */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '1rem', 
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Current Value</p>
                  <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#1565c0' }}>
                    ${selectedUser.portfolioValue.toLocaleString()}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Recent Performance</p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold',
                    color: getPerformanceColor(selectedUser.recentPerformance)
                  }}>
                    {selectedUser.recentPerformance >= 0 ? '+' : ''}{selectedUser.recentPerformance.toFixed(1)}%
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>Volatility</p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold',
                    color: getVolatilityColor(selectedUser.volatility)
                  }}>
                    {selectedUser.volatility > 2.0 ? 'High' : selectedUser.volatility > 1.3 ? 'Medium' : 'Low'}
                  </p>
                </div>
              </div>

              {/* Betting Form */}
              <div style={{ 
                padding: '1.5rem', 
                backgroundColor: '#fff3e0', 
                borderRadius: '8px',
                border: '1px solid #ffcc02',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#e65100' }}>
                  📊 Custom Portfolio Bet
                </h3>
                
                {/* Bet Direction */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Direction:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      onClick={() => setBetForm({ ...betForm, betType: 'increase' })}
                      style={{
                        padding: '1rem',
                        backgroundColor: betForm.betType === 'increase' ? '#28a745' : '#f8f9fa',
                        color: betForm.betType === 'increase' ? 'white' : '#333',
                        border: '2px solid #28a745',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}
                    >
                      📈 INCREASE
                    </button>
                    <button
                      onClick={() => setBetForm({ ...betForm, betType: 'decrease' })}
                      style={{
                        padding: '1rem',
                        backgroundColor: betForm.betType === 'decrease' ? '#dc3545' : '#f8f9fa',
                        color: betForm.betType === 'decrease' ? 'white' : '#333',
                        border: '2px solid #dc3545',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}
                    >
                      📉 DECREASE
                    </button>
                  </div>
                </div>

                {/* Target Percentage */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    Target Percentage: {betForm.targetPercentage}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={betForm.targetPercentage}
                    onChange={(e) => setBetForm({ ...betForm, targetPercentage: parseInt(e.target.value) })}
                    style={{ width: '100%', margin: '0 0 0.5rem 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                    <span>5% (Easy)</span>
                    <span>25% (Medium)</span>
                    <span>50% (Hard)</span>
                  </div>
                </div>

                {/* Timeframe */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    Timeframe: {betForm.timeFrame} days
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={betForm.timeFrame}
                    onChange={(e) => setBetForm({ ...betForm, timeFrame: parseInt(e.target.value) })}
                    style={{ width: '100%', margin: '0 0 0.5rem 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                    <span>1 day (Hard)</span>
                    <span>15 days</span>
                    <span>30 days (Easy)</span>
                  </div>
                </div>

                {/* Bet Amount */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    Bet Amount:
                  </label>
                  <input
                    type="number"
                    value={betForm.amount}
                    onChange={(e) => setBetForm({ ...betForm, amount: parseInt(e.target.value) || 0 })}
                    placeholder="Enter amount..."
                    min="1"
                    max={currentUser.balance}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {[50, 100, 250, 500].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setBetForm({ ...betForm, amount })}
                        disabled={amount > currentUser.balance}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: amount > currentUser.balance ? '#ccc' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: amount > currentUser.balance ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bet Summary */}
                {betForm.amount > 0 && (
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#e3f2fd', 
                    borderRadius: '6px',
                    marginBottom: '1rem'
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#1565c0' }}>
                      Bet Summary:
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                      Betting ${betForm.amount} that {selectedUser.username}'s portfolio will{' '}
                      <strong>{betForm.betType}</strong> by <strong>{betForm.targetPercentage}%</strong>{' '}
                      within <strong>{betForm.timeFrame} days</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      Multiplier: <strong>
                        {calculateBetMultiplier(
                          betForm.betType,
                          betForm.targetPercentage,
                          betForm.timeFrame,
                          selectedUser.volatility,
                          selectedUser.recentPerformance
                        ).toFixed(2)}x
                      </strong> • 
                      Potential Payout: <strong style={{ color: '#28a745' }}>
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
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: (betForm.amount <= 0 || betForm.amount > currentUser.balance) ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (betForm.amount <= 0 || betForm.amount > currentUser.balance) ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}
                >
                  {betForm.amount <= 0 ? 'Enter Bet Amount' :
                   betForm.amount > currentUser.balance ? 'Insufficient Funds' :
                   `Place Bet: ${betForm.amount}`}
                </button>
              </div>

              {/* Holdings Preview */}
              <div>
                <h3 style={{ margin: '0 0 1rem 0' }}>Top Holdings ({selectedUser.opinionsCount} total)</h3>
                <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedUser.topOpinions.map((opinion, index) => (
                    <div key={index} style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                          "{safeSlice(opinion.text, 60)}"
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>${opinion.currentPrice}</p>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '0.85rem',
                          color: (opinion.currentPrice - opinion.purchasePrice) >= 0 ? '#28a745' : '#dc3545'
                        }}>
                          {(opinion.currentPrice - opinion.purchasePrice) >= 0 ? '+' : ''}${(opinion.currentPrice - opinion.purchasePrice).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            backgroundColor: message.includes('won') || message.includes('placed') ? '#d4edda' : '#f8d7da',
            color: message.includes('won') || message.includes('placed') ? '#155724' : '#721c24',
            border: `1px solid ${message.includes('won') || message.includes('placed') ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '8px',
            zIndex: 1001,
            fontWeight: 'bold',
            maxWidth: '400px',
            wordWrap: 'break-word'
          }}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}