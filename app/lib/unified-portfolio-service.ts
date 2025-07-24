// =============================================================================
// Unified Portfolio Service - Real-time portfolio synchronization
// =============================================================================

'use client';

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy, 
  limit,
  updateDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from './portfolio-utils';
import { realtimeDataService } from './realtime-data-service';

// Shared interface for portfolio items
export interface UserPortfolioItem {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

// Shared interface for user leaderboard data
export interface UserLeaderboardData {
  uid: string;
  username: string;
  joinDate: string;
  portfolioValue: number;
  exposure: number;
  opinionsCount: number;
  betsCount: number;
  performanceChange: number;
  performancePercent: number;
  volatility: 'Low' | 'Medium' | 'High';
  holdings: number;
  topHoldings: Array<{
    text: string;
    value: number;
    currentPrice: number;
    purchasePrice: number;
    percentChange: number;
    quantity: number;
  }>;
  isBot: boolean;
}

export class UnifiedPortfolioService {
  private static instance: UnifiedPortfolioService;
  
  public static get Instance(): UnifiedPortfolioService {
    if (!this.instance) {
      this.instance = new UnifiedPortfolioService();
    }
    return this.instance;
  }

  /**
   * Unified portfolio loading function used by both users list page and individual user pages
   * This ensures perfect data synchronization between views
   */
  async loadUserPortfolio(userId: string, userData?: any): Promise<UserPortfolioItem[]> {
    try {
      console.log(`📊 Loading unified portfolio for user: ${userId}`);
      
      // Get full user profile data (not just basic user document)
      const fullUserProfile = await realtimeDataService.getUserProfile(userId);
      
      let portfolio: Portfolio;
      
      console.log('📊 USER PORTFOLIO LOADING:', {
        userId,
        username: fullUserProfile?.username || userData?.username,
        hasPortfolioV2: !!fullUserProfile?.portfolioV2,
        hasOldPortfolio: !!fullUserProfile?.portfolio,
      });
      
      try {
        portfolio = await getUserPortfolio(userId);
        console.log('✅ USER PORTFOLIO LOADED:', {
          itemsCount: portfolio.items.length,
          totalValue: portfolio.totalValue,
          totalCost: portfolio.totalCost,
        });
      } catch (error) {
        console.warn('Failed to load new portfolio, trying migration...');
        await migrateUserPortfolio(userId);
        portfolio = await getUserPortfolio(userId);
        console.log('🔄 USER PORTFOLIO MIGRATED:', {
          itemsCount: portfolio.items.length,
        });
      }
      
      // ✅ BOT FIX: If no regular portfolio found, check bot collections
      if (portfolio.items.length === 0 && (userData?.isBot || fullUserProfile?.isBot)) {
        console.log('🤖 TRIGGERING BOT PORTFOLIO FALLBACK for:', userId);
        console.log('🤖 Reason: Standard portfolio has 0 items');
        console.log('🤖 userData.isBot:', userData?.isBot);
        console.log('🤖 fullUserProfile.isBot:', fullUserProfile?.isBot);
        try {
          const botPortfolioItems = await this.loadBotPortfolio(userId);
          if (botPortfolioItems.length > 0) {
            console.log(`🤖 ✅ SUCCESS: Found ${botPortfolioItems.length} items in bot collections`);
            return botPortfolioItems;
          } else {
            console.log('🤖 ❌ No items found in bot collections either');
          }
        } catch (botError) {
          console.warn('🤖 ❌ Failed to load bot portfolio:', botError);
        }
      }
      
      // If no items in new portfolio but old portfolio exists, migrate
      if (portfolio.items.length === 0 && fullUserProfile?.portfolio) {
        console.log('🔄 Migrating portfolio data...');
        await migrateUserPortfolio(userId);
        portfolio = await getUserPortfolio(userId);
        console.log('🔄 USER PORTFOLIO AFTER MIGRATION:', {
          itemsCount: portfolio.items.length,
        });
      }
      
      // Get market data for current prices
      const marketData = await realtimeDataService.getMarketData();
      
      // Filter out invalid portfolio items before calculations
      const validItems = [];
      for (const item of portfolio.items) {
        if (!item.opinionText || 
            typeof item.opinionText !== 'string' || 
            !item.opinionText.trim() ||
            item.opinionText === 'Unknown Opinion' ||
            item.opinionText === 'Opinion (Unknown)' ||
            item.opinionText.startsWith('Opinion (')) {
          console.warn('Skipping invalid portfolio item:', item);
          continue;
        }
        validItems.push(item);
      }
      
      // Transform portfolio items using market data consistently
      const transformedOpinions: UserPortfolioItem[] = validItems.map(item => ({
        id: item.opinionId,
        text: item.opinionText,
        purchasePrice: item.averagePrice,
        currentPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice,
        purchaseDate: new Date(item.lastUpdated).toLocaleDateString(),
        quantity: item.quantity,
      }));
      
      console.log('📊 UNIFIED PORTFOLIO RESULT:', {
        userId,
        username: fullUserProfile?.username || userData?.username,
        validItemsCount: validItems.length,
        transformedOpinions: transformedOpinions.length,
        totalValue: transformedOpinions.reduce((sum, op) => sum + op.currentPrice * op.quantity, 0),
        sampleItems: transformedOpinions.slice(0, 2).map(op => ({
          text: op.text,
          quantity: op.quantity,
          purchasePrice: op.purchasePrice,
          currentPrice: op.currentPrice,
          value: op.currentPrice * op.quantity
        }))
      });
      
      return transformedOpinions;
      
    } catch (error) {
      console.error(`Error loading unified portfolio for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user's bets with consistent filtering
   */
  async getUserBets(userId: string): Promise<any[]> {
    try {
      const betsQuery = query(
        collection(db, 'advanced-bets'), 
        where('userId', '==', userId)
        // Removed isBot filter - advanced-bets documents don't have this field
      );
      const snapshot = await getDocs(betsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error loading bets for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user's shorts with consistent filtering
   */
  async getUserShorts(userId: string): Promise<any[]> {
    try {
      const shortsQuery = query(
        collection(db, 'short-positions'), 
        where('userId', '==', userId)
        // Removed isBot filter - short-positions documents don't have this field
      );
      const snapshot = await getDocs(shortsQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error loading shorts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Calculate top holdings consistently
   */
  async calculateTopHoldings(portfolio: UserPortfolioItem[]): Promise<Array<{
    text: string;
    value: number;
    currentPrice: number;
    purchasePrice: number;
    percentChange: number;
    quantity: number;
  }>> {
    // Get top holdings - only use valid opinions
    const sortedOpinions = portfolio
      .sort((a, b) => {
        const aValue = a.currentPrice * a.quantity;
        const bValue = b.currentPrice * b.quantity;
        return bValue - aValue;
      })
      .slice(0, 2);
    
    // Process top holdings with consistent logic
    const topHoldings = [];
    for (const op of sortedOpinions) {
      const currentPrice = op.currentPrice;
      const value = currentPrice * op.quantity;
      const percentChange = op.purchasePrice > 0 ? ((currentPrice - op.purchasePrice) / op.purchasePrice) * 100 : 0;
      
      topHoldings.push({
        text: op.text,
        value: value,
        currentPrice: currentPrice,
        purchasePrice: op.purchasePrice,
        percentChange: percentChange,
        quantity: op.quantity
      });
    }
    
    return topHoldings;
  }

  /**
   * Load portfolio data from bot-specific collections (fallback for bots)
   */
  private async loadBotPortfolio(botId: string): Promise<UserPortfolioItem[]> {
    try {
      console.log(`🤖 Loading bot portfolio for: ${botId}`);
      
      // Check consolidated bot portfolio first
      const consolidatedDocRef = doc(db, 'consolidated-bot-portfolios', botId);
      const consolidatedSnap = await getDoc(consolidatedDocRef);
      
      if (consolidatedSnap.exists()) {
        const consolidatedData = consolidatedSnap.data();
        console.log(`🤖 Found consolidated bot portfolio with ${consolidatedData.holdings?.length || 0} holdings`);
        
        if (consolidatedData.holdings && consolidatedData.holdings.length > 0) {
          // Get current market data
          const marketData = await realtimeDataService.getMarketData();
          
          return consolidatedData.holdings.map((holding: any) => ({
            id: holding.opinionId,
            text: holding.opinionText,
            purchasePrice: holding.purchasePrice || holding.averagePrice,
            currentPrice: marketData[holding.opinionText]?.currentPrice || holding.purchasePrice || holding.averagePrice,
            purchaseDate: new Date(holding.lastUpdated || Date.now()).toLocaleDateString(),
            quantity: holding.quantity,
          }));
        }
      }
      
      // Fallback: Check individual bot portfolio documents
      console.log('🤖 No consolidated portfolio, checking individual bot documents...');
      const botPortfoliosQuery = query(collection(db, 'bot-portfolios'));
      const botPortfoliosSnap = await getDocs(botPortfoliosQuery);
      const botPortfolioItems = botPortfoliosSnap.docs.filter(doc => 
        doc.id.startsWith(botId + '_') && doc.data().qty > 0
      );
      
      if (botPortfolioItems.length > 0) {
        console.log(`🤖 Found ${botPortfolioItems.length} individual bot portfolio items`);
        const marketData = await realtimeDataService.getMarketData();
        
        return botPortfolioItems.map(doc => {
          const data = doc.data();
          return {
            id: data.opinionId,
            text: data.opinionText,
            purchasePrice: data.avgPrice,
            currentPrice: marketData[data.opinionText]?.currentPrice || data.avgPrice,
            purchaseDate: new Date(data.updatedAt?.toDate?.() || Date.now()).toLocaleDateString(),
            quantity: data.qty,
          };
        });
      }
      
      console.log('🤖 No bot portfolio data found in any collection');
      return [];
      
    } catch (error) {
      console.error(`Error loading bot portfolio for ${botId}:`, error);
      if ((error as any)?.code === 'permission-denied') {
        console.error('🔒 FIRESTORE PERMISSIONS: Bot collections (consolidated-bot-portfolios, bot-portfolios) are not accessible');
        console.error('🔧 FIX NEEDED: Update Firestore security rules to allow reading bot collections');
      }
      return [];
    }
  }
}

export const unifiedPortfolioService = UnifiedPortfolioService.Instance; 