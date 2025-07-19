// =============================================================================
// Portfolio Utilities - Better data structure for user portfolios
// =============================================================================

import { doc, writeBatch, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { createMarketDataDocId } from './document-id-utils';

// Portfolio item structure
export interface PortfolioItem {
  opinionId: string;
  opinionText: string;
  quantity: number;
  totalCost: number;
  averagePrice: number;
  lastUpdated: string;
  transactions: string[]; // Array of transaction IDs for this opinion
}

// Portfolio structure
export interface Portfolio {
  items: PortfolioItem[];
  totalValue: number;
  totalCost: number;
  lastUpdated: string;
}

// Helper to get user's portfolio
export async function getUserPortfolio(userId: string): Promise<Portfolio> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    return userData.portfolioV2 || {
      items: [],
      totalValue: 0,
      totalCost: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  
  return {
    items: [],
    totalValue: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString()
  };
}

// Helper to update user's portfolio
export async function updateUserPortfolio(
  userId: string,
  opinionId: string,
  opinionText: string,
  quantityChange: number,
  pricePerShare: number,
  transactionId: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const batch = writeBatch(db);
  
  // Get current portfolio
  const portfolio = await getUserPortfolio(userId);
  
  // Find existing item or create new one
  const existingItemIndex = portfolio.items.findIndex(item => item.opinionId === opinionId);
  
  if (existingItemIndex !== -1) {
    // Update existing item
    const existingItem = portfolio.items[existingItemIndex];
    const newQuantity = existingItem.quantity + quantityChange;
    
    if (newQuantity <= 0) {
      // Remove item if quantity becomes 0 or negative
      portfolio.items.splice(existingItemIndex, 1);
    } else {
      // Update existing item
      const newTotalCost = existingItem.totalCost + (quantityChange * pricePerShare);
      existingItem.quantity = newQuantity;
      existingItem.totalCost = newTotalCost;
      existingItem.averagePrice = newTotalCost / newQuantity;
      existingItem.lastUpdated = new Date().toISOString();
      existingItem.transactions.push(transactionId);
    }
  } else if (quantityChange > 0) {
    // Add new item
    const newItem: PortfolioItem = {
      opinionId,
      opinionText,
      quantity: quantityChange,
      totalCost: quantityChange * pricePerShare,
      averagePrice: pricePerShare,
      lastUpdated: new Date().toISOString(),
      transactions: [transactionId]
    };
    portfolio.items.push(newItem);
  }
  
  // Update portfolio metadata
  portfolio.totalCost = portfolio.items.reduce((sum, item) => sum + item.totalCost, 0);
  portfolio.lastUpdated = new Date().toISOString();
  
  // Update user document
  batch.update(userRef, {
    portfolioV2: portfolio,
    updatedAt: new Date().toISOString()
  });
  
  await batch.commit();
}

// Helper to get user's position in a specific opinion
export async function getUserPositionInOpinion(userId: string, opinionId: string): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  const item = portfolio.items.find(item => item.opinionId === opinionId);
  return item ? item.quantity : 0;
}

// Helper to calculate portfolio value with current market prices
export async function calculatePortfolioValue(userId: string, marketData: Record<string, any>): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  
  return portfolio.items.reduce((totalValue, item) => {
    const currentPrice = marketData[item.opinionText]?.currentPrice || item.averagePrice;
    return totalValue + (item.quantity * currentPrice);
  }, 0);
}

