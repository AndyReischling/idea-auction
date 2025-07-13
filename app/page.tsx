"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import AuthButton from './components/AuthButton';
import { realtimeDataService } from './lib/realtime-data-service';
import { collection, onSnapshot, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './lib/firebase';
import { publicLeaderboardService, PublicLeaderboardEntry } from './lib/public-leaderboard';
import styles from './page.module.css';
import {
  TrendUp,
  ChartLineUp,
  ChartLineDown,
  Minus,
  Sparkle,
  Clock,
  Fire,
  Eye,
  User,
  SignIn,
  Crown,
  Trophy,
} from '@phosphor-icons/react';

/* ------------------------------------------------------------------
 * TYPES
 * ------------------------------------------------------------------*/
interface OpinionWithPrice {
  id: string;
  text: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: 'up' | 'down' | 'neutral';
  volatility: 'high' | 'medium' | 'low';
  createdAt: number;
  originalIndex: number;
  timesPurchased: number;
  timesSold: number;
  volume: number;
  author: string;
  isBot: boolean;
}

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility?: number;
  lastUpdated: string;
  priceHistory?: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create' }[];
}

interface LeaderboardUser {
  uid: string;
  username: string;
  joinDate: string;
  portfolioValue: number;
  exposure: number;
  opinionsCount: number;
  isBot?: boolean;
}

interface UserDoc {
  id: string;
  username: string;
  joinDate: string;
  avatar?: string;
}

