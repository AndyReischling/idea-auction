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
  createdAt: number;
  originalIndex: number; // Keep track of original array position
}

export default function Sidebar({
  opinions = [],
}: {
  opinions?: OpinionItem[];
}) {
  const [opinionsWithPrices, setOpinionsWithPrices] = useState<OpinionWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // FIXED: Get all opinions with proper creation timestamps and maintain array index mapping
  const getAllOpinions = (): { id: string; text: string; createdAt: number; originalIndex: number }[] => {
    try {
      const storedOpinions: string[] = JSON.parse(localStorage.getItem('opinions') || '[]');
      
      // Get ONLY creation transactions (type: 'earn'), ignore all buy/sell/bet transactions
      const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      
      // Filter to ONLY opinion creation transactions (type: 'earn')
      const creationTransactions = [
        ...userTransactions.filter((t: any) => t.type === 'earn'),
        ...botTransactions.filter((t: any) => t.type === 'earn')
      ];
      
      console.log(`📊 Sidebar: Found ${storedOpinions.length} opinions, ${creationTransactions.length} creation transactions`);
      
      return storedOpinions
        .filter(Boolean)
        .map((text: string, index: number) => {
          // Keep the original array index for URL routing
          const originalIndex = index;
          
          // Find creation transaction for THIS SPECIFIC OPINION
          const creationTransaction = creationTransactions
            .filter((t: any) => {
              // EXACT match first (most reliable)
              if (t.opinionText === text) return true;
              
              // Fallback: partial match only if exact match not found
              if (t.opinionText && (
                text.includes(t.opinionText.slice(0, 50)) ||
                t.opinionText.includes(text.slice(0, 50))
              )) return true;
              
              return false;
            })
            .sort((a: any, b: any) => {
              // Sort by timestamp descending to get the MOST RECENT creation
              const aTime = a.timestamp || new Date(a.date).getTime();
              const bTime = b.timestamp || new Date(b.date).getTime();
              return bTime - aTime;
            })[0];
          
          // Use creation timestamps for sorting
          let createdAt: number;
          
          if (creationTransaction) {
            createdAt = creationTransaction.timestamp || new Date(creationTransaction.date).getTime();
            console.log(`📋 CREATION found for "${text.slice(0, 30)}...": ${new Date(createdAt).toLocaleString()}`);
          } else {
            // FALLBACK: Use opinion position in array with recent bias
            // Higher index = more recent opinion = more recent timestamp
            const baseTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
            const timeIncrement = 60 * 60 * 1000; // 1 hour increment per opinion
            createdAt = baseTime + (index * timeIncrement);
            
            console.log(`📋 FALLBACK timestamp for "${text.slice(0, 30)}..." (index ${index}): ${new Date(createdAt).toLocaleString()}`);
          }
          
          return {
            id: originalIndex.toString(), // Use original index as ID for URL consistency
            text,
            createdAt,
            originalIndex
          };
        });
    } catch (error) {
      console.error('Error getting all opinions:', error);
      return [];
    }
  };

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

    // Check if this is from bot transactions (bot-generated)
    const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
    const isBotGenerated = botTransactions.some((t: any) => 
      t.type === 'earn' && t.opinionText && opinionText.includes(t.opinionText.slice(0, 20))
    );

    if (isBotGenerated) {
      return { type: 'ai', emoji: '🤖' };
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

  // FIXED: Load and process opinion data with proper sorting while maintaining URL consistency
  useEffect(() => {
    setIsLoading(true);
    
    const updateOpinions = () => {
      // Fetch ALL opinions from storage
      const allOpinions = getAllOpinions();
      
      console.log(`📊 Sidebar updating: Found ${allOpinions.length} total opinions`);
      
      // CRITICAL FIX: Sort by creation timestamp - NEWEST FIRST
      // This ensures newest opinions appear at the top regardless of their original array position
      const sortedByCreationTime = allOpinions
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first
      
      console.log(`📊 After sorting by creation time: ${sortedByCreationTime.length} opinions`);
      if (sortedByCreationTime.length > 0) {
        console.log(`📊 Most recent: "${sortedByCreationTime[0]?.text?.slice(0, 30)}..." (Original ID: ${sortedByCreationTime[0]?.id}, Created: ${new Date(sortedByCreationTime[0]?.createdAt).toLocaleString()})`);
        if (sortedByCreationTime.length > 1) {
          console.log(`📊 Second most recent: "${sortedByCreationTime[1]?.text?.slice(0, 30)}..." (Original ID: ${sortedByCreationTime[1]?.id}, Created: ${new Date(sortedByCreationTime[1]?.createdAt).toLocaleString()})`);
        }
      }
      
      const processedOpinions: OpinionWithPrice[] = sortedByCreationTime
        .map((op: { id: string; text: string; createdAt: number; originalIndex: number }) => {
          const text = op.text;
          const id = op.id; // Keep original ID for proper URL routing
          
          const marketData = getOpinionMarketData(text);
          const { trend, priceChange, priceChangePercent } = calculatePriceTrend(marketData);
          const volatilityLevel = getVolatilityLevel(marketData.volatility);
          
          return {
            id, // Original array index for URL consistency
            text,
            currentPrice: marketData.currentPrice,
            priceChange,
            priceChangePercent,
            trend,
            volatility: volatilityLevel,
            createdAt: op.createdAt,
            originalIndex: op.originalIndex
          };
        });

      console.log(`📊 Processed ${processedOpinions.length} opinions for display`);
      console.log(`📊 Display order (newest first): ${processedOpinions.slice(0, 3).map(op => `"${op.text.slice(0, 20)}..." (ID: ${op.id}, Created: ${new Date(op.createdAt).toLocaleString()})`).join(', ')}`);

      setOpinionsWithPrices(processedOpinions);
      setIsLoading(false);
    };

    // Initial load
    updateOpinions();

    // Multiple update mechanisms for faster detection
    
    // 1. Fast interval for real-time updates
    const fastInterval = setInterval(updateOpinions, 3000);
    
    // 2. Storage event listener for immediate updates when localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'opinions' || e.key === 'botTransactions' || e.key === 'transactions' || e.key === 'opinionMarketData') {
        console.log('🔄 Storage changed, updating sidebar...', e.key);
        setTimeout(updateOpinions, 100);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 3. Custom event listener for bot activity
    const handleBotActivity = () => {
      console.log('🤖 Bot activity detected, updating sidebar...');
      setTimeout(updateOpinions, 200);
    };
    
    window.addEventListener('botActivityUpdate', handleBotActivity);
    
    // 4. Manual polling with visibility check
    const visibilityInterval = setInterval(() => {
      if (!document.hidden) {
        updateOpinions();
      }
    }, 5000);

    return () => {
      clearInterval(fastInterval);
      clearInterval(visibilityInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('botActivityUpdate', handleBotActivity);
    };
  }, []);

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.headerTitle}>
          📊 Opinion Exchange
        </h2>
        <p className={styles.headerSubtitle}>
          Live Market Prices (Recent First)
        </p>
      </div>

      {/* Live Feed Link */}
      <a href="/feed" className={styles.liveFeedLink}>
        📡 Live Trading Feed
      </a>

      {/* Table Headers */}
      <div className={styles.tableHeaders}>
        <div className={styles.headerRow}>
          <span>Opinion (Newest First)</span>
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

      {/* Opinion List - Now properly sorted with newest first */}
      {!isLoading && opinionsWithPrices.length > 0 && (
        <ul className={styles.opinionList}>
          {opinionsWithPrices.map((opinion, index) => {
            const attribution = getOpinionAttribution(opinion.text);
            const trendIndicator = getTrendIndicator(opinion.trend, opinion.volatility);
            const volatilityIndicator = getVolatilityIndicator(opinion.volatility);
            
            // Debug info for first few opinions
            if (index < 3) {
              console.log(`📋 Displaying opinion ${index}: Original ID=${opinion.id}, text="${opinion.text.slice(0, 30)}...", createdAt=${new Date(opinion.createdAt).toLocaleString()}`);
            }
            
            return (
              <li key={`${opinion.id}-${opinion.createdAt}`} className={styles.opinionItem}>
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