// Enhanced portfolio statistics calculation
export async function calculatePortfolioStats(userId: string, marketData?: Record<string, any>): Promise<{
  portfolioValue: number;
  totalCost: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  totalQuantity: number;
  uniqueOpinions: number;
  topHoldings: Array<{
    opinionText: string;
    quantity: number;
    currentPrice: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
  }>;
  riskMetrics: {
    diversificationScore: number;
    volatilityScore: number;
    exposureRating: 'Low' | 'Medium' | 'High';
  };
}> {
  const portfolio = await getUserPortfolio(userId);
  
  // Get market data if not provided
  let currentMarketData = marketData;
  if (!currentMarketData) {
    const { realtimeDataService } = await import('./realtime-data-service');
    currentMarketData = await realtimeDataService.getMarketData() || {};
  }
  // Ensure we have a valid market data object
  currentMarketData = currentMarketData || {};
  
  let portfolioValue = 0;
  let totalCost = 0;
  let totalQuantity = 0;
  const holdingsWithValues: any[] = [];
  
  // Calculate values for each holding
  for (const item of portfolio.items) {
    const currentPrice = currentMarketData[item.opinionText]?.currentPrice || item.averagePrice;
    const currentValue = item.quantity * currentPrice;
    const gainLoss = currentValue - item.totalCost;
    const gainLossPercent = item.totalCost > 0 ? (gainLoss / item.totalCost) * 100 : 0;
    
    portfolioValue += currentValue;
    totalCost += item.totalCost;
    totalQuantity += item.quantity;
    
    holdingsWithValues.push({
      opinionText: item.opinionText,
      quantity: item.quantity,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      averagePrice: item.averagePrice
    });
  }
  
  // Calculate overall metrics
  const unrealizedGainLoss = portfolioValue - totalCost;
  const unrealizedGainLossPercent = totalCost > 0 ? (unrealizedGainLoss / totalCost) * 100 : 0;
  
  // Sort holdings by current value and get top holdings
  const topHoldings = holdingsWithValues
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map(holding => ({
      opinionText: holding.opinionText,
      quantity: holding.quantity,
      currentPrice: holding.currentPrice,
      currentValue: holding.currentValue,
      gainLoss: holding.gainLoss,
      gainLossPercent: holding.gainLossPercent
    }));
  
  // Calculate risk metrics
  const uniqueOpinions = portfolio.items.length;
  
  // Diversification score based on number of holdings and value concentration
  const totalValue = Math.max(portfolioValue, 1);
  const concentrationRatios = holdingsWithValues.map(h => h.currentValue / totalValue);
  const herfindahlIndex = concentrationRatios.reduce((sum, ratio) => sum + ratio * ratio, 0);
  const diversificationScore = Math.max(0, (1 - herfindahlIndex) * 100);
  
  // Volatility score based on price variations from average cost
  const priceVariations = holdingsWithValues.map(h => 
    h.averagePrice > 0 ? Math.abs(h.currentPrice - h.averagePrice) / h.averagePrice : 0
  );
  const avgVariation = priceVariations.length > 0 ? 
    priceVariations.reduce((sum, variation) => sum + variation, 0) / priceVariations.length : 0;
  const volatilityScore = Math.min(avgVariation * 100, 100);
  
  // Exposure rating based on volatility and concentration
  let exposureRating: 'Low' | 'Medium' | 'High' = 'Low';
  if (volatilityScore > 50 || herfindahlIndex > 0.5) {
    exposureRating = 'High';
  } else if (volatilityScore > 25 || herfindahlIndex > 0.3) {
    exposureRating = 'Medium';
  }
  
  return {
    portfolioValue,
    totalCost,
    unrealizedGainLoss,
    unrealizedGainLossPercent,
    totalQuantity,
    uniqueOpinions,
    topHoldings,
    riskMetrics: {
      diversificationScore,
      volatilityScore,
      exposureRating
    }
  };
}

// Helper to get user's current positions with real-time prices
export async function getUserPositionsWithCurrentPrices(userId: string): Promise<Array<{
  opinionId: string;
  opinionText: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  lastUpdated: string;
}>> {
  const portfolio = await getUserPortfolio(userId);
  const { realtimeDataService } = await import('./realtime-data-service');
  const marketData = await realtimeDataService.getMarketData();
  
  return portfolio.items.map(item => {
    const currentPrice = marketData[item.opinionText]?.currentPrice || item.averagePrice;
    const currentValue = item.quantity * currentPrice;
    const unrealizedGainLoss = currentValue - item.totalCost;
    const unrealizedGainLossPercent = item.totalCost > 0 ? (unrealizedGainLoss / item.totalCost) * 100 : 0;
    
    return {
      opinionId: item.opinionId,
      opinionText: item.opinionText,
      quantity: item.quantity,
      averagePrice: item.averagePrice,
      currentPrice,
      currentValue,
      totalCost: item.totalCost,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      lastUpdated: item.lastUpdated
    };
  });
}

