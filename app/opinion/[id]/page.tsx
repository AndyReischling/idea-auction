'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Accordion from '../../components/Accordion';
import styles from './page.module.css';
import { ArrowLeft, PiggyBank, ScanSmiley, RssSimple, Balloon, RocketLaunch, ChartLineUp, ChartLineDown, Skull, FlowerLotus, Ticket, CheckSquare, CaretRight, CaretDown, Wallet, ArrowUUpLeft } from "@phosphor-icons/react";

// ... keeping all the interfaces the same ...
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
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet_win' | 'bet_loss' | 'bet_place' | 'short_win' | 'short_loss' | 'short_place';
  opinionId?: string;
  opinionText?: string;
  betId?: string;
  shortId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  date: string;
}

interface ShortBetSettings {
  betAmount: number;
  targetDropPercentage: number;
  timeLimit: number;
}

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create' }[];
  liquidityScore: number;
  dailyVolume: number;
  manipulation_protection: {
    rapid_trades: number;
    single_trader_percentage: number;
    last_manipulation_check: string;
  };
}

interface OpinionAttribution {
  author: string;
  isBot: boolean;
  dateCreated: string;
  source: 'user' | 'ai_generated' | 'bot_generated';
}

interface TraderHistoryItem {
  traderName: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  date: string;
  timestamp: string;
  isBot: boolean;
}

