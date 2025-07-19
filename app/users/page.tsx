"use client";

/**
 * Traders leaderboard – **Firestore‑native edition**
 * ---------------------------------------------------------------------------
 * All data is sourced straight from Firestore.  *Nothing* touches localStorage
 * any more.  The page still renders the same leaderboard / detailed‑user modals
 * but every query is re‑implemented with typed Firebase helpers.
 *
 * Collections used:
 *   • users               – one doc per user (public profile)
 *   • user-portfolios     – holdings & snapshots → /user-portfolios/{uid}
 *   • market-data         – opinionPrices keyed by opinionText
 *   • opinions            – opinions text catalogue (for sidebar)
 *   • advanced-bets       – portfolio bets
 *   • short-positions     – short positions
 *   • transactions        – recent activity
 *
 * Each query is wrapped in a tiny `useFirestoreCollection` helper so it can be
 * unsubscribed automatically when the component unmounts.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  CollectionReference,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from "../lib/portfolio-utils";
import { realtimeDataService } from "../lib/realtime-data-service";
import { Eye, Lightbulb, Rss, ChartLine, Balloon } from "@phosphor-icons/react";

/* ── UI ─────────────────────────────────────────────────────────────────── */
import Sidebar from "../components/Sidebar";
import LeaderboardCard from "./components/LeaderboardCard"; // (extract‑ed)
import UserDetailModal from "../components/UserDetailModal"; // (extract‑ed)
import AuthGuard from "../components/AuthGuard";
import ActivityIntegration from "../components/ActivityIntegration";
import Navigation from "../components/Navigation";
import { publicLeaderboardService } from "../lib/public-leaderboard";
import styles from "./page.module.css";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface UserDoc {
  id: string;
  username: string;
  joinDate: string; // ISO
  avatar?: string;
}

interface BotDoc {
  id: string;
  username?: string;
  balance: number;
  joinDate: string;
  totalEarnings?: number;
  totalLosses?: number;
  personality: {
    name?: string;
    description: string;
    activityFrequency: number;
    betProbability?: number;
    buyProbability?: number;
  };
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  tradingStrategy?: {
    type: string;
  };
  lastActive: string;
  isActive: boolean;
}

interface PortfolioDoc {
  userId: string;
  ownedOpinions: Array<{
    opinionId: string;
    opinionText: string;
    quantity: number;
    purchasePrice: number;
  }>;
  shortExposure: number;
  betExposure: number;
  snapshots?: Array<{ value: number; timestamp: string }>;
}

interface BotPortfolioDoc {
  botId: string;
  holdings: Array<{
    opinionId: string;
    opinionText: string;
    quantity: number;
    purchasePrice: number;
  }>;
}

interface OpinionPrice {
  currentPrice: number;
  timesPurchased: number;
  timesSold: number;
}
interface BetDoc {
  userId: string;
  type: string;
  amount: number;
  status: string;
}

type SortOption = '7-day' | 'portfolio' | 'total' | 'volatility';

