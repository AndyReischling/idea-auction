'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';
import { ScanSmiley } from '@phosphor-icons/react/dist/icons/ScanSmiley';
import { Balloon } from '@phosphor-icons/react/dist/icons/Balloon';
import { Rss, WalletIcon } from '@phosphor-icons/react/dist/ssr';
import { Wallet } from '@phosphor-icons/react';
import { Money } from '@phosphor-icons/react';
import { CurrencyDollar } from '@phosphor-icons/react';
import { Plus } from '@phosphor-icons/react';
import { HandPeace } from '@phosphor-icons/react';
import { DiceSix } from '@phosphor-icons/react';
import { ChartLineDown } from '@phosphor-icons/react';

interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'bet_place' | 'bet_win' | 'bet_loss' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
  username: string;
  opinionText?: string;
  opinionId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  shortDetails?: {
    targetDropPercentage: number;
    startingPrice: number;
    targetPrice: number;
    potentialWinnings: number;
    timeLimit: number;
  };
  timestamp: string;
  relativeTime: string;
  isBot?: boolean;
}

interface UserProfile {
  username: string;
  balance: number;
}

interface TransactionDetail {
  id: string;
  type: string;
  username: string;
  opinionText?: string;
  opinionId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  shortDetails?: {
    targetDropPercentage: number;
    startingPrice: number;
    targetPrice: number;
    potentialWinnings: number;
    timeLimit: number;
  };
  timestamp: string;
  isBot?: boolean;
  fullDescription: string;
  additionalDetails?: {
    multiplier?: number;
    potentialPayout?: number;
    volatilityRating?: string;
    expiryDate?: string;
    betStatus?: string;
    shortProgress?: number;
  };
}

// Enhanced interfaces for betting functionality
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

interface BetForm {
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number;
}

