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
  volatilityRating: 'Low' | 'Medium' | 'High' | 'Extreme';
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
  actualLoss?: number;
}

// NEW: Betting form interface
interface BetForm {
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number;
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
  const [isClient, setIsClient] = useState(false);
  
  // NEW: Betting states
  const [showBetModal, setShowBetModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });
  const [message, setMessage] = useState('');
  const [betForm, setBetForm] = useState<BetForm>({
    betType: 'increase',
    targetPercentage: 15,
    amount: 100,
    timeFrame: 7
  });
  const [activeBets, setActiveBets] = useState<AdvancedBet[]>([]);

  // Safe localStorage helper with storage limit protection
  const safeLocalStorage = {
    getItem: (key: string) => {
      if (typeof window !== 'undefined' && isClient) {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return null;
        }
      }
      return null;
    },
    
    setItem: (key: string, value: string) => {
      if (typeof window !== 'undefined' && isClient) {
        try {
          if (key === 'portfolioSnapshots') {
            const data = JSON.parse(value);
            const maxSnapshots = 100;
            const limitedData = data.slice(-maxSnapshots);
            localStorage.setItem(key, JSON.stringify(limitedData));
          } else {
            localStorage.setItem(key, value);
          }
        } catch (error: any) {
          console.error('Error writing to localStorage:', error);
          if (error?.name === 'QuotaExceededError' && key !== 'portfolioSnapshots') {
            console.warn('Storage quota exceeded, attempting cleanup...');
            try {
              const existingSnapshots = localStorage.getItem('portfolioSnapshots');
              if (existingSnapshots) {
                const snapshots = JSON.parse(existingSnapshots);
                const reducedSnapshots = snapshots.slice(-50);
                localStorage.setItem('portfolioSnapshots', JSON.stringify(reducedSnapshots));
                localStorage.setItem(key, value);
              }
            } catch (retryError) {
              console.error('Failed to save even after cleanup:', retryError);
            }
          }
        }
      }
    },
    
    removeItem: (key: string) => {
      if (typeof window !== 'undefined' && isClient) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing from localStorage:', error);
        }
      }
    }
  };

  const safeSlice = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text || typeof text !== 'string') return 'Unknown text';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const getCurrentPrice = (opinionText: string): number => {
    if (!isClient) return 10;
    
    try {
      const marketDataStr = safeLocalStorage.getItem('opinionMarketData');
      if (marketDataStr) {
        const marketData = JSON.parse(marketDataStr);
        if (marketData[opinionText]) {
          return marketData[opinionText].currentPrice;
        }
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
    if (!isClient) return [];
    
    try {
      const shortsStr = safeLocalStorage.getItem('shortPositions');
      if (!shortsStr) return [];
      
      const shorts = JSON.parse(shortsStr);
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
    if (!isClient) return [];
    
    try {
      const betsStr = safeLocalStorage.getItem('advancedBets');
      if (!betsStr) return [];
      
      const bets = JSON.parse(betsStr);
      return bets.filter((bet: AdvancedBet) => bet.bettor === username);
    } catch {
      return [];
    }
  };

  // NEW: Betting calculation functions
  const calculateBetMultiplier = (
    betType: 'increase' | 'decrease',
    targetPercentage: number,
    timeFrame: number,
    userVolatility: number,
    recentPerformance: number
  ): number => {
    let baseMultiplier = 1.0;
    
    if (targetPercentage >= 1 && targetPercentage <= 5) {
      baseMultiplier = 1.2;
    } else if (targetPercentage > 5 && targetPercentage <= 15) {
      baseMultiplier = 1.5;
    } else if (targetPercentage > 15 && targetPercentage <= 25) {
      baseMultiplier = 2.0;
    } else if (targetPercentage > 25 && targetPercentage <= 40) {
      baseMultiplier = 3.0;
    } else if (targetPercentage > 40 && targetPercentage <= 60) {
      baseMultiplier = 4.0;
    } else if (targetPercentage > 60 && targetPercentage <= 80) {
      baseMultiplier = 5.0;
    } else if (targetPercentage > 80 && targetPercentage <= 100) {
      baseMultiplier = 6.0;
    }
    
    let timeMultiplier = 1.0;
    if (timeFrame <= 1) {
      timeMultiplier = 1.5;
    } else if (timeFrame <= 3) {
      timeMultiplier = 1.3;
    } else if (timeFrame <= 7) {
      timeMultiplier = 1.0;
    } else if (timeFrame <= 14) {
      timeMultiplier = 0.9;
    } else {
      timeMultiplier = 0.8;
    }
    
    const volatilityFactor = Math.max(0.8, Math.min(2.0, userVolatility));
    
    const trendAlignment = betType === 'increase' 
      ? (recentPerformance > 5 ? 0.7 : recentPerformance < -5 ? 1.4 : 1.0)
      : (recentPerformance < -5 ? 0.7 : recentPerformance > 5 ? 1.4 : 1.0);
    
    const finalMultiplier = baseMultiplier * timeMultiplier * volatilityFactor * trendAlignment;
    
    return Math.max(1.1, Math.min(15.0, Math.round(finalMultiplier * 10) / 10));
  };

  const getVolatilityRating = (percentage: number): 'Low' | 'Medium' | 'High' | 'Extreme' => {
    if (percentage >= 1 && percentage <= 10) return 'Low';
    if (percentage > 10 && percentage <= 30) return 'Medium';
    if (percentage > 30 && percentage <= 70) return 'High';
    return 'Extreme';
  };

  const calculatePotentialLoss = (amount: number, multiplier: number): number => {
    return amount * multiplier;
  };

  const getPerformanceClass = (percentage: number) => {
    if (percentage >= 0) return 'positive';
    return 'negative';
  };

  const calculatePortfolioVolatility = (opinions: OpinionAsset[]): number => {
    if (opinions.length === 0) return 1.0;
    
    if (opinions.length <= 3) return 2.0;
    if (opinions.length <= 7) return 1.5;
    return 1.0;
  };

  const calculateReal7DayPerformance = (username: string, currentValue: number, botId?: string): number => {
    try {
      const snapshots = JSON.parse(safeLocalStorage.getItem('portfolioSnapshots') || '[]');
      const now = new Date();
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      
      const userSnapshots = snapshots.filter((snap: any) => {
        if (botId) {
          return snap.botId === botId && snap.timestamp >= sevenDaysAgo;
        } else {
          return snap.userId === username && !snap.botId && snap.timestamp >= sevenDaysAgo;
        }
      });
      
      if (userSnapshots.length === 0) {
        return 0;
      }
      
      userSnapshots.sort((a: any, b: any) => a.timestamp - b.timestamp);
      const oldestSnapshot = userSnapshots[0];
      
      if (oldestSnapshot.portfolioValue <= 0) {
        return 0;
      }
      
      const performanceChange = ((currentValue - oldestSnapshot.portfolioValue) / oldestSnapshot.portfolioValue) * 100;
      
      return Math.max(-95, Math.min(500, performanceChange));
      
    } catch (error) {
      console.error('Error calculating 7-day performance:', error);
      return 0;
    }
  };

  // NEW: Place bet function
  const placeBet = () => {
    if (!userProfile) return;

    if (userProfile.username === currentUser.username) {
      setMessage('You cannot bet on your own portfolio!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (betForm.amount <= 0 || betForm.amount > currentUser.balance) {
      setMessage('Invalid bet amount or insufficient funds!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const portfolioValue = ownedOpinions.reduce((total, opinion) => 
      total + (opinion.currentPrice * opinion.quantity), 0
    );

    const volatility = calculatePortfolioVolatility(ownedOpinions);
    const recentPerformance = calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined);

    const multiplier = calculateBetMultiplier(
      betForm.betType,
      betForm.targetPercentage,
      betForm.timeFrame,
      volatility,
      recentPerformance
    );

    const potentialPayout = Math.round(betForm.amount * multiplier);
    const potentialLoss = calculatePotentialLoss(betForm.amount, multiplier);
    const volatilityRating = getVolatilityRating(betForm.targetPercentage);

    const newBet: AdvancedBet = {
      id: Date.now().toString(),
      bettor: currentUser.username,
      targetUser: userProfile.username,
      betType: betForm.betType,
      targetPercentage: betForm.targetPercentage,
      amount: betForm.amount,
      timeFrame: betForm.timeFrame,
      initialPortfolioValue: portfolioValue,
      currentPortfolioValue: portfolioValue,
      placedDate: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + betForm.timeFrame * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: 'active',
      multiplier,
      potentialPayout,
      volatilityRating
    };

    const updatedBets = [...activeBets, newBet];
    setActiveBets(updatedBets);
    safeLocalStorage.setItem('advancedBets', JSON.stringify(updatedBets));

    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - betForm.amount
    };
    setCurrentUser(updatedUser);
    safeLocalStorage.setItem('userProfile', JSON.stringify(updatedUser));

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'bet_place',
      amount: -betForm.amount,
      date: new Date().toLocaleDateString(),
      description: `Bet on ${userProfile.username}: ${betForm.betType} ${betForm.targetPercentage}% in ${betForm.timeFrame}d (${multiplier}x multiplier)`
    };

    const existingTransactions = JSON.parse(safeLocalStorage.getItem('transactions') || '[]');
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    safeLocalStorage.setItem('transactions', JSON.stringify(updatedTransactions));

    setMessage(`Bet placed! $${betForm.amount} on ${userProfile.username} portfolio ${betForm.betType === 'increase' ? 'increasing' : 'decreasing'} by ${betForm.targetPercentage}% in ${betForm.timeFrame} days. Potential payout: $${potentialPayout} (${multiplier}x) | Risk: $${potentialLoss} if lost`);
    setShowBetModal(false);
    setTimeout(() => setMessage(''), 10000);
  };

  // Validate percentage range (1%-100%)
  const validateBetPercentage = (percentage: number): boolean => {
    return percentage >= 1 && percentage <= 100;
  };

  // Calculate actual loss amount for failed portfolio bets
  const calculateBetLoss = (bet: AdvancedBet): number => {
    return bet.amount * bet.multiplier;
  };

  // Get difficulty label for display
  const getDifficultyLabel = (percentage: number): string => {
    if (percentage >= 1 && percentage <= 10) return 'Easy';
    if (percentage > 10 && percentage <= 25) return 'Medium';
    if (percentage > 25 && percentage <= 50) return 'Hard';
    return 'Extreme';
  };

  const combineBettingActivities = (bets: AdvancedBet[], shorts: ShortPosition[]) => {
    const activities: BettingActivity[] = [];

    bets.forEach(bet => {
      const actualLoss = bet.status === 'lost' ? calculateBetLoss(bet) : undefined;
      
      const percentageDisplay = validateBetPercentage(bet.targetPercentage) 
        ? `${bet.targetPercentage}%` 
        : `${bet.targetPercentage}% (Invalid range: must be 1-100%)`;

      const difficultyLabel = getDifficultyLabel(bet.targetPercentage);

      activities.push({
        id: `bet_${bet.id}`,
        type: 'portfolio_bet',
        title: `Portfolio Bet: ${bet.targetUser}`,
        subtitle: `Betting $${bet.amount} on ${bet.betType} by ${percentageDisplay} (${difficultyLabel})`,
        amount: bet.amount,
        potentialPayout: bet.potentialPayout,
        status: bet.status,
        placedDate: bet.placedDate,
        expiryDate: bet.expiryDate,
        daysRemaining: bet.status === 'active' ? getDaysRemaining(bet.expiryDate) : undefined,
        additionalInfo: `${bet.timeFrame} days | ${bet.volatilityRating} volatility | ${bet.multiplier}x multiplier`,
        multiplier: bet.multiplier,
        volatilityRating: bet.volatilityRating,
        targetUser: bet.targetUser,
        actualLoss: actualLoss
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
    if (!isClient) return [];
    
    try {
      const botTransactionsStr = safeLocalStorage.getItem('botTransactions');
      if (!botTransactionsStr) return [];
      
      const botTransactions = JSON.parse(botTransactionsStr);
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
    if (!isClient) return;
    
    const targetUsername = decodeURIComponent(username as string);
    
    try {
      const botsStr = safeLocalStorage.getItem('autonomousBots');
      const bots = botsStr ? JSON.parse(botsStr) : [];
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

        const botOpinionsStr = safeLocalStorage.getItem('botOpinions');
        const botOpinions = botOpinionsStr ? JSON.parse(botOpinionsStr) : [];
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
        const currentUserProfileStr = safeLocalStorage.getItem('userProfile');
        const currentUserProfile = currentUserProfileStr ? JSON.parse(currentUserProfileStr) : {};
        if (currentUserProfile.username === targetUsername) {
          setUserProfile(currentUserProfile);
          
          const ownedOpinionsStr = safeLocalStorage.getItem('ownedOpinions');
          const ownedOpinions = ownedOpinionsStr ? JSON.parse(ownedOpinionsStr) : [];
          const updatedOpinions = ownedOpinions.map((opinion: OpinionAsset) => ({
            ...opinion,
            currentPrice: getCurrentPrice(opinion.text)
          }));
          setOwnedOpinions(updatedOpinions);

          const transactionsStr = safeLocalStorage.getItem('transactions');
          const transactions = transactionsStr ? JSON.parse(transactionsStr) : [];
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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    // Load current user profile
    const storedProfile = safeLocalStorage.getItem('userProfile');
    if (storedProfile) {
      setCurrentUser(JSON.parse(storedProfile));
    }

    // Load active bets
    const storedBets = safeLocalStorage.getItem('advancedBets');
    if (storedBets) {
      setActiveBets(JSON.parse(storedBets));
    }
    
    const storedStr = safeLocalStorage.getItem('opinions');
    if (storedStr) {
      const parsed = JSON.parse(storedStr);
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setAllOpinions(validOpinions);
    }

    if (username) {
      loadUserData();
    }
  }, [username, isClient]);

  if (!userProfile || !isClient) {
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

  const isCurrentUser = userProfile.username === currentUser.username;

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
                  🤖 Algorithmic Trading Strategies (1-100% bet range with loss multipliers)
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

        {/* NEW: Prominent Bet on Portfolio Button */}
        {!isCurrentUser && (
          <div style={{ 
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setShowBetModal(true)}
              style={{
                width: '100%',
                maxWidth: '600px',
                padding: '20px 40px',
                fontSize: '20px',
                fontWeight: '700',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#d97706';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
              }}
            >
              🎯 Bet on Portfolio
            </button>
          </div>
        )}

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
              <p>{isBot ? 'The bot will start making strategic bets as it develops confidence.' : 'They can bet on portfolios (1-100% range with multiplied losses) or short specific opinions.'}</p>
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
                          {activity.multiplier && (
                            <span style={{ 
                              color: activity.status === 'lost' ? '#ef4444' : 'inherit',
                              fontWeight: activity.status === 'lost' ? '600' : 'normal'
                            }}>
                              Multiplier: {activity.multiplier}x
                              {activity.status === 'lost' && ' (Applied to loss)'}
                            </span>
                          )}
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
                           activity.status === 'lost' ? 
                             (activity.type === 'portfolio_bet' && activity.actualLoss ? 
                               `Lost $${activity.actualLoss} (${activity.amount} × ${activity.multiplier}x)` : 
                               `Lost $${activity.amount}`) :
                           activity.status === 'active' ? `Potential: $${activity.potentialPayout}` :
                           'Expired'}
                        </p>
                        {activity.status === 'active' && (
                          <p className="card-subtitle">Expires: {activity.expiryDate}</p>
                        )}
                        {activity.status === 'active' && activity.type === 'portfolio_bet' && activity.multiplier && (
                          <p className="card-subtitle" style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                            Risk: ${activity.amount * activity.multiplier} if lost
                          </p>
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
                    activityText = 'Lost Portfolio Bet (with multiplier applied)';
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

        {/* NEW: Betting Modal */}
        {showBetModal && userProfile && (
          <div 
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowBetModal(false);
              }
            }}
          >
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  🎯 Bet on {isBot ? '🤖 ' : ''}{userProfile.username} Portfolio
                </h2>
                <button
                  onClick={() => setShowBetModal(false)}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <>
                {isBot && (
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
                    <p>${portfolioValue.toLocaleString()}</p>
                  </div>
                  <div className={styles.summaryItem}>
                    <p>Real 7-Day Performance</p>
                    <p className={getPerformanceClass(calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined))}>
                      {calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined) >= 0 ? '+' : ''}{calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined).toFixed(1)}%
                    </p>
                  </div>
                  <div className={styles.summaryItem}>
                    <p>Volatility</p>
                    <p className={calculatePortfolioVolatility(ownedOpinions) > 2.0 ? 'high' : calculatePortfolioVolatility(ownedOpinions) > 1.3 ? 'medium' : 'low'}>
                      {calculatePortfolioVolatility(ownedOpinions) > 2.0 ? 'High' : calculatePortfolioVolatility(ownedOpinions) > 1.3 ? 'Medium' : 'Low'}
                    </p>
                  </div>
                </div>

                <div className={styles.bettingForm}>
                  <h3 className={styles.formTitle}>📊 Custom Portfolio Bet</h3>
                  
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

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Target Percentage: {betForm.targetPercentage}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={betForm.targetPercentage}
                      onChange={(e) => setBetForm({ ...betForm, targetPercentage: parseInt(e.target.value) })}
                      className={styles.rangeInput}
                    />
                    <div className={styles.rangeLabels}>
                      <span>1% (Easy)</span>
                      <span>25% (Medium)</span>
                      <span>50% (Hard)</span>
                      <span>100% (Extreme)</span>
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
                      <div className={styles.betSummaryHeader}>
                        <p>📊 Bet Summary:</p>
                      </div>
                      <p>
                        Betting ${betForm.amount} that {isBot ? '🤖 ' : ''}{userProfile.username} portfolio will{' '}
                        <strong>{betForm.betType}</strong> by <strong>{betForm.targetPercentage}%</strong>{' '}
                        within <strong>{betForm.timeFrame} days</strong>
                      </p>
                      <div className={styles.betCalculations}>
                        <div className={styles.calculationRow}>
                          <span>Multiplier:</span>
                          <span><strong>
                            {calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              calculatePortfolioVolatility(ownedOpinions),
                              calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                            ).toFixed(2)}x
                          </strong></span>
                        </div>
                        <div className={styles.calculationRow}>
                          <span>Volatility Rating:</span>
                          <span><strong>{getVolatilityRating(betForm.targetPercentage)}</strong></span>
                        </div>
                        <div className={styles.calculationRow}>
                          <span>If You Win:</span>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            +${Math.round(betForm.amount * calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              calculatePortfolioVolatility(ownedOpinions),
                              calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                            ))}
                          </span>
                        </div>
                        <div className={styles.calculationRow}>
                          <span>If You Lose:</span>
                          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                            -${calculatePotentialLoss(betForm.amount, calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              calculatePortfolioVolatility(ownedOpinions),
                              calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                            ))}
                          </span>
                        </div>
                      </div>
                      
                      {/* Loss Warning */}
                      <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>
                          ⚠️ Loss Calculation: ${betForm.amount} × {calculateBetMultiplier(
                            betForm.betType,
                            betForm.targetPercentage,
                            betForm.timeFrame,
                            calculatePortfolioVolatility(ownedOpinions),
                            calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                          ).toFixed(2)}x = ${calculatePotentialLoss(betForm.amount, calculateBetMultiplier(
                            betForm.betType,
                            betForm.targetPercentage,
                            betForm.timeFrame,
                            calculatePortfolioVolatility(ownedOpinions),
                            calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                          ))}
                        </div>
                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
                          Higher percentages and shorter timeframes increase both potential rewards and losses
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={placeBet}
                    disabled={betForm.amount <= 0 || betForm.amount > currentUser.balance}
                    className={styles.placeBetButton}
                  >
                    {betForm.amount <= 0 ? 'Enter Bet Amount' :
                     betForm.amount > currentUser.balance ? 'Insufficient Funds' :
                     `Place Bet: ${betForm.amount} (Risk: ${calculatePotentialLoss(betForm.amount, calculateBetMultiplier(
                       betForm.betType,
                       betForm.targetPercentage,
                       betForm.timeFrame,
                       calculatePortfolioVolatility(ownedOpinions),
                       calculateReal7DayPerformance(userProfile.username, portfolioValue, botId || undefined)
                     ))})`}
                  </button>
                </div>

                <div className={styles.modalHoldings}>
                  <h3>Top Holdings ({ownedOpinions.length} total)</h3>
                  {ownedOpinions.length > 0 ? (
                    <div className={styles.holdingsGrid}>
                      {ownedOpinions.slice(0, 5).map((opinion, index) => (
                        <div key={index} className={styles.holdingItem}>
                          <div>
                            <p className={styles.holdingText}>
                              "{safeSlice(opinion.text, 60)}"
                            </p>
                          </div>
                          <div className={styles.holdingStats}>
                            <p>${opinion.currentPrice}</p>
                            <p className={(opinion.currentPrice - opinion.purchasePrice) >= 0 ? 'positive' : 'negative'}>
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
                        {isBot ? 'This bot has not made any trades yet' : 'This user has not purchased any opinions yet'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            </div>
          </div>
        )}

        {message && (
          <div className={`${styles.statusMessage} ${message.includes('won') || message.includes('placed') ? styles.success : styles.error}`}>
            {message}
          </div>
        )}

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
              Portfolio updates automatically based on market conditions • 
              <strong>Bet range: 1%-100% with loss multipliers</strong> • 
              <strong>Loss calculation: Bet Amount × Multiplier (higher % = higher risk)</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}