interface BotDoc {
  id: string;
  username?: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  personality?: any;
  riskTolerance?: string;
  tradingStrategy?: any;
  lastActive?: string;
  isActive?: boolean;
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

/* ------------------------------------------------------------------
 * COMPONENT
 * ------------------------------------------------------------------*/
export default function HomePage() {
  /* -------------------------- state --------------------------- */
  const [opinions, setOpinions] = useState<OpinionWithPrice[]>([]);
  const [featuredOpinions, setFeaturedOpinions] = useState<OpinionWithPrice[]>([]);
  const [trendingOpinions, setTrendingOpinions] = useState<OpinionWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [priceFlash, setPriceFlash] = useState<Record<string, string>>({});

  // Leaderboard state
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioDoc[]>([]);
  const [bots, setBots] = useState<BotDoc[]>([]);
  const [botPortfolios, setBotPortfolios] = useState<BotPortfolioDoc[]>([]);
  const [marketDataMap, setMarketDataMap] = useState<Map<string, any>>(new Map());
  const [publicLeaderboard, setPublicLeaderboard] = useState<PublicLeaderboardEntry[]>([]);

  const { user, userProfile } = useAuth();
  const router = useRouter();

  /* ------------------------------------------------------------------
   * HELPERS – everything below hits Firestore via realtimeDataService
   * ----------------------------------------------------------------*/

  const calculatePrice = (
    timesPurchased: number,
    timesSold: number,
    basePrice: number = 10,
  ) => {
    const net = timesPurchased - timesSold;
    const multiplier = net >= 0 ? Math.pow(1.001, net) : Math.max(0.1, Math.pow(0.999, Math.abs(net)));
    return Math.round(Math.max(basePrice * 0.5, basePrice * multiplier) * 100) / 100;
  };

  const getOpinionMarketData = async (text: string): Promise<OpinionMarketData> => {
    const marketData = await realtimeDataService.getMarketData();
    const fallback: OpinionMarketData = {
      opinionText: text,
      timesPurchased: 0,
      timesSold: 0,
      currentPrice: 10,
      basePrice: 10,
      volatility: 1,
      lastUpdated: new Date().toISOString(),
      priceHistory: [],
    };
    return marketData[text] ? { ...fallback, ...marketData[text] } : fallback;
  };

  const calculatePriceTrend = (md: OpinionMarketData) => {
    const hist = md.priceHistory ?? [];
    if (hist.length < 2) return { trend: 'neutral', priceChange: 0, priceChangePercent: 0 };
    const prev = hist[hist.length - 2].price;
    const change = md.currentPrice - prev;
    const pct = (change / prev) * 100;
    const trend: 'up' | 'down' | 'neutral' = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';
    return { trend, priceChange: +change.toFixed(2), priceChangePercent: +pct.toFixed(2) };
  };

  const getOpinionAttribution = async (text: string) => {
    // For now, return default attribution since getTransactionsForOpinion doesn't exist
    return { author: 'AI', isBot: false };
  };

  /* ------------------------------------------------------------------
   * LEADERBOARD LOGIC
   * ----------------------------------------------------------------*/
  
  // Calculate leaderboard from users, portfolios, and market data - only for authenticated users
  const leaderboard = useMemo(() => {
    if (!user || (users.length === 0 && bots.length === 0)) return [];
    
    // Process regular users
    const regularUsers = users.map((u) => {
      const pf = portfolios.find((p) => p.userId === u.id);
      
      // Create default portfolio data for users without portfolios
      const defaultPortfolio = {
        userId: u.id,
        ownedOpinions: [] as Array<{
          opinionId: string;
          opinionText: string;
          quantity: number;
          purchasePrice: number;
        }>,
        shortExposure: 0,
        betExposure: 0
      };
      
      const portfolio = pf || defaultPortfolio;
      
      const value = portfolio.ownedOpinions.reduce((sum, op) => {
        const md = marketDataMap.get(op.opinionText);
        return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
      }, 0);
      
      const exposure = (portfolio.shortExposure || 0) + (portfolio.betExposure || 0);
      
      return {
        uid: u.id,
        username: u.username,
        joinDate: u.joinDate,
        portfolioValue: value - exposure,
        exposure,
        opinionsCount: portfolio.ownedOpinions.length,
        isBot: false,
      };
    }) as LeaderboardUser[];

    // Process bots
    const botUsers = bots.map((bot) => {
      const botPf = botPortfolios.find((bp) => bp.botId === bot.id);
      const portfolio = botPf || { botId: bot.id, holdings: [] };
      
      const value = portfolio.holdings.reduce((sum, op) => {
        const md = marketDataMap.get(op.opinionText);
        return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
      }, 0);
      
      const exposure = 0; // Bots don't have short exposure typically
      
      return {
        uid: bot.id,
        username: bot.username || `Bot_${bot.id.slice(0, 8)}`,
        joinDate: bot.joinDate,
        portfolioValue: value - exposure,
        exposure,
        opinionsCount: portfolio.holdings.length,
        isBot: true,
      };
    });

    // Merge users and bots, then sort by portfolio value
    return [...regularUsers, ...botUsers].sort((a, b) => b.portfolioValue - a.portfolioValue);
  }, [user, users, bots, portfolios, botPortfolios, marketDataMap]);

  // Get top 10 traders for homepage display - use public leaderboard for unauthorized users
  const topUsers = useMemo(() => {
    if (user) {
      // For authenticated users, use the full leaderboard
      return leaderboard
        .sort((a, b) => b.portfolioValue - a.portfolioValue)
        .slice(0, 10);
    } else {
      // For unauthorized users, use the public leaderboard
      return publicLeaderboard.map(trader => ({
        uid: trader.uid,
        username: trader.username,
        joinDate: '', // Not needed for public display
        portfolioValue: trader.portfolioValue,
        exposure: 0, // Not needed for public display
        opinionsCount: trader.topHoldings.length,
        isBot: trader.isBot
      }));
    }
  }, [leaderboard, publicLeaderboard, user]);

  /* ------------------------------------------------------------------
   * LOAD & SUBSCRIBE
   * ----------------------------------------------------------------*/
  
  // Fetch bots from autonomous-bots collection
  useEffect(() => {
    const findAndLoadBots = async () => {
      try {
        console.log("🔍 Searching for bots in autonomous-bots collection...");
        
        const autonomousBotsRef = collection(db, "autonomous-bots");
        const autonomousBotsSnap = await getDocs(autonomousBotsRef);
        
        console.log(`📁 Found ${autonomousBotsSnap.size} documents in autonomous-bots collection`);
        
        if (autonomousBotsSnap.empty) {
          console.log("❌ No documents found in autonomous-bots collection");
          setBots([]);
          return;
        }
        
        const botsList: BotDoc[] = [];
        
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
        
        console.log(`🎯 Total bots found: ${botsList.length}`);
        setBots(botsList);
      } catch (error) {
        console.error("❌ Error loading bots:", error);
        setBots([]);
      }
    };
    
    findAndLoadBots();
  }, []);

  const loadOpinions = async () => {
    setLoading(true);
    try {
      const opinionTexts = await realtimeDataService.getAllOpinions(); // returns string[]
      const processed: OpinionWithPrice[] = [];
      // Remove duplicates first to prevent duplicate IDs
      const uniqueTexts = [...new Set(opinionTexts)];
      
      for (const [idx, text] of uniqueTexts.entries()) {
        const md = await getOpinionMarketData(text);
        const { trend, priceChange, priceChangePercent } = calculatePriceTrend(md);
        const attr = await getOpinionAttribution(text);

        processed.push({
          id: `${btoa(text).replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}_${idx}`, // generate unique ID from text + index
          text: text,
          currentPrice: md.currentPrice,
          priceChange,
          priceChangePercent,
          trend: trend as 'up' | 'down' | 'neutral',
          volatility:
            md.volatility && md.volatility > 1.5
              ? 'high'
              : md.volatility && md.volatility > 1.2
              ? 'medium'
              : 'low',
          createdAt: Date.now() - (idx * 1000 * 60 * 60), // mock timestamps
          originalIndex: idx,
          timesPurchased: md.timesPurchased,
          timesSold: md.timesSold,
          volume: md.timesPurchased + md.timesSold,
          author: attr.author,
          isBot: attr.isBot,
        });
      }

      const sorted = processed.sort((a, b) => b.createdAt - a.createdAt);
      setOpinions(sorted);
      
      // Featured opinions: always 2-4 opinions, prioritizing volume and price volatility
      const qualifyingOpinions = sorted.filter(o => o.volume > 5 || Math.abs(o.priceChangePercent) > 10);
      let featuredList = qualifyingOpinions.slice(0, 4); // Take up to 4 qualifying opinions
      
      // If we have less than 2, fill up to 2 with the next best opinions from the sorted list
      if (featuredList.length < 2) {
        const remainingOpinions = sorted.filter(o => !featuredList.includes(o));
        const additionalNeeded = 2 - featuredList.length;
        featuredList = [...featuredList, ...remainingOpinions.slice(0, additionalNeeded)];
      }
      
      setFeaturedOpinions(featuredList);
      setTrendingOpinions(
        sorted
          .filter(o => o.trend !== 'neutral')
          .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
          .slice(0, 5),
      );
      setLastUpdateTime(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Subscribe to Firestore changes via service wrappers
    const unsubOpinions = realtimeDataService.subscribeToAllOpinions(() => loadOpinions());
    const unsubMarket = realtimeDataService.subscribeToMarketData(() => loadOpinions());
    // initial fetch
    loadOpinions();
    return () => {
      realtimeDataService.unsubscribe(unsubOpinions);
      realtimeDataService.unsubscribe(unsubMarket);
    };
  }, []);

  // Leaderboard data subscriptions
  useEffect(() => {
    // Market data is publicly readable, so we can always subscribe to it
    const unsubMarketData = onSnapshot(collection(db, "market-data"), (snap) => {
      const map = new Map();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.opinionText) {
          map.set(data.opinionText, data);
        }
      });
      setMarketDataMap(map);
    });

    // Subscribe to public leaderboard for unauthorized users
    const unsubPublicLeaderboard = publicLeaderboardService.subscribeToPublicLeaderboard((leaderboard) => {
      console.log('📊 Public leaderboard updated:', leaderboard.length, 'traders');
      setPublicLeaderboard(leaderboard);
    });

    // If authenticated, subscribe to full leaderboard data
    if (user) {
      // Subscribe to users and portfolios for authenticated users
      const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        const usersList: UserDoc[] = [];
        snap.docs.forEach((doc) => {
          const data = doc.data();
          usersList.push({
            id: doc.id,
            username: data.username,
            joinDate: data.joinDate,
            avatar: data.avatar
          });
        });
        setUsers(usersList);
      });

