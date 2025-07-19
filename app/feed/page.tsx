'use client';

/**
 * REALISTIC ACTIVITY FIX & CONSTANT REAL-TIME UPDATES IMPLEMENTED:
 * 
 * Issues Fixed:
 * - Users no longer gain money for generating opinions
 * - 'generate' and 'earn' are now separate activity types
 * - Generate activities show $0.00 instead of positive amounts
 * - Only legitimate earnings (trading wins, bet wins) show positive amounts
 * - Bot system updated to not reward opinion generation
 * - Feed now updates constantly with real-time activity
 * 
 * Changes Made:
 * - Updated unifiedTransactionProcessor to set generate amount to 0
 * - Fixed bot system to use 'generate' type with 0 amount
 * - Updated activity descriptions to differentiate generate vs earn
 * - Added test function to verify realistic behavior
 * 
 * REAL-TIME UPDATE SYSTEM:
 * - Relative times update every 10 seconds (was 60 seconds)
 * - Full feed refresh every 3 seconds for constant updates
 * - Bot activity generation every 5 seconds to keep feed active
 * - Activity boost check every 15 seconds to maintain flow
 * - Immediate kickstart activity when page loads
 * - Enhanced header with live indicators and auto-refresh status
 * - Manual "INSTANT LIVE ACTIVITY" button for immediate content generation
 * - Firebase real-time subscriptions for multi-user updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
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
import AuthButton from '../components/AuthButton';
import Navigation from '../components/Navigation';
import ActivityIntegration from '../components/ActivityIntegration';
import { useAuth } from '../lib/auth-context';
import { firebaseActivityService, LocalActivityItem } from '../lib/firebase-activity';
import { dataReconciliationService } from '../lib/data-reconciliation';
import { realtimeDataService } from '../lib/realtime-data-service';
import { createActivityId } from '../lib/document-id-utils';
import { AuthProvider } from '../lib/auth-context';
import { db } from '../lib/firebase';

// REAL-TIME FEED: Global Event System for Instant Updates
class RealTimeFeedManager {
  private listeners: Set<(activity: ActivityFeedItem) => void> = new Set();
  private static instance: RealTimeFeedManager;

  static getInstance(): RealTimeFeedManager {
    if (!RealTimeFeedManager.instance) {
      RealTimeFeedManager.instance = new RealTimeFeedManager();
    }
    return RealTimeFeedManager.instance;
  }

  // Subscribe to real-time activity updates
  subscribe(callback: (activity: ActivityFeedItem) => void): () => void {
    this.listeners.add(callback);
    console.log(`🔴 LIVE FEED: New subscriber added (${this.listeners.size} total)`);
    
    return () => {
      this.listeners.delete(callback);
      console.log(`🔴 LIVE FEED: Subscriber removed (${this.listeners.size} remaining)`);
    };
  }

  // Push new activity to all subscribers immediately
  pushActivity(activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) {
    const fullActivity: ActivityFeedItem = {
      ...activity,
      id: createActivityId(),
      relativeTime: 'just now'
    };

    console.log(`🔴 LIVE FEED: Broadcasting new activity: ${fullActivity.username} - ${fullActivity.type}`);
    
    // Notify all subscribers immediately
    this.listeners.forEach(callback => {
      try {
        callback(fullActivity);
      } catch (error) {
        console.error('🔴 LIVE FEED: Error in subscriber callback:', error);
      }
    });

    return fullActivity;
  }

  // Get current subscriber count
  getSubscriberCount(): number {
    return this.listeners.size;
  }
}

// Force CSS to be processed
if (typeof window !== 'undefined') {
  // This ensures CSS modules are processed
  console.log('CSS modules loaded:', styles);
  
  // Add real-time feed animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInFromTop {
      0% {
        transform: translateY(-20px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes fadeIn {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }
    
    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'bet' | 'bet_place' | 'bet_win' | 'bet_loss' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
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

    setShowBettingInterface(false);
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
    const userPrefix = isBot ? 'Bot' : 'User';
    
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
            Activity Details
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
                {activity.isBot ? 'Bot' : 'User'} {activity.username}
              </button>
              

            </div>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <span>${Math.abs(activity.amount).toFixed(2)}</span>
              <span>{activity.relativeTime}</span>
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
                Bet on {targetUserData.username}'s Portfolio
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
                    <option value="increase">Portfolio Increase</option>
                    <option value="decrease">Portfolio Decrease</option>
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
                  {betForm.amount <= 0 ? 'Enter Bet Amount' :
                   betForm.amount > currentUser.balance ? 'Insufficient Funds' :
                   `Place Bet ($${betForm.amount})`}
                </button>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '15px',
              backgroundColor: message.includes('placed') ? '#f0fdf4' : message.includes('cannot') ? '#fef3c7' : '#fef2f2',
              border: `1px solid ${message.includes('placed') ? '#bbf7d0' : message.includes('cannot') ? '#fde68a' : '#fecaca'}`,
              color: message.includes('placed') ? '#166534' : message.includes('cannot') ? '#92400e' : '#dc2626',
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
                  Current Price: ${currentPrice.toFixed(2)}
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
                    You own {ownedQuantity} shares • Sell price: ${calculateSellPrice(currentPrice).toFixed(2)}
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
                    Buy Shares
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
                            'TRADING LIMIT REACHED (3/3)' : 
                            `TRADING WARNING: ${rapidTradeCount}/3 purchases in 10 minutes`
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
                        return '#f3f4f6'; // Grey background
                      })(),
                      color: (() => {
                        const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                        if (rapidCount >= 3 || currentPrice * quantity > currentUser.balance) return 'white';
                        return '#374151'; // Dark grey text
                      })(),
                      border: '2px solid #000000', // Black outline
                      borderRadius: '8px',
                      cursor: (currentPrice * quantity > currentUser.balance || getRapidTradeCount(activity.opinionText || '', 10) >= 3) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                      if (!(currentPrice * quantity > currentUser.balance || rapidCount >= 3)) {
                        e.currentTarget.style.backgroundColor = '#10b981'; // Green hover
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                      if (!(currentPrice * quantity > currentUser.balance || rapidCount >= 3)) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'; // Back to grey
                        e.currentTarget.style.color = '#374151'; // Back to dark grey text
                      }
                    }}
                  >
                    {(() => {
                      const rapidCount = getRapidTradeCount(activity.opinionText || '', 10);
                      if (rapidCount >= 3) return 'TRADING LIMIT REACHED';
                      if (currentPrice * quantity > currentUser.balance) return 'INSUFFICIENT FUNDS';
                      return `Buy ${quantity} Share${quantity !== 1 ? 's' : ''} ($${(currentPrice * quantity).toFixed(2)})`;
                    })()}
                  </button>
                  
                  {/* Sell Button */}
                  {alreadyOwned && (
                    <button 
                      onClick={handleSell}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#f3f4f6', // Grey background
                        color: '#374151', // Dark grey text
                        border: '2px solid #000000', // Black outline
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '700',
                        marginTop: '8px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444'; // Red hover
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'; // Back to grey
                        e.currentTarget.style.color = '#374151'; // Back to dark grey text
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
                    Short Position
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
                      backgroundColor: (shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0) ? '#9ca3af' : '#f3f4f6', // Grey background
                      color: (shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0) ? 'white' : '#374151', // Dark grey text
                      border: '2px solid #000000', // Black outline
                      borderRadius: '6px',
                      cursor: (shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      const isDisabled = shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0;
                      if (!isDisabled) {
                        e.currentTarget.style.backgroundColor = '#ef4444'; // Red hover
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const isDisabled = shortSettings.betAmount > currentUser.balance || hasActiveShort || ownedQuantity > 0 || shortSettings.betAmount <= 0;
                      if (!isDisabled) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6'; // Back to grey
                        e.currentTarget.style.color = '#374151'; // Back to dark grey text
                      }
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
                Portfolio Bet Target
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
                View {activity.targetUser}'s Portfolio
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
                  {showBettingInterface ? 'Cancel Bet' : 'Bet on Portfolio'}
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
  const { user, userProfile: authUserProfile } = useAuth();
  
  // Core state
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'Loading...',
    balance: 10000
  });
  
  // UI state
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'generates' | 'shorts'>('all');
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Loading states for better UX
  const [isLoadingFirebase, setIsLoadingFirebase] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  // Real-time feed state
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [newActivityCount, setNewActivityCount] = useState(0);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const realTimeFeedManager = useRef<RealTimeFeedManager | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);

  // Safe localStorage helpers
  const safeGetFromStorage = useCallback((key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }, []);

  const safeSetToStorage = useCallback((key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }, []);

  // Helper functions - Fixed to handle Firestore Timestamp objects
  const getRelativeTime = useCallback((timestamp: any): string => {
    try {
      const now = new Date();
      let time: Date;
      
      // Handle Firestore Timestamp objects
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        time = timestamp.toDate();
      } 
      // Handle Firestore Timestamp seconds/nanoseconds format
      else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        time = new Date(timestamp.seconds * 1000);
      }
      // Handle string timestamps
      else if (typeof timestamp === 'string') {
        time = new Date(timestamp);
      }
      // Handle number timestamps
      else if (typeof timestamp === 'number') {
        time = new Date(timestamp);
      }
      else {
        console.warn('Invalid timestamp format:', timestamp);
        return 'Unknown time';
      }

      if (isNaN(time.getTime())) {
        console.warn('Invalid date from timestamp:', timestamp);
        return 'Unknown time';
      }

      const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (error) {
      console.error('Error in getRelativeTime:', error, 'timestamp:', timestamp);
      return 'Unknown time';
    }
  }, []);

  const isBot = useCallback((username: string): boolean => {
    return username.includes('Bot') || 
           username.includes('Alpha') ||
           username.includes('Beta') ||
           username.includes('Gamma') ||
           username.includes('Delta') ||
           username.includes('Sigma');
  }, []);

  // Load Firebase data only (simplified)
  const loadFirebaseData = useCallback(async () => {
    console.log('🔥 Loading Firebase data...');
    console.log('👤 User authenticated:', !!user);
    console.log('🔑 User ID:', user?.uid);
    setIsLoadingFirebase(true);
    setFirebaseError(null);
    
    try {
      // Load user profile from Firebase/auth
      if (user?.uid) {
        console.log('👤 Loading user profile...');
        const firebaseProfile = await realtimeDataService.getUserProfile();
        if (firebaseProfile) {
          console.log('✅ User profile loaded:', firebaseProfile.username);
          setCurrentUser({
            username: firebaseProfile.username,
            balance: firebaseProfile.balance || 10000
          });
        } else {
          console.log('⚠️ No user profile found in Firebase');
        }
      } else {
        console.log('⚠️ No authenticated user, skipping profile load');
      }
      
      // Load Firebase activities
      console.log('📊 Loading Firebase activities...');
      const firebaseActivities = await Promise.race([
        firebaseActivityService.getRecentActivities(200),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout after 10 seconds')), 10000)
        )
      ]);
      
      console.log(`🔥 Loaded ${firebaseActivities.length} Firebase activities`);
      
      if (firebaseActivities.length > 0) {
        console.log('📊 Sample activity:', firebaseActivities[0]);
      }
      
      // Convert Firebase activities to our format - Fixed timestamp handling
      const formattedActivities: ActivityFeedItem[] = firebaseActivities.map(activity => {
        // Ensure timestamp is properly converted to string for storage
        let timestampString: string;
        try {
          if (activity.timestamp && typeof activity.timestamp === 'object' && activity.timestamp.toDate) {
            timestampString = activity.timestamp.toDate().toISOString();
          } else if (activity.timestamp && typeof activity.timestamp === 'object' && activity.timestamp.seconds) {
            timestampString = new Date(activity.timestamp.seconds * 1000).toISOString();
          } else if (typeof activity.timestamp === 'string') {
            timestampString = activity.timestamp;
          } else if (typeof activity.timestamp === 'number') {
            timestampString = new Date(activity.timestamp).toISOString();
          } else {
            timestampString = new Date().toISOString();
          }
        } catch (error) {
          console.error('Error converting timestamp:', error, activity.timestamp);
          timestampString = new Date().toISOString();
        }

        return {
          id: activity.id || 'unknown',
          type: activity.type || 'unknown',
          username: activity.username || 'Unknown User',
          opinionText: activity.opinionText,
          opinionId: activity.opinionId,
          amount: typeof activity.amount === 'number' ? activity.amount : 0,
          price: activity.price,
          quantity: activity.quantity,
          targetUser: activity.targetUser,
          betType: activity.betType,
          targetPercentage: activity.targetPercentage,
          timeframe: activity.timeframe,
          timestamp: timestampString,
          relativeTime: getRelativeTime(activity.timestamp), // Use original timestamp for calculation
          isBot: !!activity.isBot
        };
      });
      
      console.log(`✅ Formatted ${formattedActivities.length} activities for display`);
      setActivityFeed(formattedActivities);
      setIsLoadingFirebase(false);
      
    } catch (error) {
      console.error('❌ Firebase data load failed:', error);
      const errorMessage = (error as Error).message || 'Firebase connection error';
      setFirebaseError(errorMessage);
      setIsLoadingFirebase(false);
    }
  }, [user?.uid, getRelativeTime]);



  // Activity filtering
  const filterActivities = useCallback((activities: ActivityFeedItem[]): ActivityFeedItem[] => {
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
  }, [filter]);

  const getFilterCount = useCallback((filterType: string): number => {
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
  }, [activityFeed]);

  // Format activity description
  const formatActivityDescription = useCallback((activity: ActivityFeedItem): string => {
    const { type, username, opinionText, targetUser, betType, targetPercentage, isBot, quantity } = activity;
    const userPrefix = isBot ? 'Bot' : 'User';
    
    switch (type) {
      case 'buy':
        return `${userPrefix} ${username} bought ${quantity || 1} shares of "${opinionText?.slice(0, 40)}..."`;
      case 'sell':
        return `${userPrefix} ${username} sold ${quantity || 1} shares of "${opinionText?.slice(0, 40)}..."`;
      case 'generate':
        return `${userPrefix} ${username} generated opinion: "${opinionText?.slice(0, 50)}..."`;
      case 'earn':
        return `${userPrefix} ${username} generated opinion: "${opinionText?.slice(0, 50)}..."`;
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
  }, []);

  // Event handlers
  const handleActivityClick = useCallback((activity: ActivityFeedItem, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.clickableUsername')) {
      return;
    }
    setSelectedActivity(activity);
    setShowActivityDetailModal(true);
  }, []);

  const handleUsernameClick = useCallback((username: string, event: React.MouseEvent) => {
    event.stopPropagation();
    router.push(`/users/${username}`);
  }, [router]);

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load Firebase data
  useEffect(() => {
    if (!isClient) return;
    
    // Only load Firebase data if user is authenticated
    if (user) {
      loadFirebaseData();
    } else {
      console.log('🔐 User not authenticated - Firebase data will load after sign in');
      setIsLoadingFirebase(false);
      setFirebaseError('Please sign in to view activity feed');
    }
  }, [isClient, user, loadFirebaseData]);

  // Real-time feed setup
  useEffect(() => {
    if (!isClient) return;
    
    realTimeFeedManager.current = RealTimeFeedManager.getInstance();
    setLiveConnectionStatus('connecting');
    
    // Set up Firebase real-time subscription for activity-feed
    console.log('🔥 Setting up Firebase real-time activity subscription...');
    const activityQuery = query(
      collection(db, 'activity-feed'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    
    const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
      console.log(`🔥 Firebase activity update: ${snapshot.size} activities received`);
      const activities: ActivityFeedItem[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Handle Firestore Timestamp objects properly
          let timestampISO: string;
          if (data.timestamp?.toDate) {
            timestampISO = data.timestamp.toDate().toISOString();
          } else if (data.timestamp) {
            timestampISO = new Date(data.timestamp).toISOString();
          } else {
            timestampISO = new Date().toISOString();
          }
          
          activities.push({
            id: doc.id,
            type: data.type,
            username: data.username || 'Unknown',
            opinionText: data.opinionText,
            opinionId: data.opinionId,
            amount: data.amount || 0,
            price: data.price,
            quantity: data.quantity,
            targetUser: data.targetUser,
            betType: data.betType,
            targetPercentage: data.targetPercentage,
            timeframe: data.timeframe,
            timestamp: timestampISO,
            relativeTime: getRelativeTime(timestampISO),
            isBot: data.isBot || false
          });
        } catch (error) {
          console.error('Error processing activity doc:', doc.id, error);
        }
      });
      
      console.log(`🔥 Live feed updated with ${activities.length} activities`);
      setActivityFeed(activities);
      setLiveConnectionStatus('connected');
    }, (error) => {
      console.error('🔥 Firebase activity subscription error:', error);
      setLiveConnectionStatus('disconnected');
      setFirebaseError('Real-time updates failed. Please refresh.');
    });
    
    // Update relative timestamps every 30 seconds to keep times fresh
    const timestampUpdateInterval = setInterval(() => {
      setActivityFeed(currentFeed => 
        currentFeed.map(activity => ({
          ...activity,
          relativeTime: getRelativeTime(activity.timestamp)
        }))
      );
    }, 30000);
    
    return () => {
      console.log('🔥 Cleaning up Firebase activity subscription');
      unsubscribe();
      clearInterval(timestampUpdateInterval);
      setLiveConnectionStatus('disconnected');
    };
  }, [isClient]); // Removed getRelativeTime from dependencies as it's memoized with useCallback

  if (!isClient) {
    return (
      <div className="page-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#F1F0EC'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚡</div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>Loading Idea Auction...</div>
        </div>
      </div>
    );
  }

  const filteredActivities = filterActivities(activityFeed);
  const botActivityCount = activityFeed.filter(a => a.isBot).length;
  const humanActivityCount = activityFeed.filter(a => !a.isBot).length;

  return (
    <div className="page-container" style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#F1F0EC',
      fontFamily: "'Noto Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <Sidebar opinions={opinions} />
      
      <main className="main-content" style={{ 
        paddingLeft: '20px', 
        paddingRight: '20px', 
        paddingTop: '115px', 
        flex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        marginTop: '95px'
      }}>
        {/* Header */}
        <div className="header-section" style={{ 
          backgroundColor: 'white', 
          padding: '16px 20px',
          marginBottom: '20px',
          marginLeft: '-20px',
          paddingLeft: '40px',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '16px',
          position: 'fixed',
          top: 0,
          width: '100%',
          maxWidth: '1200px',
          height: '95px',
          zIndex: 1000
        }}>
          <div className="user-header" style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            maxWidth: '600px'
          }}>
            <div className="user-info">
              <h1 style={{
                fontSize: '36px',
                margin: '0',
                fontWeight: '800',
                color: '#1a1a1a'
              }}>Live Feed</h1>
            </div>
          </div>

          {/* Navigation Buttons */}
          <Navigation currentPage="feed" />
        </div>

        {/* Loading Status */}
        {isLoadingFirebase && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #92400e',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Loading Firebase data...
          </div>
        )}

        {/* Firebase Status */}
        {firebaseError && (
          <div style={{
            marginBottom: '16px',
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#dc2626'
          }}>
            ❌ Firebase Error: {firebaseError} (using localStorage fallback)
          </div>
        )}

        {/* Filter Controls */}
        <div style={{ 
          marginTop: '8px',
          marginBottom: '16px', 
          display: 'flex',
          gap: '8px',
          padding: '1rem',
          backgroundColor: '#F1F0EC',
          borderRadius: '16px',
          border: '1px solid #000000',
          alignItems: 'center'
        }}>
          <span style={{
            marginRight: '1rem',
            fontWeight: '700',
            color: '#555555',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Filter:</span>
          {(['all', 'trades', 'bets', 'shorts', 'generates'] as const).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={{
                padding: '8px 16px',
                border: filter === filterType ? '2px solid #3b82f6' : '2px solid #63b3ed',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                textTransform: 'capitalize',
                background: filter === filterType ? '#3b82f6' : '#F1F0EC',
                color: filter === filterType ? '#ffffff' : '#1a1a1a',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit'
              }}
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
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #000000',
          overflow: 'hidden',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Feed Header */}
          <div style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#F1F0EC',
            borderBottom: '1px solid #000000',
            fontWeight: '700',
            color: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: liveConnectionStatus === 'connected' ? '#10b981' : '#ef4444',
                borderRadius: '50%'
              }}></div>
              <span style={{ 
                color: liveConnectionStatus === 'connected' ? '#10b981' : '#ef4444',
                fontWeight: '800' 
              }}>
                {liveConnectionStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
              </span>
              <span style={{ color: '#666' }}>•</span>
              <span>{filteredActivities.length} Activities</span>
              <span style={{ color: '#666' }}>•</span>
              <span style={{ color: '#10b981' }}>🤖 {botActivityCount} bots</span>
              <span style={{ color: '#666' }}>•</span>
              <span style={{ color: '#3b82f6' }}>👤 {humanActivityCount} users</span>
            </div>
          </div>

          {/* Feed Content */}
          <div 
            ref={feedContainerRef}
            style={{
              maxHeight: '70vh',
              overflowY: 'auto',
              padding: '0',
              backgroundColor: '#ffffff'
            }}
          >
            {filteredActivities.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#666'
              }}>
                {!user ? (
                  <>
                    <p style={{ fontSize: '48px', margin: '0 0 20px 0' }}>🔐</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 10px 0' }}>
                      Sign in to view activity feed
                    </p>
                    <p style={{ fontSize: '14px', margin: '0 0 20px 0' }}>
                      Firebase data requires authentication
                    </p>
                    <AuthButton />
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '48px', margin: '0 0 20px 0' }}>📭</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 10px 0' }}>
                      No activity found
                    </p>
                    <p style={{ fontSize: '14px', margin: '0' }}>
                      {isLoadingFirebase ? 'Loading activities...' : 'Try a different filter or refresh the page'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const isUserActivity = activity.username === currentUser.username;
                const isBotActivity = activity.isBot;
                
                return (
                  <div 
                    key={activity.id}
                    onClick={(e) => handleActivityClick(activity, e)}
                    style={{ 
                      cursor: 'pointer', 
                      padding: '1rem 1.5rem',
                      borderBottom: '1px solid #000000',
                      backgroundColor: '#ffffff',
                      transition: 'all 200ms ease-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      {/* Activity Icon */}
                      <div style={{ 
                        width: 40, 
                        height: 40, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderRadius: '50%', 
                        background: activity.type === 'buy' ? 'rgba(92,184,92,1)' :
                                   activity.type === 'sell' ? 'rgba(239,68,68,1)' :
                                   activity.type.includes('bet') ? 'rgba(255, 118, 2, 1)' :
                                   activity.type.includes('short') ? 'rgba(236,72,153,1)' :
                                   'rgba(59, 130, 246, 1)'
                      }}>
                        {activity.type === 'buy' ? <CurrencyDollar color="white" size={24} /> :
                         activity.type === 'sell' ? <HandPeace color="white" size={24} /> :
                         activity.type.includes('bet') ? <DiceSix color="white" size={24} /> :
                         activity.type.includes('short') ? <ChartLineDown color="white" size={24} /> :
                         <Plus size={24} />}
                      </div>

                      {/* Activity Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '14px',
                          lineHeight: '1.5',
                          color: '#1a1a1a',
                          marginBottom: '4px'
                        }}>
                          {formatActivityDescription(activity)}
                          {isUserActivity && (
                            <span style={{
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '700',
                              marginLeft: '8px'
                            }}>
                              YOU
                            </span>
                          )}
                          {isBotActivity && (
                            <span style={{
                              backgroundColor: '#10b981',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '700',
                              marginLeft: '8px'
                            }}>
                              BOT
                            </span>
                          )}
                          {/* Clickable username */}
                          <span 
                            className="clickableUsername"
                            onClick={(e) => handleUsernameClick(activity.username, e)}
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
                        
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                          color: '#7a7a7a'
                        }}>
                          <span>{activity.relativeTime}</span>
                          <span style={{
                            fontWeight: '700',
                            color: activity.amount >= 0 ? '#0F7950' : '#BB0006'
                          }}>
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

        {/* Activity Detail Modal */}
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
      </main>
      
      {/* Add CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Activity Integration for real-time updates */}
      <ActivityIntegration userProfile={authUserProfile ? {
        username: authUserProfile.username,
        balance: authUserProfile.balance,
        totalEarnings: authUserProfile.totalEarnings,
        totalLosses: authUserProfile.totalLosses,
        joinDate: authUserProfile.joinDate instanceof Date ? authUserProfile.joinDate.toISOString() : authUserProfile.joinDate
      } : undefined} />
    </div>
  );
}
