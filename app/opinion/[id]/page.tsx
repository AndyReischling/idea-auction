'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
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
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet_win' | 'bet_loss' | 'bet_place' | 'short_win' | 'short_loss' | 'short_place';
  opinionId?: string;
  opinionText?: string;
  betId?: string;
  shortId?: string;
  amount: number;
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
  volatility: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' }[];
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
  const [currentPrice, setCurrentPrice] = useState<number>(10);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [timesPurchased, setTimesPurchased] = useState<number>(0);
  const [timesSold, setTimesSold] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [alreadyOwned, setAlreadyOwned] = useState<boolean>(false);
  const [ownedQuantity, setOwnedQuantity] = useState<number>(0);
  const [attribution, setAttribution] = useState<OpinionAttribution | null>(null);
  
  // Short betting states
  const [showShortModal, setShowShortModal] = useState<boolean>(false);
  const [shortSettings, setShortSettings] = useState<ShortBetSettings>({
    betAmount: 100,
    targetDropPercentage: 10,
    timeLimit: 24
  });
  const [activeShorts, setActiveShorts] = useState<ShortPosition[]>([]);
  const [hasActiveShort, setHasActiveShort] = useState<boolean>(false);

  // Helper function to safely access localStorage
  const getFromStorage = (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key ${key}:`, error);
      return defaultValue;
    }
  };

  // Helper function to safely set localStorage
  const setToStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  };

  // Get attribution for an opinion
  const getOpinionAttribution = (opinionText: string, opinionIndex: number): OpinionAttribution => {
    try {
      const attributions = getFromStorage('opinionAttributions', {});
      
      if (attributions[opinionText]) {
        return attributions[opinionText];
      }
      
      const botTransactions = getFromStorage('botTransactions', []);
      const botGenerated = botTransactions.find((t: any) => 
        t.type === 'earn' && t.opinionText === opinionText
      );
      
      if (botGenerated) {
        const bots = getFromStorage('autonomousBots', []);
        const bot = bots.find((b: any) => b.id === botGenerated.botId);
        
        return {
          author: bot ? bot.username : 'AI Bot',
          isBot: true,
          dateCreated: botGenerated.date || new Date().toLocaleDateString(),
          source: 'bot_generated'
        };
      }
      
      const transactions = getFromStorage('transactions', []);
      const aiGenerated = transactions.find((t: any) => 
        t.type === 'earn' && 
        (t.opinionText === opinionText || t.description?.includes(opinionText.slice(0, 30)))
      );
      
      if (aiGenerated) {
        const currentUser = getFromStorage('userProfile', {});
        return {
          author: currentUser.username || 'OpinionTrader123',
          isBot: false,
          dateCreated: aiGenerated.date || new Date().toLocaleDateString(),
          source: 'ai_generated'
        };
      }
      
      const currentUser = getFromStorage('userProfile', {});
      return {
        author: currentUser.username || 'OpinionTrader123',
        isBot: false,
        dateCreated: new Date().toLocaleDateString(),
        source: 'user'
      };
      
    } catch (error) {
      console.error('Error getting opinion attribution:', error);
      const currentUser = getFromStorage('userProfile', {});
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
    try {
      const attributions = getFromStorage('opinionAttributions', {});
      attributions[opinionText] = attribution;
      setToStorage('opinionAttributions', attributions);
    } catch (error) {
      console.error('Error saving opinion attribution:', error);
    }
  };

  // UPDATED: Enhanced pricing algorithm with ultra-micro movements (0.1% per purchase) - precise decimals
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10, volatility: number = 1): number => {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // CHANGED: Ultra-micro multiplier: 1.001 (0.1% per purchase) to prevent arbitrage completely
      priceMultiplier = Math.pow(1.001, netDemand) * volatility;
    } else {
      // CHANGED: Ultra-small decline: 0.999 (0.1% decrease per sale)
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand))) * volatility;
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // Return precise decimal (rounded to 2 decimal places for currency)
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Calculate user's recent trading dominance
  const calculateUserDominance = (opinion: string, userTradeHistory?: any[]): number => {
    try {
      const recentTrades = getFromStorage('recentTradeActivity', {});
      const opinionTrades = recentTrades[opinion] || [];
      const userTrades = opinionTrades.filter((trade: any) => trade.isCurrentUser);
      
      return opinionTrades.length > 0 ? userTrades.length / opinionTrades.length : 0;
    } catch {
      return 0;
    }
  };

  // Track rapid trading for manipulation detection
  const getRapidTradeCount = (opinion: string, timeWindowMinutes: number): number => {
    try {
      const rapidTrades = getFromStorage('rapidTrades', {});
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

  // Calculate sell price - Simple: always 95% of current market price (precise decimals)
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
    try {
      // Track recent trade activity
      const recentTrades = getFromStorage('recentTradeActivity', {});
      if (!recentTrades[opinion]) recentTrades[opinion] = [];
      
      recentTrades[opinion].push({
        action,
        price,
        timestamp: Date.now(),
        isCurrentUser
      });
      
      // Keep only last 20 trades per opinion
      recentTrades[opinion] = recentTrades[opinion].slice(-20);
      setToStorage('recentTradeActivity', recentTrades);
      
      // Track rapid trades
      const rapidTrades = getFromStorage('rapidTrades', {});
      if (!rapidTrades[opinion]) rapidTrades[opinion] = [];
      
      rapidTrades[opinion].push(Date.now());
      
      // Keep only trades from last 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      rapidTrades[opinion] = rapidTrades[opinion].filter((timestamp: number) => timestamp > twoHoursAgo);
      
      setToStorage('rapidTrades', rapidTrades);
    } catch (error) {
      console.error('Error tracking trade activity:', error);
    }
  };

  // Calculate daily trading volume
  const calculateDailyVolume = (opinionText: string): number => {
    try {
      const marketData = getFromStorage('opinionMarketData', {});
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

  // Calculate opinion volatility based on content
  const calculateVolatility = (opinionText: string): number => {
    const text = opinionText.toLowerCase();
    let volatility = 1.0;
    
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('stock')) volatility += 0.5;
    if (text.includes('controversial') || text.includes('hot take') || text.includes('unpopular')) volatility += 0.3;
    if (text.includes('prediction') || text.includes('will') || text.includes('future')) volatility += 0.2;
    if (text.includes('politics') || text.includes('election')) volatility += 0.4;
    
    if (text.includes('safe') || text.includes('boring') || text.includes('obvious')) volatility -= 0.2;
    if (text.includes('traditional') || text.includes('conservative')) volatility -= 0.1;
    
    return Math.max(0.5, Math.min(2.0, volatility));
  };

  // Get market data for an opinion
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    const marketData = getFromStorage('opinionMarketData', {});
    
    if (marketData[opinionText]) {
      const data = marketData[opinionText];
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
      const basePrice = 10;
      const volatility = calculateVolatility(opinionText);
      
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: basePrice,
        basePrice,
        volatility,
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
  };

  // Update market data for an opinion with realistic tracking
  const updateOpinionMarketDataRealistic = (opinionText: string, action: 'buy' | 'sell'): OpinionMarketData => {
    const marketData = getFromStorage('opinionMarketData', {});
    const currentData = getOpinionMarketData(opinionText);
    
    const newTimesPurchased = action === 'buy' ? currentData.timesPurchased + 1 : currentData.timesPurchased;
    const newTimesSold = action === 'sell' ? currentData.timesSold + 1 : currentData.timesSold;
    const newPrice = calculatePrice(newTimesPurchased, newTimesSold, currentData.basePrice, currentData.volatility);
    
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
    setToStorage('opinionMarketData', marketData);
    
    // Track this trade
    trackTradeActivity(opinionText, action, newPrice, true);
    
    return updatedData;
  };

  // Calculate potential winnings for short bet
  const calculateShortWinnings = (betAmount: number, targetDropPercentage: number, timeLimit: number): number => {
    // Base multiplier based on drop percentage (higher drop = higher risk = higher reward)
    const dropMultiplier = 1 + (targetDropPercentage / 100) * 2;
    
    // Time multiplier (shorter time = higher risk = higher reward)
    const timeMultiplier = timeLimit <= 6 ? 2.5 : timeLimit <= 12 ? 2.0 : timeLimit <= 24 ? 1.5 : 1.0;
    
    // Market volatility factor (more volatile = easier to achieve drops)
    const volatilityFactor = opinion ? calculateVolatility(opinion) : 1.0;
    const volatilityMultiplier = 2.0 - (volatilityFactor - 0.5); // Lower volatility = higher multiplier
    
    const totalMultiplier = dropMultiplier * timeMultiplier * volatilityMultiplier;
    
    return Math.round(betAmount * totalMultiplier);
  };

  // Load short positions
  const loadShortPositions = () => {
    try {
      const storedShorts = getFromStorage('shortPositions', null);
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
    if (!opinion) return;
    
    try {
      const storedShorts = getFromStorage('shortPositions', null);
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
          setToStorage('userProfile', updatedProfile);
          
          // Add penalty transaction
          const penaltyTransaction: Transaction = {
            id: Date.now().toString(),
            type: 'short_loss',
            shortId: short.id,
            opinionText: short.opinionText.length > 50 ? short.opinionText.slice(0, 50) + '...' : short.opinionText,
            amount: -penalty,
            date: new Date().toLocaleDateString()
          };
          
          const existingTransactions = getFromStorage('transactions', []);
          const updatedTransactions = [penaltyTransaction, ...existingTransactions.slice(0, 9)];
          setToStorage('transactions', updatedTransactions);
          
          setMessage(`💀 Short bet expired! Penalty: $${penalty.toFixed(2)} (100x current price of $${currentMarketData.currentPrice})`);
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
          setToStorage('userProfile', updatedProfile);
          
          // Add transaction
          const newTransaction: Transaction = {
            id: Date.now().toString(),
            type: 'short_win',
            shortId: short.id,
            opinionText: short.opinionText.length > 50 ? short.opinionText.slice(0, 50) + '...' : short.opinionText,
            amount: short.potentialWinnings,
            date: new Date().toLocaleDateString()
          };
          
          const existingTransactions = getFromStorage('transactions', []);
          const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
          setToStorage('transactions', updatedTransactions);
          
          setMessage(`🎉 Short bet won! Earned $${short.potentialWinnings}!`);
          setTimeout(() => setMessage(''), 7000);
          
          return { ...short, status: 'won' as const };
        }
        
        return short;
      });
      
      if (updated) {
        setToStorage('shortPositions', updatedShorts);
        loadShortPositions();
      }
    } catch (error) {
      console.error('Error checking short positions:', error);
    }
  };

  // Place short bet
  const placeShortBet = () => {
    if (!opinion || userProfile.balance < shortSettings.betAmount) {
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
    setToStorage('userProfile', updatedProfile);
    
    // Save short position
    const existingShorts = getFromStorage('shortPositions', []);
    const updatedShorts = [...existingShorts, newShort];
    setToStorage('shortPositions', updatedShorts);
    
    // Add transaction
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'short_place',
      shortId: newShort.id,
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: -shortSettings.betAmount,
      date: new Date().toLocaleDateString()
    };
    
    const existingTransactions = getFromStorage('transactions', []);
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    setToStorage('transactions', updatedTransactions);
    
    setHasActiveShort(true);
    setShowShortModal(false);
    loadShortPositions();
    
    setMessage(`📉 Short bet placed! You'll win $${potentialWinnings} if price drops to $${targetPrice} within ${shortSettings.timeLimit} hours.`);
    setTimeout(() => setMessage(''), 10000);
  };

  // Update all owned opinions with new market prices
  const updateOwnedOpinionPrices = () => {
    const storedAssets = getFromStorage('ownedOpinions', null);
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
    setToStorage('ownedOpinions', updatedOwned);
  };

  useEffect(() => {
    if (typeof id !== 'string') {
      setOpinion('Opinion not found.');
      return;
    }

    try {
      const stored = getFromStorage('opinions', null);
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
        const storedAssets = getFromStorage('ownedOpinions', null);
        let ownedAsset = null;
        if (storedAssets) {
          const owned = storedAssets;
          ownedAsset = owned.find((asset: OpinionAsset) => asset.text === currentOpinion);
        }
        
        console.log(`DEBUG initial load: ownedAsset =`, ownedAsset);
        const initialSellPrice = calculateSellPrice(marketData.currentPrice, ownedAsset?.purchasePrice);
        console.log(`DEBUG initial load: calculated sell price = ${initialSellPrice}`);
        setSellPrice(initialSellPrice);
        setTimesPurchased(marketData.timesPurchased);
        setTimesSold(marketData.timesSold);
      } else {
        setOpinion('Opinion not found.');
      }

      const storedProfile = getFromStorage('userProfile', null);
      if (storedProfile) {
        setUserProfile(storedProfile);
      }

      updateOwnedOpinionPrices();
      
      const storedAssets = getFromStorage('ownedOpinions', null);
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
  }, [id]);

  // Check short positions periodically
  useEffect(() => {
    if (opinion) {
      checkShortPositions();
      const interval = setInterval(checkShortPositions, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [opinion, currentPrice]);

  // Update sell price whenever current price changes
  useEffect(() => {
    console.log(`DEBUG useEffect: alreadyOwned=${alreadyOwned}, currentPrice=${currentPrice}, opinion="${opinion}"`);
    if (alreadyOwned && currentPrice > 0 && opinion) {
      const userPurchasePrice = getUserPurchasePrice(opinion);
      console.log(`DEBUG useEffect: calling calculateSellPrice(${currentPrice}, ${userPurchasePrice})`);
      const newSellPrice = calculateSellPrice(currentPrice, userPurchasePrice);
      console.log(`DEBUG useEffect: calculated sell price = ${newSellPrice}`);
      setSellPrice(newSellPrice);
    }
  }, [currentPrice, alreadyOwned, opinion, ownedOpinions]); // Added ownedOpinions dependency

  const purchaseOpinion = () => {
    if (!opinion) return;

    if (userProfile.balance < currentPrice) {
      setMessage('Insufficient funds! Generate more opinions to earn money.');
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
      setToStorage('ownedOpinions', updatedOwnedOpinions);
    } else {
      const newAsset: OpinionAsset = {
        id: Date.now().toString(),
        text: opinion,
        purchasePrice: currentPrice,
        currentPrice: updatedMarketData.currentPrice,
        purchaseDate: new Date().toLocaleDateString(),
        quantity: 1
      };

      const updatedOwnedOpinions = [...ownedOpinions, newAsset];
      setOwnedOpinions(updatedOwnedOpinions);
      setToStorage('ownedOpinions', updatedOwnedOpinions);
      setAlreadyOwned(true);
      setOwnedQuantity(1);
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'buy',
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: -currentPrice,
      date: new Date().toLocaleDateString()
    };

    updateOwnedOpinionPrices();

    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance - currentPrice
    };
    setUserProfile(updatedProfile);
    setToStorage('userProfile', updatedProfile);

    const existingTransactions = getFromStorage('transactions', []);
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    setToStorage('transactions', updatedTransactions);

    const oldPrice = currentPrice;
    setCurrentPrice(updatedMarketData.currentPrice);
    
    // Update sell price based on new market price (simple 95% calculation)
    setSellPrice(calculateSellPrice(updatedMarketData.currentPrice));
    setTimesPurchased(updatedMarketData.timesPurchased);
    
    setMessage(`Successfully purchased! Price: ${oldPrice} → ${updatedMarketData.currentPrice}. You can sell for: ${calculateSellPrice(updatedMarketData.currentPrice)}`);
    setTimeout(() => setMessage(''), 7000);
  };

  const sellOpinion = () => {
    if (!opinion || !alreadyOwned || ownedQuantity === 0) return;

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
      setToStorage('userProfile', updatedProfile);
      
      // Mark short as lost and add penalty transaction
      const updatedShorts = activeShorts.map(short => 
        short.id === activeShort.id ? { ...short, status: 'lost' as const } : short
      );
      setActiveShorts(updatedShorts);
      
      const allShorts = getFromStorage('shortPositions', []);
      const updatedAllShorts = allShorts.map((short: ShortPosition) => 
        short.id === activeShort.id ? { ...short, status: 'lost' as const } : short
      );
      setToStorage('shortPositions', updatedAllShorts);
      
      // Add penalty transaction
      const penaltyTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'short_loss',
        shortId: activeShort.id,
        opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
        amount: -totalPenaltyCost,
        date: new Date().toLocaleDateString()
      };
      
      const existingTransactions = getFromStorage('transactions', []);
      setToStorage('transactions', [penaltyTransaction, ...existingTransactions.slice(0, 9)]);
      
      setHasActiveShort(false);
      
      setMessage(`⚠️ Short position cancelled! Must buy ${unitsToBuy} units at $${costPerUnit.toFixed(2)} each = $${totalPenaltyCost.toFixed(2)} penalty for early exit.`);
      setTimeout(() => setMessage(''), 10000);
    }

    // Get the actual sell price based on current market price
    const actualSellPrice = calculateSellPrice(currentPrice);

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
    setToStorage('ownedOpinions', updatedOwnedOpinions);

    const newQuantity = ownedQuantity - 1;
    setOwnedQuantity(newQuantity);
    if (newQuantity === 0) {
      setAlreadyOwned(false);
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'sell',
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: actualSellPrice,
      date: new Date().toLocaleDateString()
    };

    updateOwnedOpinionPrices();

    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance + actualSellPrice,
      totalEarnings: userProfile.totalEarnings + actualSellPrice
    };
    setUserProfile(updatedProfile);
    setToStorage('userProfile', updatedProfile);

    const existingTransactions = getFromStorage('transactions', []);
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    setToStorage('transactions', updatedTransactions);

    const oldPrice = currentPrice;
    setCurrentPrice(updatedMarketData.currentPrice);
    
    // Update sell price for remaining shares (if any)
    if (newQuantity > 0) {
      setSellPrice(calculateSellPrice(updatedMarketData.currentPrice));
    }
    setTimesSold(updatedMarketData.timesSold);
    
    const userPurchasePrice = getUserPurchasePrice(opinion);
    const profitLoss = actualSellPrice - userPurchasePrice;
    const profitMessage = profitLoss > 0 ? `📈 Profit: +${profitLoss.toFixed(2)}` : profitLoss < 0 ? `📉 Loss: ${Math.abs(profitLoss).toFixed(2)}` : '📊 Break even';
    
    const baseMessage = `Sold for ${actualSellPrice}! ${profitMessage} (Bought at ${userPurchasePrice}). Market: ${oldPrice} → ${updatedMarketData.currentPrice}`;
    
    if (!activeShort) {
      setMessage(baseMessage);
      setTimeout(() => setMessage(''), 7000);
    }
    // If there was an active short, the penalty message was already set above
  };

  const getMarketTrend = () => {
    const netDemand = timesPurchased - timesSold;
    if (netDemand > 5) return { emoji: '🚀', text: 'Bullish', color: 'bullish', class: 'bullish' };
    if (netDemand > 2) return { emoji: '📈', text: 'Rising', color: 'bullish', class: 'bullish' };
    if (netDemand > -2) return { emoji: '➡️', text: 'Stable', color: 'stable', class: 'stable' };
    if (netDemand > -5) return { emoji: '📉', text: 'Declining', color: 'bearish', class: 'bearish' };
    return { emoji: '💀', text: 'Bearish', color: 'bearish', class: 'bearish' };
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
            ← Back to Profile
          </button>

          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders">
              📊 View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              📡 Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
              ✨ Generate
            </a>

            <div className={styles.walletDisplay}>
              <p>💰 Wallet</p>
              <p>${userProfile.balance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Main Opinion Card */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionHeader}>
            <h1 className={styles.opinionTitle}>💬 Opinion #{id}</h1>
            <div className={styles.badgeContainer}>
              {alreadyOwned && (
                <div className={styles.ownedBadge}>
                  ✅ Owned: {ownedQuantity}
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
            <p>"{opinion}"</p>
          </div>

          {/* Attribution Section */}
          {attribution && (
            <div className={styles.attributionSection}>
              <div className={`${styles.attributionCard} ${styles[getAuthorDisplay(attribution).class]}`}>
                <div className={styles.attributionIcon}>
                  {getAuthorDisplay(attribution).icon}
                </div>
                <div className={styles.attributionDetails}>
                  <div className={styles.attributionAuthor}>
                    {getAuthorDisplay(attribution).name}
                  </div>
                  <div className={styles.attributionMeta}>
                    {getAuthorDisplay(attribution).description} • Created {attribution.dateCreated}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  <span>${short.betAmount}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Target Drop:</span>
                  <span>{short.targetDropPercentage}%</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Starting Price:</span>
                  <span>${short.startingPrice}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Target Price:</span>
                  <span>${short.targetPrice}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Potential Winnings:</span>
                  <span className={styles.winnings}>${short.potentialWinnings}</span>
                </div>
                <div className={styles.shortDetailItem}>
                  <span>Expires:</span>
                  <span>{new Date(short.expirationDate).toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.shortProgress}>
                <div className={styles.progressLabel}>
                  Progress to Target: ${currentPrice} → ${short.targetPrice}
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

          {/* Price Chart */}
          <div className={styles.chartContainer}>
            <h3 className={styles.chartTitle}>📈 Price History Chart</h3>
            
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
              
              const prices = chartData.map(d => d.price);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const priceRange = maxPrice - minPrice;
              const firstPrice = prices[0];
              const lastPrice = prices[prices.length - 1];
              const totalChange = lastPrice - firstPrice;
              const totalChangePercent = firstPrice > 0 ? ((totalChange / firstPrice) * 100) : 0;
              
              const maxBarHeight = 150;
              
              return (
                <div>
                  <div className={styles.chartSummary}>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Starting Price</div>
                      <div className={styles.summaryValue}>${firstPrice}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Current Price</div>
                      <div className={styles.summaryValue}>${lastPrice}</div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Total Change</div>
                      <div className={`${styles.summaryValue} ${totalChange >= 0 ? styles.positive : styles.negative}`}>
                        {totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)} ({totalChangePercent >= 0 ? '+' : ''}{totalChangePercent.toFixed(1)}%)
                      </div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryLabel}>Data Points</div>
                      <div className={styles.summaryValue}>{chartData.length}</div>
                    </div>
                  </div>
                  
                  <div className={styles.chartVisual}>
                    <div className={`${styles.yAxisLabel} ${styles.top}`}>
                      ${maxPrice}
                    </div>
                    <div className={`${styles.yAxisLabel} ${styles.bottom}`}>
                      ${minPrice}
                    </div>
                    
                    {chartData.map((dataPoint, index) => {
                      const barHeight = priceRange > 0 
                        ? ((dataPoint.price - minPrice) / priceRange) * maxBarHeight 
                        : maxBarHeight / 2;
                      const isIncrease = index === 0 || dataPoint.price >= chartData[index - 1].price;
                      
                      return (
                        <div key={index} className={styles.chartBar}>
                          <div className={`${styles.barLabel} ${isIncrease ? styles.positive : styles.negative}`}>
                            ${dataPoint.price}
                          </div>
                          
                          <div
                            className={`${styles.bar} ${isIncrease ? styles.positive : styles.negative}`}
                            style={{ height: `${barHeight}px` }}
                            title={`${dataPoint.price} - ${dataPoint.date} ${dataPoint.time}`}
                          />
                          
                          <div className={styles.barDate}>
                            {dataPoint.date}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className={styles.chartLegend}>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendColor} ${styles.positive}`}></div>
                      <span>Price Increase</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={`${styles.legendColor} ${styles.negative}`}></div>
                      <span>Price Decrease</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Market Stats */}
          <div className={styles.marketStats}>
            <div className={`${styles.statCard} ${styles.price}`}>
              <h3 className={`${styles.statTitle} ${styles.price}`}>💰 Current Price</h3>
              <p className={styles.statValue}>${currentPrice}</p>
              <p className={styles.statSubtext}>Base price: $10</p>
            </div>

            <div className={`${styles.statCard} ${styles.trend}`}>
              <h3 className={`${styles.statTitle} ${styles.trend}`}>📊 Market Trend</h3>
              <p className={`${styles.statValue} ${styles[trend.class]}`}>
                {trend.emoji} {trend.text}
              </p>
              <p className={styles.statSubtext}>
                Net demand: {timesPurchased - timesSold}
              </p>
            </div>

            <div className={`${styles.statCard} ${styles.volume}`}>
              <h3 className={`${styles.statTitle} ${styles.volume}`}>🔄 Trading Volume</h3>
              <p className={styles.statValue}>
                {timesPurchased} buys
              </p>
              <p className={styles.statSubtext}>
                {timesSold} sells
              </p>
            </div>

            {alreadyOwned && (
              <div className={`${styles.statCard} ${styles.sell}`}>
                <h3 className={`${styles.statTitle} ${styles.sell}`}>💸 Sell Price</h3>
                <p className={styles.statValue}>${sellPrice}</p>
                <div className={styles.marketConditions}>
                  {(() => {
                    const userPurchasePrice = getUserPurchasePrice(opinion || '');
                    
                    return (
                      <>
                        <p className={styles.statSubtext}>
                          Purchase: ${userPurchasePrice} | Market: ${currentPrice} | Sell: ${sellPrice}
                        </p>
                        <p className={styles.liquidityInfo}>
                          {sellPrice > userPurchasePrice 
                            ? `🎉 Profit potential: +$${(sellPrice - userPurchasePrice).toFixed(2)}`
                            : sellPrice === userPurchasePrice 
                            ? `📊 Break even - no profit or loss`
                            : `📉 Loss: -$${(userPurchasePrice - sellPrice).toFixed(2)} (5% transaction cost + small market moves)`
                          }
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            {!alreadyOwned || ownedQuantity === 0 ? (
              <button
                onClick={purchaseOpinion}
                disabled={userProfile.balance < currentPrice}
                className={`${styles.actionButton} ${styles.buy}`}
              >
                {userProfile.balance < currentPrice 
                  ? `Need $${currentPrice - userProfile.balance} more`
                  : `Buy for $${currentPrice}`
                }
              </button>
            ) : (
              <>
                <button
                  onClick={purchaseOpinion}
                  disabled={userProfile.balance < currentPrice}
                  className={`${styles.actionButton} ${styles.buyMore}`}
                >
                  {userProfile.balance < currentPrice 
                    ? `Need $${currentPrice - userProfile.balance} more`
                    : `Buy More ($${currentPrice})`
                  }
                </button>
                
                <button
                  onClick={sellOpinion}
                  className={`${styles.actionButton} ${styles.sell}`}
                >
                  Sell 1 for ${sellPrice}
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
               '📉 Short'}
            </button>
          </div>
        </div>

        {/* Short Bet Modal */}
        {showShortModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.shortModal}>
              <div className={styles.modalHeader}>
                <h3>📉 Short Bet Configuration</h3>
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
                    <span className={styles.settingHint}>Available: ${userProfile.balance}</span>
                  </div>
                  
                  <div className={styles.settingGroup}>
                    <label>Target Price Drop (%)</label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={shortSettings.targetDropPercentage}
                      onChange={(e) => setShortSettings({
                        ...shortSettings,
                        targetDropPercentage: parseInt(e.target.value)
                      })}
                      className={styles.settingSlider}
                    />
                    <div className={styles.sliderValue}>
                      {shortSettings.targetDropPercentage}% 
                      (${currentPrice} → ${(currentPrice * (1 - shortSettings.targetDropPercentage / 100)).toFixed(2)})
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
                      <span>${currentPrice}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Target Price:</span>
                      <span>${(currentPrice * (1 - shortSettings.targetDropPercentage / 100)).toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Bet Amount:</span>
                      <span>-${shortSettings.betAmount}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Potential Winnings:</span>
                      <span className={styles.winnings}>
                        +${calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit)}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Multiplier:</span>
                      <span>{(calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit) / shortSettings.betAmount).toFixed(2)}x</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Early Exit Penalty:</span>
                      <span className={styles.penalty}>
                        -${(shortSettings.targetDropPercentage * currentPrice).toFixed(2)} ({shortSettings.targetDropPercentage} units × ${currentPrice})
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
                      : `Place Short Bet (${shortSettings.betAmount})`
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && (
          <div className={`${styles.statusMessage} ${styles[getMessageClass(message)]}`}>
            {message}
          </div>
        )}

        {/* Enhanced Trading Info */}
        <div className={styles.tradingInfo}>
          <p>💡 <strong>Ultra-Conservative Trading System with Extreme Short Risk:</strong></p>
          <div className={styles.tradingInfoGrid}>
            <div className={styles.tradingInfoSection}>
              <strong>Ultra-Micro Market Movements:</strong>
              <ul>
                <li>Each purchase increases price by ~0.1% (prevents arbitrage completely)</li>
                <li>Sell price = 95% of current market price</li>
                <li>Ultra-tiny price jumps make instant arbitrage impossible</li>
                <li>Need massive trading volume to create profit opportunities</li>
                <li>Market movements are now 10x smaller than before</li>
              </ul>
            </div>
            <div className={styles.tradingInfoSection}>
              <strong>⚠️ SHORT POSITION PENALTIES:</strong>
              <ul>
                <li><strong>WIN:</strong> Target reached in time = earn potential winnings</li>
                <li><strong>EARLY EXIT:</strong> Sell shares = buy X units at current price (X = target %)</li>
                <li><strong>EXPIRE:</strong> Time runs out = pay 100x current market price!</li>
                <li>Example: 20% drop bet, exit early at $15 = buy 20 units = $300 penalty</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}