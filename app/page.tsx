'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import AuthButton from './components/AuthButton';
import { TrendUp, TrendDown, Minus, Sparkle, Clock, Fire, Eye, ChartLineUp, ChartLineDown, User, SignIn } from '@phosphor-icons/react';

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

export default function HomePage() {
  const [opinions, setOpinions] = useState<OpinionWithPrice[]>([]);
  const [featuredOpinions, setFeaturedOpinions] = useState<OpinionWithPrice[]>([]);
  const [trendingOpinions, setTrendingOpinions] = useState<OpinionWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [priceFlash, setPriceFlash] = useState<{[key: string]: string}>({});
  
  const { user, userProfile } = useAuth();
  const router = useRouter();

  // Log auth state for debugging
  useEffect(() => {
    console.log('HomePage: Auth state - user:', !!user, 'userProfile:', !!userProfile);
  }, [user, userProfile]);

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

  // Calculate price based on market activity
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

  // Get market data for an opinion
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    const marketData = safeGetFromStorage('opinionMarketData', {});
    
    if (marketData[opinionText]) {
      const data = marketData[opinionText];
      return {
        opinionText,
        timesPurchased: data.timesPurchased || 0,
        timesSold: data.timesSold || 0,
        currentPrice: data.currentPrice || 10,
        basePrice: data.basePrice || 10,
        volatility: data.volatility || 1.0,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        priceHistory: data.priceHistory || []
      };
    }
    
    return {
      opinionText,
      timesPurchased: 0,
      timesSold: 0,
      currentPrice: 10,
      basePrice: 10,
      volatility: 1.0,
      lastUpdated: new Date().toISOString(),
      priceHistory: []
    };
  };

  // Calculate price trend
  const calculatePriceTrend = (marketData: OpinionMarketData): { trend: 'up' | 'down' | 'neutral', priceChange: number, priceChangePercent: number } => {
    const { priceHistory = [] } = marketData;
    
    if (priceHistory.length < 2) {
      return { trend: 'neutral', priceChange: 0, priceChangePercent: 0 };
    }
    
    const recentPrices = priceHistory.slice(-5);
    const previousPrice = recentPrices[0]?.price || 10;
    const currentPrice = marketData.currentPrice;
    
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = ((priceChange / previousPrice) * 100);
    
    const trend = priceChange > 0.1 ? 'up' : priceChange < -0.1 ? 'down' : 'neutral';
    
    return {
      trend,
      priceChange: Math.round(priceChange * 100) / 100,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100
    };
  };

  // Get opinion attribution
  const getOpinionAttribution = (opinionText: string): { author: string, isBot: boolean } => {
    const attributions = safeGetFromStorage('opinionAttributions', {});
    
    if (attributions[opinionText]) {
      return {
        author: attributions[opinionText].author,
        isBot: attributions[opinionText].isBot
      };
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
        isBot: true
      };
    }
    
    return {
      author: 'Community',
      isBot: false
    };
  };

  // Load and process opinions
  const loadOpinions = () => {
    const storedOpinions: string[] = safeGetFromStorage('opinions', []);
    const processedOpinions: OpinionWithPrice[] = [];
    
    storedOpinions.forEach((text: string, index: number) => {
      if (!text || typeof text !== 'string') return;
      
      const marketData = getOpinionMarketData(text);
      const { trend, priceChange, priceChangePercent } = calculatePriceTrend(marketData);
      const attribution = getOpinionAttribution(text);
      
      // Check for price changes to trigger flash effect
      const oldPrice = opinions.find(op => op.text === text)?.currentPrice || marketData.currentPrice;
      if (oldPrice !== marketData.currentPrice) {
        setPriceFlash(prev => ({
          ...prev,
          [text]: trend === 'up' ? 'price-up' : trend === 'down' ? 'price-down' : 'neutral'
        }));
        
        // Clear flash after animation
        setTimeout(() => {
          setPriceFlash(prev => {
            const newFlash = { ...prev };
            delete newFlash[text];
            return newFlash;
          });
        }, 1000);
      }
      
      processedOpinions.push({
        id: index.toString(),
        text,
        currentPrice: marketData.currentPrice,
        priceChange,
        priceChangePercent,
        trend,
        volatility: marketData.volatility! > 1.5 ? 'high' : marketData.volatility! < 0.8 ? 'low' : 'medium',
        createdAt: Date.now() - (index * 60000), // Mock creation time
        originalIndex: index,
        timesPurchased: marketData.timesPurchased,
        timesSold: marketData.timesSold,
        volume: marketData.timesPurchased + marketData.timesSold,
        author: attribution.author,
        isBot: attribution.isBot
      });
    });
    
    // Sort by creation time (newest first)
    processedOpinions.sort((a, b) => b.createdAt - a.createdAt);
    
    setOpinions(processedOpinions);
    
    // Set featured opinions (high volume or significant price changes)
    const featured = processedOpinions
      .filter(op => op.volume > 5 || Math.abs(op.priceChangePercent) > 10)
      .slice(0, 3);
    setFeaturedOpinions(featured);
    
    // Set trending opinions (most active)
    const trending = processedOpinions
      .filter(op => op.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);
    setTrendingOpinions(trending);
    
    setLastUpdateTime(new Date().toLocaleTimeString());
  };

  // Handle opinion click
  const handleOpinionClick = (opinion: OpinionWithPrice) => {
    router.push(`/opinion/${opinion.originalIndex}`);
  };

  // Format price change
  const formatPriceChange = (change: number, percent: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}$${change.toFixed(2)} (${sign}${percent.toFixed(1)}%)`;
  };

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return <ChartLineUp size={16} className="status-positive" />;
      case 'down': return <ChartLineDown size={16} className="status-negative" />;
      default: return <Minus size={16} className="status-neutral" />;
    }
  };

  // Get volatility indicator
  const getVolatilityBadge = (volatility: 'high' | 'medium' | 'low') => {
    const badges = {
      high: { emoji: '🔥', label: 'High Vol', class: 'status-negative' },
      medium: { emoji: '⚡', label: 'Med Vol', class: 'status-neutral' },
      low: { emoji: '💧', label: 'Low Vol', class: 'status-positive' }
    };
    
    const badge = badges[volatility];
    return (
      <span className={`${badge.class}`} style={{ fontSize: '12px', fontWeight: '500' }}>
        {badge.emoji} {badge.label}
      </span>
    );
  };

  // Auto-refresh opinions
  useEffect(() => {
    loadOpinions();
    setLoading(false);
    
    const interval = setInterval(() => {
      loadOpinions();
    }, 3000); // Update every 3 seconds for dynamic feel
    
    return () => clearInterval(interval);
  }, []);

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      loadOpinions();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">
          <div className="spinner"></div>
          Loading market data...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar opinions={opinions.map(op => ({ id: op.id, text: op.text }))} />
      
      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">
              <Sparkle size={32} />
            </div>
            <div className="user-info">
              <div className="user-name">
                <div>Opinion Market</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Last updated: {lastUpdateTime}
                </div>
              </div>
              <p>Live opinion trading marketplace • {opinions.length} active opinions</p>
            </div>
          </div>

          <div className="navigation-buttons">
            <a href="/feed" className="nav-button">
              <Fire size={20} /> Live Feed
            </a>
            <a href="/users" className="nav-button">
              <User size={20} /> Traders
            </a>
            <a href="/generate" className="nav-button">
              <Sparkle size={20} /> Generate
            </a>
            {user ? (
              <AuthButton />
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="nav-button"
              >
                <SignIn size={20} /> Login
              </button>
            )}
          </div>
        </div>

        {/* Market Status */}
        <div style={{
          background: 'var(--bg-section)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid var(--border-secondary)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
              Market Status
            </h3>
            <div className="status-positive" style={{ fontSize: '12px', fontWeight: '500' }}>
              ● Live Trading
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Opinions</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>{opinions.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Trending</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--green)' }}>{trendingOpinions.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Featured</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>{featuredOpinions.length}</div>
            </div>
          </div>
        </div>

        {/* Featured Opinions */}
        {featuredOpinions.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fire size={24} /> Featured Opinions
            </h2>
            <div className="grid grid-3">
              {featuredOpinions.map((opinion) => (
                <div
                  key={opinion.id}
                  onClick={() => handleOpinionClick(opinion)}
                  className={`card ${priceFlash[opinion.text] || ''}`}
                  style={{ 
                    cursor: 'pointer',
                    transform: 'translateY(0)',
                    transition: 'all 0.3s ease',
                    border: '2px solid var(--green)',
                    background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-section) 100%)'
                  }}
                >
                  <div className="card-header">
                    <div className="card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {getTrendIcon(opinion.trend)}
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {opinion.isBot ? '🤖' : '👤'} {opinion.author}
                          </span>
                        </div>
                        {getVolatilityBadge(opinion.volatility)}
                      </div>
                      
                      <p className="card-title" style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        marginBottom: '12px',
                        lineHeight: '1.4'
                      }}>
                        {opinion.text.length > 80 ? `${opinion.text.slice(0, 80)}...` : opinion.text}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)' }}>Volume: {opinion.volume}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            ${opinion.currentPrice.toFixed(2)}
                          </div>
                          <div className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
                            {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending Opinions */}
        {trendingOpinions.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendUp size={24} /> Trending Now
            </h2>
            <div className="grid grid-2">
              {trendingOpinions.map((opinion) => (
                <div
                  key={opinion.id}
                  onClick={() => handleOpinionClick(opinion)}
                  className={`card ${priceFlash[opinion.text] || ''}`}
                  style={{ 
                    cursor: 'pointer',
                    transform: 'translateY(0)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div className="card-header">
                    <div className="card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {getTrendIcon(opinion.trend)}
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {opinion.isBot ? '🤖' : '👤'} {opinion.author}
                          </span>
                        </div>
                        {getVolatilityBadge(opinion.volatility)}
                      </div>
                      
                      <p className="card-title" style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        marginBottom: '12px',
                        lineHeight: '1.4'
                      }}>
                        {opinion.text.length > 100 ? `${opinion.text.slice(0, 100)}...` : opinion.text}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)' }}>Volume: {opinion.volume}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            ${opinion.currentPrice.toFixed(2)}
                          </div>
                          <div className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
                            {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Opinions */}
        <section>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={24} /> All Opinions
          </h2>
          
          {opinions.length === 0 ? (
            <div className="empty-state">
              <p>No opinions available yet!</p>
              <p>Visit the <a href="/generate" style={{ color: 'var(--green)' }}>Generate page</a> to create the first opinion.</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {opinions.map((opinion) => (
                <div
                  key={opinion.id}
                  onClick={() => handleOpinionClick(opinion)}
                  className={`card ${priceFlash[opinion.text] || ''}`}
                  style={{ 
                    cursor: 'pointer',
                    transform: 'translateY(0)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div className="card-header">
                    <div className="card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {getTrendIcon(opinion.trend)}
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {opinion.isBot ? '🤖' : '👤'} {opinion.author}
                          </span>
                        </div>
                        {getVolatilityBadge(opinion.volatility)}
                      </div>
                      
                      <p className="card-title" style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        marginBottom: '12px',
                        lineHeight: '1.4'
                      }}>
                        {opinion.text.length > 120 ? `${opinion.text.slice(0, 120)}...` : opinion.text}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)' }}>Volume: {opinion.volume}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            ${opinion.currentPrice.toFixed(2)}
                          </div>
                          {opinion.priceChange !== 0 && (
                            <div className={opinion.trend === 'up' ? 'status-positive' : opinion.trend === 'down' ? 'status-negative' : 'status-neutral'}>
                              {formatPriceChange(opinion.priceChange, opinion.priceChangePercent)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
}