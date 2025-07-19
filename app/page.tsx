"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import AuthButton from './components/AuthButton';
import AuthStatusIndicator from './components/AuthStatusIndicator';
import Navigation from './components/Navigation';
import ActivityIntegration from './components/ActivityIntegration';

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
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Calculate total gain from base price for overall performance
    const basePrice = md.basePrice || 10.0;
    const totalChange = md.currentPrice - basePrice;
    const totalPct = (totalChange / basePrice) * 100;
    
    // Also calculate 24-hour change for trend detection
    let priceFromYesterday = basePrice;
    
    if (hist.length > 0) {
      // Find the closest price point to 24 hours ago
      const validHistory = hist.filter(h => h.timestamp && h.price);
      
      if (validHistory.length > 0) {
        // Find the price entry closest to 24 hours ago
        let closestEntry = validHistory[0];
        let closestTimeDiff = Math.abs(new Date(closestEntry.timestamp).getTime() - twentyFourHoursAgo.getTime());
        
        for (const entry of validHistory) {
          const entryTime = new Date(entry.timestamp).getTime();
          const timeDiff = Math.abs(entryTime - twentyFourHoursAgo.getTime());
          
          if (timeDiff < closestTimeDiff) {
            closestTimeDiff = timeDiff;
            closestEntry = entry;
          }
        }
        
        priceFromYesterday = closestEntry.price;
      }
    }
    
    // Use total change for display, but 24h change for trend direction
    const recentChange = md.currentPrice - priceFromYesterday;
    const trend: 'up' | 'down' | 'neutral' = recentChange > 0.1 ? 'up' : recentChange < -0.1 ? 'down' : 'neutral';
    
    return { 
      trend, 
      priceChange: +totalChange.toFixed(2), 
      priceChangePercent: +totalPct.toFixed(2) 
    };
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
      
      // Ensure holdings is an array before processing
      const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
      
      const value = holdings.reduce((sum, op) => {
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
        opinionsCount: holdings.length,
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
        console.log("🔍 Loading bots from autonomous-bots collection...");
        
        const autonomousBotsRef = collection(db, "autonomous-bots");
        const autonomousBotsSnap = await getDocs(autonomousBotsRef);
        
        console.log(`📁 Found ${autonomousBotsSnap.size} bot documents in autonomous-bots collection`);
        
        if (autonomousBotsSnap.empty) {
          console.log("❌ No bot documents found in autonomous-bots collection");
          setBots([]);
          return;
        }
        
        const botsList: BotDoc[] = [];
        
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
        
        console.log(`🎯 Total bots loaded: ${botsList.length}`);
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
      const opinionDocs = await realtimeDataService.getAllOpinions(); // returns document objects with IDs
      const processed: OpinionWithPrice[] = [];
      // Remove duplicates by text first to prevent duplicate IDs
      const uniqueOpinions = opinionDocs.filter((doc, index, self) => 
        self.findIndex(d => d.text === doc.text) === index
      );
      
      for (const [idx, doc] of uniqueOpinions.entries()) {
        const md = await getOpinionMarketData(doc.text);
        const { trend, priceChange, priceChangePercent } = calculatePriceTrend(md);
        const attr = await getOpinionAttribution(doc.text);

        processed.push({
          id: doc.id, // Use the real Firestore document ID
          text: doc.text,
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
          createdAt: doc.createdAt?.toDate?.()?.getTime() || Date.now() - (idx * 1000 * 60 * 60), // Use real timestamp or fallback
          originalIndex: idx,
          timesPurchased: md.timesPurchased,
          timesSold: md.timesSold,
          volume: md.timesPurchased + md.timesSold,
          author: doc.author || attr.author,
          isBot: doc.isBot || attr.isBot,
        });
      }

      const sorted = processed.sort((a, b) => b.currentPrice - a.currentPrice);
      setOpinions(sorted);
      
      // Featured opinions: only show positive % increases, sorted by biggest increase
      const positiveGainers = processed.filter(o => o.priceChangePercent > 0);
      const sortedByPercentageIncrease = positiveGainers.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
      let featuredList = sortedByPercentageIncrease.slice(0, 4); // Take top 4 opinions with biggest % increase
      
      // If we have less than 2 positive gainers, show the best available opinions
      if (featuredList.length < 2) {
        const remainingOpinions = sorted.filter(o => !featuredList.includes(o));
        const additionalNeeded = Math.min(2 - featuredList.length, remainingOpinions.length);
        featuredList = [...featuredList, ...remainingOpinions.slice(0, additionalNeeded)];
      }
      
      setFeaturedOpinions(featuredList);
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
    const formatPriceChange = (c: number, p: number) => `${c >= 0 ? '+' : ''}$${c.toFixed(2)} (${c >= 0 ? '+' : ''}${p.toFixed(2)}%)`;
  const getTrendIcon = (t: 'up' | 'down' | 'neutral') =>
    t === 'up' ? <ChartLineUp size={16} style={{ color: 'var(--green)' }} /> : t === 'down' ? <ChartLineDown size={16} style={{ color: 'var(--red)' }} /> : <Minus size={16} style={{ color: 'var(--text-secondary)' }} />;

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

          <Navigation currentPage="home" />
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
                    <div className="card-content" style={{ paddingRight: '100px' }}>
                      <p className="card-title">
                        {opinion.text.slice(0, 120)}{opinion.text.length > 120 ? '...' : ''}
                      </p>
                      <p className="card-subtitle">
                        Vol: {opinion.volume} • {opinion.author}
                      </p>
                    </div>
                  </div>
                  <div style={{ 
                    position: 'absolute', 
                    top: '16px', 
                    right: '16px',
                    textAlign: 'right'
                  }}>
                    <p style={{ 
                      color: opinion.currentPrice > 0 ? 'var(--green)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-number)',
                      fontWeight: '600',
                      fontSize: 'var(--font-size-2xl)',
                      margin: '0 0 4px 0'
                    }}>
                      ${opinion.currentPrice.toFixed(2)}
                    </p>
                    <div style={{ 
                      width: '60px', 
                      height: '1px', 
                      backgroundColor: 'var(--border-primary)'
                    }} />
                  </div>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '16px', 
                    right: '16px',
                    color: opinion.priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                    fontFamily: 'var(--font-number)',
                    fontWeight: '500',
                    fontSize: 'var(--font-size-sm)',
                    textAlign: 'right'
                  }}>
                    {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
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
                              {trader.portfolioValue >= 1000 ? (((trader.portfolioValue - 1000) / 1000) * 100).toFixed(2) : 
                               trader.portfolioValue < 0 ? (((trader.portfolioValue) / 1000) * 100).toFixed(2) : '0.00'}%
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
              <p>No opinions available yet. Check back soon!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-2" style={{ marginLeft: 20, marginRight: 20 }}>
                {opinions.slice(0, 15).map((opinion) => (
                  <div key={opinion.id} className="card" onClick={() => handleOpinionClick(opinion)}>
                    <div className="card-header">
                      <div className="card-content" style={{ paddingRight: '100px' }}>
                        <p className="card-title">
                          {opinion.text.slice(0, 100)}...
                        </p>
                        <p className="card-subtitle">
                          Vol: {opinion.volume} • {opinion.author}
                        </p>
                      </div>
                    </div>
                    <div style={{ 
                      position: 'absolute', 
                      top: '16px', 
                      right: '16px',
                      textAlign: 'right'
                    }}>
                      <p style={{ 
                        color: opinion.currentPrice > 0 ? 'var(--green)' : 'var(--text-primary)',
                        fontFamily: 'var(--font-number)',
                        fontWeight: '600',
                        fontSize: 'var(--font-size-2xl)',
                        margin: '0 0 4px 0'
                      }}>
                        ${opinion.currentPrice.toFixed(2)}
                      </p>
                      <div style={{ 
                        width: '60px', 
                        height: '1px', 
                        backgroundColor: 'var(--border-primary)'
                      }} />
                    </div>
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '16px', 
                      right: '16px',
                      color: opinion.priceChange >= 0 ? 'var(--green)' : 'var(--red)',
                      fontFamily: 'var(--font-number)',
                      fontWeight: '500',
                      fontSize: 'var(--font-size-sm)',
                      textAlign: 'right'
                    }}>
                      {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Start Talking Button */}
              {opinions.length > 15 && (
                <div style={{ 
                  marginTop: '40px', 
                  marginLeft: 20, 
                  marginRight: 20,
                  display: 'flex', 
                  justifyContent: 'center' 
                }}>
                  <button 
                    onClick={() => user ? router.push('/generate') : setShowAuthModal(true)}
                    style={{
                      padding: '16px 48px',
                      backgroundColor: 'white',
                      border: '2px solid black',
                      borderRadius: '16px',
                      color: 'black',
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      minWidth: '200px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    }}
                  >
                    Start Talking
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Activity Integration for real-time updates */}
      <ActivityIntegration />
    </div>
  );
}