// Helper to calculate total exposure including bets and shorts
export async function calculateTotalExposure(userId: string): Promise<{
  portfolioValue: number;
  bettingExposure: number;
  shortsExposure: number;
  totalExposure: number;
  riskScore: number;
}> {
  try {
    // Get portfolio value
    const portfolioStats = await calculatePortfolioStats(userId);
    
    // Get betting positions
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    
    const betsQuery = query(
      collection(db, 'advanced-bets'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const betsSnapshot = await getDocs(betsQuery);
    const bettingExposure = betsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.amount || 0);
    }, 0);
    
    // Get shorts positions
    const shortsQuery = query(
      collection(db, 'short-positions'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const shortsSnapshot = await getDocs(shortsQuery);
    const shortsExposure = shortsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.betAmount || data.amount || 0);
    }, 0);
    
    const totalExposure = bettingExposure + shortsExposure;
    const totalPortfolioValue = Math.max(portfolioStats.portfolioValue, 1);
    
    // Calculate risk score based on exposure ratio and volatility
    const exposureRatio = totalExposure / totalPortfolioValue;
    const riskScore = Math.min(
      (exposureRatio * 50) + (portfolioStats.riskMetrics.volatilityScore * 0.5),
      100
    );
    
    return {
      portfolioValue: portfolioStats.portfolioValue,
      bettingExposure,
      shortsExposure,
      totalExposure,
      riskScore
    };
    
  } catch (error) {
    console.error('Error calculating total exposure:', error);
    return {
      portfolioValue: 0,
      bettingExposure: 0,
      shortsExposure: 0,
      totalExposure: 0,
      riskScore: 0
    };
  }
}

// Migration helper: Convert old portfolio format to new format
export async function migrateUserPortfolio(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    console.error('❌ migrateUserPortfolio: Invalid userId provided:', userId);
    throw new Error('Invalid userId provided to migrateUserPortfolio');
  }
  
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data();
  const oldPortfolio = userData.portfolio;
  
  // Skip if already migrated or no old portfolio
  if (!oldPortfolio || userData.portfolioV2) return;
  
  console.log(`🔄 Migrating portfolio for user: ${userData.username || userId}`);
  
  const newPortfolio: Portfolio = {
    items: [],
    totalValue: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString()
  };
  
  // Convert old format to new format
  for (const [key, quantity] of Object.entries(oldPortfolio)) {
    if (typeof quantity === 'number' && quantity > 0) {
      // Try to find the original opinion text
      let opinionText = key;
      
      // If key contains underscores, it might be sanitized
      if (key.includes('_')) {
        // Try to reverse the sanitization by querying opinions
                 try {
           const opinionsSnap = await getDocs(collection(db, 'opinions'));
           const matchingOpinion = opinionsSnap.docs.find((docSnapshot) => {
             const sanitized = docSnapshot.data().text?.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
             return sanitized === key;
           });
           
           if (matchingOpinion) {
             opinionText = matchingOpinion.data().text;
           }
         } catch (error) {
           console.warn('Failed to find original opinion text for:', key);
         }
      }
      
      // Create portfolio item
      const item: PortfolioItem = {
        opinionId: createMarketDataDocId(opinionText),
        opinionText,
        quantity,
        totalCost: quantity * 10, // Assume $10 base price for migrated items
        averagePrice: 10,
        lastUpdated: new Date().toISOString(),
        transactions: [] // No transaction history for migrated items
      };
      
      newPortfolio.items.push(item);
    }
  }
  
  // Update portfolio metadata
  newPortfolio.totalCost = newPortfolio.items.reduce((sum, item) => sum + item.totalCost, 0);
  
  // Save new portfolio and mark as migrated
  await updateDoc(userRef, {
    portfolioV2: newPortfolio,
    portfolioMigratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log(`✅ Successfully migrated portfolio for ${userData.username || userId}`);
}

// Helper to get all users that need migration
export async function getUsersNeedingMigration(): Promise<string[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const usersToMigrate: string[] = [];
  
  usersSnap.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    if (data.portfolio && !data.portfolioV2) {
      usersToMigrate.push(docSnapshot.id);
    }
  });
  
  return usersToMigrate;
} 

