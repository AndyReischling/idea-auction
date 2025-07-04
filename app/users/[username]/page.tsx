'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import styles from '../page.module.css';
import { ScanSmiley, Balloon, Wallet, CurrencyCircleDollar, ChartLine, Folder, DiceSix, BookOpenText, Play, CurrencyDollar, Rss } from '@phosphor-icons/react';

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
  quantity?: number;
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
  opinionId?: string;
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
        progress: Math.max(0, Math.min(100, progress)),
        opinionId: short.opinionId
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
      
      <main className="main-content" style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '0', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '24px 0 8px 0', borderBottom: '1px solid #eee', marginBottom: '16px', paddingRight: '20px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '28px', 
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '20px'
          }}>
            <ScanSmiley size={32} />  {userProfile.username}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="/feed" className="nav-button feed">
              <Rss size={24} /> Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
              <Balloon size={24} /> Generate Opinion
            </a>
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={24} /> View Traders
            </a>
            <a href="/" className="nav-button traders">
              <Wallet size={24} /> My Portfolio
            </a>
          </div>
        </div>

        <div className={styles.walletOverview} style={{ marginTop: '36px' }}>
          <div className={`${styles.walletCard} ${styles.balance}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 0 }}>
              <CurrencyCircleDollar size={24} style={{ verticalAlign: 'middle', marginLeft: '-16px', marginRight: 8 }} />
              <span style={{ marginLeft: 0 }}>Wallet Balance</span>
            </h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, textAlign: 'center' }}>${userProfile.balance.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.portfolio}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 0 }}>
              <ChartLine size={24} style={{ verticalAlign: 'middle', marginLeft: '-16px', marginRight: 8 }} />
              <span style={{ marginLeft: 0 }}>Portfolio Value</span>
            </h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, textAlign: 'center' }}>${portfolioValue.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.pnl} ${totalGainsLosses >= 0 ? styles.positive : styles.negative}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 0 }}>
              <Folder size={24} style={{ verticalAlign: 'middle', marginLeft: '-16px', marginRight: 8 }} />
              <span style={{ marginLeft: 0 }}>P&L</span>
            </h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, textAlign: 'center' }}>{totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.bets}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 0 }}>
              <DiceSix size={24} style={{ verticalAlign: 'middle', marginLeft: '-16px', marginRight: 8 }} />
              <span style={{ marginLeft: 0 }}>Active Bets</span>
            </h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, textAlign: 'center' }}>{totalActiveBets}</p>
          </div>
        </div>

        {/* Portfolio Holdings Section - grid card style */}
        <div style={{ margin: '32px 0' }}>
          <h2 className="section-title" style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DiceSix size={28} style={{ verticalAlign: 'middle' }} /> My Opinion Portfolio
          </h2>
          {ownedOpinions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
              {ownedOpinions.map((opinion, index) => {
                const gain = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainPct = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                // Find the correct opinion index in the opinions array
                const allOpinions = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('opinions') || '[]') : [];
                const opinionIndex = allOpinions.findIndex((op: string) => op === opinion.text);
                const opinionId = opinionIndex !== -1 ? opinionIndex : opinion.id;
                
                return (
                  <a
                    key={index}
                    href={`/opinion/${opinionId}`}
                    style={{
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '16px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                      display: 'block',
                      textDecoration: 'none',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      cursor: 'pointer',
                      color: '#222',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.10)';
                      e.currentTarget.style.transform = 'scale(1.03)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.03)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#222', lineHeight: 1.2 }}>{opinion.text}</div>
                    <div style={{ color: '#666', fontSize: '0.95rem', marginBottom: '10px' }}>
                      Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}
                    </div>
                    <div style={{ color: '#444', fontSize: '1rem', marginBottom: '6px' }}>Bought: ${opinion.purchasePrice}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.5rem', color: '#111' }}>${opinion.currentPrice.toFixed(2)}</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: gain >= 0 ? '#16a34a' : '#dc2626' }}>
                        {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
                      </span>
                    </div>
                  </a>
                );
              })}
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
          <h2 className="section-title" style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DiceSix size={28} style={{ verticalAlign: 'middle' }} /> User Portfolio Bets & Short Positions
          </h2>
          
          {combinedBettingActivity.length === 0 ? (
            <div className="empty-state">
              <p>{isBot ? 'This bot hasn\'t placed any bets or short positions yet!' : 'This user hasn\'t placed any bets or short positions yet!'}</p>
              <p>{isBot ? 'The bot will start making strategic bets as it develops confidence.' : 'They can bet on portfolios (1-100% range with multiplied losses) or short specific opinions.'}</p>
            </div>
          ) : (
            <div className={styles.betGrid}>
              {combinedBettingActivity.slice(0, 10).map((activity) => {
                return (
                  <div className={styles.betCard} key={activity.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Left: Main Content */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: '8px', marginLeft: '-12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          {activity.type === 'short_bet' && (
                            <>
                              <span style={{ background: '#fde047', color: '#000', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                SHORT
                              </span>
                              {activity.status === 'lost' && (
                                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  LOST
                                </span>
                              )}
                              {activity.status === 'won' && (
                                <span style={{ background: '#22c55e', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  WON
                                </span>
                              )}
                              {activity.status === 'expired' && (
                                <span style={{ background: '#222', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  EXPIRED
                                </span>
                              )}
                            </>
                          )}
                          {!(activity.type === 'short_bet') && (
                            <>
                              {activity.status === 'active' && (
                                <span className={`${styles.betStatus} ${styles[activity.status]}`} style={{ background: '#22c55e', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  ACTIVE
                                </span>
                              )}
                              {activity.status === 'won' && (
                                <span style={{ background: '#22c55e', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  WON
                                </span>
                              )}
                              {activity.status === 'lost' && (
                                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '16px', padding: '2px 16px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px', display: 'inline-block', minWidth: '70px', textAlign: 'center' }}>
                                  LOST
                                </span>
                              )}
                            </>
                          )}
                          {activity.status === 'active' && activity.daysRemaining !== null && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '16px', marginLeft: '8px' }}>{activity.daysRemaining} days left</span>
                          )}
                        </div>
                        {activity.type === 'short_bet' ? (
                          <a href={`/opinion/${activity.opinionId}`} style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700, fontSize: '1.15rem', marginBottom: '2px', cursor: 'pointer' }}>
                            {activity.title}
                          </a>
                        ) : (
                          <div style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '2px', color: 'var(--text-primary)' }}>{activity.title}</div>
                        )}
                        <div style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '6px' }}>{activity.subtitle}</div>
                        {activity.type === 'short_bet' && activity.opinionText && (
                          <div style={{ fontStyle: 'italic', margin: '8px 0', padding: '8px', background: '#f8f9fa', borderRadius: '4px', fontSize: '13px', color: '#555' }}>
                            "{safeSlice(activity.opinionText, 60)}"
                          </div>
                        )}
                        {activity.type === 'short_bet' && activity.status === 'active' && activity.progress !== undefined && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', color: 'var(--text-tertiary)' }}>
                              <span>Progress to target:</span>
                              <span>{activity.progress.toFixed(1)}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(100, activity.progress)}%`,
                                height: '100%',
                                backgroundColor: activity.progress >= 100 ? '#10b981' : activity.progress >= 50 ? '#f59e0b' : '#ef4444',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '10px', flexWrap: 'wrap' }}>
                          {activity.additionalInfo && <span>{activity.additionalInfo}</span>}
                          {activity.multiplier && (
                            !activity.additionalInfo?.includes('multiplier') &&
                              <span>8x multiplier</span>
                          )}
                        </div>
                      </div>
                      {/* Right: Meta/Stats */}
                      <div style={{ textAlign: 'right', minWidth: '140px', flexShrink: 0, marginTop: '0px', marginRight: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '2px', color: activity.status === 'won' ? '#22c55e' : activity.status === 'lost' ? '#ef4444' : 'var(--text-primary)' }}>
                          {activity.status === 'won' ? `Won $${activity.potentialPayout}` :
                           activity.status === 'lost' ? (activity.type === 'portfolio_bet' && activity.actualLoss ? `Lost $${activity.actualLoss} (${activity.amount} × ${activity.multiplier}x)` : `Lost $${activity.amount}`) :
                           activity.status === 'active' ? `Potential: $${activity.potentialPayout}` :
                           'Expired'}
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: '2px' }}>Placed: {activity.placedDate}</div>
                        {activity.status === 'active' && (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Expires: {activity.expiryDate}</div>
                        )}
                        {activity.status === 'active' && activity.type === 'portfolio_bet' && activity.multiplier && (
                          <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                            Risk: ${activity.amount * activity.multiplier} if lost
                          </div>
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
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <Play size={28} weight="fill" style={{ marginBottom: '-2px' }} />
            Recent Activity
          </h2>
          
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
                          {transaction.type === 'buy' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#4ade80' }}>
                                <CurrencyDollar size={18} color="#fff" weight="bold" />
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '1.1rem', marginLeft: '6px' }}>
                                Bought{transaction.quantity ? ` ${transaction.quantity} unit${transaction.quantity > 1 ? 's' : ''}` : ''}
                              </span>
                            </span>
                          ) : (
                            <span>{emoji} {activityText}</span>
                          )}
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

                <div className={styles.modalHoldings} style={{ margin: '32px 0' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '16px' }}>Portfolio Holdings ({ownedOpinions.length} total)</h3>
                  {ownedOpinions.length > 0 ? (
                    <div className={styles.holdingsGrid}>
                      {ownedOpinions.map((opinion, index) => (
                        <div key={index} className={styles.holdingItem}>
                          <div>
                            <p className={styles.holdingText} style={{ fontStyle: 'italic', fontSize: '1rem', marginBottom: '8px' }}>
                              "{safeSlice(opinion.text, 60)}"
                            </p>
                            <p style={{ color: '#888', fontSize: '0.95rem', margin: 0 }}>Qty: {opinion.quantity}</p>
                          </div>
                          <div className={styles.holdingStats}>
                            <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>${opinion.currentPrice}</p>
                            <p className={(opinion.currentPrice - opinion.purchasePrice) >= 0 ? styles.positive : styles.negative} style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>
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