      const unsubPortfolios = onSnapshot(collection(db, "user-portfolios"), (snap) => {
        const portfoliosList: PortfolioDoc[] = [];
        snap.docs.forEach((doc) => {
          const data = doc.data();
          portfoliosList.push({
            userId: doc.id,
            ownedOpinions: data.ownedOpinions || [],
            shortExposure: data.shortExposure || 0,
            betExposure: data.betExposure || 0
          });
        });
        setPortfolios(portfoliosList);
      });

      // Subscribe to bot portfolios
      const unsubBotPortfolios = onSnapshot(collection(db, "bot-portfolios"), (snap) => {
        const botPortfoliosList: BotPortfolioDoc[] = [];
        snap.docs.forEach((doc) => {
          const data = doc.data();
          botPortfoliosList.push({
            botId: doc.id,
            holdings: data.holdings || []
          });
        });
        setBotPortfolios(botPortfoliosList);
      });

      return () => {
        unsubMarketData();
        unsubPublicLeaderboard();
        unsubUsers();
        unsubPortfolios();
        unsubBotPortfolios();
      };
    }
    
    return () => {
      unsubMarketData();
      unsubPublicLeaderboard();
    };
  }, [user]);

  // Update public leaderboard when full leaderboard changes (for authenticated users)
  useEffect(() => {
    if (user && leaderboard.length > 0) {
      const publicLeaderboardData = leaderboard.slice(0, 10).map(trader => ({
        uid: trader.uid,
        username: trader.username,
        portfolioValue: trader.portfolioValue,
        topHoldings: [], // We don't have top holdings data in this simplified version
        isBot: trader.isBot || false
      }));
      
      publicLeaderboardService.updatePublicLeaderboard(publicLeaderboardData);
    }
  }, [user, leaderboard]);

  /* ------------------------------------------------------------------
   * UI helpers (unchanged apart from imports)
   * ----------------------------------------------------------------*/
  const handleOpinionClick = (op: OpinionWithPrice) => router.push(`/opinion/${op.id}`);
  const formatPriceChange = (c: number, p: number) => `${c >= 0 ? '+' : ''}$${c.toFixed(2)} (${c >= 0 ? '+' : ''}${p.toFixed(1)}%)`;
  const getTrendIcon = (t: 'up' | 'down' | 'neutral') =>
    t === 'up' ? <ChartLineUp size={16} style={{ color: 'var(--green)' }} /> : t === 'down' ? <ChartLineDown size={16} style={{ color: 'var(--red)' }} /> : <Minus size={16} style={{ color: 'var(--text-secondary)' }} />;
  const getVolatilityBadge = (v: 'high' | 'medium' | 'low') => {
    const map = {
      high: { l: 'High Vol', c: 'status-negative', bg: '#ef4444' },
      medium: { l: 'Med Vol', c: 'status-neutral', bg: '#6b7280' },
      low: { l: 'Low Vol', c: 'status-positive', bg: '#22c55e' },
    }[v];
    return (
      <span className={map.c} style={{ fontSize: 12, fontWeight: 500, padding: '2px 6px', borderRadius: 4, backgroundColor: map.bg, color: '#fff' }}>
        {map.l}
      </span>
    );
  };

  /* ------------------------------------------------------------------
   * RENDER — the long JSX remains largely unchanged
   * ----------------------------------------------------------------*/
  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">
          <div className="spinner" /> Loading market data…
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      
      <main className="main-content" style={{ paddingTop: '110px' }}>
        {/* Header */}
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">
              <Fire size={24} />
            </div>
            <div className="user-info">
              <div className="user-name">Opinion Market</div>
              <p>Live market feed</p>
              {lastUpdateTime && <p>Last updated: {lastUpdateTime}</p>}
            </div>
          </div>

          <div className="navigation-buttons">
            <a href="/users" className="nav-button">
              <User size={20} /> Traders
            </a>
            <a href="/feed" className="nav-button">
              <Fire size={20} /> Feed
            </a>
            <a href="/generate" className="nav-button">
              <Sparkle size={20} /> Generate
            </a>
            <AuthButton />
          </div>
        </div>

        {/* Hottest Opinions Header */}
        <div style={{ marginTop: '30px', marginBottom: '16px', marginLeft: '20px' }}>
          <h1 style={{ 
            fontSize: 'var(--font-size-3xl)', 
            fontWeight: '700', 
            color: 'var(--text-primary)',
            margin: '0'
          }}>
            Hottest Opinions
          </h1>
        </div>

        {/* Featured Opinions */}
        {featuredOpinions.length > 0 && (
          <section style={{ marginLeft: 20, marginRight: 20, marginBottom: '40px' }}>
            <div className="grid grid-square" style={{ marginLeft: 20, marginRight: 20 }}>
              {featuredOpinions.map((opinion) => (
                <div key={opinion.id} className="card-square" onClick={() => handleOpinionClick(opinion)}>
                  <div className="card-header">
                    <div className="card-content">
                      <p className="card-title">{opinion.text.slice(0, 120)}{opinion.text.length > 120 ? '...' : ''}</p>
                      <p className="card-subtitle">
                        Vol: {opinion.volume} • {opinion.author}
                      </p>
                    </div>
                    <div className={styles.opinionPricing}>
                      <div className={styles.currentPricing}>
                        <p style={{ 
                          color: opinion.currentPrice > 0 ? 'var(--green)' : 'var(--text-primary)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '600'
                        }}>
                          ${opinion.currentPrice.toFixed(2)}
                        </p>
                        <p style={{ 
                          color: opinion.priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '500'
                        }}>
                          {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                        </p>
                      </div>
                      {getTrendIcon(opinion.trend)}
                    </div>
                  </div>
                  {getVolatilityBadge(opinion.volatility)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending Opinions */}
        {trendingOpinions.length > 0 && (
          <section className="section" style={{ 
            marginLeft: 20, 
            borderTop: '2px solid var(--border-primary)', 
            paddingTop: '40px' 
          }}>
            <h2 className="section-title">Trending Opinions</h2>
            <div className="grid grid-2" style={{ marginLeft: 20 }}>
              {trendingOpinions.map((opinion) => (
                <div key={opinion.id} className="card" onClick={() => handleOpinionClick(opinion)}>
                  <div className="card-header">
                    <div className="card-content">
                      <p className="card-title">{opinion.text.slice(0, 60)}...</p>
                      <p className="card-subtitle">
                        Vol: {opinion.volume} • {opinion.author}
                      </p>
                    </div>
                    <div className={styles.opinionPricing}>
                      <div className={styles.currentPricing}>
                        <p style={{ 
                          color: opinion.currentPrice > 0 ? 'var(--green)' : 'var(--text-primary)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '600'
                        }}>
                          ${opinion.currentPrice.toFixed(2)}
                        </p>
                        <p style={{ 
                          color: opinion.priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '500'
                        }}>
                          {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                        </p>
                      </div>
                      {getTrendIcon(opinion.trend)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Traders */}
        <section className="section" style={{ 
          marginLeft: 20, 
          borderTop: '2px solid var(--border-primary)', 
          paddingTop: '40px' 
        }}>
          <h2 className="section-title" style={{ 
            fontSize: 'var(--font-size-2xl)', 
            fontWeight: '700',
            marginBottom: '24px'
          }}>
            🏆 Top Traders
          </h2>
          {topUsers.length === 0 ? (
            <div className="empty-state">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <p style={{ margin: 0 }}>Loading top traders...</p>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>
                {user ? 'Loading full leaderboard data...' : 'Loading public leaderboard...'}
              </p>
            </div>
          ) : (
            <div style={{ marginLeft: 20, marginRight: 20, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topUsers.map((trader, idx) => (
                                  <div 
                  key={trader.uid} 
                  className="card" 
                  onClick={() => router.push(`/users/${trader.username}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-header" style={{ display: 'flex', alignItems: 'center', minHeight: '120px' }}>
                    <div className="card-content" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'var(--bg-elevated)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          color: idx < 3 ? '#000' : 'var(--text-primary)',
                          flexShrink: 0
                        }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p className="card-title" style={{ margin: 0 }}>
                            {trader.username}
                            {((user && trader.isBot) || (!user && publicLeaderboard.find(t => t.uid === trader.uid)?.isBot)) && (
                              <span style={{ 
                                fontSize: '12px', 
                                marginLeft: '6px', 
                                color: 'var(--text-secondary)',
                                fontWeight: 'normal'
                              }}>
                                🤖 Bot
                              </span>
                            )}
                          </p>
                          <p className="card-subtitle" style={{ margin: '2px 0 8px 0' }}>
                            {trader.opinionsCount} {user ? 'opinions' : 'holdings'}
                          </p>
                          
                          {/* P+L Percentage under username */}
                          <div style={{ marginBottom: '4px' }}>
                            <p style={{ 
                              margin: 0,
                              fontSize: 'var(--font-size-lg)',
                              fontWeight: '600',
                              fontFamily: 'var(--font-number)',
                              color: trader.portfolioValue >= 1000 ? 'var(--green)' : trader.portfolioValue < 0 ? 'var(--red)' : 'var(--text-secondary)'
                            }}>
                              {trader.portfolioValue >= 1000 ? '+' : ''}
                              {trader.portfolioValue >= 1000 ? (((trader.portfolioValue - 1000) / 1000) * 100).toFixed(1) : 
                               trader.portfolioValue < 0 ? (((trader.portfolioValue) / 1000) * 100).toFixed(1) : '0.0'}%
                            </p>
                            <p style={{ 
                              margin: 0,
                              fontSize: '11px', 
                              color: 'var(--text-tertiary)',
                              fontWeight: '500'
                            }}>
                              P+L %
                            </p>
                          </div>
                          
                          {/* Exposure under P+L */}
                          <div>
                            <p style={{ 
                              margin: 0,
                              fontSize: 'var(--font-size-base)',
                              fontWeight: '600',
                              fontFamily: 'var(--font-number)',
                              color: trader.exposure > 0 ? 'var(--red)' : 'var(--text-secondary)'
                            }}>
                              ${trader.exposure.toFixed(2)}
                            </p>
                            <p style={{ 
                              margin: 0,
                              fontSize: '11px', 
                              color: 'var(--text-tertiary)',
                              fontWeight: '500'
                            }}>
                              Exposure
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Portfolio Value - larger and centered vertically */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      minWidth: '140px',
                      height: '100%'
                    }}>
                      <p style={{ 
                        margin: 0,
                        fontSize: 'var(--font-size-3xl)',
                        fontWeight: '800',
                        fontFamily: 'var(--font-number)',
                        color: trader.portfolioValue >= 0 ? 'var(--green)' : 'var(--red)'
                      }}>
                        ${trader.portfolioValue.toFixed(2)}
                      </p>
                      <p style={{ 
                        margin: 0,
                        fontSize: '12px', 
                        color: 'var(--text-tertiary)',
                        fontWeight: '500'
                      }}>
                        Portfolio Value
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* All Opinions */}
        <section className="section" style={{ 
          marginLeft: 20, 
          marginRight: 20, 
          borderTop: '2px solid var(--border-primary)', 
          paddingTop: '40px' 
        }}>
          <h2 className="section-title">All Opinions</h2>
          {opinions.length === 0 ? (
            <div className="empty-state">
              <p>No opinions available yet. Be the first to share your thoughts!</p>
              <button onClick={() => window.location.href = '/generate'} className="btn btn-primary">
                <Sparkle size={16} /> Generate Opinion
              </button>
            </div>
          ) : (
            <div className="grid grid-2" style={{ marginLeft: 20, marginRight: 20 }}>
              {opinions.map((opinion) => (
                <div key={opinion.id} className="card" onClick={() => handleOpinionClick(opinion)}>
                  <div className="card-header">
                    <div className="card-content">
                      <p className="card-title">{opinion.text.slice(0, 100)}...</p>
                      <p className="card-subtitle">
                        Vol: {opinion.volume} • {opinion.author} • {getVolatilityBadge(opinion.volatility)}
                      </p>
                    </div>
                    <div className={styles.opinionPricing}>
                      <div className={styles.currentPricing}>
                        <p style={{ 
                          color: opinion.currentPrice > 0 ? 'var(--green)' : 'var(--text-primary)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '600'
                        }}>
                          ${opinion.currentPrice.toFixed(2)}
                        </p>
                        <p style={{ 
                          color: opinion.priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'var(--font-number)',
                          fontWeight: '500'
                        }}>
                          {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                        </p>
                      </div>
                      {getTrendIcon(opinion.trend)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}