// NEW: Enhanced Activity Detail Modal Component with Full Trading and Betting Functionality
interface ActivityDetailModalProps {
  activity: ActivityFeedItem;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({ activity, onClose, currentUser, onUpdateUser }) => {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(10.00);
  const [message, setMessage] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // Short settings state
  const [shortSettings, setShortSettings] = useState({
    betAmount: 100,
    targetDropPercentage: 25,
    timeLimit: 24
  });

  // Portfolio betting state
  const [showBettingInterface, setShowBettingInterface] = useState(false);
  const [betForm, setBetForm] = useState<BetForm>({
    betType: 'increase',
    targetPercentage: 10,
    amount: 100,
    timeFrame: 7
  });
  const [targetUserData, setTargetUserData] = useState<any>(null);

  // Market data state
  const [marketData, setMarketData] = useState({
    timesPurchased: 0,
    timesSold: 0,
    currentPrice: 10.00,
    basePrice: 10.00
  });

  // Ownership state  
  const [ownedQuantity, setOwnedQuantity] = useState(0);
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [hasActiveShort, setHasActiveShort] = useState(false);

  // Portfolio betting functions
  const calculateBetMultiplier = (
    betType: 'increase' | 'decrease',
    targetPercentage: number,
    timeFrame: number,
    userVolatility: number = 15,
    recentPerformance: number = 0
  ): number => {
    let baseMultiplier = 1.0;
    
    // Percentage difficulty multiplier (1-100% range)
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
    
    // Time multiplier
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
    
    const volatilityFactor = Math.max(0.8, Math.min(2.0, userVolatility / 10));
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

  const getDifficultyLabel = (percentage: number): string => {
    if (percentage >= 1 && percentage <= 5) return 'Very Easy';
    if (percentage > 5 && percentage <= 15) return 'Easy';
    if (percentage > 15 && percentage <= 25) return 'Medium';
    if (percentage > 25 && percentage <= 40) return 'Hard';
    if (percentage > 40 && percentage <= 60) return 'Very Hard';
    if (percentage > 60 && percentage <= 80) return 'Extreme';
    return 'Nearly Impossible';
  };

  // Load target user data for betting
  const loadTargetUserData = (username: string) => {
    // Simulate user data - in real app, this would fetch from API/storage
    const mockUserData = {
      username: username,
      portfolioValue: Math.floor(Math.random() * 100000) + 10000,
      volatility: Math.floor(Math.random() * 30) + 5,
      recentPerformance: (Math.random() - 0.5) * 20,
      isCurrentUser: username === currentUser.username,
      isBot: activity.isBot || false
    };
    setTargetUserData(mockUserData);
  };

  // Handle portfolio bet placement
  const handlePlaceBet = () => {
    if (!targetUserData || !isClient) return;

    if (targetUserData.isCurrentUser) {
      setMessage('⚠️ You cannot bet on your own portfolio!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (betForm.amount <= 0 || betForm.amount > currentUser.balance) {
      setMessage('💰 Invalid bet amount or insufficient funds!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const multiplier = calculateBetMultiplier(
      betForm.betType,
      betForm.targetPercentage,
      betForm.timeFrame,
      targetUserData.volatility,
      targetUserData.recentPerformance
    );

    const potentialPayout = Math.round(betForm.amount * multiplier);
    const volatilityRating = getVolatilityRating(betForm.targetPercentage);

    const newBet: AdvancedBet = {
      id: Date.now().toString(),
      bettor: currentUser.username,
      targetUser: targetUserData.username,
      betType: betForm.betType,
      targetPercentage: betForm.targetPercentage,
      amount: betForm.amount,
      timeFrame: betForm.timeFrame,
      initialPortfolioValue: targetUserData.portfolioValue,
      currentPortfolioValue: targetUserData.portfolioValue,
      placedDate: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + betForm.timeFrame * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: 'active',
      multiplier,
      potentialPayout,
      volatilityRating
    };

    // Update user balance
    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - betForm.amount
    };
    onUpdateUser(updatedUser);
    safeSetToStorage('userProfile', updatedUser);

    // Save bet
    const existingBets = safeGetFromStorage('advancedBets', []);
    const updatedBets = [...existingBets, newBet];
    safeSetToStorage('advancedBets', updatedBets);

    // Add transaction
    const transactions = safeGetFromStorage('transactions', []);
    const newTransaction = {
      id: Date.now().toString(),
      type: 'bet_place',
      amount: -betForm.amount,
      date: new Date().toLocaleDateString(),
      description: `Bet on ${targetUserData.username}: ${betForm.betType} ${betForm.targetPercentage}% in ${betForm.timeFrame}d (${multiplier}x multiplier)`
    };
    
    transactions.unshift(newTransaction);
    safeSetToStorage('transactions', transactions.slice(0, 50));

    // Call global feed tracking
    if (typeof window !== 'undefined' && (window as any).addToGlobalFeed) {
      (window as any).addToGlobalFeed({
        type: 'bet_place',
        username: currentUser.username,
        targetUser: targetUserData.username,
        betType: betForm.betType,
        targetPercentage: betForm.targetPercentage,
        timeframe: betForm.timeFrame,
        amount: -betForm.amount,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }

    setMessage(`✅ Bet placed! $${betForm.amount} on ${targetUserData.username} portfolio ${betForm.betType === 'increase' ? 'increasing' : 'decreasing'} by ${betForm.targetPercentage}% in ${betForm.timeFrame} days. Potential payout: $${potentialPayout} (${multiplier}x)`);
    setShowBettingInterface(false);
    setTimeout(() => setMessage(''), 5000);
  };

  // Initialize betting data when modal opens
  useEffect(() => {
    if (!isClient || !activity.username) return;
    
    // Load target user data for betting if it's a different user
    if (activity.username !== currentUser.username) {
      loadTargetUserData(activity.username);
    }
  }, [isClient, activity.username, currentUser.username]);

  // Safe localStorage helpers
  const safeGetFromStorage = (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  };

  const safeSetToStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  };

  // Price calculation matching sidebar logic
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    let priceMultiplier;
    
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Get current market data for opinion
  const getOpinionMarketData = (opinionText: string) => {
    if (!isClient) return { timesPurchased: 0, timesSold: 0, currentPrice: 10.00, basePrice: 10.00 };
    
    const existingData = safeGetFromStorage('opinionMarketData', {});
    
    if (existingData[opinionText]) {
      return existingData[opinionText];
    }
    
    return { timesPurchased: 0, timesSold: 0, currentPrice: 10.00, basePrice: 10.00 };
  };

  // Update market data with new transaction
  const updateOpinionMarketData = (opinionText: string, action: 'buy' | 'sell') => {
    const existingData = safeGetFromStorage('opinionMarketData', {});
    
    if (!existingData[opinionText]) {
      existingData[opinionText] = { timesPurchased: 0, timesSold: 0, currentPrice: 10.00, basePrice: 10.00 };
    }
    
    if (action === 'buy') {
      existingData[opinionText].timesPurchased += 1;
    } else {
      existingData[opinionText].timesSold += 1;
    }
    
    existingData[opinionText].currentPrice = calculatePrice(
      existingData[opinionText].timesPurchased,
      existingData[opinionText].timesSold,
      existingData[opinionText].basePrice
    );
    
    safeSetToStorage('opinionMarketData', existingData);
    return existingData[opinionText];
  };

  // Calculate sell price (95% of current price)
  const calculateSellPrice = (currentPrice: number): number => {
    return Math.round(currentPrice * 0.95 * 100) / 100;
  };

  // Calculate short winnings
  const calculateShortWinnings = (betAmount: number, targetDropPercentage: number, timeLimit: number): number => {
    const baseMultiplier = Math.max(1.1, 1 + (targetDropPercentage / 100));
    let timeBonus = 1;
    
    if (timeLimit <= 6) timeBonus = 1.5;
    else if (timeLimit <= 12) timeBonus = 1.3;
    else if (timeLimit <= 24) timeBonus = 1.1;
    
    let riskMultiplier = 1;
    if (targetDropPercentage >= 80) riskMultiplier = 10;
    else if (targetDropPercentage >= 50) riskMultiplier = 5;
    else if (targetDropPercentage >= 30) riskMultiplier = 3;
    else if (targetDropPercentage >= 20) riskMultiplier = 2;
    
    const totalMultiplier = baseMultiplier * timeBonus * riskMultiplier;
    return Math.round(betAmount * totalMultiplier * 100) / 100;
  };

  // Load market data and ownership status
  useEffect(() => {
    if (!isClient || !activity.opinionText) return;

    const data = getOpinionMarketData(activity.opinionText);
    setMarketData(data);
    setCurrentPrice(data.currentPrice);

    // Check ownership
    const ownedOpinions = safeGetFromStorage('ownedOpinions', []);
    const owned = ownedOpinions.find((op: any) => op.text === activity.opinionText);
    if (owned) {
      setOwnedQuantity(owned.quantity || 0);
      setAlreadyOwned(true);
    }

    // Check for active short position
    const shortPositions = safeGetFromStorage('shortPositions', []);
    const activeShort = shortPositions.find((short: any) => 
      short.opinionText === activity.opinionText && short.status === 'active'
    );
    setHasActiveShort(!!activeShort);
  }, [isClient, activity.opinionText]);

  // Rapid trading restriction function with enhanced date handling
  const getRapidTradeCount = (opinionText: string, timeframeMinutes: number): number => {
    if (!isClient) return 0;
    
    const transactions = safeGetFromStorage('transactions', []);
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - timeframeMinutes);
    
    const recentTrades = transactions.filter((t: any) => {
      if (t.type !== 'buy') return false;
      if (!t.opinionText) return false;
      
      const transactionOpinion = t.opinionText.replace('...', '');
      const targetOpinion = opinionText.slice(0, 47);
      
      const opinionMatches = transactionOpinion.includes(targetOpinion.slice(0, 20)) || 
                            targetOpinion.includes(transactionOpinion.slice(0, 20));
      
      if (!opinionMatches) return false;
      
      let transactionDate: Date;
      
      if (t.timestamp) {
        transactionDate = new Date(t.timestamp);
      } else if (t.date) {
        transactionDate = new Date(t.date);
      } else {
        return false;
      }
      
      if (isNaN(transactionDate.getTime())) return false;
      
      return transactionDate > cutoffTime;
    });
    
    return recentTrades.length;
  };

  // Enhanced buy handler with better rapid trading enforcement
  const handleBuy = () => {
    if (!activity.opinionText || !isClient) return;

    const rapidTradeCount = getRapidTradeCount(activity.opinionText, 10);
    
    if (rapidTradeCount >= 3) {
      setMessage('⚠️ TRADING LIMIT REACHED! You can only make 3 purchases per 10 minutes for each opinion. Please wait before purchasing again.');
      setTimeout(() => setMessage(''), 7000);
      return;
    }

    const totalCost = currentPrice * quantity;
    if (currentUser.balance < totalCost) {
      setMessage('💰 Insufficient funds!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Update user balance
    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - totalCost
    };
    onUpdateUser(updatedUser);
    safeSetToStorage('userProfile', updatedUser);

    // Update market data
    const updatedMarketData = updateOpinionMarketData(activity.opinionText, 'buy');
    setMarketData(updatedMarketData);
    setCurrentPrice(updatedMarketData.currentPrice);

    // Add to owned opinions
    const ownedOpinions = safeGetFromStorage('ownedOpinions', []);
    const existingOpinion = ownedOpinions.find((op: any) => op.text === activity.opinionText);
    
    if (existingOpinion) {
      existingOpinion.quantity += quantity;
      existingOpinion.currentPrice = updatedMarketData.currentPrice;
    } else {
      ownedOpinions.push({
        id: activity.opinionId || Date.now().toString(),
        text: activity.opinionText,
        purchasePrice: currentPrice,
        currentPrice: updatedMarketData.currentPrice,
        purchaseDate: new Date().toLocaleDateString(),
        quantity: quantity
      });
    }
    safeSetToStorage('ownedOpinions', ownedOpinions);

    // Update local state
    setOwnedQuantity(ownedQuantity + quantity);
    setAlreadyOwned(true);

    // Add transaction with PRECISE timestamp for rapid trading tracking
    const transactions = safeGetFromStorage('transactions', []);
    const newTransaction = {
      id: Date.now().toString(),
      type: 'buy',
      opinionId: activity.opinionId,
      opinionText: activity.opinionText.length > 47 ? activity.opinionText.slice(0, 47) + '...' : activity.opinionText,
      amount: -totalCost,
      price: currentPrice,
      quantity: quantity,
      date: new Date().toLocaleDateString(),
      timestamp: new Date().toISOString()
    };
    
    transactions.unshift(newTransaction);
    safeSetToStorage('transactions', transactions.slice(0, 50));

    // Call global feed tracking
    if (typeof window !== 'undefined' && (window as any).addToGlobalFeed) {
      (window as any).addToGlobalFeed({
        type: 'buy',
        username: currentUser.username,
        opinionText: activity.opinionText,
        opinionId: activity.opinionId,
        amount: -totalCost,
        price: currentPrice,
        quantity: quantity,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }

    setMessage(`✅ Bought ${quantity} shares for ${totalCost.toFixed(2)}! (${getRapidTradeCount(activity.opinionText, 10) + 1}/3 trades in 10min)`);
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle sell opinion
  const handleSell = () => {
    if (!activity.opinionText || !alreadyOwned || ownedQuantity === 0 || !isClient) return;

    // Check for active short position penalty
    const shortPositions = safeGetFromStorage('shortPositions', []);
    const activeShort = shortPositions.find((short: any) => 
      short.opinionText === activity.opinionText && short.status === 'active'
    );
    
    if (activeShort) {
      const unitsToBuy = activeShort.targetDropPercentage;
      const costPerUnit = currentPrice;
      const totalPenaltyCost = Math.round(unitsToBuy * costPerUnit * 100) / 100;
      
      const updatedUser = {
        ...currentUser,
        balance: currentUser.balance - totalPenaltyCost
      };
      onUpdateUser(updatedUser);
      safeSetToStorage('userProfile', updatedUser);
      
      // Mark short as lost
      const updatedShorts = shortPositions.map((short: any) => 
        short.id === activeShort.id ? { ...short, status: 'lost' } : short
      );
      safeSetToStorage('shortPositions', updatedShorts);
      setHasActiveShort(false);
      
      setMessage(`⚠️ Short position cancelled! Penalty: ${totalPenaltyCost.toFixed(2)}`);
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    const actualSellPrice = calculateSellPrice(currentPrice);
    const totalReceived = actualSellPrice;

    // Update user balance
    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance + totalReceived
    };
    onUpdateUser(updatedUser);
    safeSetToStorage('userProfile', updatedUser);

    // Update market data
    const updatedMarketData = updateOpinionMarketData(activity.opinionText, 'sell');
    setMarketData(updatedMarketData);
    setCurrentPrice(updatedMarketData.currentPrice);

    // Update owned opinions
    const ownedOpinions = safeGetFromStorage('ownedOpinions', []);
    const updatedOwnedOpinions = ownedOpinions.map((asset: any) => {
      if (asset.text === activity.opinionText) {
        const newQuantity = asset.quantity - 1;
        return {
          ...asset,
          quantity: newQuantity,
          currentPrice: updatedMarketData.currentPrice
        };
      }
      return asset;
    }).filter((asset: any) => asset.quantity > 0);

    safeSetToStorage('ownedOpinions', updatedOwnedOpinions);

    // Update local state
    const newQuantity = ownedQuantity - 1;
    setOwnedQuantity(newQuantity);
    if (newQuantity === 0) {
      setAlreadyOwned(false);
    }

    // Add transaction
    const transactions = safeGetFromStorage('transactions', []);
    transactions.unshift({
      id: Date.now().toString(),
      type: 'sell',
      opinionId: activity.opinionId,
      opinionText: activity.opinionText,
      amount: totalReceived,
      price: actualSellPrice,
      quantity: 1,
      date: new Date().toLocaleDateString()
    });
    safeSetToStorage('transactions', transactions.slice(0, 50));

    // Call global feed tracking
    if (typeof window !== 'undefined' && (window as any).addToGlobalFeed) {
      (window as any).addToGlobalFeed({
        type: 'sell',
        username: currentUser.username,
        opinionText: activity.opinionText,
        opinionId: activity.opinionId,
        amount: totalReceived,
        price: actualSellPrice,
        quantity: 1,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }

    setMessage(`💰 Sold 1 share for ${totalReceived.toFixed(2)}!`);
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle short position
  const handleShort = () => {
    if (!activity.opinionText || !isClient) return;

    if (currentUser.balance < shortSettings.betAmount) {
      setMessage('💰 Insufficient funds for short bet!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (hasActiveShort) {
      setMessage('⚠️ You already have an active short position on this opinion!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (ownedQuantity > 0) {
      setMessage('⚠️ Cannot short opinions you own. Sell your position first.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const targetPrice = Math.round((currentPrice * (1 - shortSettings.targetDropPercentage / 100)) * 100) / 100;
    const potentialWinnings = calculateShortWinnings(
      shortSettings.betAmount,
      shortSettings.targetDropPercentage,
      shortSettings.timeLimit
    );

    // Update user balance
    const updatedUser = {
      ...currentUser,
      balance: currentUser.balance - shortSettings.betAmount
    };
    onUpdateUser(updatedUser);
    safeSetToStorage('userProfile', updatedUser);

    // Create short position
    const shortPositions = safeGetFromStorage('shortPositions', []);
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + shortSettings.timeLimit);

    const newShort = {
      id: Date.now().toString(),
      opinionText: activity.opinionText,
      opinionId: activity.opinionId || Date.now().toString(),
      betAmount: shortSettings.betAmount,
      targetDropPercentage: shortSettings.targetDropPercentage,
      startingPrice: currentPrice,
      targetPrice,
      potentialWinnings,
      expirationDate: expirationTime.toISOString(),
      createdDate: new Date().toISOString(),
      status: 'active'
    };

    shortPositions.push(newShort);
    safeSetToStorage('shortPositions', shortPositions);
    setHasActiveShort(true);

    // Add transaction
    const transactions = safeGetFromStorage('transactions', []);
    transactions.unshift({
      id: Date.now().toString(),
      type: 'short_place',
      opinionText: activity.opinionText,
      amount: -shortSettings.betAmount,
      date: new Date().toLocaleDateString()
    });
    safeSetToStorage('transactions', transactions.slice(0, 50));

    // Call global feed tracking
    if (typeof window !== 'undefined' && (window as any).addToGlobalFeed) {
      (window as any).addToGlobalFeed({
        type: 'short_place',
        username: currentUser.username,
        opinionText: activity.opinionText,
        opinionId: activity.opinionId,
        amount: -shortSettings.betAmount,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }

    setMessage(`📉 Short position placed! Target: ${shortSettings.targetDropPercentage}% drop`);
    setTimeout(() => setMessage(''), 3000);
  };

  // Get activity description
  const getActivityDescription = () => {
    const { type, username, opinionText, targetUser, betType, targetPercentage, isBot } = activity;
    const userPrefix = isBot ? '🤖 Bot' : '👤 User';
    
    switch (type) {
      case 'buy':
        return `${userPrefix} ${username} bought ${activity.quantity || 1} shares of "${opinionText}"`;
      case 'sell':
        return `${userPrefix} ${username} sold ${activity.quantity || 1} shares of "${opinionText}"`;
      case 'generate':
      case 'earn':
        return `${userPrefix} ${username} generated opinion: "${opinionText}"`;
      case 'short_place':
        return `${userPrefix} ${username} placed a short bet on "${opinionText}"`;
      case 'short_win':
        return `${userPrefix} ${username} won a short bet on "${opinionText}"`;
      case 'short_loss':
        return `${userPrefix} ${username} lost a short bet on "${opinionText}"`;
      case 'bet_place':
        return `${userPrefix} ${username} bet that ${targetUser}'s portfolio will ${betType} by ${targetPercentage}%`;
      case 'bet_win':
        return `${userPrefix} ${username} won a portfolio bet on ${targetUser}`;
      case 'bet_loss':
        return `${userPrefix} ${username} lost a portfolio bet on ${targetUser}`;
      default:
        return `${userPrefix} ${username} performed ${type}`;
    }
  };

  // Check if activity is idea-related (shows trading interface)
  const isIdeaRelated = () => {
    return ['buy', 'sell', 'generate', 'earn', 'short_place', 'short_win', 'short_loss'].includes(activity.type);
  };

  // Check if activity is portfolio bet related (shows target user link)
  const isPortfolioBet = () => {
    return ['bet_place', 'bet_win', 'bet_loss'].includes(activity.type);
  };

  // Handle navigation to target user profile
  const handleViewTargetProfile = () => {
    if (activity.targetUser) {
      router.push(`/users/${activity.targetUser}`);
      onClose();
    }
  };

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="modal-content"
        style={{
          width: '500px',
          height: '500px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header with close button - Fixed at top */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid var(--border-primary)',
          paddingBottom: '15px',
          flexShrink: 0
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}>
            📊 Activity Details
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '5px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '5px'
        }}>
          {/* Enhanced Activity Description with Clickable Username */}
          <div style={{
            padding: '15px',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--border-primary)',
            marginBottom: '20px'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              fontSize: '14px', 
              lineHeight: '1.4',
              color: 'var(--text-primary)'
            }}>
              {getActivityDescription()}
            </p>
            
            {/* User Profile Link Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <span style={{ fontSize: '12px', color: '#4b5563' }}>User:</span>
              <button
                onClick={() => {
                  router.push(`/users/${activity.username}`);
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activity.isBot ? '#10b981' : '#3b82f6',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {activity.isBot ? '🤖' : '👤'} {activity.username}
              </button>
              

            </div>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <span>💰 ${Math.abs(activity.amount).toFixed(2)}</span>
              <span>⏰ {activity.relativeTime}</span>
            </div>
          </div>

          {/* Portfolio Betting Interface */}
          {showBettingInterface && targetUserData && !targetUserData.isCurrentUser && (
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-primary)',
              marginBottom: '20px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ 
                margin: '0 0 15px 0', 
                fontSize: '18px',
                color: '#1f2937',
                fontWeight: '700'
              }}>
                🎯 Bet on {targetUserData.username}'s Portfolio
              </h4>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px',
                marginBottom: '15px'
              }}>
                {/* Bet Type */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151', 
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Bet Type:
                  </label>
                  <select 
                    value={betForm.betType}
                    onChange={(e) => setBetForm({...betForm, betType: e.target.value as 'increase' | 'decrease'})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      color: '#1f2937'
                    }}
                  >
                    <option value="increase">📈 Portfolio Increase</option>
                    <option value="decrease">📉 Portfolio Decrease</option>
                  </select>
                </div>

                {/* Target Percentage */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151', 
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Target % ({getDifficultyLabel(betForm.targetPercentage)}):
                  </label>
                  <input 
                    type="number" 
                    value={betForm.targetPercentage}
                    onChange={(e) => setBetForm({...betForm, targetPercentage: parseFloat(e.target.value) || 1})}
                    min="1"
                    max="100"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      color: '#1f2937'
                    }}
                  />
                </div>

                {/* Bet Amount */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151', 
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Bet Amount ($):
                  </label>
                  <input 
                    type="number" 
                    value={betForm.amount}
                    onChange={(e) => setBetForm({...betForm, amount: parseFloat(e.target.value) || 0})}
                    min="1"
                    max={currentUser.balance}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      color: '#1f2937'
                    }}
                  />
                </div>

                {/* Time Frame */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151', 
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    Time Frame (days):
                  </label>
                  <input 
                    type="number" 
                    value={betForm.timeFrame}
                    onChange={(e) => setBetForm({...betForm, timeFrame: parseFloat(e.target.value) || 1})}
                    min="1"
                    max="365"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      color: '#1f2937'
                    }}
                  />
                </div>
              </div>

              {/* Bet Calculation Display */}
              <div style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                marginBottom: '15px'
              }}>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                  <strong>Bet Summary:</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                  Target: {targetUserData.username}'s portfolio will <strong>{betForm.betType}</strong> by <strong>{betForm.targetPercentage}%</strong> within <strong>{betForm.timeFrame} days</strong><br/>
                  Risk Level: <strong>{getVolatilityRating(betForm.targetPercentage)}</strong> ({getDifficultyLabel(betForm.targetPercentage)})<br/>
                  Multiplier: <strong>{calculateBetMultiplier(betForm.betType, betForm.targetPercentage, betForm.timeFrame, targetUserData.volatility, targetUserData.recentPerformance)}x</strong><br/>
                  Potential Payout: <strong>${Math.round(betForm.amount * calculateBetMultiplier(betForm.betType, betForm.targetPercentage, betForm.timeFrame, targetUserData.volatility, targetUserData.recentPerformance))}</strong>
                </div>
              </div>

              {/* Place Bet Button */}
              <button 
                onClick={handlePlaceBet}
                disabled={betForm.amount <= 0 || betForm.amount > currentUser.balance}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: (betForm.amount <= 0 || betForm.amount > currentUser.balance) ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (betForm.amount <= 0 || betForm.amount > currentUser.balance) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '700',
                  transition: 'all 0.2s ease'
                }}
              >
                {betForm.amount <= 0 ? '⚠️ Enter Bet Amount' :
                 betForm.amount > currentUser.balance ? '💰 Insufficient Funds' :
                 `🎯 Place Bet ($${betForm.amount})`}
              </button>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '15px',
              backgroundColor: message.includes('✅') ? '#f0fdf4' : message.includes('⚠️') ? '#fef3c7' : '#fef2f2',
              border: `1px solid ${message.includes('✅') ? '#bbf7d0' : message.includes('⚠️') ? '#fde68a' : '#fecaca'}`,
              color: message.includes('✅') ? '#166534' : message.includes('⚠️') ? '#92400e' : '#dc2626',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {message}
            </div>
          )}

          {/* Bottom Section - Context Dependent */}
          {isIdeaRelated() && activity.opinionText && (
            <div>
              {/* Price Display */}
              <div style={{
                padding: '15px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-primary)',
                marginBottom: '15px'
              }}>
                <h4 style={{ 
                  margin: '0 0 5px 0', 
                  fontSize: '16px',
                  color: 'var(--text-primary)'
                }}>
                  💹 Current Price: ${currentPrice.toFixed(2)}
                </h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  lineHeight: '1.3'
                }}>
                  "{activity.opinionText.slice(0, 60)}..."
                </p>
                {alreadyOwned && (
                  <p style={{ 
                    margin: '5px 0 0 0', 
                    fontSize: '12px', 
                    color: 'var(--lime-green)',
                    fontWeight: '600'
                  }}>
                    ✅ You own {ownedQuantity} shares • Sell price: ${calculateSellPrice(currentPrice).toFixed(2)}
                  </p>
                )}
              </div>

              {/* Trading Interface */}
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '15px'
              }}>
                {/* Buy Section */}
                <div style={{
                  flex: 1,
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--border-primary)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '16px',
                    color: '#1f2937',
                    fontWeight: '700'
                  }}>
                    🛒 Buy Shares
                  </h5>
                  
                  {/* Rapid Trading Warning */}
                  {(() => {
                    const rapidTradeCount = getRapidTradeCount(activity.opinionText || '', 10);
                    const isAtLimit = rapidTradeCount >= 3;
                    const isNearLimit = rapidTradeCount >= 2;
                    
                    if (rapidTradeCount > 0) {
                      return (
                        <div style={{
                          padding: '8px',
                          backgroundColor: isAtLimit ? '#fef2f2' : isNearLimit ? '#fef3c7' : '#f0f9ff',
                          border: `1px solid ${isAtLimit ? '#fecaca' : isNearLimit ? '#fde68a' : '#bfdbfe'}`,
                          borderRadius: '6px',
                          marginBottom: '10px',
                          fontSize: '12px',
                          color: isAtLimit ? '#dc2626' : isNearLimit ? '#92400e' : '#1d4ed8',
                          fontWeight: '700',
                          textAlign: 'center'
                        }}>
                          {isAtLimit ? 
                            '🚫 TRADING LIMIT REACHED (3/3)' : 
                            `⚡ TRADING WARNING: ${rapidTradeCount}/3 purchases in 10 minutes`
                          }
                          <div style={{ fontSize: '10px', marginTop: '2px', fontWeight: '500' }}>
                            {isAtLimit ? 
                              'Wait 10 minutes from your first purchase to buy more' :
                              `${3 - rapidTradeCount} more purchases allowed in this 10-minute window`
                            }
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>Quantity:</span>
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      style={{
                        width: '30px',
                        height: '30px',
                        border: '2px solid #d1d5db',
                        backgroundColor: quantity <= 1 ? '#f3f4f6' : '#ffffff',
                        cursor: quantity <= 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#374151'
                      }}
                    >
                      -
                    </button>
                    <span style={{ 
                      minWidth: '30px', 
                      textAlign: 'center',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1f2937'
                    }}>
                      {quantity}
                    </span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={currentPrice * (quantity + 1) > currentUser.balance}
                      style={{
                        width: '30px',
                        height: '30px',
                        border: '2px solid #d1d5db',
                        backgroundColor: currentPrice * (quantity + 1) > currentUser.balance ? '#f3f4f6' : '#ffffff',
                        cursor: currentPrice * (quantity + 1) > currentUser.balance ? 'not-allowed' : 'pointer',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#374151'
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#374151',
                    marginBottom: '12px',
                    fontWeight: '600'
                  }}>
                    Total Cost: ${(currentPrice * quantity).toFixed(2)}
                  </div>
                  <button 
                    onClick={handleBuy}
                    disabled={currentPrice * quantity > currentUser.balance || getRapidTradeCount(activity.opinionText || '', 10) >= 3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: (() => {
                        const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                        if (rapidCount >= 3) return '#dc2626';
                        if (currentPrice * quantity > currentUser.balance) return '#9ca3af';
                        return 'var(--lime-green)';
                      })(),
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (currentPrice * quantity > currentUser.balance || getRapidTradeCount(activity.opinionText || '', 10) >= 3) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {(() => {
                      const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                      if (rapidCount >= 3) return '🚫 TRADING LIMIT REACHED';
                      if (currentPrice * quantity > currentUser.balance) return '💰 INSUFFICIENT FUNDS';
                      return `🛒 Buy ${quantity} Share${quantity !== 1 ? 's' : ''} ($${(currentPrice * quantity).toFixed(2)})`;
                    })()}
                  </button>
                  
                  {/* Sell Button */}
                  {alreadyOwned && (
                    <button 
                      onClick={handleSell}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: 'var(--coral-red)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '700',
                        marginTop: '8px'
                      }}
                    >
                      Sell 1 Share (${calculateSellPrice(currentPrice).toFixed(2)})
                    </button>
                  )}
                </div>

                {/* Short Section */}
                <div style={{
                  flex: 1,
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--border-primary)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '16px',
                    color: '#1f2937',
                    fontWeight: '700'
                  }}>
                    📉 Short Position
                  </h5>
                  
                  {/* Bet Amount */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ 
                      fontSize: '12px', 
                      color: '#374151', 
                      fontWeight: '600',
                      display: 'block',
                      marginBottom: '4px'
                    }}>
                      Bet Amount ($):
                    </label>
                    <input 
                      type="number" 
                      value={shortSettings.betAmount}
                      onChange={(e) => setShortSettings({...shortSettings, betAmount: parseFloat(e.target.value) || 0})}
                      min="1"
                      max={currentUser.balance}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        color: '#1f2937'
                      }}
                    />
                  </div>

                  {/* Target Drop % */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ 
                      fontSize: '12px', 
                      color: '#374151', 
                      fontWeight: '600',
                      display: 'block',
                      marginBottom: '4px'
                    }}>
                      Target Drop (%):
                    </label>
                    <input 
                      type="number" 
                      value={shortSettings.targetDropPercentage}
                      onChange={(e) => setShortSettings({...shortSettings, targetDropPercentage: parseFloat(e.target.value) || 0})}
                      min="1"
                      max="100"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        color: '#1f2937'
                      }}
                    />
                  </div>

                  {/* Time Limit */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ 
                      fontSize: '12px', 
                      color: '#374151', 
                      fontWeight: '600',
                      display: 'block',
                      marginBottom: '4px'
                    }}>
                      Time Limit (hours):
                    </label>
                    <input 
                      type="number" 
                      value={shortSettings.timeLimit}
                      onChange={(e) => setShortSettings({...shortSettings, timeLimit: parseFloat(e.target.value) || 0})}
                      min="1"
                      max="168"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: 'white',
                        color: '#1f2937'
                      }}
                    />
                  </div>

                  {/* Potential Winnings */}
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#374151',
                    marginBottom: '10px',
                    fontWeight: '600'
                  }}>
                    Potential Win: ${calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit).toFixed(2)}
                  </div>

                  {/* Short Button */}
                  <button 
                    onClick={handleShort}
                    disabled={shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: (shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0) ? '#9ca3af' : 'var(--coral-red)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    {hasActiveShort ? 'Active Short Exists' : 
                     ownedQuantity > 0 ? 'Own Shares - Cannot Short' : 
                     shortSettings.betAmount > currentUser.balance ? 'Insufficient Funds' : 
                     shortSettings.betAmount <= 0 ? 'Enter Bet Amount' :
                     `Place Short Bet (${shortSettings.betAmount.toFixed(2)})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isPortfolioBet() && activity.targetUser && (
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border-primary)',
              textAlign: 'center',
              marginBottom: '15px'
            }}>
              <h4 style={{ 
                margin: '0 0 15px 0',
                color: 'var(--text-primary)'
              }}>
                🎯 Portfolio Bet Target
              </h4>
              <p style={{ 
                margin: '0 0 15px 0',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                This bet involves <strong>{activity.targetUser}</strong>'s portfolio performance.
              </p>
              {activity.betType && activity.targetPercentage && (
                <p style={{ 
                  margin: '0 0 20px 0',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}>
                  Prediction: Portfolio will <strong>{activity.betType}</strong> by <strong>{activity.targetPercentage}%</strong>
                  {activity.timeframe && ` within ${activity.timeframe} days`}
                </p>
              )}
              <button 
                onClick={handleViewTargetProfile}
                className="nav-button"
                style={{ 
                  backgroundColor: 'var(--soft-purple)',
                  color: 'white',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                👤 View {activity.targetUser}'s Portfolio
              </button>
            </div>
          )}

          {/* Portfolio Betting Button - Moved from User Profile Section */}
          {targetUserData && !targetUserData.isCurrentUser && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              border: '2px solid var(--border-primary)'
            }}>
              <button
                onClick={() => setShowBettingInterface(!showBettingInterface)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: showBettingInterface ? '#ef4444' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '700',
                  transition: 'all 0.2s ease'
                }}
              >
                {showBettingInterface ? '❌ Cancel Bet' : '🎯 Bet on Portfolio'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function FeedPage() {
  const router = useRouter();
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000
  });
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'generates' | 'shorts'>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // NEW: Activity detail modal states
  const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);

  // UNIFIED TRANSACTION PROCESSING - Complete Implementation
  // Safe localStorage helpers with proper error handling
  const safeGetFromStorage = (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  };

  const safeSetToStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  };

  // UNIFIED: Bot username mapping
  const getBotUsernames = (): { [botId: string]: string } => {
    if (!isClient) return {};
    
    try {
      const bots = safeGetFromStorage('autonomousBots', []);
      const botMap: { [botId: string]: string } = {};
      
      bots.forEach((bot: any) => {
        if (bot && bot.id && bot.username) {
          botMap[bot.id] = bot.username;
        }
      });
      
      console.log(`🤖 UNIFIED: Loaded ${Object.keys(botMap).length} bot usernames:`, Object.values(botMap).slice(0, 5));
      return botMap;
    } catch (error) {
      console.error('UNIFIED: Error loading bot usernames:', error);
      return {};
    }
  };

  // UNIFIED: Enhanced bot detection
  const isBot = (username: string): boolean => {
    const botMap = getBotUsernames();
    const botUsernames = Object.values(botMap);
    
    return botUsernames.includes(username) || 
           username.includes('Bot') || 
           username.includes('Alpha') ||
           username.includes('Beta') ||
           username.includes('Gamma') ||
           username.includes('Delta') ||
           username.includes('Sigma') ||
           username.includes('Prime') ||
           username.includes('The') ||
           username.includes('Contrarian') ||
           username.includes('Trend') ||
           username.includes('Value') ||
           username.includes('Day') ||
           username.includes('Whale') ||
           username.includes('Gambler') ||
           username.includes('Scalper') ||
           username.includes('HODLer') ||
           username.includes('Swing') ||
           username.includes('Arbitrageur');
  };

  // UNIFIED: Get relative time
  const getRelativeTime = (timestamp: string): string => {
    try {
      const now = new Date();
      const time = new Date(timestamp);
      const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
      return 'Unknown time';
    }
  };

  // UNIFIED: Price calculation with 0.1% movements
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // EXACT: 1.001 = 0.1% increase per purchase (NO volatility multiplier)
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      // EXACT: 0.999 = 0.1% decrease per sale (NO volatility multiplier)
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // CRITICAL: Always return exactly 2 decimal places
    return Math.round(calculatedPrice * 100) / 100;
  };

  // UNIFIED: Get current price for an opinion
  const getCurrentPrice = (opinionText: string): number => {
    if (!isClient) return 10.00;
    
    try {
      const marketData = safeGetFromStorage('opinionMarketData', {});
      if (marketData[opinionText]) {
        const price = marketData[opinionText].currentPrice;
        return Math.round(price * 100) / 100;
      }
      return 10.00;
    } catch (error) {
      console.error('UNIFIED: Error getting current price:', error);
      return 10.00;
    }
  };

  // UNIFIED TRANSACTION PROCESSOR (MAIN)
  const unifiedTransactionProcessor = (): ActivityFeedItem[] => {
    if (!isClient) return [];
    
    console.log('🔄 UNIFIED: Processing all transactions with hybrid processor...');
    
    const activities: ActivityFeedItem[] = [];
    const seenIds = new Set<string>();
    const botMap = getBotUsernames();
    
    try {
      // STEP 1: Process bot transactions with enhanced handling
      const botTransactions = safeGetFromStorage('botTransactions', []);
      console.log(`🤖 UNIFIED: Processing ${botTransactions.length} bot transactions`);
      
      let botTransactionsProcessed = 0;
      let botTransactionsSkipped = 0;

      botTransactions.forEach((transaction: any, index: number) => {
        try {
          // Generate unique ID with better collision prevention
          const uniqueId = transaction.id || `bot_${transaction.botId}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Skip if we've already seen this ID
          if (seenIds.has(uniqueId)) {
            console.log(`⚠️ UNIFIED: Duplicate transaction ID skipped: ${uniqueId}`);
            botTransactionsSkipped++;
            return;
          }
          seenIds.add(uniqueId);

          // Get actual bot name with fallback
          let botName = 'Unknown Bot';
          if (transaction.botId && botMap[transaction.botId]) {
            botName = botMap[transaction.botId];
          } else if (transaction.botId) {
            botName = `Bot_${transaction.botId.slice(-6)}`;
          }

          // Extract transaction data
          let activityType = transaction.type;
          let amount = parseFloat(transaction.amount) || 0;
          
          // Extract actual price and quantity from metadata with better fallbacks
          let actualPrice: number | undefined;
          let actualQuantity: number | undefined;
          
          if (transaction.metadata && typeof transaction.metadata === 'object') {
            actualPrice = transaction.metadata.purchasePricePerShare || transaction.metadata.price;
            actualQuantity = transaction.metadata.quantity;
            
            if (actualPrice) {
              console.log(`💰 UNIFIED: Extracted price from metadata: ${botName} - ${actualPrice.toFixed(2)} x ${actualQuantity || 1}`);
            }
          }
          
          // Calculate proper price if not in metadata - NEVER allow $0.00
          if (!actualPrice && (transaction.type === 'buy' || transaction.type === 'sell')) {
            if (transaction.opinionText) {
              const marketData = safeGetFromStorage('opinionMarketData', {});
              if (marketData[transaction.opinionText]) {
                actualPrice = marketData[transaction.opinionText].currentPrice;
                console.log(`💡 UNIFIED: Using market price for ${transaction.opinionText}: ${actualPrice?.toFixed(2)}`);
              } else {
                // Calculate price based on purchase history
                const allBotTx = botTransactions.filter((tx: any) => tx.opinionText === transaction.opinionText);
                const purchases = allBotTx.filter((tx: any) => tx.type === 'buy').length;
                const sales = allBotTx.filter((tx: any) => tx.type === 'sell').length;
                actualPrice = calculatePrice(purchases, sales, 10.00);
                console.log(`🔧 UNIFIED: Calculated price for ${transaction.opinionText}: ${actualPrice.toFixed(2)} (${purchases} buys, ${sales} sells)`);
              }
              
              if (!actualQuantity) {
                actualQuantity = Math.max(1, Math.round(Math.abs(amount) / (actualPrice ?? 10.00)));
              }
            } else {
              actualPrice = Math.max(10.00, Math.abs(amount));
              actualQuantity = 1;
              console.log(`⚠️ UNIFIED: Fallback pricing for ${botName}: ${actualPrice.toFixed(2)} x 1`);
            }
          }
          
          // Ensure prices are never $0.00
          if (actualPrice && actualPrice < 0.01) {
            actualPrice = 10.00;
            console.log(`🔧 UNIFIED: Fixed $0.00 price for ${botName} - reset to $10.00`);
          }
          
          // Normalize transaction types and amounts
          switch (transaction.type) {
            case 'bet':
              activityType = 'bet_place';
              amount = -Math.abs(amount);
              break;
            case 'buy':
              activityType = 'buy';
              amount = -Math.abs(amount);
              break;
            case 'sell':
              activityType = 'sell';
              amount = Math.abs(amount);
              break;
            case 'earn':
            case 'generate':
              activityType = 'earn';
              amount = Math.abs(amount);
              break;
            case 'short_place':
              activityType = 'short_place';
              amount = -Math.abs(amount);
              break;
            case 'short_win':
              activityType = 'short_win';
              amount = Math.abs(amount);
              break;
            case 'short_loss':
              activityType = 'short_loss';
              amount = -Math.abs(amount);
              break;
          }

          // Parse timestamp with multiple format support
          let timestamp: string;
          if (transaction.date) {
            try {
              let parsedDate: Date;
              
              if (typeof transaction.date === 'string') {
                if (transaction.date.includes('T')) {
                  parsedDate = new Date(transaction.date);
                } else {
                  parsedDate = new Date(transaction.date);
                }
              } else {
                parsedDate = new Date(transaction.date);
              }

              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.toISOString();
              } else {
                timestamp = new Date().toISOString();
                console.log(`⚠️ UNIFIED: Invalid date for transaction ${uniqueId}, using current time`);
              }
            } catch (error) {
              timestamp = new Date().toISOString();
              console.log(`⚠️ UNIFIED: Date parsing error for transaction ${uniqueId}:`, error);
            }
          } else {
            timestamp = new Date().toISOString();
          }

          const newActivity: ActivityFeedItem = {
            id: uniqueId,
            type: activityType as any,
            username: botName,
            opinionText: transaction.opinionText,
            opinionId: transaction.opinionId,
            amount: amount,
            price: actualPrice ? Math.round(actualPrice * 100) / 100 : undefined,
            quantity: actualQuantity,
            timestamp: timestamp,
            relativeTime: getRelativeTime(timestamp),
            isBot: true
          };

          activities.push(newActivity);
          botTransactionsProcessed++;

          // Debug log for verification
          if (actualPrice && (transaction.type === 'buy' || transaction.type === 'sell')) {
            console.log(`🤖💰 UNIFIED: Processed: ${botName} - ${activityType} - ${actualQuantity}x @ ${actualPrice.toFixed(2)} = ${Math.abs(amount).toFixed(2)}`);
          }

        } catch (error) {
          console.error(`UNIFIED: Error processing bot transaction ${index}:`, error, transaction);
          botTransactionsSkipped++;
        }
      });

      console.log(`✅ UNIFIED: Bot transactions: ${botTransactionsProcessed} processed, ${botTransactionsSkipped} skipped`);

      // STEP 2: Process user transactions
      try {
        const userTransactions = safeGetFromStorage('transactions', []);
        console.log(`👤 UNIFIED: Processing ${userTransactions.length} user transactions`);
        
        let userTransactionsProcessed = 0;

        userTransactions.forEach((t: any, index: number) => {
          try {
            const uniqueId = t.id || `user_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            
            if (seenIds.has(uniqueId)) return;
            seenIds.add(uniqueId);

            let timestamp: string;
            try {
              const parsedDate = new Date(t.date || new Date());
              timestamp = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
            } catch {
              timestamp = new Date().toISOString();
            }

            activities.push({
              id: uniqueId,
              type: t.type,
              username: currentUser.username,
              opinionText: t.opinionText || t.description?.replace(/^(Bought|Sold|Generated) /, ''),
              opinionId: t.opinionId,
              amount: parseFloat(t.amount) || 0,
              price: t.price ? Math.round(t.price * 100) / 100 : undefined,
              quantity: t.quantity,
              timestamp: timestamp,
              relativeTime: getRelativeTime(timestamp),
              isBot: false
            });

            userTransactionsProcessed++;
          } catch (error) {
            console.error(`UNIFIED: Error processing user transaction ${index}:`, error);
          }
        });

        console.log(`✅ UNIFIED: User transactions: ${userTransactionsProcessed} processed`);
      } catch (error) {
        console.error('UNIFIED: Error loading user transactions:', error);
      }

      // STEP 3: Process global activity feed
      try {
        const globalFeed = safeGetFromStorage('globalActivityFeed', []);
        console.log(`🌐 UNIFIED: Processing ${globalFeed.length} global feed entries`);
        
        let globalEntriesProcessed = 0;

        globalFeed.forEach((activity: any) => {
          try {
            if (seenIds.has(activity.id)) return;
            seenIds.add(activity.id);

            activities.push({
              ...activity,
              isBot: isBot(activity.username),
              relativeTime: getRelativeTime(activity.timestamp),
              amount: typeof activity.amount === 'number' ? Math.round(activity.amount * 100) / 100 : activity.amount,
              price: activity.price ? Math.round(activity.price * 100) / 100 : activity.price
            });

            globalEntriesProcessed++;
          } catch (error) {
            console.error('UNIFIED: Error processing global feed entry:', error);
          }
        });

        console.log(`✅ UNIFIED: Global feed: ${globalEntriesProcessed} processed`);
      } catch (error) {
        console.error('UNIFIED: Error loading global activity feed:', error);
      }
      
      // STEP 4: Handle empty feed with bot system diagnostics
      if (activities.length === 0) {
        console.log('📝 UNIFIED: No real activity found - checking bot system status...');
        
        if (typeof window !== 'undefined' && (window as any).botSystem) {
          const botSystem = (window as any).botSystem;
          const isRunning = botSystem.isSystemRunning();
          console.log(`🤖 UNIFIED: Bot system status: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
          
          if (!isRunning) {
            console.log('⚠️ UNIFIED: Bot system is stopped! Attempting to start...');
            try {
              botSystem.startBots();
              console.log('✅ UNIFIED: Bot system start command sent');
            } catch (error) {
              console.error('❌ UNIFIED: Failed to start bot system:', error);
            }
          } else {
            console.log('🤖 UNIFIED: Bot system running but no transactions found - forcing activity...');
            try {
              botSystem.forceBotActivity(5);
              console.log('✅ UNIFIED: Forced bot activity command sent');
            } catch (error) {
              console.error('❌ UNIFIED: Failed to force bot activity:', error);
            }
          }
        } else {
          console.log('❌ UNIFIED: Bot system not found in window object');
        }

        // Add helpful system message
        activities.push({
          id: 'system_message',
          type: 'generate',
          username: 'System',
          opinionText: 'Bot system initializing... If this persists, click "Start Bots" above.',
          amount: 0,
          timestamp: new Date().toISOString(),
          relativeTime: 'just now',
          isBot: false
        });
      }

    } catch (error) {
      console.error('❌ UNIFIED: Error in transaction processing:', error);
    }

    // STEP 5: Sort, deduplicate, and return results
    const uniqueActivities = activities
      .filter((activity, index, self) => {
        const isDuplicate = self.findIndex(a => 
          a.id === activity.id || 
          (a.username === activity.username && 
           a.type === activity.type && 
           a.amount === activity.amount && 
           Math.abs(new Date(a.timestamp).getTime() - new Date(activity.timestamp).getTime()) < 1000)
        ) !== index;
        
        return !isDuplicate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200);

    // Enhanced logging for diagnostics
    const botActivities = uniqueActivities.filter(a => a.isBot);
    const userActivities = uniqueActivities.filter(a => !a.isBot);
    const activityBreakdown = uniqueActivities.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 UNIFIED: Final result - ${uniqueActivities.length} unique activities`);
    console.log(`   🤖 Bot activities: ${botActivities.length}`);
    console.log(`   👤 User activities: ${userActivities.length}`);
    console.log(`   📈 Activity breakdown:`, activityBreakdown);
    console.log(`   🔗 Unique bot usernames:`, [...new Set(botActivities.map(a => a.username))].slice(0, 10));
    
    return uniqueActivities;
  };

  // Helper functions for UI rendering
  const getActivityIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'buy':
        return <CurrencyDollar color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />;
      case 'sell':
        return <HandPeace color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />;
      case 'bet_place':
      case 'bet_win':
      case 'bet_loss':
        return <DiceSix color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />;
      case 'short_place':
      case 'short_win':
      case 'short_loss':
        return <ChartLineDown color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />;
      case 'earn':
      case 'generate':
        return <Plus size={24} />;
      default:
        return '\ud83d\udcca';
    }
  };

  const getActivityIconClass = (type: string): string => {
    switch (type) {
      case 'buy': return styles.buyIcon;
      case 'sell': return styles.sellIcon;
      case 'bet_place': return styles.betIcon;
      case 'bet_win': return styles.winIcon;
      case 'bet_loss': return styles.lossIcon;
      case 'earn':
      case 'generate': return styles.earnIcon;
      case 'short_place': return styles.shortIcon;
      case 'short_win': return styles.shortWinIcon;
      case 'short_loss': return styles.shortLossIcon;
      default: return styles.defaultIcon;
    }
  };

  const getAmountClass = (amount: number): string => {
    return amount >= 0 ? styles.positiveAmount : styles.negativeAmount;
  };

  const formatActivityDescription = (activity: ActivityFeedItem): string => {
    const { type, username, opinionText, targetUser, betType, targetPercentage, isBot, quantity } = activity;
    const userPrefix = isBot ? '🤖' : '👤';
    
    switch (type) {
      case 'buy':
        return `${userPrefix} ${username} bought ${quantity || 1} shares of "${opinionText?.slice(0, 40)}..."`;
      case 'sell':
        return `${userPrefix} ${username} sold ${quantity || 1} shares of "${opinionText?.slice(0, 40)}..."`;
      case 'generate':
      case 'earn':
        return `${userPrefix} ${username} generated: "${opinionText?.slice(0, 50)}..."`;
      case 'short_place':
        return `${userPrefix} ${username} shorted "${opinionText?.slice(0, 40)}..."`;
      case 'short_win':
        return `${userPrefix} ${username} won short bet on "${opinionText?.slice(0, 40)}..."`;
      case 'short_loss':
        return `${userPrefix} ${username} lost short bet on "${opinionText?.slice(0, 40)}..."`;
      case 'bet_place':
        return `${userPrefix} ${username} bet ${targetUser} portfolio will ${betType} by ${targetPercentage}%`;
      case 'bet_win':
        return `${userPrefix} ${username} won portfolio bet on ${targetUser}`;
      case 'bet_loss':
        return `${userPrefix} ${username} lost portfolio bet on ${targetUser}`;
      default:
        return `${userPrefix} ${username} performed ${type}`;
    }
  };

  // Activity filtering functions
  const filterActivities = (activities: ActivityFeedItem[]): ActivityFeedItem[] => {
    switch (filter) {
      case 'trades':
        return activities.filter(a => ['buy', 'sell'].includes(a.type));
      case 'bets':
        return activities.filter(a => a.type.includes('bet'));
      case 'shorts':
        return activities.filter(a => a.type.includes('short'));
      case 'generates':
        return activities.filter(a => ['generate', 'earn'].includes(a.type));
      default:
        return activities;
    }
  };

  const getFilterCount = (filterType: string): number => {
    switch (filterType) {
      case 'all':
        return activityFeed.length;
      case 'trades':
        return activityFeed.filter(a => ['buy', 'sell'].includes(a.type)).length;
      case 'bets':
        return activityFeed.filter(a => a.type.includes('bet')).length;
      case 'shorts':
        return activityFeed.filter(a => a.type.includes('short')).length;
      case 'generates':
        return activityFeed.filter(a => ['generate', 'earn'].includes(a.type)).length;
      default:
        return 0;
    }
  };

  // Event handlers
  const handleActivityClick = (activity: ActivityFeedItem, event: React.MouseEvent) => {
    // Don't open modal if username was clicked
    if ((event.target as HTMLElement).closest('.clickableUsername')) {
      return;
    }
    
    setSelectedActivity(activity);
    setShowActivityDetailModal(true);
  };

  const handleUsernameClick = (username: string, event: React.MouseEvent) => {
    event.stopPropagation();
    router.push(`/users/${username}`);
  };

  const handleTransactionClick = (activity: ActivityFeedItem) => {
    // Convert activity to transaction detail format
    const transaction: TransactionDetail = {
      ...activity,
      fullDescription: formatActivityDescription(activity)
    };
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  };

  // Global functions for external access
  const addToGlobalFeed = (activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) => {
    if (!isClient) return;
    
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: `${Date.now()}_${Math.random()}`,
      relativeTime: getRelativeTime(activity.timestamp)
    };

    const existingFeed = safeGetFromStorage('globalActivityFeed', []);
    const updatedFeed = [newActivity, ...existingFeed].slice(0, 200);
    
    safeSetToStorage('globalActivityFeed', updatedFeed);
    setActivityFeed(updatedFeed);
  };

  const forceRefreshFeed = () => {
    setLastRefresh(Date.now());
    const newActivity = unifiedTransactionProcessor();
    setActivityFeed(newActivity);
  };

  const ensureBotsRunning = () => {
    if (typeof window !== 'undefined' && (window as any).botSystem) {
      const botSystem = (window as any).botSystem;
      if (!botSystem.isSystemRunning()) {
        console.log('🤖 Starting bot system...');
        botSystem.startBots();
      }
    }
  };

  // Client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Make functions available globally
  useEffect(() => {
    if (!isClient) return;
    
    (window as any).addToGlobalFeed = addToGlobalFeed;
    (window as any).forceRefreshFeed = forceRefreshFeed;
    
    return () => {
      delete (window as any).addToGlobalFeed;
      delete (window as any).forceRefreshFeed;
    };
  }, [isClient]);

  // Initialize data
  useEffect(() => {
    if (!isClient) return;
    
    // Load opinions
    const stored = safeGetFromStorage('opinions', null);
    if (stored) {
      const parsed = stored;
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setOpinions(validOpinions.map((text: string, i: number) => ({ id: i.toString(), text })));
    }

    // Load user profile
    const storedProfile = safeGetFromStorage('userProfile', null);
    if (storedProfile) {
      setCurrentUser(storedProfile);
    }

    // Ensure bots are running
    ensureBotsRunning();
  }, [isClient]);

  // Main activity loading effect
  useEffect(() => {
    if (!isClient) return;
    
    // Use unified processor
    const realActivity = unifiedTransactionProcessor();
    setActivityFeed(realActivity);

    // Update relative times every minute
    const interval = setInterval(() => {
      setActivityFeed(prevFeed => 
        prevFeed.map(activity => ({
          ...activity,
          relativeTime: getRelativeTime(activity.timestamp)
        }))
      );
    }, 60000);

    // Enhanced refresh with change detection
    const refreshInterval = setInterval(() => {
      const currentActivityCount = activityFeed.length;
      const botTransactionCount = safeGetFromStorage('botTransactions', []).length;
      
      const lastBotTransactionCount = parseInt(safeGetFromStorage('lastBotTransactionCount', '0') || '0');
      
      if (botTransactionCount !== lastBotTransactionCount) {
        console.log(`🔄 HYBRID: New bot transactions detected: ${botTransactionCount} (was ${lastBotTransactionCount})`);
        safeSetToStorage('lastBotTransactionCount', botTransactionCount.toString());
        
        const newActivity = unifiedTransactionProcessor();
        if (newActivity.length !== currentActivityCount) {
          console.log(`📈 HYBRID: Activity count changed: ${newActivity.length} (was ${currentActivityCount})`);
          setActivityFeed(newActivity);
        }
      }
      
      if (activityFeed.filter(a => a.isBot).length < 3) {
        console.log('⚠️ HYBRID: Low bot activity detected - ensuring bots are running...');
        ensureBotsRunning();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [isClient]);

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return <div>Loading...</div>;
  }

  const filteredActivities = filterActivities(activityFeed);
  const botActivityCount = activityFeed.filter(a => a.isBot).length;
  const humanActivityCount = activityFeed.filter(a => !a.isBot).length;
  const shortActivityCount = activityFeed.filter(a => a.type.includes('short')).length;

  return (
    <div className="page-container">
      <Sidebar opinions={opinions} />
      
      <main className="main-content" style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '0', marginTop: '24px' }}>
        {/* Header with Title and Navigation */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '20px',
          marginTop: 0,
          paddingTop: 0
        }}>
          {/* Left side - Title */}
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
            <Rss size={32} />  Live Feed
          </h1>
          
          {/* Right side - Navigation Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            flexWrap: 'wrap',
            paddingRight: '20px'
          }}>
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

        {/* Filter Controls */}
        <div className={styles.filterControls}>
          <span className={styles.filterLabel}>Filter:</span>
          {(['all', 'trades', 'bets', 'shorts', 'generates'] as const).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`${styles.filterButton} ${filter === filterType ? styles.active : ''}`}
            >
              {filterType === 'all' ? `All Activity (${getFilterCount(filterType)})` :
               filterType === 'trades' ? `Trades (${getFilterCount(filterType)})` :
               filterType === 'bets' ? `Bets (${getFilterCount(filterType)})` :
               filterType === 'shorts' ? `Shorts (${getFilterCount(filterType)})` :
               `Generates (${getFilterCount(filterType)})`}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div className={styles.feedContainer}>
          {/* Enhanced Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.liveIndicator}></div>
            LIVE • {filteredActivities.length} Recent Activities • 
            🤖 {botActivityCount} bots • 👤 {humanActivityCount} users • 
            Last refresh: {new Date(lastRefresh).toLocaleTimeString()}
          </div>

          {/* Feed Content */}
          <div className={styles.feedContent}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyFeed}>
                <p>📭</p>
                <p>No activity found matching your filter.</p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  🤖 Bot system may be starting up. Click "Start Bots" to begin automated trading.
                </p>
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => {
                      ensureBotsRunning();
                      setTimeout(forceRefreshFeed, 2000);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🤖 Start Bot System
                  </button>
                  <button 
                    onClick={forceRefreshFeed}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh Feed
                  </button>
                  <button 
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).forceBotActivity) {
                        (window as any).forceBotActivity(10);
                        setTimeout(forceRefreshFeed, 3000);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🚀 Force Bot Activity
                  </button>
                </div>
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const isUserActivity = activity.username === currentUser.username;
                const isBotActivity = activity.isBot;
                const isShortActivity = activity.type.includes('short');
                
                return (
                  <div 
                    key={activity.id}
                    className={`${styles.activityItem} ${isUserActivity ? styles.userActivity : ''} ${isBotActivity ? styles.botActivity : ''} ${isShortActivity ? styles.shortActivity : ''}`}
                    onClick={(e) => handleActivityClick(activity, e)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                    }}
                  >
                    <div className={styles.activityLayout}>
                      {/* Activity Icon */}
                      {(() => {
                        if (activity.type === 'buy') {
                          return (
                            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(92,184,92,1)' }}>
                              <CurrencyDollar color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />
                            </div>
                          );
                        } else if (activity.type === 'sell') {
                          return (
                            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(239,68,68,1)' }}>
                              <HandPeace color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />
                            </div>
                          );
                        } else if (["bet_place", "bet_win", "bet_loss"].includes(activity.type)) {
                          return (
                            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,159,10,1)' }}>
                              <DiceSix color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />
                            </div>
                          );
                        } else if (["short_place", "short_win", "short_loss"].includes(activity.type)) {
                          return (
                            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(236,72,153,1)' }}>
                              <ChartLineDown color="white" size={24} style={{ background: 'none', border: 'none', borderRadius: 0, boxShadow: 'none' }} />
                            </div>
                          );
                        } else {
                          return (
                      <div className={`${styles.activityIcon} ${getActivityIconClass(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                          );
                        }
                      })()}

                      {/* Activity Content */}
                      <div className={styles.activityContent}>
                        <div className={styles.activityDescription}>
                          {formatActivityDescription(activity)}
                          {isUserActivity && (
                            <span className={styles.userBadge}>
                              YOU
                            </span>
                          )}
                          {isBotActivity && (
                            <span className={styles.botBadge}>
                              BOT
                            </span>
                          )}
                          {isShortActivity && (
                            <span className={styles.shortBadge}>
                              SHORT
                            </span>
                          )}
                          {/* Clickable username */}
                          <span 
                            className="clickableUsername"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUsernameClick(activity.username, e);
                            }}
                            style={{ 
                              color: isBotActivity ? '#10b981' : '#3b82f6', 
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              marginLeft: '8px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {isBotActivity ? '🤖' : '👤'} {activity.username}
                          </span>
                        </div>
                        
                        <div className={styles.activityMeta}>
                          <span className={styles.activityTime}>{activity.relativeTime}</span>
                          <span className={`${styles.activityAmount} ${getAmountClass(activity.amount)}`}>
                            {activity.amount >= 0 ? '+' : ''}${Math.abs(activity.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* NEW: Enhanced Activity Detail Modal with Portfolio Betting */}
        {showActivityDetailModal && selectedActivity && (
          <ActivityDetailModal
            activity={selectedActivity}
            onClose={() => {
              setShowActivityDetailModal(false);
              setSelectedActivity(null);
            }}
            currentUser={currentUser}
            onUpdateUser={setCurrentUser}
          />
        )}

        {/* Transaction Details Modal - Preserved advanced implementation */}
        {showTransactionModal && selectedTransaction && (
          <div 
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTransactionModal(false);
                setSelectedTransaction(null);
              }
            }}
          >
            <div className={styles.transactionModal}>
              <div className={styles.modalHeader}>
                <h2>
                  {getActivityIcon(selectedTransaction.type)} Transaction Details
                </h2>
                <button
                  onClick={() => {
                    setShowTransactionModal(false);
                    setSelectedTransaction(null);
                  }}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <div className={styles.modalContent}>
                {/* Transaction Type & User */}
                <div className={styles.transactionHeader}>
                  <div className={styles.transactionType}>
                    <span className={`${styles.typeTag} ${styles[selectedTransaction.type]}`}>
                      {selectedTransaction.type.toUpperCase().replace('_', ' ')}
                    </span>
                    {selectedTransaction.isBot && (
                      <span className={styles.botTag}>🤖 BOT</span>
                    )}
                    {selectedTransaction.type.includes('short') && (
                      <span className={styles.shortTag}>📉 SHORT</span>
                    )}
                  </div>
                  <div className={styles.transactionAmount}>
                    <span className={getAmountClass(selectedTransaction.amount)}>
                      {selectedTransaction.amount >= 0 ? '+' : ''}${Math.abs(selectedTransaction.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Full Description */}
                <div className={styles.transactionDescription}>
                  <p>{selectedTransaction.fullDescription}</p>
                </div>

                {/* Transaction Details */}
                <div className={styles.transactionDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>User:</span>
                    <span 
                      className={styles.clickableUsername}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUsernameClick(selectedTransaction.username, e);
                        setShowTransactionModal(false);
                      }}
                      style={{ 
                        color: selectedTransaction.isBot ? '#10b981' : '#3b82f6', 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {selectedTransaction.isBot ? '🤖 ' : '👤 '}{selectedTransaction.username}
                    </span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Time:</span>
                    <span>{new Date(selectedTransaction.timestamp).toLocaleString()}</span>
                  </div>

                  {selectedTransaction.opinionText && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Opinion:</span>
                      <span className={styles.opinionText}>"{selectedTransaction.opinionText}"</span>
                    </div>
                  )}

                  {selectedTransaction.opinionId && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Opinion ID:</span>
                      <span>#{selectedTransaction.opinionId}</span>
                    </div>
                  )}

                  {/* Show price and quantity details for trades */}
                  {(selectedTransaction.type === 'buy' || selectedTransaction.type === 'sell') && selectedTransaction.price && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Price per share:</span>
                        <span>${selectedTransaction.price.toFixed(2)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Quantity:</span>
                        <span>{selectedTransaction.quantity || 1} shares</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Total value:</span>
                        <span>${Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.modalActions}>
                  {selectedTransaction.username !== currentUser.username && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUsernameClick(selectedTransaction.username, e);
                        setShowTransactionModal(false);
                      }}
                      className={styles.viewUserButton}
                    >
                      👤 View {selectedTransaction.isBot ? 'Bot' : 'User'} Profile
                    </button>
                  )}
                  
                  {selectedTransaction.opinionId && (
                    <button
                      onClick={() => {
                        router.push(`/opinion/${selectedTransaction.opinionId}`);
                        setShowTransactionModal(false);
                      }}
                      className={styles.viewOpinionButton}
                    >
                      💬 View Opinion
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowTransactionModal(false);
                      setSelectedTransaction(null);
                    }}
                    className={styles.closeModalButton}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Market Stats */}
        <div className={styles.marketStats}>
          <div className={`${styles.statCard} ${styles.purchases}`}>
            <div className={`${styles.statNumber} ${styles.purchases}`}>
              {activityFeed.filter(a => a.type === 'buy').length}
            </div>
            <div className={styles.statLabel}>Total Purchases</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.sales}`}>
            <div className={`${styles.statNumber} ${styles.sales}`}>
              {activityFeed.filter(a => a.type === 'sell').length}
            </div>
            <div className={styles.statLabel}>Total Sales</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.bets}`}>
            <div className={`${styles.statNumber} ${styles.bets}`}>
              {activityFeed.filter(a => a.type.includes('bet')).length}
            </div>
            <div className={styles.statLabel}>Portfolio Bets</div>
          </div>

          <div className={`${styles.statCard} ${styles.shorts}`}>
            <div className={`${styles.statNumber} ${styles.shorts}`}>
              {shortActivityCount}
            </div>
            <div className={styles.statLabel}>Short Positions</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.volume}`}>
            <div className={`${styles.statNumber} ${styles.volume}`}>
              ${activityFeed.reduce((sum, a) => sum + Math.abs(a.amount), 0).toFixed(2)}
            </div>
            <div className={styles.statLabel}>Total Volume</div>
          </div>
        </div>
      </main>
    </div>
  );
}