interface LeaderboardEntry {
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

/* ── Helper hook – live collection subscription ────────────────────────── */
function useCollection<T = any>(ref: CollectionReference, deps: any[] = []) {
  const [docs, setDocs] = useState<T[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(ref, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return docs;
}

/* ── Main Page component ────────────────────────────────────────────────── */
export default function UsersPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();

  /* 1️⃣  Fetch core collections */
  const users = useCollection<UserDoc>(collection(db, "users"));
  const portfolios = useCollection<PortfolioDoc>(collection(db, "user-portfolios"));
  const botPortfolios = useCollection<BotPortfolioDoc>(collection(db, "bot-portfolios"));
  const bets = useCollection<BetDoc>(collection(db, "advanced-bets"));

  // 🔄 FIX 4: Market Data Sync - Load realtime market data using same service as profile
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [marketDataLoaded, setMarketDataLoaded] = useState(false);

  useEffect(() => {
    const loadMarketData = async () => {
      try {
        console.log('📈 Loading market data...');
        const data = await realtimeDataService.getMarketData();
        setMarketData(data);
        setMarketDataLoaded(true);
        console.log('✅ Market data loaded:', Object.keys(data).length, 'opinions');
      } catch (error) {
        console.error('❌ Failed to load market data:', error);
        setMarketData({});
        setMarketDataLoaded(true);
      }
    };

    loadMarketData();
  }, []);

  // Fetch bots from the specific document path
  const [bots, setBots] = useState<BotDoc[]>([]);
  
    useEffect(() => {
    const findAndLoadBots = async () => {
      try {
        console.log("🔍 Loading bots from autonomous-bots collection...");
        
        const autonomousBotsRef = collection(db, "autonomous-bots");
        const autonomousBotsSnap = await getDocs(autonomousBotsRef);
        
        console.log(`📁 Found ${autonomousBotsSnap.size} bot documents in autonomous-bots collection`);
        
        if (autonomousBotsSnap.empty) {
          console.log("❌ No bot documents found in autonomous-bots collection");
          setBots([]);
          return;
        }
        
        let botsList: BotDoc[] = [];
        
        // Load each bot document directly
        for (const docSnap of autonomousBotsSnap.docs) {
          const botData = docSnap.data();
          
          // Validate that this is a bot document
          if (botData && (botData.id || botData.username || botData.balance !== undefined)) {
            const displayName = botData.personality?.name || botData.username || `Bot_${docSnap.id}`;
            
            console.log(`✅ Found bot: ${docSnap.id} - ${displayName}`);
            
            botsList.push({
              id: botData.id || docSnap.id,
              username: displayName,
              balance: botData.balance || 0,
              joinDate: botData.joinDate || new Date().toISOString(),
              totalEarnings: botData.totalEarnings || 0,
              totalLosses: botData.totalLosses || 0,
              personality: botData.personality || {
                description: "A trading bot",
                activityFrequency: 100,
                betProbability: 0.5,
                buyProbability: 0.5
              },
              riskTolerance: botData.riskTolerance || 'moderate',
              tradingStrategy: botData.tradingStrategy || { type: 'balanced' },
              lastActive: botData.lastActive || new Date().toISOString(),
              isActive: botData.isActive !== undefined ? botData.isActive : true,
              ...botData
            });
          }
        }
        
        console.log(`🎉 Total bots loaded: ${botsList.length}`, botsList);
        setBots(botsList);
        
      } catch (error) {
        console.error("❌ Error loading bots:", error);
        setBots([]);
      }
    };
    
    findAndLoadBots();
  }, []);

  /* 2️⃣  Sorting state */
  const [sortBy, setSortBy] = useState<SortOption>('portfolio');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // State for leaderboard and opinion text mapping
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [opinionTextMap, setOpinionTextMap] = useState<Map<string, string>>(new Map());

  // FIXED: Helper function to get opinion text by ID with better fallbacks
  const getOpinionText = async (opinionId: string, fallbackText?: string): Promise<string> => {
    // PRIORITY 1: Use fallbackText if it's valid and not empty
    if (fallbackText && 
        typeof fallbackText === 'string' && 
        fallbackText.trim() && 
        fallbackText !== 'Unknown Opinion' &&
        fallbackText !== 'Opinion (Unknown)' &&
        !fallbackText.startsWith('Opinion (')) {
      return fallbackText.trim();
    }
    
    // PRIORITY 2: Check our local cache
    if (opinionId && opinionTextMap.has(opinionId)) {
      const cachedText = opinionTextMap.get(opinionId)!;
      if (cachedText && 
          cachedText !== 'Unknown Opinion' && 
          cachedText !== 'Opinion (Unknown)' &&
          !cachedText.startsWith('Opinion (')) {
        return cachedText;
      }
    }
    
    // PRIORITY 3: Try to fetch from Firestore
    if (opinionId && typeof opinionId === 'string' && opinionId.trim()) {
      try {
        const docRef = doc(db, "opinions", opinionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const text = data.text || data.opinionText || '';
          if (text && 
              typeof text === 'string' && 
              text.trim() &&
              text !== 'Unknown Opinion' &&
              text !== 'Opinion (Unknown)') {
            // Update the map for future use
            setOpinionTextMap(prev => new Map(prev).set(opinionId, text.trim()));
            return text.trim();
          }
        }
      } catch (error) {
        console.warn('Failed to fetch opinion text for ID:', opinionId, error);
      }
    }
    
    // PRIORITY 4: Return empty string as fallback
    console.warn('Unable to resolve opinion text for:', { opinionId, fallbackText });
    return ''; // Return empty string instead of null to avoid type errors
  };

  // 🔄 FIX 2: Enhanced Portfolio Loading - Process user portfolios with migration support
  const processUserPortfolio = async (userId: string, userData: any) => {
    try {
      // 🔄 FIX 1: Synced Data Sources - Use same data fetching approach as profile page
      // Get full user profile data (not just basic user document)
      const fullUserProfile = await realtimeDataService.getUserProfile(userId);
      
      let portfolio: Portfolio;
      
      // 🔄 FIX 3: Detailed Logging - Special logging for current user
      if (user?.uid === userId) {
        console.log('📊 CURRENT USER PORTFOLIO LOADING:', {
          userId,
          username: fullUserProfile?.username || userData.username,
          hasPortfolioV2: !!fullUserProfile?.portfolioV2,
          hasOldPortfolio: !!fullUserProfile?.portfolio,
          fullUserProfile: fullUserProfile
        });
      }
      
      try {
        portfolio = await getUserPortfolio(userId);
        
        if (user?.uid === userId) {
          console.log('✅ CURRENT USER PORTFOLIO LOADED:', {
            itemsCount: portfolio.items.length,
            totalValue: portfolio.totalValue,
            totalCost: portfolio.totalCost,
            items: portfolio.items.map(item => ({
              opinionText: item.opinionText,
              quantity: item.quantity,
              averagePrice: item.averagePrice
            }))
          });
        }
      } catch (error) {
        console.warn('Failed to load new portfolio, trying migration...');
        await migrateUserPortfolio(userId);
        portfolio = await getUserPortfolio(userId);
        
        if (user?.uid === userId) {
          console.log('🔄 CURRENT USER PORTFOLIO MIGRATED:', {
            itemsCount: portfolio.items.length,
            totalValue: portfolio.totalValue,
            totalCost: portfolio.totalCost
          });
        }
      }
      
      // If no items in new portfolio but old portfolio exists, migrate
      if (portfolio.items.length === 0 && fullUserProfile?.portfolio) {
        console.log('🔄 Migrating portfolio data...');
        await migrateUserPortfolio(userId);
        portfolio = await getUserPortfolio(userId);
        
        if (user?.uid === userId) {
          console.log('🔄 CURRENT USER PORTFOLIO AFTER MIGRATION:', {
            itemsCount: portfolio.items.length,
            totalValue: portfolio.totalValue,
            totalCost: portfolio.totalCost
          });
        }
      }
      
      // 🔄 FIX 5: Data Validation - Filter out invalid portfolio items before calculations
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
      
      // Transform portfolio items to the expected format using market data
      const transformedOpinions = validItems.map(item => ({
        id: item.opinionId,
        text: item.opinionText,
        purchasePrice: item.averagePrice,
        currentPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice,
        purchaseDate: new Date(item.lastUpdated).toLocaleDateString(),
        quantity: item.quantity,
      }));
      
      if (user?.uid === userId) {
        console.log('📊 CURRENT USER FINAL PORTFOLIO:', {
          validItemsCount: validItems.length,
          transformedOpinions: transformedOpinions.length,
          marketDataAvailable: !!marketData[validItems[0]?.opinionText],
          sampleMarketData: validItems.slice(0, 2).map(item => ({
            opinionText: item.opinionText,
            marketPrice: marketData[item.opinionText]?.currentPrice,
            averagePrice: item.averagePrice,
            finalPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice
          })),
          transformedItems: transformedOpinions.map(op => ({
            text: op.text,
            quantity: op.quantity,
            purchasePrice: op.purchasePrice,
            currentPrice: op.currentPrice,
            value: op.currentPrice * op.quantity
          }))
        });
      }
      
      return transformedOpinions;
      
    } catch (error) {
      console.error('Error processing user portfolio:', error);
      return [];
    }
  };

  // Calculate leaderboard
  useEffect(() => {
    // 🔄 FIX 4: Market Data Sync - Wait for market data before calculating leaderboard
    if (!marketDataLoaded) return;
    
    const calculateLeaderboard = async () => {
      // Process regular users
      const regularUsers: LeaderboardEntry[] = await Promise.all(users.map(async (u) => {
        const pf = portfolios.find((p) => p.userId === u.id);
        const userBets = bets.filter((b) => b.userId === u.id);
        
        // 🔄 FIX 1: Synced Data Sources - Get full user profile data like profile page
        const fullUserProfile = await realtimeDataService.getUserProfile(u.id);
        
        // Handle case where full user profile is not available
        if (!fullUserProfile) {
          console.warn(`⚠️ Could not load full user profile for ${u.username} (${u.id})`);
        }
        
        // 🔄 FIX 2: Enhanced Portfolio Loading - Process with migration support
        const ownedOpinions = await processUserPortfolio(u.id, fullUserProfile || u);
        
        const value = ownedOpinions.reduce((sum, op) => sum + op.currentPrice * op.quantity, 0);
        
        const exposure = (pf?.shortExposure || 0) + (pf?.betExposure || 0);
        const portfolioValue = value - exposure;
        
        // Calculate performance using full user profile data
        const previousValue = pf?.snapshots && pf.snapshots.length > 0 
          ? pf.snapshots[pf.snapshots.length - 1].value 
          : portfolioValue;
        const performanceChange = portfolioValue - previousValue;
        const performancePercent = previousValue !== 0 ? (performanceChange / previousValue) * 100 : 0;
        
        // Calculate volatility
        const volatility: 'Low' | 'Medium' | 'High' = exposure > portfolioValue * 0.5 ? 'High' : 
                          exposure > portfolioValue * 0.2 ? 'Medium' : 'Low';
        
        // Get top holdings - only use valid opinions
        const sortedOpinions = ownedOpinions
          .sort((a, b) => {
            const aValue = a.currentPrice * a.quantity;
            const bValue = b.currentPrice * b.quantity;
            return bValue - aValue;
          })
          .slice(0, 2);
        
        // Process top holdings with better validation
        const topHoldings = [];
        for (const op of sortedOpinions) {
          const opinionText = await getOpinionText(op.id, op.text);
          
          // Skip if we couldn't resolve valid opinion text
          if (!opinionText) {
            continue;
          }
          
          const currentPrice = op.currentPrice;
          const value = currentPrice * op.quantity;
          const percentChange = op.purchasePrice > 0 ? ((currentPrice - op.purchasePrice) / op.purchasePrice) * 100 : 0;
          
          topHoldings.push({
            text: opinionText,
            value: value,
            currentPrice: currentPrice,
            purchasePrice: op.purchasePrice,
            percentChange: percentChange,
            quantity: op.quantity
          });
        }
        
        // 🔄 FIX 3: Detailed Logging - Special logging for current user
        if (user?.uid === u.id) {
          console.log('👤 CURRENT USER LEADERBOARD DATA:', {
            userId: u.id,
            username: fullUserProfile?.username || u.username,
            balance: fullUserProfile?.balance,
            totalEarnings: fullUserProfile?.totalEarnings,
            totalLosses: fullUserProfile?.totalLosses,
            portfolioValue: portfolioValue,
            ownedOpinions: ownedOpinions.length,
            topHoldings: topHoldings.length,
            fullUserProfile: fullUserProfile
          });
        }
        
        return {
          uid: u.id,
          username: fullUserProfile?.username || u.username,
          joinDate: fullUserProfile?.joinDate || u.joinDate,
          portfolioValue,
          exposure,
          opinionsCount: ownedOpinions.length,
          betsCount: userBets.length,
          performanceChange,
          performancePercent,
          volatility,
          holdings: ownedOpinions.length,
          topHoldings,
          isBot: false
        };
      }));

      // Process bots
      const botUsers: LeaderboardEntry[] = await Promise.all(bots.map(async (bot) => {
        const botPf = botPortfolios.find((bp) => bp.botId === bot.id);
        const botBets = bets.filter((b) => b.userId === bot.id);
        
        // Create default portfolio data for bots without portfolios
        const defaultBotPortfolio = {
          botId: bot.id,
          holdings: []
        };
        
        const portfolio = botPf || defaultBotPortfolio;
        
        // 🔄 FIX 5: Data Validation - Filter out holdings with invalid opinion text before calculations
        const validBotHoldings = [];
        for (const op of portfolio.holdings) {
          if (!op.opinionText || 
              typeof op.opinionText !== 'string' || 
              !op.opinionText.trim() ||
              op.opinionText === 'Unknown Opinion' ||
              op.opinionText === 'Opinion (Unknown)' ||
              op.opinionText.startsWith('Opinion (')) {
            console.warn('Skipping invalid bot holding:', op);
            continue;
          }
          validBotHoldings.push(op);
        }
        
        const value = validBotHoldings.reduce((sum, op) => {
          const md = marketData[op.opinionText];
          return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
        }, 0);
        
        const exposure = 0; // Bots don't have short exposure typically
        const portfolioValue = value - exposure;
        
        // Calculate performance based on total earnings/losses
        const totalEarnings = bot.totalEarnings || 0;
        const totalLosses = bot.totalLosses || 0;
        const performanceChange = totalEarnings - totalLosses;
        const performancePercent = totalEarnings > 0 ? (performanceChange / totalEarnings) * 100 : 0;
        
        // Calculate volatility based on bot risk tolerance
        const volatility: 'Low' | 'Medium' | 'High' = 
          bot.riskTolerance === 'aggressive' ? 'High' : 
          bot.riskTolerance === 'moderate' ? 'Medium' : 'Low';
        
        // Get top holdings (use existing opinionText for bots) - only use valid holdings
        const sortedBotOpinions = validBotHoldings
          .sort((a, b) => {
            const aValue = (marketData[a.opinionText]?.currentPrice ?? a.purchasePrice) * a.quantity;
            const bValue = (marketData[b.opinionText]?.currentPrice ?? b.purchasePrice) * b.quantity;
            return bValue - aValue;
          })
          .slice(0, 2);
        
        // Process bot top holdings with better validation
        const topHoldings = [];
        for (const op of sortedBotOpinions) {
          const opinionText = await getOpinionText(op.opinionId, op.opinionText);
          
          // Skip if we couldn't resolve valid opinion text
          if (!opinionText) {
            continue;
          }
          
          const currentPrice = marketData[op.opinionText]?.currentPrice ?? op.purchasePrice;
          const value = currentPrice * op.quantity;
          const percentChange = op.purchasePrice > 0 ? ((currentPrice - op.purchasePrice) / op.purchasePrice) * 100 : 0;
          
          topHoldings.push({
            text: opinionText,
            value: value,
            currentPrice: currentPrice,
            purchasePrice: op.purchasePrice,
            percentChange: percentChange,
            quantity: op.quantity
          });
        }
        
        return {
          uid: bot.id,
          username: bot.username || `Bot_${bot.id.slice(0, 8)}`,
          joinDate: bot.joinDate,
          portfolioValue,
          exposure,
          opinionsCount: validBotHoldings.length,
          betsCount: botBets.length,
          performanceChange,
          performancePercent,
          volatility,
          holdings: validBotHoldings.length,
          topHoldings,
          isBot: true
        };
      }));

      // Merge regular users and bots
      const results = [...regularUsers, ...botUsers];

      // Sort based on selected option
      let sortedResults: LeaderboardEntry[];
      switch (sortBy) {
        case '7-day':
          sortedResults = results.sort((a, b) => b.performancePercent - a.performancePercent);
          break;
        case 'portfolio':
          sortedResults = results.sort((a, b) => b.portfolioValue - a.portfolioValue);
          break;
        case 'total':
          sortedResults = results.sort((a, b) => b.portfolioValue - a.portfolioValue);
          break;
        case 'volatility':
          const volatilityOrder: Record<'High' | 'Medium' | 'Low', number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
          sortedResults = results.sort((a, b) => volatilityOrder[b.volatility] - volatilityOrder[a.volatility]);
          break;
        default:
          sortedResults = results.sort((a, b) => b.portfolioValue - a.portfolioValue);
      }
      
      // 🔄 FIX 3: Detailed Logging - Debug logging with special focus on current user
      console.log('🔍 Leaderboard Debug:', {
        totalUsers: users.length,
        totalBots: bots.length,
        regularUsersProcessed: regularUsers.length,
        botUsersProcessed: botUsers.length,
        finalResults: sortedResults.length,
        marketDataKeys: Object.keys(marketData).length,
        first10Results: sortedResults.slice(0, 10).map(r => ({ 
          username: r.username, 
          isBot: r.isBot, 
          portfolioValue: r.portfolioValue,
          opinionsCount: r.opinionsCount,
          topHoldings: r.topHoldings.length,
          isCurrentUser: r.uid === user?.uid
        }))
      });

      // Special logging for current user
      if (user?.uid) {
        const currentUserEntry = sortedResults.find(r => r.uid === user.uid);
        if (currentUserEntry) {
          console.log('👤 CURRENT USER LEADERBOARD ENTRY:', {
            username: currentUserEntry.username,
            portfolioValue: currentUserEntry.portfolioValue,
            opinionsCount: currentUserEntry.opinionsCount,
            topHoldings: currentUserEntry.topHoldings,
            rank: sortedResults.findIndex(r => r.uid === user.uid) + 1
          });
        }
      }
      
      // Limit results to prevent performance issues (show top 100)
      const limitedResults = sortedResults.slice(0, 100);
      
      setLeaderboard(limitedResults);

      // Update public leaderboard with top 5 traders for unauthorized users
      if (limitedResults.length > 0) {
        const publicLeaderboardData = limitedResults.slice(0, 5).map(trader => ({
          uid: trader.uid,
          username: trader.username,
          portfolioValue: trader.portfolioValue,
          topHoldings: trader.topHoldings,
          isBot: trader.isBot
        }));
        
        publicLeaderboardService.updatePublicLeaderboard(publicLeaderboardData);
      }
    };

    if (users.length > 0 || bots.length > 0) {
      calculateLeaderboard();
    }
  }, [users, bots, portfolios, botPortfolios, marketData, marketDataLoaded, bets, sortBy, user?.uid]);

  /* 4️⃣  UI state */
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selectedUser = leaderboard.find((l) => l.uid === selectedUid);

  /* 5️⃣  Sidebar opinions list (static – one‑off fetch) */
  const [opinionTexts, setOpinionTexts] = useState<string[]>([]);
  
  useEffect(() => {
    (async () => {
      const qs = query(collection(db, "opinions"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(qs);
      const texts = snap.docs.map((d) => (d.data() as any).text as string);
      setOpinionTexts(texts);
      
      // Build opinion text map for fast lookup
      const textMap = new Map<string, string>();
      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const text = data.text || data.opinionText || '';
        if (text && 
            typeof text === 'string' && 
            text.trim() &&
            text !== 'Unknown Opinion' &&
            text !== 'Opinion (Unknown)') {
          textMap.set(doc.id, text.trim());
        }
      });
      setOpinionTextMap(textMap);
    })();
  }, []);

  /* 6️⃣  Update timestamp */
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }));
  }, [users, bots, portfolios, botPortfolios, marketData]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <AuthGuard>
      <ActivityIntegration userProfile={userProfile ? {
        username: userProfile.username,
        balance: userProfile.balance,
        joinDate: userProfile.joinDate instanceof Date ? userProfile.joinDate.toISOString() : String(userProfile.joinDate || new Date().toISOString()),
        totalEarnings: userProfile.totalEarnings,
        totalLosses: userProfile.totalLosses
      } : undefined} />
      <div className="page-container">
        <Sidebar />

        <main className="main-content">
          {/* Top Navigation */}
          <nav className={styles.topNavigation}>
            <h1 className={styles.pageTitle}>
              <Eye size={24} weight="regular" />
              View Traders
            </h1>
            <Navigation currentPage="users" />
          </nav>

          {/* Leaderboard Container */}
          <div className={styles.leaderboardContainer}>
            <h2 className={styles.leaderboardTitle}>Portfolio Leaderboard</h2>
            <div className={styles.leaderboardStats}>
              <p>👥 {users.length} users • 🤖 {bots.length} bots • Showing top {leaderboard.length} traders</p>
              {!marketDataLoaded && <p>📈 Loading market data...</p>}
            </div>
            
            {/* Sort Controls */}
            <div className={styles.sortControls}>
              <span className={styles.sortLabel}>SORT BY:</span>
              <button 
                className={`${styles.sortButton} ${sortBy === '7-day' ? styles.active : ''}`}
                onClick={() => setSortBy('7-day')}
              >
                7-Day Performance
              </button>
              <button 
                className={`${styles.sortButton} ${sortBy === 'portfolio' ? styles.active : ''}`}
                onClick={() => setSortBy('portfolio')}
              >
                Portfolio Value
              </button>
              <button 
                className={`${styles.sortButton} ${sortBy === 'total' ? styles.active : ''}`}
                onClick={() => setSortBy('total')}
              >
                Total Performance
              </button>
              <button 
                className={`${styles.sortButton} ${sortBy === 'volatility' ? styles.active : ''}`}
                onClick={() => setSortBy('volatility')}
              >
                Volatility
              </button>
              <div className={styles.lastRefresh}>
                Last updated: {lastUpdated}
              </div>
            </div>

            {/* Leaderboard Grid */}
            {(users.length === 0 && bots.length === 0) || !marketDataLoaded ? (
              <p style={{ padding: 40 }}>Loading traders…</p>
            ) : (
              <div className={styles.leaderboardGrid}>
                {leaderboard.map((row, idx) => (
                  <LeaderboardCard
                    key={row.uid}
                    rank={idx + 1}
                    data={row}
                    isMe={row.uid === user?.uid}
                    onClick={() => setSelectedUid(row.uid)}
                    onNavigate={() => router.push(`/users/${row.username}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {selectedUser && (
          <UserDetailModal uid={selectedUser.uid} onClose={() => setSelectedUid(null)} />
        )}
      </div>
    </AuthGuard>
  );
}