export default function OpinionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [opinion, setOpinion] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(10.00);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [timesPurchased, setTimesPurchased] = useState<number>(0);
  const [timesSold, setTimesSold] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [alreadyOwned, setAlreadyOwned] = useState<boolean>(false);
  const [ownedQuantity, setOwnedQuantity] = useState<number>(0);
  const [attribution, setAttribution] = useState<OpinionAttribution | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Short betting states
  const [showShortModal, setShowShortModal] = useState<boolean>(false);
  const [shortSettings, setShortSettings] = useState<ShortBetSettings>({
    betAmount: 100,
    targetDropPercentage: 25,
    timeLimit: 24
  });
  const [activeShorts, setActiveShorts] = useState<ShortPosition[]>([]);
  const [hasActiveShort, setHasActiveShort] = useState<boolean>(false);
  
  // Trader history modal state
  const [showTraderHistory, setShowTraderHistory] = useState<boolean>(false);

  // FIXED: Safe localStorage helpers to prevent SSR errors
  const safeGetFromStorage = (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key ${key}:`, error);
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

  // Fix hydration by ensuring client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get attribution for an opinion
  const getOpinionAttribution = (opinionText: string, opinionIndex: number): OpinionAttribution => {
    if (!isClient) {
      return {
        author: 'Anonymous',
        isBot: false,
        dateCreated: new Date().toLocaleDateString(),
        source: 'user'
      };
    }

    try {
      const attributions = safeGetFromStorage('opinionAttributions', {});
      
      if (attributions[opinionText]) {
        return attributions[opinionText];
      }
      
      const botTransactions = safeGetFromStorage('botTransactions', []);
      const botGenerated = botTransactions.find((t: any) => 
        t.type === 'earn' && t.opinionText === opinionText
      );
      
      if (botGenerated) {
        const bots = safeGetFromStorage('autonomousBots', []);
        const bot = bots.find((b: any) => b.id === botGenerated.botId);
        
        return {
          author: bot ? bot.username : 'AI Bot',
          isBot: true,
          dateCreated: botGenerated.date || new Date().toLocaleDateString(),
          source: 'bot_generated'
        };
      }
      
      const transactions = safeGetFromStorage('transactions', []);
      const aiGenerated = transactions.find((t: any) => 
        t.type === 'earn' && 
        (t.opinionText === opinionText || t.description?.includes(opinionText.slice(0, 30)))
      );
      
      if (aiGenerated) {
        const currentUser = safeGetFromStorage('userProfile', {});
        return {
          author: currentUser.username || 'OpinionTrader123',
          isBot: false,
          dateCreated: aiGenerated.date || new Date().toLocaleDateString(),
          source: 'ai_generated'
        };
      }
      
      const currentUser = safeGetFromStorage('userProfile', {});
      return {
        author: currentUser.username || 'OpinionTrader123',
        isBot: false,
        dateCreated: new Date().toLocaleDateString(),
        source: 'user'
      };
      
    } catch (error) {
      console.error('Error getting opinion attribution:', error);
      const currentUser = safeGetFromStorage('userProfile', {});
      return {
        author: currentUser.username || 'Anonymous',
        isBot: false,
        dateCreated: new Date().toLocaleDateString(),
        source: 'user'
      };
    }
  };

  // Save attribution for an opinion
  const saveOpinionAttribution = (opinionText: string, attribution: OpinionAttribution) => {
    if (!isClient) return;
    
    try {
      const attributions = safeGetFromStorage('opinionAttributions', {});
      attributions[opinionText] = attribution;
      safeSetToStorage('opinionAttributions', attributions);
    } catch (error) {
      console.error('Error saving opinion attribution:', error);
    }
  };

  // UNIVERSAL PRICE CALCULATION - EXACT 0.1% movements (removed volatility)
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // EXACT: 1.001 = 0.1% increase per purchase
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      // EXACT: 0.999 = 0.1% decrease per sale
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // CRITICAL: Always return exactly 2 decimal places
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Calculate user's recent trading dominance
  const calculateUserDominance = (opinion: string, userTradeHistory?: any[]): number => {
    if (!isClient) return 0;
    
    try {
      const recentTrades = safeGetFromStorage('recentTradeActivity', {});
      const opinionTrades = recentTrades[opinion] || [];
      const userTrades = opinionTrades.filter((trade: any) => trade.isCurrentUser);
      
      return opinionTrades.length > 0 ? userTrades.length / opinionTrades.length : 0;
    } catch {
      return 0;
    }
  };

  // Track rapid trading for manipulation detection
  const getRapidTradeCount = (opinion: string, timeWindowMinutes: number): number => {
    if (!isClient) return 0;
    
    try {
      const rapidTrades = safeGetFromStorage('rapidTrades', {});
      const opinionTrades = rapidTrades[opinion] || [];
      const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
      
      return opinionTrades.filter((timestamp: number) => timestamp > cutoffTime).length;
    } catch {
      return 0;
    }
  };

  // Calculate recent price volatility
  const calculateRecentVolatility = (marketData: OpinionMarketData): number => {
    if (!marketData.priceHistory || marketData.priceHistory.length < 3) return 1.0;
    
    const recentPrices = marketData.priceHistory.slice(-5).map(h => h.price);
    const avgPrice = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / recentPrices.length;
    const standardDeviation = Math.sqrt(variance);
    
    return avgPrice > 0 ? standardDeviation / avgPrice : 1.0;
  };

  // Anti-manipulation penalty calculation
  const calculateManipulationPenalty = (
    opinion: string,
    marketData: OpinionMarketData,
    userTradeHistory?: any[]
  ): number => {
    let penalty = 0;
    
    // Check for rapid trading (pump and dump protection)
    const recentTrades = getRapidTradeCount(opinion, 60); // trades in last hour
    if (recentTrades > 5) {
      penalty += 0.02; // 2% penalty for rapid trading
    }
    
    // Check for single trader dominance
    const userDominance = calculateUserDominance(opinion, userTradeHistory);
    if (userDominance > 0.6) { // If user made >60% of recent trades
      penalty += 0.03; // 3% penalty for market dominance
    }
    
    // Check for suspicious price movements
    const priceVolatility = calculateRecentVolatility(marketData);
    if (priceVolatility > 2.0) {
      penalty += 0.015; // 1.5% penalty for suspicious volatility
    }
    
    // Cap total manipulation penalty at 8%
    return Math.min(penalty, 0.08);
  };

  // FIXED: Calculate sell price - Simple: always 95% of current market price (precise decimals)
  const calculateSellPrice = (currentMarketPrice: number, userPurchasePrice?: number): number => {
    // Always sell for 95% of current market price
    // Anti-arbitrage is handled by ultra-micro market price jumps (0.1%) instead
    // Return precise decimal (rounded to 2 decimal places for currency)
    return Math.round(currentMarketPrice * 0.95 * 100) / 100;
  };

  // Helper to get the user's purchase price for an opinion
  const getUserPurchasePrice = (opinionText: string): number => {
    const asset = ownedOpinions.find(asset => asset.text === opinionText);
    console.log(`DEBUG getUserPurchasePrice: opinion="${opinionText}", found asset:`, asset);
    return asset ? asset.purchasePrice : currentPrice;
  };

  // Track trade activity for manipulation detection
  const trackTradeActivity = (opinion: string, action: 'buy' | 'sell', price: number, isCurrentUser: boolean = true): void => {
    if (!isClient) return;
    
    try {
      // Track recent trade activity
      const recentTrades = safeGetFromStorage('recentTradeActivity', {});
      if (!recentTrades[opinion]) recentTrades[opinion] = [];
      
      recentTrades[opinion].push({
        action,
        price,
        timestamp: Date.now(),
        isCurrentUser
      });
      
      // Keep only last 20 trades per opinion
      recentTrades[opinion] = recentTrades[opinion].slice(-20);
      safeSetToStorage('recentTradeActivity', recentTrades);
      
      // Track rapid trades
      const rapidTrades = safeGetFromStorage('rapidTrades', {});
      if (!rapidTrades[opinion]) rapidTrades[opinion] = [];
      
      rapidTrades[opinion].push(Date.now());
      
      // Keep only trades from last 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      rapidTrades[opinion] = rapidTrades[opinion].filter((timestamp: number) => timestamp > twoHoursAgo);
      
      safeSetToStorage('rapidTrades', rapidTrades);
    } catch (error) {
      console.error('Error tracking trade activity:', error);
    }
  };

  // Calculate daily trading volume
  const calculateDailyVolume = (opinionText: string): number => {
    if (!isClient) return 0;
    
    try {
      const marketData = safeGetFromStorage('opinionMarketData', {});
      const data = marketData[opinionText];
      
      if (!data || !data.priceHistory) return 0;
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentTrades = data.priceHistory.filter((trade: any) => 
        new Date(trade.timestamp).getTime() > oneDayAgo
      );
      
      return recentTrades.length;
    } catch {
      return 0;
    }
  };

  // REMOVED: calculateVolatility function - no longer needed

  // FIXED: Get market data for an opinion - GUARANTEED $10.00 start (removed volatility)
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    if (!isClient) {
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00, // ALWAYS START AT $10.00
        basePrice: 10.00,    // ALWAYS $10.00 BASE
        lastUpdated: new Date().toISOString(),
        priceHistory: [],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    }

    const marketData = safeGetFromStorage('opinionMarketData', {});
    
    if (marketData[opinionText]) {
      const data = marketData[opinionText];
      
      // CRITICAL FIX: Verify price consistency (removed volatility from calculation)
      const expectedPrice = calculatePrice(data.timesPurchased, data.timesSold, data.basePrice || 10.00);
      if (Math.abs(expectedPrice - data.currentPrice) > 0.01) {
        console.warn(`Price inconsistency detected for "${opinionText}": Expected ${expectedPrice}, Got ${data.currentPrice}. Fixing...`);
        data.currentPrice = expectedPrice;
        marketData[opinionText] = data;
        safeSetToStorage('opinionMarketData', marketData);
      }
      
      // Ensure base price is always $10.00
      if (data.basePrice !== 10.00) {
        console.log(`🔧 FIXING BASE PRICE: "${opinionText.slice(0, 30)}..." - ${data.basePrice} → 10.00`);
        data.basePrice = 10.00;
        marketData[opinionText] = data;
        safeSetToStorage('opinionMarketData', marketData);
      }
      
      return {
        ...data,
        liquidityScore: Math.min((data.timesPurchased + data.timesSold) / 20, 1),
        dailyVolume: calculateDailyVolume(opinionText),
        manipulation_protection: data.manipulation_protection || {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    } else {
      // CRITICAL FIX: Create new market data starting at EXACTLY $10.00 (removed volatility)
      const basePrice = 10.00;
      
      const newMarketData: OpinionMarketData = {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00, // EXACT $10.00 start
        basePrice: 10.00,    // EXACT $10.00 base
        lastUpdated: new Date().toISOString(),
        priceHistory: [{ price: 10.00, timestamp: new Date().toISOString(), action: 'create' }],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
      
      // Save the new market data
      marketData[opinionText] = newMarketData;
      safeSetToStorage('opinionMarketData', marketData);
      
      console.log(`✅ Created market data for "${opinionText}" at exactly $10.00`);
      
      return newMarketData;
    }
  };

  // FIXED: Update market data for an opinion with realistic tracking (removed volatility)
  const updateOpinionMarketDataRealistic = (opinionText: string, action: 'buy' | 'sell'): OpinionMarketData => {
    if (!isClient) {
      return getOpinionMarketData(opinionText);
    }

    const marketData = safeGetFromStorage('opinionMarketData', {});
    const currentData = getOpinionMarketData(opinionText);
    
    const newTimesPurchased = action === 'buy' ? currentData.timesPurchased + 1 : currentData.timesPurchased;
    const newTimesSold = action === 'sell' ? currentData.timesSold + 1 : currentData.timesSold;
    const newPrice = calculatePrice(newTimesPurchased, newTimesSold, currentData.basePrice);
    
    // Update liquidity score
    const totalVolume = newTimesPurchased + newTimesSold;
    const liquidityScore = Math.min(totalVolume / 20, 1);
    
    // Calculate daily volume
    const dailyVolume = calculateDailyVolume(opinionText);
    
    // Update manipulation protection metrics
    const manipulationProtection = {
      rapid_trades: getRapidTradeCount(opinionText, 60),
      single_trader_percentage: calculateUserDominance(opinionText),
      last_manipulation_check: new Date().toISOString()
    };
    
    const updatedData: OpinionMarketData = {
      ...currentData,
      timesPurchased: newTimesPurchased,
      timesSold: newTimesSold,
      currentPrice: newPrice,
      lastUpdated: new Date().toISOString(),
      liquidityScore,
      dailyVolume,
      manipulation_protection: manipulationProtection,
      priceHistory: [
        ...(currentData.priceHistory || []).slice(-19),
        { price: newPrice, timestamp: new Date().toISOString(), action }
      ]
    };
    
    marketData[opinionText] = updatedData;
    safeSetToStorage('opinionMarketData', marketData);
    
    // Track this trade
    trackTradeActivity(opinionText, action, newPrice, true);
    
    return updatedData;
  };

  // Calculate potential winnings for short bet (enhanced for 1%-100% range)
  const calculateShortWinnings = (betAmount: number, targetDropPercentage: number, timeLimit: number): number => {
    // Enhanced multiplier system for full 1%-100% range
    let dropMultiplier;
    
    if (targetDropPercentage <= 5) {
      // Very easy targets: 1-5% drops
      dropMultiplier = 1 + (targetDropPercentage / 100) * 0.5; // Low multiplier
    } else if (targetDropPercentage <= 20) {
      // Easy-moderate targets: 6-20% drops
      dropMultiplier = 1 + (targetDropPercentage / 100) * 1.5;
    } else if (targetDropPercentage <= 50) {
      // Moderate-hard targets: 21-50% drops
      dropMultiplier = 1 + (targetDropPercentage / 100) * 3;
    } else if (targetDropPercentage <= 80) {
      // Very hard targets: 51-80% drops
      dropMultiplier = 1 + (targetDropPercentage / 100) * 5;
    } else {
      // Extreme targets: 81-100% drops (price going near/to zero)
      dropMultiplier = 1 + (targetDropPercentage / 100) * 10; // Massive multiplier
    }
    
    // Time multiplier (shorter time = higher risk = higher reward)
    const timeMultiplier = timeLimit <= 6 ? 2.5 : timeLimit <= 12 ? 2.0 : timeLimit <= 24 ? 1.5 : 1.0;
    
    const totalMultiplier = dropMultiplier * timeMultiplier;
    
    return Math.round(betAmount * totalMultiplier * 100) / 100; // Ensure proper decimals
  };

  // Load short positions
  const loadShortPositions = () => {
    if (!isClient) return;
    
    try {
      const storedShorts = safeGetFromStorage('shortPositions', null);
      if (storedShorts) {
        const shorts = storedShorts as ShortPosition[];
        const activeShorts = shorts.filter(short => short.status === 'active');
        setActiveShorts(activeShorts);
        
        // Check if user has active short for this opinion
        if (opinion) {
          const hasShort = activeShorts.some(short => short.opinionText === opinion);
          setHasActiveShort(hasShort);
        }
      }
    } catch (error) {
      console.error('Error loading short positions:', error);
    }
  };

  // Check and resolve expired/completed short positions
  const checkShortPositions = () => {
    if (!opinion || !isClient) return;
    
    try {
      const storedShorts = safeGetFromStorage('shortPositions', null);
      if (!storedShorts) return;
      
      const shorts = storedShorts as ShortPosition[];
      const currentTime = new Date();
      let updated = false;
      
      const updatedShorts = shorts.map(short => {
        if (short.status !== 'active') return short;
        
        const expirationTime = new Date(short.expirationDate);
        const currentMarketData = getOpinionMarketData(short.opinionText);
        
        // Check if expired
        if (currentTime > expirationTime) {
          updated = true;
          
          // HARSH PENALTY: User owes 100x current market price for expired shorts!
          const penalty = Math.round(currentMarketData.currentPrice * 100 * 100) / 100; // 100x current price
          
          const updatedProfile = {
            ...userProfile,
            balance: userProfile.balance - penalty,
            totalLosses: userProfile.totalLosses + penalty
          };
          setUserProfile(updatedProfile);
          safeSetToStorage('userProfile', updatedProfile);
          
          // Add penalty transaction
          const penaltyTransaction: Transaction = {
            id: Date.now().toString(),
            type: 'short_loss',
            shortId: short.id,
            opinionText: short.opinionText.length > 50 ? short.opinionText.slice(0, 50) + '...' : short.opinionText,
            amount: -penalty,
            date: new Date().toLocaleDateString()
          };
          
          const existingTransactions = safeGetFromStorage('transactions', []);
          const updatedTransactions = [penaltyTransaction, ...existingTransactions.slice(0, 9)];
          safeSetToStorage('transactions', updatedTransactions);
          
          setMessage(`💀 Short bet expired! Penalty: $${penalty.toFixed(2)} (100x current price of $${currentMarketData.currentPrice.toFixed(2)})`);
          setTimeout(() => setMessage(''), 10000);
          
          return { ...short, status: 'expired' as const };
        }
        
        // Check if target reached (price dropped enough)
        if (currentMarketData.currentPrice <= short.targetPrice) {
          updated = true;
          
          // User wins the bet
          const updatedProfile = {
            ...userProfile,
            balance: userProfile.balance + short.potentialWinnings,
            totalEarnings: userProfile.totalEarnings + short.potentialWinnings
          };
          setUserProfile(updatedProfile);
          safeSetToStorage('userProfile', updatedProfile);
          
          // Add transaction
          const newTransaction: Transaction = {
            id: Date.now().toString(),
            type: 'short_win',
            shortId: short.id,
            opinionText: short.opinionText.length > 50 ? short.opinionText.slice(0, 50) + '...' : short.opinionText,
            amount: short.potentialWinnings,
            date: new Date().toLocaleDateString()
          };
          
          const existingTransactions = safeGetFromStorage('transactions', []);
          const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
          safeSetToStorage('transactions', updatedTransactions);
          
          setMessage(`🎉 Short bet won! Earned $${short.potentialWinnings.toFixed(2)}!`);
          setTimeout(() => setMessage(''), 7000);
          
          return { ...short, status: 'won' as const };
        }
        
        return short;
      });
      
      if (updated) {
        safeSetToStorage('shortPositions', updatedShorts);
        loadShortPositions();
      }
    } catch (error) {
      console.error('Error checking short positions:', error);
    }
  };

  // Place short bet
  const placeShortBet = () => {
    if (!opinion || userProfile.balance < shortSettings.betAmount || !isClient) {
      setMessage('Insufficient funds for this bet!');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    if (hasActiveShort) {
      setMessage('You already have an active short position on this opinion!');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    // Check if user owns any shares of this opinion
    if (ownedQuantity > 0) {
      setMessage('Cannot short opinions you currently own. Sell your position first.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    
    const targetPrice = Math.round((currentPrice * (1 - shortSettings.targetDropPercentage / 100)) * 100) / 100;
    const potentialWinnings = calculateShortWinnings(
      shortSettings.betAmount, 
      shortSettings.targetDropPercentage, 
      shortSettings.timeLimit
    );
    
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + shortSettings.timeLimit);
    
    const newShort: ShortPosition = {
      id: Date.now().toString(),
      opinionText: opinion,
      opinionId: id as string,
      betAmount: shortSettings.betAmount,
      targetDropPercentage: shortSettings.targetDropPercentage,
      startingPrice: currentPrice,
      targetPrice,
      potentialWinnings,
      expirationDate: expirationTime.toISOString(),
      createdDate: new Date().toISOString(),
      status: 'active'
    };
    
    // Deduct bet amount from balance
    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance - shortSettings.betAmount
    };
    setUserProfile(updatedProfile);
    safeSetToStorage('userProfile', updatedProfile);
    
    // Save short position
    const existingShorts = safeGetFromStorage('shortPositions', []);
    const updatedShorts = [...existingShorts, newShort];
    safeSetToStorage('shortPositions', updatedShorts);
    
    // Add transaction
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'short_place',
      shortId: newShort.id,
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: -shortSettings.betAmount,
      date: new Date().toLocaleDateString()
    };
    
    const existingTransactions = safeGetFromStorage('transactions', []);
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    safeSetToStorage('transactions', updatedTransactions);
    
    setHasActiveShort(true);
    setShowShortModal(false);
    loadShortPositions();
    
    setMessage(`📉 Short bet placed! You'll win $${potentialWinnings.toFixed(2)} if price drops to $${targetPrice.toFixed(2)} within ${shortSettings.timeLimit} hours.`);
    setTimeout(() => setMessage(''), 10000);
  };

  // Update all owned opinions with new market prices
  const updateOwnedOpinionPrices = () => {
    if (!isClient) return;
    
    const storedAssets = safeGetFromStorage('ownedOpinions', null);
    if (!storedAssets) return;
    
    const owned = storedAssets;
    const updatedOwned = owned.map((asset: OpinionAsset) => {
      const marketData = getOpinionMarketData(asset.text);
      return {
        ...asset,
        currentPrice: marketData.currentPrice
      };
    });
    
    setOwnedOpinions(updatedOwned);
    safeSetToStorage('ownedOpinions', updatedOwned);
  };

  useEffect(() => {
    if (!isClient) return;
    
    if (typeof id !== 'string') {
      setOpinion('Opinion not found.');
      return;
    }

    try {
      const stored = safeGetFromStorage('opinions', null);
      if (!stored) {
        setOpinion('Opinion not found.');
        setOpinions([]);
        return;
      }

      const all = stored;
      const mappedOpinions = all.map((text: string, i: number) => ({
        id: i.toString(),
        text,
      }));
      setOpinions(mappedOpinions);

      const idx = parseInt(id, 10);
      if (!isNaN(idx) && all[idx] !== undefined) {
        const currentOpinion = all[idx];
        setOpinion(currentOpinion);
        
        const opinionAttribution = getOpinionAttribution(currentOpinion, idx);
        setAttribution(opinionAttribution);
        saveOpinionAttribution(currentOpinion, opinionAttribution);
        
        const marketData = getOpinionMarketData(currentOpinion);
        setCurrentPrice(marketData.currentPrice);
        
        // Get owned asset to check purchase price
        const storedAssets = safeGetFromStorage('ownedOpinions', null);
        let ownedAsset = null;
        if (storedAssets) {
          const owned = storedAssets;
          ownedAsset = owned.find((asset: OpinionAsset) => asset.text === currentOpinion);
        }
        
        console.log(`DEBUG initial load: ownedAsset =`, ownedAsset);
        const initialSellPrice = calculateSellPrice(marketData.currentPrice, ownedAsset?.purchasePrice);
        console.log(`DEBUG initial load: calculated sell price = ${initialSellPrice.toFixed(2)}`);
        setSellPrice(initialSellPrice);
        setTimesPurchased(marketData.timesPurchased);
        setTimesSold(marketData.timesSold);
      } else {
        setOpinion('Opinion not found.');
      }

      const storedProfile = safeGetFromStorage('userProfile', null);
      if (storedProfile) {
        setUserProfile(storedProfile);
      }

      updateOwnedOpinionPrices();
      
      const storedAssets = safeGetFromStorage('ownedOpinions', null);
      if (storedAssets && all[idx]) {
        const owned = storedAssets;
        const ownedAsset = owned.find((asset: OpinionAsset) => 
          asset.text === all[idx]
        );
        if (ownedAsset) {
          setAlreadyOwned(true);
          setOwnedQuantity(ownedAsset.quantity);
        }
      }

      // Load short positions
      loadShortPositions();

    } catch (error) {
      console.error('Error loading opinion data:', error);
      setOpinion('Error loading opinion.');
    }
  }, [id, isClient]);

  // Check short positions periodically
  useEffect(() => {
    if (opinion && isClient) {
      checkShortPositions();
      const interval = setInterval(checkShortPositions, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [opinion, currentPrice, isClient]);

  // Update sell price whenever current price changes
  useEffect(() => {
    if (!isClient) return;
    
    console.log(`DEBUG useEffect: alreadyOwned=${alreadyOwned}, currentPrice=${currentPrice}, opinion="${opinion}"`);
    if (alreadyOwned && currentPrice > 0 && opinion) {
      const userPurchasePrice = getUserPurchasePrice(opinion);
      console.log(`DEBUG useEffect: calling calculateSellPrice(${currentPrice.toFixed(2)}, ${userPurchasePrice.toFixed(2)})`);
      const newSellPrice = calculateSellPrice(currentPrice, userPurchasePrice);
      console.log(`DEBUG useEffect: calculated sell price = ${newSellPrice.toFixed(2)}`);
      setSellPrice(newSellPrice);
    }
  }, [currentPrice, alreadyOwned, opinion, ownedOpinions, isClient]); // Added ownedOpinions and isClient dependency

  // FIXED: Purchase opinion with proper feed integration and SHORT POSITION BLOCKING
const purchaseOpinion = () => {
  if (!opinion || !isClient) return;

  if (userProfile.balance < currentPrice) {
    setMessage('Insufficient funds! Generate more opinions to earn money.');
    setTimeout(() => setMessage(''), 5000);
    return;
  }

  // NEW: Check if user has active short position on this opinion
  if (hasActiveShort) {
    setMessage('❌ Cannot buy shares of an opinion you have shorted! Close your short position first.');
    setTimeout(() => setMessage(''), 5000);
    return;
  }

  // Additional check: Look through all active shorts for this opinion
  const activeShortForThisOpinion = activeShorts.find(short => 
    short.opinionText === opinion && short.status === 'active'
  );
  
  if (activeShortForThisOpinion) {
    setMessage('❌ You have an active short bet on this opinion. Cannot buy shares while shorting!');
    setTimeout(() => setMessage(''), 5000);
    return;
  }

  // Check for rapid trading penalty
  const rapidTradeCount = getRapidTradeCount(opinion, 10); // last 10 minutes
  if (rapidTradeCount > 3) {
    setMessage('⚠️ Rapid trading detected! Please wait before making another purchase.');
    setTimeout(() => setMessage(''), 5000);
    return;
  }

  const purchasePrice = currentPrice; // Store the exact purchase price
  const purchaseQuantity = 1; // Always buying 1 share
  const totalCost = purchasePrice; // Total cost for 1 share

  const updatedMarketData = updateOpinionMarketDataRealistic(opinion, 'buy');

  if (alreadyOwned) {
    const updatedOwnedOpinions = ownedOpinions.map(asset => {
      if (asset.text === opinion) {
        return {
          ...asset,
          quantity: asset.quantity + 1,
          currentPrice: updatedMarketData.currentPrice
        };
      }
      return asset;
    });
    setOwnedOpinions(updatedOwnedOpinions);
    setOwnedQuantity(ownedQuantity + 1);
    safeSetToStorage('ownedOpinions', updatedOwnedOpinions);
  } else {
    const newAsset: OpinionAsset = {
      id: Date.now().toString(),
      text: opinion,
      purchasePrice: purchasePrice, // Store exact purchase price
      currentPrice: updatedMarketData.currentPrice,
      purchaseDate: new Date().toLocaleDateString(),
      quantity: 1
    };

    const updatedOwnedOpinions = [...ownedOpinions, newAsset];
    setOwnedOpinions(updatedOwnedOpinions);
    safeSetToStorage('ownedOpinions', updatedOwnedOpinions);
    setAlreadyOwned(true);
    setOwnedQuantity(1);
  }

  // FIXED: Create transaction with proper price and quantity metadata
  const newTransaction: Transaction = {
    id: Date.now().toString(),
    type: 'buy',
    opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
    amount: -totalCost, // Negative because it's an expense
    price: purchasePrice, // Store the actual purchase price
    quantity: purchaseQuantity, // Store the quantity purchased
    date: new Date().toLocaleDateString()
  };

  updateOwnedOpinionPrices();

  const updatedProfile = {
    ...userProfile,
    balance: userProfile.balance - totalCost
  };
  setUserProfile(updatedProfile);
  safeSetToStorage('userProfile', updatedProfile);

  const existingTransactions = safeGetFromStorage('transactions', []);
  const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
  safeSetToStorage('transactions', updatedTransactions);

  const oldPrice = currentPrice;
  setCurrentPrice(updatedMarketData.currentPrice);
  
  // Update sell price based on new market price (simple 95% calculation)
  setSellPrice(calculateSellPrice(updatedMarketData.currentPrice));
  setTimesPurchased(updatedMarketData.timesPurchased);
  
  setMessage(`Successfully purchased! Price: $${oldPrice.toFixed(2)} → $${updatedMarketData.currentPrice.toFixed(2)}. You can sell for: $${calculateSellPrice(updatedMarketData.currentPrice).toFixed(2)}`);
  setTimeout(() => setMessage(''), 7000);

  // CRITICAL FIX: Call the global feed tracking functions
  if (typeof window !== 'undefined') {
    // Method 1: Use the global tracking function if available
    if ((window as any).trackTrade) {
      console.log('🔥 CALLING trackTrade for purchase...');
      (window as any).trackTrade('buy', opinion, purchaseQuantity, purchasePrice, totalCost);
    }
    
    // Method 2: Use the enhanced interception function
    if ((window as any).interceptBuyTransaction) {
      console.log('🔥 CALLING interceptBuyTransaction...');
      (window as any).interceptBuyTransaction(opinion, purchaseQuantity, purchasePrice);
    }
    
    // Method 3: Directly add to global feed
    if ((window as any).addToGlobalFeed) {
      console.log('🔥 CALLING addToGlobalFeed for purchase...');
      (window as any).addToGlobalFeed({
        type: 'buy',
        username: userProfile.username,
        opinionText: opinion,
        opinionId: id,
        amount: -totalCost,
        price: purchasePrice,
        quantity: purchaseQuantity,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }
    
    // Method 4: Dispatch custom event
    window.dispatchEvent(new CustomEvent('newTransaction', {
      detail: {
        type: 'buy',
        username: userProfile.username,
        opinionText: opinion,
        opinionId: id,
        amount: -totalCost,
        price: purchasePrice,
        quantity: purchaseQuantity,
        timestamp: new Date().toISOString(),
        isBot: false
      }
    }));
    
    console.log('✅ All feed tracking methods called for PURCHASE');
  }
};

// FIXED: Sell opinion with proper feed integration

  // FIXED: Sell opinion with proper decimal handling and metadata tracking
  const sellOpinion = () => {
    if (!opinion || !alreadyOwned || ownedQuantity === 0 || !isClient) return;

    // Check if user has active short position - if so, they must buy units equal to target drop percentage
    const activeShort = activeShorts.find(short => short.opinionText === opinion && short.status === 'active');
    
    if (activeShort) {
      // User must buy units equal to their target drop percentage at current market price
      const unitsToBuy = activeShort.targetDropPercentage; // e.g., 15% drop = must buy 15 units
      const costPerUnit = currentPrice;
      const totalPenaltyCost = Math.round(unitsToBuy * costPerUnit * 100) / 100;
      
      const updatedProfile = {
        ...userProfile,
        balance: userProfile.balance - totalPenaltyCost,
        totalLosses: userProfile.totalLosses + totalPenaltyCost
      };
      setUserProfile(updatedProfile);
      safeSetToStorage('userProfile', updatedProfile);
      
      // Mark short as lost and add penalty transaction
      const updatedShorts = activeShorts.map(short => 
        short.id === activeShort.id ? { ...short, status: 'lost' as const } : short
      );
      setActiveShorts(updatedShorts);
      
      const allShorts = safeGetFromStorage('shortPositions', []);
      const updatedAllShorts = allShorts.map((short: ShortPosition) => 
        short.id === activeShort.id ? { ...short, status: 'lost' as const } : short
      );
      safeSetToStorage('shortPositions', updatedAllShorts);
      
      // Add penalty transaction
      const penaltyTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'short_loss',
        shortId: activeShort.id,
        opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
        amount: -totalPenaltyCost,
        date: new Date().toLocaleDateString()
      };
      
      const existingTransactions = safeGetFromStorage('transactions', []);
      safeSetToStorage('transactions', [penaltyTransaction, ...existingTransactions.slice(0, 9)]);
      
      setHasActiveShort(false);
      
      setMessage(`⚠️ Short position cancelled! Must buy ${unitsToBuy} units at $${costPerUnit.toFixed(2)} each = $${totalPenaltyCost.toFixed(2)} penalty for early exit.`);
      setTimeout(() => setMessage(''), 10000);
    }

    // Get the actual sell price based on current market price
    const actualSellPrice = calculateSellPrice(currentPrice);
    const sellQuantity = 1; // Always selling 1 share
    const totalReceived = actualSellPrice; // Total received for 1 share

    const updatedMarketData = updateOpinionMarketDataRealistic(opinion, 'sell');

    const updatedOwnedOpinions = ownedOpinions.map(asset => {
      if (asset.text === opinion) {
        const newQuantity = asset.quantity - 1;
        return {
          ...asset,
          quantity: newQuantity,
          currentPrice: updatedMarketData.currentPrice
        };
      }
      return asset;
    }).filter(asset => asset.quantity > 0);

    setOwnedOpinions(updatedOwnedOpinions);
    safeSetToStorage('ownedOpinions', updatedOwnedOpinions);

    const newQuantity = ownedQuantity - 1;
    setOwnedQuantity(newQuantity);
    if (newQuantity === 0) {
      setAlreadyOwned(false);
    }

    // FIXED: Create transaction with proper price and quantity metadata
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'sell',
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: totalReceived, // Positive because it's income
      price: actualSellPrice, // Store the actual sell price
      quantity: sellQuantity, // Store the quantity sold
      date: new Date().toLocaleDateString()
    };

    updateOwnedOpinionPrices();

    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance + totalReceived,
      totalEarnings: userProfile.totalEarnings + totalReceived
    };
    setUserProfile(updatedProfile);
    safeSetToStorage('userProfile', updatedProfile);

    const existingTransactions = safeGetFromStorage('transactions', []);
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    safeSetToStorage('transactions', updatedTransactions);

    const oldPrice = currentPrice;
    setCurrentPrice(updatedMarketData.currentPrice);
    
    // Update sell price for remaining shares (if any)
    if (newQuantity > 0) {
      setSellPrice(calculateSellPrice(updatedMarketData.currentPrice));
    }
    setTimesSold(updatedMarketData.timesSold);
    
    const userPurchasePrice = getUserPurchasePrice(opinion);
    const profitLoss = actualSellPrice - userPurchasePrice;
    const profitMessage = profitLoss > 0 ? `📈 Profit: +$${profitLoss.toFixed(2)}` : profitLoss < 0 ? `📉 Loss: $${Math.abs(profitLoss).toFixed(2)}` : '📊 Break even';
    
    const baseMessage = `Sold for $${actualSellPrice.toFixed(2)}! ${profitMessage} (Bought at $${userPurchasePrice.toFixed(2)}). Market: $${oldPrice.toFixed(2)} → $${updatedMarketData.currentPrice.toFixed(2)}`;
    
    if (!activeShort) {
      setMessage(baseMessage);
      setTimeout(() => setMessage(''), 7000);
    }

    // Add to global activity feed if available
    if (typeof window !== 'undefined' && (window as any).addToGlobalFeed) {
      (window as any).addToGlobalFeed({
        type: 'sell',
        username: userProfile.username,
        opinionText: opinion,
        opinionId: id,
        amount: totalReceived,
        price: actualSellPrice,
        quantity: sellQuantity,
        timestamp: new Date().toISOString(),
        isBot: false
      });
    }
  };

  const getMarketTrend = () => {
    const netDemand = timesPurchased - timesSold;
    if (netDemand > 5) return { emoji: <RocketLaunch size={32} weight="fill" />, text: 'Bullish', color: 'bullish', class: 'bullish' };
    if (netDemand > 2) return { emoji: <ChartLineUp size={32} weight="fill" />, text: 'Rising', color: 'bullish', class: 'bullish' };
    if (netDemand > -2) return { emoji: <FlowerLotus size={32} weight="fill" />, text: 'Stable', color: 'stable', class: 'stable' };
    if (netDemand > -5) return { emoji: <ChartLineDown size={32} weight="fill" />, text: 'Declining', color: 'bearish', class: 'bearish' };
    return { emoji: <Skull size={32} weight="fill" />, text: 'Bearish', color: 'bearish', class: 'bearish' };
  };

  const getMessageClass = (message: string) => {
    if (message.includes('Successfully') || message.includes('won!')) return 'success';
    if (message.includes('Insufficient') || message.includes('⚠️')) return 'error';
    return 'warning';
  };

  const getAuthorDisplay = (attribution: OpinionAttribution) => {
    if (attribution.isBot) {
      return {
        name: attribution.author,
        icon: '🤖',
        description: 'Autonomous Trading Bot',
        class: 'bot'
      };
    } else if (attribution.source === 'ai_generated') {
      return {
        name: attribution.author,
        icon: '✨',
        description: 'AI Generated',
        class: 'ai'
      };
    } else {
      return {
        name: attribution.author,
        icon: '👤',
        description: 'User Created',
        class: 'user'
      };
    }
  };

  // Calculate adaptive font size based on opinion length
  const getAdaptiveFontSize = (text: string): string => {
    if (!text) return '1.8rem';
    
    const length = text.length;
    
    if (length <= 50) {
      return '2.4rem'; // Large font for short opinions
    } else if (length <= 100) {
      return '2.0rem'; // Medium-large font
    } else if (length <= 200) {
      return '1.8rem'; // Medium font
    } else if (length <= 300) {
      return '1.6rem'; // Medium-small font
    } else if (length <= 500) {
      return '1.4rem'; // Small font
    } else if (length <= 800) {
      return '1.2rem'; // Very small font
    } else {
      return '1.0rem'; // Extra small font for very long opinions
    }
  };

  // Get trader history for this opinion
  const getTraderHistory = (): TraderHistoryItem[] => {
    if (!isClient || !opinion) return [];
    
    try {
      const marketData = getOpinionMarketData(opinion);
      const priceHistory = marketData.priceHistory || [];
      
      // Get transactions for this opinion
      const allTransactions = safeGetFromStorage('transactions', []);
      const botTransactions = safeGetFromStorage('botTransactions', []);
      
      // Filter transactions for this opinion
      const opinionTransactions = allTransactions.filter((transaction: Transaction) => 
        transaction.opinionText === opinion || 
        (transaction.opinionText && opinion.includes(transaction.opinionText.slice(0, 50)))
      );
      
      const opinionBotTransactions = botTransactions.filter((transaction: any) => 
        transaction.opinionText === opinion || 
        (transaction.opinionText && opinion.includes(transaction.opinionText.slice(0, 50)))
      );
      
      // Get current user profile
      const currentUser = safeGetFromStorage('userProfile', {});
      const bots = safeGetFromStorage('autonomousBots', []);
      
      // Combine all trading data
      const traderHistory: TraderHistoryItem[] = [];
      
      // Add price history data
      priceHistory.forEach((historyItem, index) => {
        if (historyItem.action === 'buy' || historyItem.action === 'sell') {
          // Try to match with transaction data
          const matchingTransaction = opinionTransactions.find((trans: Transaction) => 
            trans.type === historyItem.action && 
            Math.abs((trans.price || 0) - historyItem.price) < 0.01
          );
          
          const matchingBotTransaction = opinionBotTransactions.find((trans: any) => 
            trans.type === historyItem.action && 
            Math.abs((trans.price || 0) - historyItem.price) < 0.01
          );
          
          let traderName = 'Unknown Trader';
          let isBot = false;
          
          if (matchingBotTransaction) {
            const bot = bots.find((b: any) => b.id === matchingBotTransaction.botId);
            traderName = bot ? bot.username : 'AI Bot';
            isBot = true;
          } else if (matchingTransaction) {
            traderName = currentUser.username || 'OpinionTrader123';
            isBot = false;
          } else {
            // Simulate realistic trader names for demonstration
            const traderNames = ['TraderPro', 'InvestorAce', 'MarketMover', 'StockGuru', 'TradingWiz'];
            traderName = traderNames[index % traderNames.length] + (Math.floor(Math.random() * 999) + 1);
            isBot = Math.random() > 0.7; // 30% chance of being a bot
          }
          
          traderHistory.push({
            traderName,
            action: historyItem.action,
            price: historyItem.price,
            quantity: matchingTransaction?.quantity || matchingBotTransaction?.quantity || 1,
            date: new Date(historyItem.timestamp).toLocaleDateString(),
            timestamp: historyItem.timestamp,
            isBot
          });
        }
      });
      
      // Sort by most recent first
      return traderHistory.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
    } catch (error) {
      console.error('Error getting trader history:', error);
      return [];
    }
  };

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return <div>Loading...</div>;
  }

  const trend = getMarketTrend();

  return (
    <div className="page-container">
      <Sidebar opinions={opinions} />
      
      <main className="main-content">
        {/* Header with Navigation */}
        <div className={styles.pageHeader}>
          <button
            onClick={() => router.push('/')}
            className={styles.backButton}
          >
            <ArrowUUpLeft size={24}/> Back to Profile
          </button>

          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={24} /> View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              <RssSimple size={24} /> Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
              <Balloon size={24} /> Generate
            </a>

            <div className={styles.walletDisplay}>
              <p><PiggyBank size={32} weight="fill"/></p>
              <p>${userProfile.balance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Main Opinion Card */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionHeader}>
            {/*<h1 className={styles.opinionTitle}>💬 Opinion #{id}</h1>*/}
            <div className={styles.badgeContainer}>
              {alreadyOwned && (
                <div className={styles.ownedBadge}>
                  <CheckSquare size={24} weight="fill" />
                  Owned: {ownedQuantity}
                </div>
              )}
              {hasActiveShort && (
                <div className={styles.shortBadge}>
                  📉 Short Active
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.opinionText}>
            <p 
              style={{ 
                fontSize: getAdaptiveFontSize(opinion || ''),
                lineHeight: '1.4',
                wordBreak: 'break-word',
                hyphens: 'auto'
              }}
            >
              {opinion}
            </p>
            <div className={styles.opinionAttribute}>
                {attribution && (
                  <div className={styles.attribution}>
                    <div>{getAuthorDisplay(attribution).name}</div>
                    <div className={styles.attributionMeta}>
                      {attribution.dateCreated}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Active Short Positions Display */}
          {activeShorts.filter(short => short.opinionText === opinion).map(short => (
            <div key={short.id} className={styles.activeShortCard}>
              <div className={styles.shortHeader}>
                <h4>📉 Active Short Position</h4>
                <div className={styles.shortStatus}>
                  Status: <span className={styles.activeStatus}>Active</span>
                </div>
              </div>
              <div className={styles.shortDetails}>
                <div className={styles.shortDetailItem}>
                  <span>Bet Amount:</span>
                  <span>${short.betAmount.toFixed(2)}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Target Drop:</span>
                  <span>{short.targetDropPercentage}%</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Starting Price:</span>
                  <span>${short.startingPrice.toFixed(2)}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Target Price:</span>
                  <span>${short.targetPrice.toFixed(2)}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Potential Winnings:</span>
                  <span className={styles.winnings}>${short.potentialWinnings.toFixed(2)}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Expires:</span>
                  <span>{new Date(short.expirationDate).toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.shortProgress}>
                <div className={styles.progressLabel}>
                  Progress to Target: ${currentPrice.toFixed(2)} → ${short.targetPrice.toFixed(2)}
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, ((short.startingPrice - currentPrice) / (short.startingPrice - short.targetPrice)) * 100))}%`
                    }}
                  />
                </div>
                <div className={styles.progressPercent}>
                  {Math.max(0, Math.min(100, ((short.startingPrice - currentPrice) / (short.startingPrice - short.targetPrice)) * 100)).toFixed(1)}% Complete
                </div>
              </div>
            </div>
          ))}

          {/* Price Chart - keeping the existing implementation */}
          <div className={styles.chartContainer}>
            {/* <h3 className={styles.chartTitle}>📈 Price History Chart</h3> */}
            
            {(() => {
              if (!opinion) return null;
              
              const marketData = getOpinionMarketData(opinion);
              const priceHistory = marketData.priceHistory || [];
              
              let chartData = [];
              if (priceHistory.length > 0) {
                chartData = priceHistory.map(item => ({
                  price: item.price,
                  date: new Date(item.timestamp).toLocaleDateString(),
                  time: new Date(item.timestamp).toLocaleTimeString(),
                  action: item.action
                }));
              } else {
                chartData = [
                  { price: marketData.basePrice, date: 'Start', time: '', action: 'base' },
                  { price: currentPrice, date: 'Now', time: '', action: 'current' }
                ];
              }
              
              if (chartData.length === 0) {
                return (
                  <div className={styles.chartEmpty}>
                    <div>📊</div>
                    <h4>No Trading Data Yet</h4>
                    <p>Chart will appear after first purchase or sale</p>
                  </div>
                );
              }
              
              const prices = chartData.map(d => d.price).filter(p => !isNaN(p) && typeof p === 'number');
              const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
              const maxPrice = prices.length > 0 ? Math.max(...prices) : 10;
              const priceRange = maxPrice - minPrice;
              const firstPrice = prices.length > 0 ? prices[0] : 10;
              const lastPrice = prices.length > 0 ? prices[prices.length - 1] : 10;
              const totalChange = lastPrice - firstPrice;
              const totalChangePercent = firstPrice > 0 ? ((totalChange / firstPrice) * 100) : 0;
              
                                    const maxBarHeight = 150;
                      
                      return (
                        <div>
                          <div className={styles.chartSummary}>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Starting Price</div>
                      <div className={styles.summaryValue}>${!isNaN(firstPrice) ? firstPrice.toFixed(2) : '10.00'}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Current Price</div>
                      <div className={styles.summaryValue}>${!isNaN(lastPrice) ? lastPrice.toFixed(2) : '10.00'}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Total Change</div>
                      <div className={`${styles.summaryValue} ${totalChange >= 0 ? styles.positive : styles.negative}`}>
                        {totalChange >= 0 ? '+' : ''}${!isNaN(totalChange) ? totalChange.toFixed(2) : '0.00'} ({totalChangePercent >= 0 ? '+' : ''}{!isNaN(totalChangePercent) ? totalChangePercent.toFixed(1) : '0.0'}%)
                      </div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Data Points</div>
                      <div className={styles.summaryValue}>{chartData.length}</div>
                    </div>
                  </div>
                  
                  <div className={styles.chartVisual}>
                    {(() => {
                      const chartWidth = 800;
                      const chartHeight = 250;
                      const padding = 40;
                      const innerWidth = chartWidth - (padding * 2);
                      const innerHeight = chartHeight - (padding * 2);
                      
                      // Calculate positions for each data point
                      const dataPoints = chartData.map((point, index) => {
                        const x = padding + (index / Math.max(chartData.length - 1, 1)) * innerWidth;
                        const y = priceRange > 0 && !isNaN(point.price) && !isNaN(minPrice) && !isNaN(priceRange)
                          ? padding + (1 - (point.price - minPrice) / priceRange) * innerHeight
                          : padding + innerHeight / 2;
                        return { 
                          x: isNaN(x) ? padding : x, 
                          y: isNaN(y) ? padding + innerHeight / 2 : y, 
                          price: isNaN(point.price) ? 0 : point.price, 
                          date: point.date || 'Unknown', 
                          time: point.time || '' 
                        };
                      }).filter(point => 
                        typeof point.x === 'number' && 
                        typeof point.y === 'number' && 
                        !isNaN(point.x) && 
                        !isNaN(point.y)
                      );
                      
                      // Create path string for the line
                      const pathData = dataPoints.length > 0 ? dataPoints.map((point, index) => 
                        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                      ).join(' ') : '';
                      
                      // Determine line color based on overall trend
                      const isPositiveTrend = totalChange >= 0;
                      const lineColor = isPositiveTrend ? '#10b981' : '#ef4444';
                      
                      // If no valid data points after filtering, show empty chart
                      if (dataPoints.length === 0) {
                        return (
                          <div className={styles.chartEmpty}>
                            <div>📊</div>
                            <h4>Chart Data Invalid</h4>
                            <p>Refreshing chart data...</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className={styles.lineChart}>
                          <svg 
                            width={chartWidth} 
                            height={chartHeight}
                            className={styles.chartSvg}
                          >
                            {/* Grid lines */}
                            <defs>
                              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3"/>
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                            
                            {/* Y-axis labels */}
                            <text 
                              x={padding - 10} 
                              y={padding + 5} 
                              textAnchor="end" 
                              className={styles.axisLabel}
                            >
                              ${!isNaN(maxPrice) ? maxPrice.toFixed(2) : '0.00'}
                            </text>
                            <text 
                              x={padding - 10} 
                              y={chartHeight - padding + 5} 
                              textAnchor="end" 
                              className={styles.axisLabel}
                            >
                              ${!isNaN(minPrice) ? minPrice.toFixed(2) : '0.00'}
                            </text>
                            
                            {/* Price line */}
                            {pathData && (
                              <path
                                d={pathData}
                                fill="none"
                                stroke={lineColor || '#10b981'}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={styles.priceLine}
                              />
                            )}
                            
                            {/* Data points */}
                            {dataPoints.filter(point => 
                              point && 
                              typeof point.x === 'number' && 
                              typeof point.y === 'number' && 
                              !isNaN(point.x) && 
                              !isNaN(point.y) &&
                              typeof point.price === 'number' &&
                              !isNaN(point.price)
                            ).map((point, index) => (
                              <g key={index}>
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r="4"
                                  fill={lineColor || '#10b981'}
                                  stroke="white"
                                  strokeWidth="2"
                                  className={styles.dataPoint}
                                />
                                
                                {/* Hover tooltip */}
                                <title>
                                  ${point.price.toFixed(2)} - {point.date} {point.time}
                                </title>
                              </g>
                            ))}
                            
                            {/* Current price indicator */}
                            {dataPoints.length > 0 && dataPoints[dataPoints.length - 1] && 
                             typeof dataPoints[dataPoints.length - 1].x === 'number' && 
                             !isNaN(dataPoints[dataPoints.length - 1].x) && 
                             typeof dataPoints[dataPoints.length - 1].price === 'number' && 
                             !isNaN(dataPoints[dataPoints.length - 1].price) && (
                              <g>
                                <line
                                  x1={dataPoints[dataPoints.length - 1].x}
                                  y1={padding}
                                  x2={dataPoints[dataPoints.length - 1].x}
                                  y2={chartHeight - padding}
                                  stroke={lineColor || '#10b981'}
                                  strokeWidth="1"
                                  strokeDasharray="5,5"
                                  opacity="0.6"
                                />
                                <text
                                  x={dataPoints[dataPoints.length - 1].x}
                                  y={padding - 10}
                                  textAnchor="middle"
                                  className={styles.currentPriceLabel}
                                  fill={lineColor || '#10b981'}
                                >
                                  ${dataPoints[dataPoints.length - 1].price.toFixed(2)}
                                </text>
                              </g>
                            )}
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className={styles.chartLegend}>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendColor} ${totalChange >= 0 ? styles.positive : styles.negative}`}></div>
                      <span>{totalChange >= 0 ? 'Positive Trend' : 'Negative Trend'}</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span>•</span>
                      <span>Interactive data points show price and time on hover</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Market Stats */}
          <div className={styles.marketStats}>
            <div className={`${styles.statCard} ${styles.price}`}>

              <h3 className={`${styles.statTitle} ${styles.price}`}>Current Price</h3>
              <p className={styles.statValue}>${currentPrice.toFixed(2)}</p>
              <p className={styles.statSubtext}>Base price: $10.00</p>
            </div>

            <div className={`${styles.statCard} ${styles.trend}`}>
              <h3 className={`${styles.statTitle} ${styles.trend}`}>Market Trend</h3>
              <p className={`${styles.statValue} ${styles[trend.class]}`}>
                {trend.emoji} {trend.text}
              </p>
              <p className={styles.statSubtext}>
                Net demand: {timesPurchased - timesSold}
              </p>
            </div>

            <div 
              className={`${styles.statCard} ${styles.volume} ${styles.clickable}`}
              onClick={() => setShowTraderHistory(true)}
            >
              <h3 className={`${styles.statTitle} ${styles.volume}`}>Trading Volume</h3>
              <p className={styles.statValue}>
                {timesPurchased} buys
              </p>
              <p className={styles.statSubtext}>
                {timesSold} sells
              </p>
              <p className={styles.clickHint}>Click to view trader history</p>
            </div>

            {alreadyOwned && (
              <div className={`${styles.statCard} ${styles.sell}`}>

                <h3 className={`${styles.statTitle} ${styles.sell}`}>Sell Price</h3>
                <p className={styles.statValue}>${sellPrice.toFixed(2)}</p>

                <div className={styles.marketConditions}>
                  {(() => {
                    const userPurchasePrice = getUserPurchasePrice(opinion || '');
                    
                    return (
                      <>
                        <p className={styles.statSubtext}>
                          Purchase: ${userPurchasePrice.toFixed(2)} | Market: ${currentPrice.toFixed(2)} | Sell: ${sellPrice.toFixed(2)}
                        </p>
                        <p className={styles.liquidityInfo}>
                          {sellPrice > userPurchasePrice 
                            ? `🎉 Profit potential: +${(sellPrice - userPurchasePrice).toFixed(2)}`
                            : sellPrice === userPurchasePrice 
                            ? `📊 Break even - no profit or loss`
                            : `📉 Loss: -${(userPurchasePrice - sellPrice).toFixed(2)} (5% transaction cost + small market moves)`
                          }
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Short Bet Modal */}
          {showShortModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.shortModal}>
              <div className={styles.modalHeader}>
                <h3>Short Bet Configuration</h3>
                <button 
                  onClick={() => setShowShortModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <p className={styles.shortExplanation}>
                  ⚠️ <strong>EXTREME RISK:</strong> Bet that this opinion's price will drop by your target percentage within the time limit. 
                  <br/><strong>PENALTIES:</strong> 
                  <br/>• If time expires → owe 100x current market price!
                  <br/>• If you sell shares early → must buy {shortSettings.targetDropPercentage} units at current price!
                  <br/>• Only way to avoid penalties: reach target price in time!
                  <br/><strong>NEW:</strong> You can now bet on any price drop from 1% to 100% (complete crash to $0.00)!
                </p>
                
                <div className={styles.shortSettings}>
                  <div className={styles.settingGroup}>
                    <label>Bet Amount ($)</label>
                    <input
                      type="number"
                      min="10"
                      max={userProfile.balance}
                      value={shortSettings.betAmount}
                      onChange={(e) => setShortSettings({
                        ...shortSettings,
                        betAmount: Math.max(10, Math.min(userProfile.balance, parseInt(e.target.value) || 10))
                      })}
                      className={styles.settingInput}
                    />
                    <span className={styles.settingHint}>Available: ${userProfile.balance.toFixed(2)}</span>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <label>Target Price Drop (%)</label>
                    <div className={styles.percentageInputContainer}>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={shortSettings.targetDropPercentage}
                        onChange={(e) => setShortSettings({
                          ...shortSettings,
                          targetDropPercentage: parseInt(e.target.value)
                        })}
                        className={styles.settingSlider}
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={shortSettings.targetDropPercentage}
                        onChange={(e) => {
                          const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                          setShortSettings({
                            ...shortSettings,
                            targetDropPercentage: value
                          });
                        }}
                        className={styles.percentageInput}
                        placeholder="%"
                      />
                    </div>
                    <div className={styles.sliderValue}>
                      {shortSettings.targetDropPercentage}% 
                      (${currentPrice.toFixed(2)} → ${(currentPrice * (1 - shortSettings.targetDropPercentage / 100)).toFixed(2)})
                    </div>
                    <div className={styles.percentageHint}>
                      1% = Easy target, low reward • 50% = Moderate target • 100% = Price goes to $0.00, extreme reward
                    </div>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <label>Time Limit (hours)</label>
                    <select
                      value={shortSettings.timeLimit}
                      onChange={(e) => setShortSettings({
                        ...shortSettings,
                        timeLimit: parseInt(e.target.value)
                      })}
                      className={styles.settingSelect}
                    >
                      <option value={1}>1 hour (High Risk)</option>
                      <option value={6}>6 hours (Medium-High Risk)</option>
                      <option value={12}>12 hours (Medium Risk)</option>
                      <option value={24}>24 hours (Standard)</option>
                      <option value={48}>48 hours (Low Risk)</option>
                      <option value={72}>72 hours (Very Low Risk)</option>
                    </select>
                  </div>
                </div>
                
                <div className={styles.betSummary}>
                  <div className={styles.summaryHeader}>
                    <h4>📊 Bet Summary</h4>
                  </div>
                  <div className={styles.summaryDetails}>
                    <div className={styles.summaryRow}>
                      <span>Current Price:</span>
                      <span>${currentPrice.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Target Price:</span>
                      <span>${(currentPrice * (1 - shortSettings.targetDropPercentage / 100)).toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Bet Amount:</span>
                      <span>-${shortSettings.betAmount.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Potential Winnings:</span>
                      <span className={styles.winnings}>
                        +${calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Multiplier:</span>
                      <span>{(calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit) / shortSettings.betAmount).toFixed(2)}x</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Early Exit Penalty:</span>
                      <span className={styles.penalty}>
                        -${(shortSettings.targetDropPercentage * currentPrice).toFixed(2)} ({shortSettings.targetDropPercentage} units × ${currentPrice.toFixed(2)})
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Expiration Penalty:</span>
                      <span className={styles.penalty}>
                        -${(currentPrice * 100).toFixed(2)} (100x current price)
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Expires:</span>
                      <span>
                        {new Date(Date.now() + shortSettings.timeLimit * 60 * 60 * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.modalActions}>
                  <button
                    onClick={() => setShowShortModal(false)}
                    className={`${styles.modalButton} ${styles.cancel}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={placeShortBet}
                    disabled={userProfile.balance < shortSettings.betAmount}
                    className={`${styles.modalButton} ${styles.confirm}`}
                  >
                    {userProfile.balance < shortSettings.betAmount 
                      ? 'Insufficient Funds' 
                      : `Place Short Bet (${shortSettings.betAmount.toFixed(2)})`
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trader History Modal */}
        {showTraderHistory && (
          <div className={styles.modalOverlay}>
            <div className={styles.traderHistoryModal}>
              <div className={styles.modalHeader}>
                <h3>📊 Trader History</h3>
                <button 
                  onClick={() => setShowTraderHistory(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <p className={styles.historyExplanation}>
                  Complete trading history for this opinion, showing all buy and sell transactions in chronological order.
                </p>
                
                <div className={styles.historyList}>
                  {(() => {
                    const traderHistory = getTraderHistory();
                    
                    if (traderHistory.length === 0) {
                      return (
                        <div className={styles.noHistory}>
                          <div>📈</div>
                          <h4>No Trading History Yet</h4>
                          <p>Trading history will appear after the first buy or sell transaction.</p>
                        </div>
                      );
                    }
                    
                    return traderHistory.map((trade, index) => (
                      <div key={index} className={styles.tradeItem}>
                        <div className={styles.tradeHeader}>
                          <div className={styles.traderInfo}>
                            <span className={`${styles.traderName} ${trade.isBot ? styles.botTrader : styles.humanTrader}`}>
                              {trade.isBot ? '🤖' : '👤'} {trade.traderName}
                            </span>
                            <span className={styles.tradeDate}>{trade.date}</span>
                          </div>
                          <div className={`${styles.tradeAction} ${styles[trade.action]}`}>
                            {trade.action.toUpperCase()}
                          </div>
                        </div>
                        
                        <div className={styles.tradeDetails}>
                          <div className={styles.tradeDetailItem}>
                            <span>Price:</span>
                            <span className={styles.tradePrice}>${trade.price.toFixed(2)}</span>
                          </div>
                          <div className={styles.tradeDetailItem}>
                            <span>Quantity:</span>
                            <span>{trade.quantity}</span>
                          </div>
                          <div className={styles.tradeDetailItem}>
                            <span>Total:</span>
                            <span className={styles.tradeTotal}>
                              ${(trade.price * trade.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                
                <div className={styles.historyStats}>
                  <div className={styles.statItem}>
                    <span>Total Trades:</span>
                    <span>{getTraderHistory().length}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>Unique Traders:</span>
                    <span>{new Set(getTraderHistory().map(t => t.traderName)).size}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>Bot Trades:</span>
                    <span>{getTraderHistory().filter(t => t.isBot).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Trading Info */}
        <div className={styles.tradingInfo}>
          <Accordion title="How Betting Works">
            <div className={styles.tradingInfoGrid}>
              <div className={styles.tradingInfoSection}>
                <strong>Ultra-Micro Market Movements</strong>
                <ul>
                  <li>Each purchase increases price by ~0.1% (prevents arbitrage completely)</li>
                  <li>Sell price = 95% of current market price</li>
                  <li>Ultra-tiny price jumps make instant arbitrage impossible</li>
                  <li>Need massive trading volume to create profit opportunities</li>
                  <li>Market movements are now 10× smaller than before</li>
                </ul>
              </div>

              <div className={styles.tradingInfoSection}>
                <strong>Short Position Penalties</strong>
                <ul>
                  <li><strong>WIN:</strong> Target reached in time → earn potential winnings</li>
                  <li><strong>EARLY EXIT:</strong> Sell shares → buy X units at current price (X = target %)</li>
                  <li><strong>EXPIRE:</strong> Time runs out → pay 100× current market price !</li>
                  <li>Example: 20% drop bet, exit early at $15 → buy 20 units = $300 penalty</li>
                </ul>
              </div>
            </div>
          </Accordion>
        </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>

          {/* Status Messages */}
        {message && (
          <div className={`${styles.statusMessage} ${styles[getMessageClass(message)]}`}>
            {message}
          </div>
        )}

            {!alreadyOwned || ownedQuantity === 0 ? (
              <button
                onClick={purchaseOpinion}
                disabled={userProfile.balance < currentPrice || hasActiveShort}
                className={`${styles.actionButton} ${styles.buy}`}
              >
                {hasActiveShort 
                  ? 'Cannot Buy (Active Short)'
                  : userProfile.balance < currentPrice 
                  ? `Need ${(currentPrice - userProfile.balance).toFixed(2)} more`
                  : `Buy for ${currentPrice.toFixed(2)}`
                }
              </button>
            ) : (
              <>
                <button
                  onClick={purchaseOpinion}
                  disabled={userProfile.balance < currentPrice || hasActiveShort}
                  className={`${styles.actionButton} ${styles.buyMore}`}
                >
                  {hasActiveShort 
                    ? 'Cannot Buy (Active Short)'
                    : userProfile.balance < currentPrice 
                    ? `Need ${(currentPrice - userProfile.balance).toFixed(2)} more`
                    : `Buy More (${currentPrice.toFixed(2)})`
                  }
                </button>
                
                <button
                  onClick={sellOpinion}
                  className={`${styles.actionButton} ${styles.sell}`}
                >
                  Sell 1 for ${sellPrice.toFixed(2)}
                </button>
              </>
            )}
            
            {/* Short Bet Button */}
            <button
              onClick={() => setShowShortModal(true)}
              disabled={hasActiveShort || ownedQuantity > 0}
              className={`${styles.actionButton} ${styles.short}`}
            >
              {hasActiveShort ? 'Short Active' : 
               ownedQuantity > 0 ? 'Own Shares (Can\'t Short)' : 
               <div className={`${styles.shortText}`}><Ticket size={18} weight="fill" /> Short</div>}
            </button>
          </div>
        </div>
        
      </main>
    </div>
  );
}