// Helper to calculate accurate betting positions with current market data
export async function getBettingPositionsWithCurrentValues(userId: string): Promise<Array<{
  id: string;
  title: string;
  type: 'BET' | 'LONG' | 'SHORT';
  status: 'active' | 'won' | 'lost' | 'expired';
  amount: number;
  placedDate: string;
  expiryDate?: string;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeFrame?: number;
  multiplier?: number;
  currentValue: number;
  potentialPayout: number;
  potential: number;
  percentage: number;
  wagered: number;
  daysHeld: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}>> {
  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    
    const betsQuery = query(
      collection(db, 'advanced-bets'),
      where('userId', '==', userId)
    );
    const betsSnapshot = await getDocs(betsQuery);
    
    const positions = [];
    
    for (const doc of betsSnapshot.docs) {
      const data = doc.data();
      const placedDate = new Date(data.createdAt?.toDate?.() || data.placedDate || Date.now());
      const expiryDate = new Date(data.expirationDate?.toDate?.() || data.expiryDate || Date.now() + 30 * 24 * 60 * 60 * 1000);
      const daysHeld = Math.floor((Date.now() - placedDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Calculate current value based on target user's portfolio performance
      let currentValue = data.amount || 0;
      let potentialPayout = data.potentialPayout || data.amount * (data.multiplier || 2);
      let percentage = 0;
      
      if (data.targetUser && data.initialPortfolioValue) {
        // For portfolio bets, calculate based on actual performance
        try {
          // Get target user's current portfolio value
          const targetUserQuery = query(
            collection(db, 'users'),
            where('username', '==', data.targetUser)
          );
          const targetUserSnap = await getDocs(targetUserQuery);
          
          if (!targetUserSnap.empty) {
            const targetUserId = targetUserSnap.docs[0].id;
            const targetPortfolioStats = await calculatePortfolioStats(targetUserId);
            const currentPortfolioValue = targetPortfolioStats.portfolioValue;
            
            const performanceChange = currentPortfolioValue - data.initialPortfolioValue;
            const performancePercent = data.initialPortfolioValue > 0 ? 
              (performanceChange / data.initialPortfolioValue) * 100 : 0;
            
            // Determine if bet is winning based on bet type and performance
            const isWinning = (data.betType === 'increase' && performancePercent >= data.targetPercentage) ||
                             (data.betType === 'decrease' && performancePercent <= -Math.abs(data.targetPercentage));
            
            if (isWinning) {
              currentValue = potentialPayout;
              percentage = ((potentialPayout - data.amount) / data.amount) * 100;
            } else {
              // Calculate partial value based on how close we are to target
              const progressPercent = Math.abs(performancePercent) / Math.abs(data.targetPercentage);
              currentValue = data.amount + ((potentialPayout - data.amount) * Math.min(progressPercent, 1));
              percentage = ((currentValue - data.amount) / data.amount) * 100;
            }
          }
        } catch (error) {
          console.warn('Error calculating bet performance:', error);
        }
      }
      
      // Determine risk level
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (data.multiplier > 5 || (data.targetPercentage && Math.abs(data.targetPercentage) > 50)) {
        riskLevel = 'High';
      } else if (data.multiplier > 3 || (data.targetPercentage && Math.abs(data.targetPercentage) > 25)) {
        riskLevel = 'Medium';
      }
      
      positions.push({
        id: doc.id,
        title: data.title || `${data.betType || 'BET'} on ${data.targetUser || 'Unknown'}`,
        type: 'BET' as const,
        status: data.status || 'active',
        amount: data.amount || 0,
        placedDate: placedDate.toLocaleDateString(),
        expiryDate: expiryDate.toLocaleDateString(),
        targetUser: data.targetUser,
        betType: data.betType,
        targetPercentage: data.targetPercentage,
        timeFrame: data.timeFrame,
        multiplier: data.multiplier || 1,
        currentValue,
        potentialPayout,
        potential: potentialPayout - data.amount,
        percentage,
        wagered: data.amount || 0,
        daysHeld,
        riskLevel
      });
    }
    
    return positions;
    
  } catch (error) {
    console.error('Error getting betting positions:', error);
    return [];
  }
}

// Helper to calculate accurate short positions with current market data
export async function getShortPositionsWithCurrentValues(userId: string): Promise<Array<{
  id: string;
  title: string;
  type: 'SHORT';
  status: 'active' | 'won' | 'lost' | 'expired';
  opinionText: string;
  opinionId: string;
  targetDropPercentage: number;
  betAmount: number;
  potentialWinnings: number;
  shortedDate: string;
  expirationDate: string;
  startingPrice: number;
  currentPrice: number;
  targetPrice: number;
  currentValue: number;
  progress: number;
  shares: number;
  entry: number;
  dropTarget: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}>> {
  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const { realtimeDataService } = await import('./realtime-data-service');
    
    const shortsQuery = query(
      collection(db, 'short-positions'),
      where('userId', '==', userId)
    );
    const shortsSnapshot = await getDocs(shortsQuery);
    
    // Get current market data
    const marketData = await realtimeDataService.getMarketData();
    
    const positions = [];
    
    for (const doc of shortsSnapshot.docs) {
      const data = doc.data();
      const shortedDate = new Date(data.createdAt?.toDate?.() || data.createdDate || Date.now());
      const expirationDate = new Date(data.expirationDate?.toDate?.() || Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Get current market price for the opinion
      const currentPrice = marketData[data.opinionText]?.currentPrice || data.startingPrice || 10;
      const startingPrice = data.startingPrice || 10;
      const targetDropPercentage = Math.abs(data.targetDropPercentage || 20);
      const targetPrice = startingPrice * (1 - targetDropPercentage / 100);
      
      // Calculate progress toward target
      const priceDropAmount = startingPrice - currentPrice;
      const targetDropAmount = startingPrice - targetPrice;
      const progress = targetDropAmount > 0 ? Math.max(0, Math.min(100, (priceDropAmount / targetDropAmount) * 100)) : 0;
      
      // Calculate current value of the short position
      let currentValue = data.betAmount || 0;
      if (currentPrice < startingPrice) {
        // Short is profitable - calculate based on price drop
        const dropPercent = ((startingPrice - currentPrice) / startingPrice) * 100;
        const profitMultiplier = Math.min(dropPercent / targetDropPercentage, 1);
        currentValue = data.betAmount + (data.potentialWinnings * profitMultiplier);
      } else if (currentPrice > startingPrice) {
        // Short is losing money - calculate loss
        const lossPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
        currentValue = Math.max(0, data.betAmount * (1 - lossPercent / 100));
      }
      
      // Calculate shares (synthetic)
      const shares = data.betAmount ? Math.round(data.betAmount / startingPrice) : 0;
      
      // Determine risk level
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (targetDropPercentage > 50 || (data.potentialWinnings / data.betAmount) > 5) {
        riskLevel = 'High';
      } else if (targetDropPercentage > 25 || (data.potentialWinnings / data.betAmount) > 2) {
        riskLevel = 'Medium';
      }
      
      positions.push({
        id: doc.id,
        title: `Short ${data.opinionText?.substring(0, 50)}${data.opinionText?.length > 50 ? '...' : ''}`,
        type: 'SHORT' as const,
        status: data.status || 'active',
        opinionText: data.opinionText || 'Unknown Opinion',
        opinionId: data.opinionId || '',
        targetDropPercentage,
        betAmount: data.betAmount || 0,
        potentialWinnings: data.potentialWinnings || 0,
        shortedDate: shortedDate.toLocaleDateString(),
        expirationDate: expirationDate.toLocaleDateString(),
        startingPrice,
        currentPrice,
        targetPrice,
        currentValue,
        progress,
        shares,
        entry: startingPrice,
        dropTarget: targetDropPercentage,
        riskLevel
      });
    }
    
    return positions;
    
  } catch (error) {
    console.error('Error getting short positions:', error);
    return [];
  }
}

// Helper to get combined portfolio positions (opinions + bets + shorts)
export async function getCombinedPortfolioPositions(userId: string) {
  const [portfolioStats, bettingPositions, shortPositions, totalExposure] = await Promise.all([
    calculatePortfolioStats(userId),
    getBettingPositionsWithCurrentValues(userId),
    getShortPositionsWithCurrentValues(userId),
    calculateTotalExposure(userId)
  ]);
  
  return {
    portfolio: portfolioStats,
    bets: bettingPositions,
    shorts: shortPositions,
    exposure: totalExposure,
    summary: {
      totalPositions: portfolioStats.uniqueOpinions + bettingPositions.length + shortPositions.length,
      totalValue: portfolioStats.portfolioValue + 
                 bettingPositions.reduce((sum, bet) => sum + bet.currentValue, 0) +
                 shortPositions.reduce((sum, short) => sum + short.currentValue, 0),
      totalRisk: totalExposure.riskScore,
      diversification: portfolioStats.riskMetrics.diversificationScore
    }
  };
} 