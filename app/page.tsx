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
  Trophy,
  Crown,
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
}

interface UserDoc {
  id: string;
  username: string;
  joinDate: string;
  avatar?: string;
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
  const [marketDataMap, setMarketDataMap] = useState<Map<string, any>>(new Map());

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
  
  // Calculate leaderboard from users, portfolios, and market data
  const leaderboard = useMemo(() => {
    if (users.length === 0 || portfolios.length === 0) return [];
    
    return users.map((u) => {
      const pf = portfolios.find((p) => p.userId === u.id);
      if (!pf) return null;
      
      const value = pf.ownedOpinions.reduce((sum, op) => {
        const md = marketDataMap.get(op.opinionText);
        return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
      }, 0);
      
      const exposure = (pf.shortExposure || 0) + (pf.betExposure || 0);
      
      return {
        uid: u.id,
        username: u.username,
        joinDate: u.joinDate,
        portfolioValue: value - exposure,
        exposure,
        opinionsCount: pf.ownedOpinions.length,
      };
    }).filter(Boolean) as LeaderboardUser[];
  }, [users, portfolios, marketDataMap]);

  // Get top 5 for preview
  const topUsers = useMemo(() => {
    return leaderboard
      .sort((a, b) => b.portfolioValue - a.portfolioValue)
      .slice(0, 5);
  }, [leaderboard]);

  /* ------------------------------------------------------------------
   * LOAD & SUBSCRIBE
   * ----------------------------------------------------------------*/
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
      setFeaturedOpinions(sorted.filter(o => o.volume > 5 || Math.abs(o.priceChangePercent) > 10).slice(0, 3));
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

  // Leaderboard data subscriptions - only when authenticated
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

    // For now, disable leaderboard subscriptions since they require special permissions
    // TODO: Create a public leaderboard collection or adjust firestore rules
    console.log("⚠️ Leaderboard subscriptions disabled due to auth requirements");
    
    return () => {
      unsubMarketData();
    };
  }, []);

  /* ------------------------------------------------------------------
   * UI helpers (unchanged apart from imports)
   * ----------------------------------------------------------------*/
  const handleOpinionClick = (op: OpinionWithPrice) => router.push(`/opinion/${op.id}`);
  const formatPriceChange = (c: number, p: number) => `${c >= 0 ? '+' : ''}$${c.toFixed(2)} (${c >= 0 ? '+' : ''}${p.toFixed(1)}%)`;
  const getTrendIcon = (t: 'up' | 'down' | 'neutral') =>
    t === 'up' ? <ChartLineUp size={16} className="status-positive" /> : t === 'down' ? <ChartLineDown size={16} className="status-negative" /> : <Minus size={16} className="status-neutral" />;
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
      
      <main className="main-content">
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

        {/* Featured Opinions */}
        {featuredOpinions.length > 0 && (
          <section className="section" style={{ marginLeft: 20 }}>
            <h2 className="section-title">Featured Opinions</h2>
            <div className="grid grid-3" style={{ marginLeft: 20 }}>
              {featuredOpinions.map((opinion) => (
                <div key={opinion.id} className="card" onClick={() => handleOpinionClick(opinion)}>
                  <div className="card-header">
                    <div className="card-content">
                      <p className="card-title">{opinion.text.slice(0, 80)}...</p>
                      <p className="card-subtitle">
                        Vol: {opinion.volume} • {opinion.author}
                      </p>
                    </div>
                    <div className={styles.opinionPricing}>
                      <div className={styles.currentPricing}>
                        <p>${opinion.currentPrice.toFixed(2)}</p>
                        <p className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
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
          <section className="section" style={{ marginLeft: 20 }}>
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
                        <p>${opinion.currentPrice.toFixed(2)}</p>
                        <p className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
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

        {/* Leaderboard Preview */}
        <section className="section" style={{ marginLeft: 20 }}>
          <h2 className="section-title">
            Top Traders
            <a href="/users" style={{ 
              fontSize: '14px', 
              marginLeft: '16px', 
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: '400'
            }}>
              View All →
            </a>
          </h2>
          {topUsers.length === 0 ? (
            <div className="empty-state">
              <p>Leaderboard temporarily unavailable</p>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                Sign in to view trader rankings
              </p>
              <AuthButton />
            </div>
          ) : (
            <div className="grid grid-3" style={{ marginLeft: 20 }}>
              {topUsers.map((trader, idx) => (
                <div 
                  key={trader.uid} 
                  className="card" 
                  onClick={() => router.push(`/users/${trader.username}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-header">
                    <div className="card-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                          color: idx < 3 ? '#000' : 'var(--text-primary)'
                        }}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="card-title" style={{ margin: 0 }}>{trader.username}</p>
                          <p className="card-subtitle" style={{ margin: '2px 0 0 0' }}>
                            {trader.opinionsCount} opinions
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.opinionPricing}>
                      <div className={styles.currentPricing}>
                        <p className={trader.portfolioValue >= 0 ? 'status-positive' : 'status-negative'}>
                          ${trader.portfolioValue.toFixed(2)}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          Portfolio Value
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* All Opinions */}
        <section className="section" style={{ marginLeft: 20 }}>
          <h2 className="section-title">All Opinions</h2>
          {opinions.length === 0 ? (
            <div className="empty-state">
              <p>No opinions available yet. Be the first to share your thoughts!</p>
              <button onClick={() => window.location.href = '/generate'} className="btn btn-primary">
                <Sparkle size={16} /> Generate Opinion
              </button>
            </div>
          ) : (
            <div className="grid grid-2" style={{ marginLeft: 20 }}>
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
                        <p>${opinion.currentPrice.toFixed(2)}</p>
                        <p className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
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