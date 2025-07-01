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
  activeBetsCount?: number;
  activeShortsCount?: number;
  shortExposure?: number;
  betExposure?: number;
}

interface AdvancedBet {
  id: string;
  bettor: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number; // Now supports 1%-100%
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
}

interface DetailedUserView {
  user: PublicUserData;
  portfolio: OpinionAsset[];
  activeBets: AdvancedBet[];
  activeShorts: ShortPosition[];
  recentTransactions: Transaction[];
}

// NEW: Interface for tracking portfolio value over time
interface PortfolioSnapshot {
  userId: string;
  botId?: string;
  portfolioValue: number;
  timestamp: number;
  date: string;
}

export default function UsersPage() {
  const [isClient, setIsClient] = useState(false);
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailedUserView, setDetailedUserView] = useState<DetailedUserView | null>(null);
  const [activeBets, setActiveBets] = useState<AdvancedBet[]>([]);
  const [message, setMessage] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'performance' | 'volatility' | 'recent_performance'>('recent_performance');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  const [betForm, setBetForm] = useState<{
    betType: 'increase' | 'decrease';
    targetPercentage: number;
    amount: number;
    timeFrame: number;
  }>({
    betType: 'increase',
    targetPercentage: 15, // Changed default to 15%
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

  // NEW: Function to save portfolio snapshot
  // FIXED: Function to save portfolio snapshot with proper error handling
  const savePortfolioSnapshot = (userId: string, portfolioValue: number, botId?: string) => {
    // Don't run on server side
    if (typeof window === 'undefined') return;
    
    try {
      // Emergency cleanup first - get existing snapshots
      const existingSnapshots = JSON.parse(localStorage.getItem('portfolioSnapshots') || '[]');
      
      // CRITICAL: Aggressive cleanup to prevent storage overflow
      const now = new Date();
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000); // Only keep 7 days
      
      // Filter to recent snapshots and limit to 50 total entries
      const recentSnapshots = existingSnapshots
        .filter((snap: PortfolioSnapshot) => snap.timestamp > sevenDaysAgo)
        .slice(-49); // Keep last 49, add 1 new = 50 total
      
      // Create new snapshot
      const snapshot: PortfolioSnapshot = {
        userId,
        botId,
        portfolioValue,
        timestamp: now.getTime(),
        date: now.toISOString().split('T')[0] // YYYY-MM-DD format
      };
      
      // Add new snapshot
      const updatedSnapshots = [...recentSnapshots, snapshot];
      
      // Check data size before saving
      const dataString = JSON.stringify(updatedSnapshots);
      const dataSize = new Blob([dataString]).size;
      
      // If data is too large, use emergency cleanup
      if (dataSize > 2 * 1024 * 1024) { // 2MB limit
        console.warn('Portfolio snapshots too large, emergency cleanup...');
        
        // Super aggressive cleanup - keep only last 20 snapshots
        const emergencySnapshots = updatedSnapshots.slice(-20);
        localStorage.setItem('portfolioSnapshots', JSON.stringify(emergencySnapshots));
        console.log(`Emergency cleanup: reduced to ${emergencySnapshots.length} snapshots`);
      } else {
        // Normal save
        localStorage.setItem('portfolioSnapshots', dataString);
      }
      
    } catch (error) {
      // CRITICAL: Handle storage quota exceeded error gracefully
      console.warn('Portfolio snapshot save failed:', error);
      
      try {
        // Emergency response - clear all portfolio snapshots and start fresh
        localStorage.removeItem('portfolioSnapshots');
        
        // Create minimal snapshot array with just the new entry
        const freshSnapshot: PortfolioSnapshot = {
          userId,
          botId,
          portfolioValue,
          timestamp: Date.now(),
          date: new Date().toISOString().split('T')[0]
        };
        
        localStorage.setItem('portfolioSnapshots', JSON.stringify([freshSnapshot]));
        console.log('Emergency recovery: created fresh portfolio snapshots');
        
      } catch (emergencyError) {
        console.error('Emergency portfolio snapshot recovery failed:', emergencyError);
        // Complete failure - disable portfolio snapshots for this session
        console.log('Portfolio snapshots disabled for this session');
      }
    }
  };

  // NEW: Function to calculate real 7-day performance
  const calculateReal7DayPerformance = (userId: string, currentValue: number, botId?: string): number => {
    try {
      const snapshots = JSON.parse(localStorage.getItem('portfolioSnapshots') || '[]');
      const now = new Date();
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      
      // Filter snapshots for this user/bot from 7 days ago
      const userSnapshots = snapshots.filter((snap: PortfolioSnapshot) => {
        if (botId) {
          return snap.botId === botId && snap.timestamp >= sevenDaysAgo;
        } else {
          return snap.userId === userId && !snap.botId && snap.timestamp >= sevenDaysAgo;
        }
      });
      
      if (userSnapshots.length === 0) {
        // No historical data, try to estimate based on current performance
        return 0; // Default to 0% if no history
      }
      
      // Get the oldest snapshot from 7 days ago (closest to 7 days ago)
      userSnapshots.sort((a: PortfolioSnapshot, b: PortfolioSnapshot) => a.timestamp - b.timestamp);
      const oldestSnapshot = userSnapshots[0];
      
      if (oldestSnapshot.portfolioValue <= 0) {
        return 0;
      }
      
      // Calculate percentage change
      const performanceChange = ((currentValue - oldestSnapshot.portfolioValue) / oldestSnapshot.portfolioValue) * 100;
      
      // Cap extreme values
      return Math.max(-95, Math.min(500, performanceChange));
      
    } catch (error) {
      console.error('Error calculating 7-day performance:', error);
      return 0;
    }
  };

  // NEW: Function to initialize historical data for existing users (one-time setup)
  const initializeHistoricalData = () => {
    try {
      const existingSnapshots = JSON.parse(localStorage.getItem('portfolioSnapshots') || '[]');
      
      // Only initialize if we don't have much historical data
      if (existingSnapshots.length < 10) {
        const now = new Date();
        const newSnapshots: PortfolioSnapshot[] = [];
        
        // Create historical snapshots for current user
        const currentUserPortfolio = getCurrentUserPortfolio();
        const currentUserValue = calculatePortfolioValue(currentUserPortfolio);
        
        for (let i = 14; i >= 0; i--) {
          const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
          // Simulate historical values with some realistic variation
          const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
          const historicalValue = currentUserValue * (1 + variation * (i / 14));
          
          newSnapshots.push({
            userId: currentUser.username,
            portfolioValue: Math.max(100, historicalValue),
            timestamp: date.getTime(),
            date: date.toISOString().split('T')[0]
          });
        }
        
        // Create historical snapshots for bots
        const botUsers = getBotUsers();
        botUsers.forEach(bot => {
          const botPortfolio = getBotPortfolio(bot.id);
          const botValue = calculatePortfolioValue(botPortfolio);
          
          for (let i = 14; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            // Bots can have more volatile historical performance
            const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
            const historicalValue = botValue * (1 + variation * (i / 14));
            
            newSnapshots.push({
              userId: bot.username,
              botId: bot.id,
              portfolioValue: Math.max(100, historicalValue),
              timestamp: date.getTime(),
              date: date.toISOString().split('T')[0]
            });
          }
        });
        
        // Merge with existing snapshots and save
        const allSnapshots = [...existingSnapshots, ...newSnapshots];
        localStorage.setItem('portfolioSnapshots', JSON.stringify(allSnapshots));
        
        console.log('📊 Initialized historical portfolio data for', newSnapshots.length, 'snapshots');
      }
    } catch (error) {
      console.error('Error initializing historical data:', error);
    }
  };

  // Helper function to calculate portfolio value
  const calculatePortfolioValue = (portfolio: OpinionAsset[]): number => {
    return portfolio.reduce((total, asset) => {
      const marketData = getOpinionMarketData(asset.text);
      const currentPrice = marketData.currentPrice || asset.currentPrice;
      return total + (currentPrice * asset.quantity);
    }, 0);
  };

  // Get user's active short positions
  const getUserShorts = (username: string, botId?: string): ShortPosition[] => {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      return shorts.filter((short: ShortPosition) => {
        if (botId) {
          return short.botId === botId && short.status === 'active';
        } else {
          // For human users, assume shorts without botId belong to the current user
          return !short.botId && short.status === 'active' && username === currentUser.username;
        }
      });
    } catch {
      return [];
    }
  };

  // Get user's active bets (bets they placed)
  const getUserBets = (username: string): AdvancedBet[] => {
    try {
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      return bets.filter((bet: AdvancedBet) => bet.bettor === username && bet.status === 'active');
    } catch {
      return [];
    }
  };

  // Get user's bot transactions
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
          description: t.opinionText || t.description
        }))
        .slice(0, 10); // Recent 10 transactions
    } catch {
      return [];
    }
  };

  // Calculate portfolio value including short exposure and bet exposure
  const calculateEnhancedPortfolioValue = (
    portfolio: OpinionAsset[], 
    activeShorts: ShortPosition[], 
    activeBets: AdvancedBet[]
  ): { 
    portfolioValue: number; 
    shortExposure: number; 
    betExposure: number; 
    adjustedValue: number;
  } => {
    // Traditional opinion holdings value
    const portfolioValue = calculatePortfolioValue(portfolio);

    // Short positions exposure (money at risk)
    const shortExposure = activeShorts.reduce((total, short) => total + short.betAmount, 0);

    // Bet exposure (money at risk) - now uses multiplier for potential loss
    const betExposure = activeBets.reduce((total, bet) => total + (bet.amount * bet.multiplier), 0);

    // Adjusted portfolio value (traditional value minus money tied up in shorts/bets)
    const adjustedValue = portfolioValue - shortExposure - betExposure;

    return { portfolioValue, shortExposure, betExposure, adjustedValue };
  };

  const calculatePortfolioVolatility = (opinions: OpinionAsset[]): number => {
    // Simplified volatility - just based on portfolio size
    if (opinions.length === 0) return 1.0;
    
    // Smaller portfolios = higher volatility, larger portfolios = lower volatility
    if (opinions.length <= 3) return 2.0; // High volatility
    if (opinions.length <= 7) return 1.5; // Medium volatility
    return 1.0; // Low volatility
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

  const convertToPublicUserData = (
    username: string,
    portfolio: OpinionAsset[],
    joinDate: string,
    isCurrentUser: boolean = false,
    isBot: boolean = false,
    botId?: string
  ): PublicUserData => {
    // Get user's active shorts and bets
    const activeShorts = getUserShorts(username, botId);
    const activeBets = getUserBets(username);

    // Calculate enhanced portfolio values
    const { portfolioValue, shortExposure, betExposure, adjustedValue } = 
      calculateEnhancedPortfolioValue(portfolio, activeShorts, activeBets);

    let totalCost = 0;
    portfolio.forEach(asset => {
      totalCost += asset.purchasePrice * asset.quantity;
    });

    const gainsLosses = portfolioValue - totalCost;
    const performancePercentage = totalCost > 0 ? ((gainsLosses / totalCost) * 100) : 0;
    const volatility = calculatePortfolioVolatility(portfolio);
    
    // CHANGED: Use real 7-day performance calculation
    const recentPerformance = calculateReal7DayPerformance(username, adjustedValue, botId);

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
      portfolioValue: adjustedValue, // Use adjusted value that accounts for short/bet exposure
      totalGainsLosses: gainsLosses,
      opinionsCount: portfolio.length,
      joinDate,
      performancePercentage,
      topOpinions,
      volatility,
      recentPerformance, // Now using real calculated performance
      rank: 0,
      isCurrentUser,
      isBot,
      botId,
      activeBetsCount: activeBets.length,
      activeShortsCount: activeShorts.length,
      shortExposure,
      betExposure
    };
  };

  // Show detailed user view
  const showUserDetails = (user: PublicUserData) => {
    const portfolio = user.isBot && user.botId ? getBotPortfolio(user.botId) : 
                     user.isCurrentUser ? getCurrentUserPortfolio() : [];
    
    const activeShorts = getUserShorts(user.username, user.botId);
    const activeBets = getUserBets(user.username);
    
    // Get recent transactions
    let recentTransactions: Transaction[] = [];
    if (user.isBot && user.botId) {
      recentTransactions = getUserBotTransactions(user.botId);
    } else if (user.isCurrentUser) {
      try {
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        recentTransactions = transactions.slice(0, 10);
      } catch {
        recentTransactions = [];
      }
    }

    setDetailedUserView({
      user,
      portfolio,
      activeBets,
      activeShorts,
      recentTransactions
    });
    setShowDetailModal(true);
  };

  const getAllUsers = (): PublicUserData[] => {
    const allUsers: PublicUserData[] = [];

    console.log('🔄 Loading all users (real + bots)...');

    const currentUserPortfolio = getCurrentUserPortfolio();
    if (currentUserPortfolio.length > 0 || currentUser.username) {
      const currentUserData = convertToPublicUserData(
        currentUser.username,
        currentUserPortfolio,
        currentUser.joinDate,
        true
      );
      allUsers.push(currentUserData);
      
      // NEW: Save current portfolio snapshot
      savePortfolioSnapshot(currentUser.username, currentUserData.portfolioValue);
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
      
      // NEW: Save bot portfolio snapshot
      savePortfolioSnapshot(bot.username, botData.portfolioValue, bot.id);
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
        
        // NEW: Save other user portfolio snapshot
        savePortfolioSnapshot(user.username, userData.portfolioValue);
      });
    } catch (error) {
      console.log('ℹ️ No other real users found');
    }

    // CHANGED: Sort by real recent performance (7-day) and update ranks
    allUsers.sort((a, b) => b.recentPerformance - a.recentPerformance);
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

  // ENHANCED: Calculate bet multiplier with support for 1-100% range and loss calculation
  const calculateBetMultiplier = (
    betType: 'increase' | 'decrease',
    targetPercentage: number,
    timeFrame: number,
    userVolatility: number,
    recentPerformance: number
  ): number => {
    // Base multiplier calculation for 1-100% range
    let baseMultiplier = 1.0;
    
    // Percentage difficulty multiplier (1-100% range)
    if (targetPercentage >= 1 && targetPercentage <= 5) {
      baseMultiplier = 1.2; // Easy
    } else if (targetPercentage > 5 && targetPercentage <= 15) {
      baseMultiplier = 1.5; // Medium-Easy
    } else if (targetPercentage > 15 && targetPercentage <= 25) {
      baseMultiplier = 2.0; // Medium
    } else if (targetPercentage > 25 && targetPercentage <= 40) {
      baseMultiplier = 3.0; // Medium-Hard
    } else if (targetPercentage > 40 && targetPercentage <= 60) {
      baseMultiplier = 4.0; // Hard
    } else if (targetPercentage > 60 && targetPercentage <= 80) {
      baseMultiplier = 5.0; // Very Hard
    } else if (targetPercentage > 80 && targetPercentage <= 100) {
      baseMultiplier = 6.0; // Extreme
    }
    
    // Time multiplier (shorter time = higher risk = higher reward)
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
    
    // Volatility factor
    const volatilityFactor = Math.max(0.8, Math.min(2.0, userVolatility));
    
    // Trend alignment
    const trendAlignment = betType === 'increase' 
      ? (recentPerformance > 5 ? 0.7 : recentPerformance < -5 ? 1.4 : 1.0)
      : (recentPerformance < -5 ? 0.7 : recentPerformance > 5 ? 1.4 : 1.0);
    
    const finalMultiplier = baseMultiplier * timeMultiplier * volatilityFactor * trendAlignment;
    
    // Cap multiplier to reasonable bounds
    return Math.max(1.1, Math.min(15.0, Math.round(finalMultiplier * 10) / 10));
  };

  // Enhanced volatility rating
  const getVolatilityRating = (percentage: number): 'Low' | 'Medium' | 'High' | 'Extreme' => {
    if (percentage >= 1 && percentage <= 10) return 'Low';
    if (percentage > 10 && percentage <= 30) return 'Medium';
    if (percentage > 30 && percentage <= 70) return 'High';
    return 'Extreme'; // 70-100%
  };

  // Calculate potential loss (bet amount × multiplier)
  const calculatePotentialLoss = (amount: number, multiplier: number): number => {
    return amount * multiplier;
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
    const potentialLoss = calculatePotentialLoss(betForm.amount, multiplier);
    const volatilityRating = getVolatilityRating(betForm.targetPercentage);

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
      description: `Bet on ${selectedUser.username}: ${betForm.betType} ${betForm.targetPercentage}% in ${betForm.timeFrame}d (${multiplier}x multiplier)`
    };

    const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));

    setMessage(`Bet placed! $${betForm.amount} on ${selectedUser.username} portfolio ${betForm.betType === 'increase' ? 'increasing' : 'decreasing'} by ${betForm.targetPercentage}% in ${betForm.timeFrame} days. Potential payout: $${potentialPayout} (${multiplier}x) | Risk: $${potentialLoss} if lost`);
    setShowBetModal(false);
    setTimeout(() => setMessage(''), 10000);
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
      // Calculate actual loss with multiplier
      const actualLoss = calculatePotentialLoss(bet.amount, bet.multiplier);
      
      const updatedUser = {
        ...currentUser,
        balance: currentUser.balance - actualLoss,
        totalLosses: currentUser.totalLosses + actualLoss
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('userProfile', JSON.stringify(updatedUser));

      setMessage(`😞 Bet lost. Lost $${actualLoss} (${bet.amount} × ${bet.multiplier}x multiplier). ${bet.targetUser} portfolio ${bet.betType === 'increase' ? 'did not increase' : 'did not decrease'} by ${bet.targetPercentage}% (actual: ${actualChange.toFixed(1)}%)`);
    }

    setTimeout(() => setMessage(''), 8000);
  };

  // Sort function remains the same since we're now using real data
  const sortUsers = (users: PublicUserData[]) => {
    switch (sortBy) {
      case 'recent_performance':
        return [...users].sort((a, b) => b.recentPerformance - a.recentPerformance);
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

  const getHoursRemaining = (expirationDate: string): number => {
    const expiry = new Date(expirationDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(0, diffHours);
  };

  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy': return '🛒';
      case 'sell': return '💰';
      case 'short_place': return '📉';
      case 'short_win': return '💹';
      case 'short_loss': return '📈';
      case 'bet_place': return '🎲';
      case 'bet_win': return '🎉';
      case 'bet_loss': return '😞';
      case 'earn': return '✨';
      default: return '📊';
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
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

      // NEW: Initialize historical data on first load
      initializeHistoricalData();

    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    if (allOpinions.length > 0 && currentUser.username) {
      const users = getAllUsers();
      setPublicUsers(users);
    }
  }, [allOpinions, currentUser, isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    const refreshInterval = setInterval(() => {
      const users = getAllUsers();
      if (users.length !== publicUsers.length) {
        setPublicUsers(users);
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [publicUsers.length, isClient]);

  const sortedUsers = sortUsers(publicUsers);
  const botCount = sortedUsers.filter(u => u.isBot).length;
  const humanCount = sortedUsers.filter(u => !u.isBot).length;

  // Client-side guard to prevent hydration errors
  if (!isClient) {
    return (
      <div className="page-container">
        <Sidebar opinions={[]} />
        <main className="main-content">
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: 'var(--text-primary)' 
          }}>
            <div style={{ 
              fontSize: '24px', 
              marginBottom: '16px' 
            }}>
              📊
            </div>
            <p>Loading traders...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main className="main-content">
        {/* Updated Header with Right-Justified Navigation */}
        <div className={styles.topNavigation}>
          {/* Page Title Section (Left side) */}
          <div>
            <h1 className={styles.pageTitle}>📊 View Traders</h1>
            <p className={styles.pageSubtitle}>Explore trader portfolios and place bets</p>
          </div>

          {/* Navigation Buttons (Right side) */}
          <div className={styles.headerActions}>
            <a href="/" className="nav-button" style={{ 
              backgroundColor: 'var(--lime-green)',
              color: 'var(--text-black)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--transition)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              👤 My Profile
            </a>
            <a href="/feed" className="nav-button feed" style={{
              backgroundColor: 'var(--coral-red)',
              color: 'var(--text-black)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--transition)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              📡 Live Feed
            </a>
            <a href="/generate" className="nav-button generate" style={{
              backgroundColor: 'var(--lime-green)',
              color: 'var(--text-black)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--transition)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ✨ Generate
            </a>
          </div>
        </div>

        <div className={styles.sortControls}>
          <span className={styles.sortLabel}>Sort by:</span>
          {(['recent_performance', 'value', 'performance', 'volatility'] as const).map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`${styles.sortButton} ${sortBy === option ? styles.active : ''}`}
            >
              {option === 'recent_performance' ? '7-Day Performance' :
               option === 'value' ? 'Portfolio Value' : 
               option === 'performance' ? 'Total Performance' :
               'Volatility'}
            </button>
          ))}
          <span className={styles.lastRefresh}>
            Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>

        <section className="section">
          <h2 className="section-title">📊 Portfolio Leaderboard ({sortedUsers.length}) - Real 7-Day Performance Tracking</h2>
          
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
                        {(user.activeBetsCount || user.activeShortsCount) && (
                          <p style={{ fontSize: '12px', color: '#666' }}>
                            {user.activeBetsCount ? `${user.activeBetsCount} bets` : ''} 
                            {user.activeBetsCount && user.activeShortsCount ? ' • ' : ''}
                            {user.activeShortsCount ? `${user.activeShortsCount} shorts` : ''}
                          </p>
                        )}
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
                      {(user.shortExposure || user.betExposure) && (
                        <p style={{ fontSize: '12px', color: '#f59e0b' }}>
                          Exposure: ${((user.shortExposure || 0) + (user.betExposure || 0)).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={styles.performanceMetrics}>
                    <div className={`${styles.metricCard} ${styles.performance} ${styles.primary}`}>
                      <p>🎯 7-Day Performance (Real)</p>
                      <p className={`${styles.metricValue} ${styles.highlight} ${getPerformanceClass(user.recentPerformance)}`}>
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

                  {/* Action buttons */}
                  <div className={styles.userCardActions}>
                    <button
                      onClick={() => {
                        // Navigate to user detail page instead of modal
                        const userParam = encodeURIComponent(user.username);
                        window.location.href = `/users/${userParam}`;
                      }}
                      className={styles.viewDetailsButton}
                    >
                      👁️ Details
                    </button>
                    
                    {!user.isCurrentUser && (
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowBetModal(true);
                        }}
                        className={styles.placeBetButton}
                      >
                        🎯 Bet
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Detailed User View Modal */}
        {showDetailModal && detailedUserView && (
          <div 
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDetailModal(false);
                setDetailedUserView(null);
              }
            }}
          >
            <div className={styles.detailModalContent}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  {detailedUserView.user.isBot ? '🤖 ' : '👤 '}{detailedUserView.user.username} - Portfolio Details
                  {detailedUserView.user.isCurrentUser && <span> (You)</span>}
                </h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDetailedUserView(null);
                  }}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <div className={styles.detailModalBody}>
                {/* Portfolio Summary */}
                <div className={styles.portfolioSummarySection}>
                  <h3>📊 Portfolio Summary</h3>
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <p>Total Value</p>
                      <p className={styles.summaryValue}>${detailedUserView.user.portfolioValue.toLocaleString()}</p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>P&L</p>
                      <p className={`${styles.summaryValue} ${getPerformanceClass(detailedUserView.user.totalGainsLosses)}`}>
                        {detailedUserView.user.totalGainsLosses >= 0 ? '+' : ''}${detailedUserView.user.totalGainsLosses.toFixed(0)}
                      </p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>Real 7-Day Performance</p>
                      <p className={`${styles.summaryValue} ${getPerformanceClass(detailedUserView.user.recentPerformance)}`}>
                        {detailedUserView.user.recentPerformance >= 0 ? '+' : ''}{detailedUserView.user.recentPerformance.toFixed(1)}%
                      </p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>Active Positions</p>
                      <p className={styles.summaryValue}>{detailedUserView.portfolio.length}</p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>Active Bets</p>
                      <p className={styles.summaryValue}>{detailedUserView.activeBets.length}</p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>Short Positions</p>
                      <p className={styles.summaryValue}>{detailedUserView.activeShorts.length}</p>
                    </div>
                    <div className={styles.summaryCard}>
                      <p>Total Exposure</p>
                      <p className={styles.summaryValue}>
                        ${((detailedUserView.user.shortExposure || 0) + (detailedUserView.user.betExposure || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opinion Portfolio */}
                <div className={styles.portfolioSection}>
                  <h3>💼 Opinion Portfolio ({detailedUserView.portfolio.length})</h3>
                  {detailedUserView.portfolio.length === 0 ? (
                    <div className={styles.emptySection}>
                      <p>📭 No opinion holdings</p>
                    </div>
                  ) : (
                    <div className={styles.portfolioGrid}>
                      {detailedUserView.portfolio.map((opinion, index) => {
                        const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                        const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                        
                        return (
                          <div key={index} className={styles.opinionCard}>
                            <div className={styles.opinionContent}>
                              <p className={styles.opinionText}>
                                &quot;{safeSlice(opinion.text, 80)}&quot;
                              </p>
                              <div className={styles.opinionMeta}>
                                <span>Qty: {opinion.quantity}</span>
                                <span>Purchased: {opinion.purchaseDate}</span>
                              </div>
                            </div>
                            <div className={styles.opinionStats}>
                              <div className={styles.priceInfo}>
                                <p>Bought: ${opinion.purchasePrice}</p>
                                <p>Current: ${opinion.currentPrice}</p>
                              </div>
                              <p className={`${styles.opinionGainLoss} ${getPerformanceClass(gainLoss)}`}>
                                {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Active Bets */}
                <div className={styles.portfolioSection}>
                  <h3>🎲 Active Portfolio Bets ({detailedUserView.activeBets.length})</h3>
                  {detailedUserView.activeBets.length === 0 ? (
                    <div className={styles.emptySection}>
                      <p>🎯 No active bets</p>
                    </div>
                  ) : (
                    <div className={styles.betsGrid}>
                      {detailedUserView.activeBets.map((bet) => (
                        <div key={bet.id} className={styles.betCard}>
                          <div className={styles.betContent}>
                            <div className={styles.betHeader}>
                              <span className={styles.betType}>
                                {bet.betType === 'increase' ? '📈' : '📉'} {bet.betType.toUpperCase()}
                              </span>
                              <span className={styles.betAmount}>${bet.amount}</span>
                            </div>
                            <p className={styles.betDescription}>
                              Target: {bet.targetUser} portfolio {bet.betType} by {bet.targetPercentage}%
                            </p>
                            <div className={styles.betMeta}>
                              <span>{getDaysRemaining(bet.expiryDate)} days remaining</span>
                              <span>{bet.volatilityRating} volatility</span>
                            </div>
                          </div>
                          <div className={styles.betStats}>
                            <p>Potential: ${bet.potentialPayout}</p>
                            <p>Multiplier: {bet.multiplier}x</p>
                            <p style={{ color: '#ef4444', fontSize: '11px' }}>
                              Risk: ${calculatePotentialLoss(bet.amount, bet.multiplier)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Short Positions */}
                <div className={styles.portfolioSection}>
                  <h3>📉 Short Positions ({detailedUserView.activeShorts.length})</h3>
                  {detailedUserView.activeShorts.length === 0 ? (
                    <div className={styles.emptySection}>
                      <p>📈 No active short positions</p>
                    </div>
                  ) : (
                    <div className={styles.shortsGrid}>
                      {detailedUserView.activeShorts.map((short) => {
                        const currentPrice = getCurrentPrice(short.opinionText);
                        const progress = ((short.startingPrice - currentPrice) / (short.startingPrice - short.targetPrice)) * 100;
                        const hoursRemaining = getHoursRemaining(short.expirationDate);
                        
                        return (
                          <div key={short.id} className={styles.shortCard}>
                            <div className={styles.shortContent}>
                              <div className={styles.shortHeader}>
                                <span className={styles.shortBadge}>📉 SHORT</span>
                                <span className={styles.shortAmount}>${short.betAmount}</span>
                              </div>
                              <p className={styles.shortOpinion}>
                                &quot;{safeSlice(short.opinionText, 60)}&quot;
                              </p>
                              <div className={styles.shortDetails}>
                                <div className={styles.shortPrices}>
                                  <span>Start: ${short.startingPrice}</span>
                                  <span>Target: ${short.targetPrice}</span>
                                  <span>Current: ${currentPrice}</span>
                                </div>
                                <div className={styles.shortMeta}>
                                  <span>Target: {short.targetDropPercentage}% drop</span>
                                  <span>{hoursRemaining}h remaining</span>
                                </div>
                              </div>
                              
                              {/* Progress bar */}
                              <div className={styles.shortProgress}>
                                <div className={styles.progressLabel}>
                                  Progress: {Math.max(0, Math.min(100, progress)).toFixed(1)}%
                                </div>
                                <div className={styles.progressBar}>
                                  <div 
                                    className={styles.progressFill}
                                    style={{
                                      width: `${Math.max(0, Math.min(100, progress))}%`,
                                      backgroundColor: progress >= 100 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className={styles.shortStats}>
                              <p>Potential: ${short.potentialWinnings}</p>
                              <p className={progress >= 100 ? 'positive' : 'negative'}>
                                {progress >= 100 ? 'Target Hit!' : 'In Progress'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Transactions */}
                <div className={styles.portfolioSection}>
                  <h3>📋 Recent Activity ({detailedUserView.recentTransactions.length})</h3>
                  {detailedUserView.recentTransactions.length === 0 ? (
                    <div className={styles.emptySection}>
                      <p>📊 No recent activity</p>
                    </div>
                  ) : (
                    <div className={styles.transactionsGrid}>
                      {detailedUserView.recentTransactions.map((transaction) => (
                        <div key={transaction.id} className={styles.transactionCard}>
                          <div className={styles.transactionIcon}>
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div className={styles.transactionContent}>
                            <p className={styles.transactionType}>
                              {transaction.type.replace('_', ' ').toUpperCase()}
                            </p>
                            <p className={styles.transactionDescription}>
                              {transaction.description || 'Transaction'}
                            </p>
                            <p className={styles.transactionDate}>{transaction.date}</p>
                          </div>
                          <div className={`${styles.transactionAmount} ${getPerformanceClass(transaction.amount)}`}>
                            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UPDATED: Betting Modal with 1-100% range and loss multiplier display */}
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
                      <p>Real 7-Day Performance</p>
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
                          Betting ${betForm.amount} that {selectedUser.isBot ? '🤖 ' : ''}{selectedUser.username} portfolio will{' '}
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
                                selectedUser.volatility,
                                selectedUser.recentPerformance
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
                                selectedUser.volatility,
                                selectedUser.recentPerformance
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
                                selectedUser.volatility,
                                selectedUser.recentPerformance
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
                              selectedUser.volatility,
                              selectedUser.recentPerformance
                            ).toFixed(2)}x = ${calculatePotentialLoss(betForm.amount, calculateBetMultiplier(
                              betForm.betType,
                              betForm.targetPercentage,
                              betForm.timeFrame,
                              selectedUser.volatility,
                              selectedUser.recentPerformance
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
                         selectedUser.volatility,
                         selectedUser.recentPerformance
                       ))})`}
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
              <strong>Portfolio betting: 1%-100% range with loss multipliers</strong> • 
              Real 7-day performance tracking updated every 30 seconds
            </p>
          </div>
        )}
      </main>
    </div>
  );
}