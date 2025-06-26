'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';

type OpinionItem = { id: string; text: string } | string;

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' }[];
}

interface OpinionWithPrice {
  id: string;
  text: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: 'up' | 'down' | 'neutral';
  volatility: 'high' | 'medium' | 'low';
}

export default function Sidebar({
  opinions = [],
}: {
  opinions?: OpinionItem[];
}) {
  const [opinionsWithPrices, setOpinionsWithPrices] = useState<OpinionWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get market data for an opinion
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    
    if (marketData[opinionText]) {
      return marketData[opinionText];
    } else {
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
    }
  };

  // Calculate price trend and movement
  const calculatePriceTrend = (marketData: OpinionMarketData): { trend: 'up' | 'down' | 'neutral', priceChange: number, priceChangePercent: number } => {
    const { priceHistory = [], currentPrice, basePrice } = marketData;
    
    if (!priceHistory || priceHistory.length < 2) {
      const change = currentPrice - basePrice;
      const changePercent = ((currentPrice - basePrice) / basePrice) * 100;
      return {
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
        priceChange: change,
        priceChangePercent: changePercent
      };
    }

    // Compare current price to price from 2 actions ago (or earliest available)
    const comparisonIndex = Math.max(0, priceHistory.length - 3);
    const previousPrice = priceHistory[comparisonIndex]?.price || basePrice;
    
    const change = currentPrice - previousPrice;
    const changePercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
    
    return {
      trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral',
      priceChange: change,
      priceChangePercent: changePercent
    };
  };

  // Determine volatility level
  const getVolatilityLevel = (volatility: number): 'high' | 'medium' | 'low' => {
    if (volatility > 2.0) return 'high';
    if (volatility > 1.3) return 'medium';
    return 'low';
  };

  // Determine opinion source/attribution
  const getOpinionAttribution = (opinionText: string): { type: 'ai' | 'community' | 'user', emoji: string } => {
    // Check if this is from user's actual transactions (user-submitted)
    const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const isUserSubmitted = userTransactions.some((t: any) => 
      t.type === 'earn' && t.opinionText && opinionText.includes(t.opinionText.slice(0, 20))
    );

    if (isUserSubmitted) {
      return { type: 'user', emoji: '✨' };
    }

    // Check for AI-generated patterns or keywords
    const text = opinionText.toLowerCase();
    const aiPatterns = [
      'i think', 'in my opinion', 'it seems', 'perhaps', 'likely', 'probably',
      'could be', 'might be', 'appears', 'suggests', 'indicates', 'future will',
      'prediction:', 'forecast:', 'analysis shows', 'data suggests'
    ];

    const hasAiPattern = aiPatterns.some(pattern => text.includes(pattern));
    
    if (hasAiPattern || text.length > 100) {
      return { type: 'ai', emoji: '🤖' };
    }

    // Default to community for shorter, more casual opinions
    return { type: 'community', emoji: '👥' };
  };

  // Get trend indicator classes and emoji
  const getTrendIndicator = (trend: 'up' | 'down' | 'neutral', volatility: 'high' | 'medium' | 'low') => {
    const className = `${styles.trendIndicator} ${styles[trend]} ${volatility === 'high' ? styles.highVolatility : ''}`;
    
    if (trend === 'up') {
      return { className, emoji: volatility === 'high' ? '🚀' : '📈' };
    } else if (trend === 'down') {
      return { className, emoji: volatility === 'high' ? '💥' : '📉' };
    } else {
      return { className, emoji: '➡️' };
    }
  };

  // Get price change class
  const getPriceChangeClass = (trend: 'up' | 'down' | 'neutral') => {
    return `${styles.priceChange} ${styles[trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral']}`;
  };

  // Get volatility indicator
  const getVolatilityIndicator = (volatility: 'high' | 'medium' | 'low') => {
    const emoji = volatility === 'high' ? '⚡' : volatility === 'medium' ? '🔄' : '🔒';
    const text = volatility === 'high' ? 'High Vol' : volatility === 'medium' ? 'Med Vol' : 'Low Vol';
    return { emoji, text, className: `${styles.volatilityIndicator} ${styles[volatility]}` };
  };

  // Load and process opinion data
  useEffect(() => {
    setIsLoading(true);
    
    const processedOpinions: OpinionWithPrice[] = opinions
      .filter(Boolean)
      .reverse() // Show newest opinions first
      .map((op, i) => {
        const text = typeof op === 'string' ? op : op.text;
        // Use reverse index to maintain correct IDs
        const originalIndex = opinions.length - 1 - i;
        const id = typeof op === 'string' ? `${originalIndex}` : op.id;
        
        const marketData = getOpinionMarketData(text);
        const { trend, priceChange, priceChangePercent } = calculatePriceTrend(marketData);
        const volatilityLevel = getVolatilityLevel(marketData.volatility);
        
        return {
          id,
          text,
          currentPrice: marketData.currentPrice,
          priceChange,
          priceChangePercent,
          trend,
          volatility: volatilityLevel
        };
      });

    setOpinionsWithPrices(processedOpinions);
    setIsLoading(false);

    // Update every 30 seconds to reflect market changes
    const interval = setInterval(() => {
      const updated = processedOpinions.map(opinion => {
        const marketData = getOpinionMarketData(opinion.text);
        const { trend, priceChange, priceChangePercent } = calculatePriceTrend(marketData);
        const volatilityLevel = getVolatilityLevel(marketData.volatility);
        
        return {
          ...opinion,
          currentPrice: marketData.currentPrice,
          priceChange,
          priceChangePercent,
          trend,
          volatility: volatilityLevel
        };
      });
      setOpinionsWithPrices(updated);
    }, 30000);

    return () => clearInterval(interval);
  }, [opinions]);

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.headerTitle}>
          📊 Opinion Exchange
        </h2>
        <p className={styles.headerSubtitle}>
          Live Market Prices
        </p>
      </div>

      {/* Live Feed Link */}
      <a href="/feed" className={styles.liveFeedLink}>
        📡 Live Trading Feed
      </a>

      {/* Table Headers */}
      <div className={styles.tableHeaders}>
        <div className={styles.headerRow}>
          <span>Opinion</span>
          <span>Price</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading market data...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && opinionsWithPrices.length === 0 && (
        <div className={styles.emptyState}>
          <p>📭</p>
          <p>No opinions available yet. Generate some to get started!</p>
        </div>
      )}

      {/* Opinion List */}
      {!isLoading && opinionsWithPrices.length > 0 && (
        <ul className={styles.opinionList}>
          {opinionsWithPrices.map((opinion) => {
            const attribution = getOpinionAttribution(opinion.text);
            const trendIndicator = getTrendIndicator(opinion.trend, opinion.volatility);
            const volatilityIndicator = getVolatilityIndicator(opinion.volatility);
            
            return (
              <li key={opinion.id} className={styles.opinionItem}>
                <Link href={`/opinion/${opinion.id}`} className={styles.opinionLink}>
                  <div className={styles.opinionContent}>
                    <div className={styles.opinionTextSection}>
                      <div className={styles.opinionText}>
                        {opinion.text.slice(0, 45)}
                        {opinion.text.length > 45 && '...'}
                      </div>
                      
                      {/* Attribution Badge */}
                      <div className={`${styles.attributionBadge} ${styles[attribution.type]}`}>
                        {attribution.emoji} {attribution.type === 'ai' ? 'AI' : 
                         attribution.type === 'community' ? 'Community' : 'User'}
                      </div>
                    </div>
                    
                    <div className={styles.priceSection}>
                      <div className={styles.priceDisplay}>
                        ${opinion.currentPrice}
                        <span className={trendIndicator.className}>
                          {trendIndicator.emoji}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price change indicator */}
                  <div className={styles.priceChangeRow}>
                    <div className={getPriceChangeClass(opinion.trend)}>
                      {opinion.priceChange !== 0 ? (
                        <>
                          {opinion.priceChange > 0 ? '+' : ''}${opinion.priceChange.toFixed(1)}
                          {' '}({opinion.priceChangePercent > 0 ? '+' : ''}{opinion.priceChangePercent.toFixed(1)}%)
                        </>
                      ) : (
                        'No change'
                      )}
                    </div>
                    
                    <div className={volatilityIndicator.className}>
                      {volatilityIndicator.emoji} {volatilityIndicator.text}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Market Summary */}
      {!isLoading && opinionsWithPrices.length > 0 && (
        <div className={styles.marketSummary}>
          <div className={styles.summaryTitle}>
            Market Status
          </div>
          <div className={styles.summaryStats}>
            <div className={styles.statItem}>
              <div className={`${styles.statNumber} ${styles.rising}`}>
                {opinionsWithPrices.filter(op => op.trend === 'up').length}
              </div>
              <div className={styles.statLabel}>Rising</div>
            </div>
            <div className={styles.statItem}>
              <div className={`${styles.statNumber} ${styles.falling}`}>
                {opinionsWithPrices.filter(op => op.trend === 'down').length}
              </div>
              <div className={styles.statLabel}>Falling</div>
            </div>
            <div className={styles.statItem}>
              <div className={`${styles.statNumber} ${styles.stable}`}>
                {opinionsWithPrices.filter(op => op.trend === 'neutral').length}
              </div>
              <div className={styles.statLabel}>Stable</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}