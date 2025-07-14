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
import { Eye, Lightbulb, Rss, ChartLine } from "@phosphor-icons/react";

/* ── UI ─────────────────────────────────────────────────────────────────── */
import Sidebar from "../components/Sidebar";
import LeaderboardCard from "./components/LeaderboardCard"; // (extract‑ed)
import UserDetailModal from "../components/UserDetailModal"; // (extract‑ed)
import AuthGuard from "../components/AuthGuard";
import ActivityIntegration from "../components/ActivityIntegration";
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
  const marketData = useCollection<{ opinionText: string } & OpinionPrice>(collection(db, "market-data"));
  const bets = useCollection<BetDoc>(collection(db, "advanced-bets"));

  // Fetch bots from the specific document path
  const [bots, setBots] = useState<BotDoc[]>([]);
  
    useEffect(() => {
    const findAndLoadBots = async () => {
      try {
        console.log("🔍 Searching for bots in autonomous-bots collection...");
        
        // First, let's try to find the autonomous-bots collection
        const autonomousBotsRef = collection(db, "autonomous-bots");
        const autonomousBotsSnap = await getDocs(autonomousBotsRef);
        
        console.log(`📁 Found ${autonomousBotsSnap.size} documents in autonomous-bots collection`);
        
        if (autonomousBotsSnap.empty) {
          console.log("❌ No documents found in autonomous-bots collection");
          setBots([]);
          return;
        }
        
        let botsList: BotDoc[] = [];
        
        // Try each document in autonomous-bots
        for (const docSnap of autonomousBotsSnap.docs) {
          console.log(`📄 Checking document: ${docSnap.id}`);
          
          // Check if this document has a 'bots' subcollection
          const botsSubRef = collection(docSnap.ref, "bots");
          const botsSubSnap = await getDocs(botsSubRef);
          
          if (!botsSubSnap.empty) {
            console.log(`🎯 Found bots subcollection in ${docSnap.id} with ${botsSubSnap.size} documents`);
            
            // Check each document in the bots subcollection
            for (const botDocSnap of botsSubSnap.docs) {
              console.log(`🤖 Checking bot document: ${botDocSnap.id}`);
              const botData = botDocSnap.data();
              console.log(`📊 Bot document data:`, botData);
              
              // Extract all bot objects from this document
              Object.entries(botData).forEach(([key, value]: [string, any]) => {
                // Check if this field looks like a bot object
                if (typeof value === 'object' && value !== null && 
                    (key.startsWith('bot_') || 
                     (value.id && value.balance !== undefined) || 
                     (value.personality && typeof value.personality === 'object'))) {
                  
                  const bot = value;
                  const displayName = bot.personality?.name || bot.username || `Bot_${bot.id || key}`;
                  
                  console.log(`✅ Found bot: ${key}`, bot);
                  
                  botsList.push({
                    id: bot.id || key,
                    username: displayName,
                    balance: bot.balance || 0,
                    joinDate: bot.joinDate || new Date().toISOString(),
                    totalEarnings: bot.totalEarnings || 0,
                    totalLosses: bot.totalLosses || 0,
                    personality: bot.personality || {
                      description: "A trading bot",
                      activityFrequency: 100,
                      betProbability: 0.5,
                      buyProbability: 0.5
                    },
                    riskTolerance: bot.riskTolerance || 'moderate',
                    tradingStrategy: bot.tradingStrategy || { type: 'balanced' },
                    lastActive: bot.lastActive || new Date().toISOString(),
                    isActive: bot.isActive !== undefined ? bot.isActive : true,
                    ...bot
                  });
                }
              });
            }
          }
          
          // Also check if the document itself contains bot data
          const docData = docSnap.data();
          if (docData && typeof docData === 'object') {
            Object.entries(docData).forEach(([key, value]: [string, any]) => {
              if (typeof value === 'object' && value !== null && 
                  (key.startsWith('bot_') || 
                   (value.id && value.balance !== undefined) || 
                   (value.personality && typeof value.personality === 'object'))) {
                
                const bot = value;
                const displayName = bot.personality?.name || bot.username || `Bot_${bot.id || key}`;
                
                console.log(`✅ Found bot in main document: ${key}`, bot);
                
                botsList.push({
                  id: bot.id || key,
                  username: displayName,
                  balance: bot.balance || 0,
                  joinDate: bot.joinDate || new Date().toISOString(),
                  totalEarnings: bot.totalEarnings || 0,
                  totalLosses: bot.totalLosses || 0,
                  personality: bot.personality || {
                    description: "A trading bot",
                    activityFrequency: 100,
                    betProbability: 0.5,
                    buyProbability: 0.5
                  },
                  riskTolerance: bot.riskTolerance || 'moderate',
                  tradingStrategy: bot.tradingStrategy || { type: 'balanced' },
                  lastActive: bot.lastActive || new Date().toISOString(),
                  isActive: bot.isActive !== undefined ? bot.isActive : true,
                  ...bot
                });
              }
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

  /* 3️⃣  Derived helpers */
  const priceMap = useMemo(() => {
    const m = new Map<string, OpinionPrice>();
    marketData.forEach((d) => m.set(d.opinionText, d));
    return m;
  }, [marketData]);

  // State for leaderboard and opinion text mapping
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [opinionTextMap, setOpinionTextMap] = useState<Map<string, string>>(new Map());

  // Helper function to get opinion text by ID
  const getOpinionText = async (opinionId: string, fallbackText?: string): Promise<string> => {
    if (fallbackText && fallbackText.trim()) {
      return fallbackText;
    }
    
    if (opinionId && opinionTextMap.has(opinionId)) {
      return opinionTextMap.get(opinionId)!;
    }
    
    if (opinionId) {
      try {
        const docRef = doc(db, "opinions", opinionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const text = data.text || data.opinionText || '';
          if (text) {
            // Update the map for future use
            setOpinionTextMap(prev => new Map(prev).set(opinionId, text));
            return text;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch opinion text for ID:', opinionId, error);
      }
    }
    
    return `Opinion (${opinionId?.slice(0, 8) || 'Unknown'})`;
  };

  // Calculate leaderboard
  useEffect(() => {
    const calculateLeaderboard = async () => {
      // Process regular users
      const regularUsers: LeaderboardEntry[] = await Promise.all(users.map(async (u) => {
        const pf = portfolios.find((p) => p.userId === u.id);
        const userBets = bets.filter((b) => b.userId === u.id);
        
        // Create default portfolio data for users without portfolios
        const defaultPortfolio = {
          userId: u.id,
          ownedOpinions: [],
          shortExposure: 0,
          betExposure: 0,
          snapshots: []
        };
        
        const portfolio = pf || defaultPortfolio;
        
        const value = portfolio.ownedOpinions.reduce((sum, op) => {
          const md = priceMap.get(op.opinionText);
          return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
        }, 0);
        
        const exposure = (portfolio.shortExposure || 0) + (portfolio.betExposure || 0);
        const portfolioValue = value - exposure;
        
        // Calculate performance
        const previousValue = portfolio.snapshots && portfolio.snapshots.length > 0 
          ? portfolio.snapshots[portfolio.snapshots.length - 1].value 
          : portfolioValue;
        const performanceChange = portfolioValue - previousValue;
        const performancePercent = previousValue !== 0 ? (performanceChange / previousValue) * 100 : 0;
        
        // Calculate volatility
        const volatility: 'Low' | 'Medium' | 'High' = exposure > portfolioValue * 0.5 ? 'High' : 
                          exposure > portfolioValue * 0.2 ? 'Medium' : 'Low';
        
        // Get top holdings
        const sortedOpinions = portfolio.ownedOpinions
          .sort((a, b) => {
            const aValue = (priceMap.get(a.opinionText)?.currentPrice ?? a.purchasePrice) * a.quantity;
            const bValue = (priceMap.get(b.opinionText)?.currentPrice ?? b.purchasePrice) * b.quantity;
            return bValue - aValue;
          })
          .slice(0, 2);
        
        const topHoldings = await Promise.all(sortedOpinions.map(async (op) => {
          const currentPrice = priceMap.get(op.opinionText)?.currentPrice ?? op.purchasePrice;
          const value = currentPrice * op.quantity;
          const percentChange = op.purchasePrice > 0 ? ((currentPrice - op.purchasePrice) / op.purchasePrice) * 100 : 0;
          
          // Get the actual opinion text
          const opinionText = await getOpinionText(op.opinionId, op.opinionText);
          
          return {
            text: opinionText,
            value: value,
            currentPrice: currentPrice,
            purchasePrice: op.purchasePrice,
            percentChange: percentChange,
            quantity: op.quantity
          };
        }));
        
        return {
          uid: u.id,
          username: u.username,
          joinDate: u.joinDate,
          portfolioValue,
          exposure,
          opinionsCount: portfolio.ownedOpinions.length,
          betsCount: userBets.length,
          performanceChange,
          performancePercent,
          volatility,
          holdings: portfolio.ownedOpinions.length,
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
        
        const value = portfolio.holdings.reduce((sum, op) => {
          const md = priceMap.get(op.opinionText);
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
        
        // Get top holdings (use existing opinionText for bots)
        const sortedBotOpinions = portfolio.holdings
          .sort((a, b) => {
            const aValue = (priceMap.get(a.opinionText)?.currentPrice ?? a.purchasePrice) * a.quantity;
            const bValue = (priceMap.get(b.opinionText)?.currentPrice ?? b.purchasePrice) * b.quantity;
            return bValue - aValue;
          })
          .slice(0, 2);
        
        const topHoldings = await Promise.all(sortedBotOpinions.map(async (op) => {
          const currentPrice = priceMap.get(op.opinionText)?.currentPrice ?? op.purchasePrice;
          const value = currentPrice * op.quantity;
          const percentChange = op.purchasePrice > 0 ? ((currentPrice - op.purchasePrice) / op.purchasePrice) * 100 : 0;
          
          // Get the actual opinion text
          const opinionText = await getOpinionText(op.opinionId, op.opinionText);
          
          return {
            text: opinionText,
            value: value,
            currentPrice: currentPrice,
            purchasePrice: op.purchasePrice,
            percentChange: percentChange,
            quantity: op.quantity
          };
        }));
        
        return {
          uid: bot.id,
          username: bot.username || `Bot_${bot.id.slice(0, 8)}`,
          joinDate: bot.joinDate,
          portfolioValue,
          exposure,
          opinionsCount: portfolio.holdings.length,
          betsCount: botBets.length,
          performanceChange,
          performancePercent,
          volatility,
          holdings: portfolio.holdings.length,
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
      
      // Debug logging
      console.log('🔍 Leaderboard Debug:', {
        totalUsers: users.length,
        totalBots: bots.length,
        regularUsersProcessed: regularUsers.length,
        botUsersProcessed: botUsers.length,
        finalResults: sortedResults.length,
        first10Results: sortedResults.slice(0, 10).map(r => ({ username: r.username, isBot: r.isBot, portfolioValue: r.portfolioValue }))
      });
      
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
  }, [users, bots, portfolios, botPortfolios, priceMap, bets, sortBy]);

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
        if (text) {
          textMap.set(doc.id, text);
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
            <div className={styles.headerActions}>
              <a href="/feed" className="nav-button">
                <Rss size={20} weight="regular" />
                Live Feed
              </a>
              <a href="/profile" className="nav-button">
                <ChartLine size={20} weight="regular" />
                My Portfolio
              </a>
            </div>
          </nav>

          {/* Leaderboard Container */}
          <div className={styles.leaderboardContainer}>
            <h2 className={styles.leaderboardTitle}>Portfolio Leaderboard</h2>
            <div className={styles.leaderboardStats}>
              <p>👥 {users.length} users • 🤖 {bots.length} bots • Showing top {leaderboard.length} traders</p>
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
            {users.length === 0 && bots.length === 0 ? (
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
