'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';
import { ArrowLeft, PiggyBank, ScanSmiley, RssSimple, Balloon, RocketLaunch, ChartLineUp, ChartLineDown, Skull, FlowerLotus, Ticket, CheckSquare, CaretRight, CaretDown, Lightbulb } from "@phosphor-icons/react";

type OpinionItem = { id: string; text: string } | string;

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility?: number; // Made optional to handle both data formats
  lastUpdated: string;
  priceHistory?: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create' }[];
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
  originalIndex: number;
}

export default function Sidebar({
  opinions = [],
}: {
  opinions?: OpinionItem[];
}) {
  const [opinionsWithPrices, setOpinionsWithPrices] = useState<OpinionWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

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

  // Price calculation matching other components
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

  // Get all opinions with proper creation timestamps and maintain array index mapping
  const getAllOpinions = (): { id: string; text: string; createdAt: number; originalIndex: number }[] => {
    try {
      const storedOpinions: string[] = safeGetFromStorage('opinions', []);
      
      // Get ALL creation transactions (type: 'earn') from both user and bot transactions
      const userTransactions = safeGetFromStorage('transactions', []);
      const botTransactions = safeGetFromStorage('botTransactions', []);
      
      // Combine all creation transactions
      const allCreationTransactions = [
        ...userTransactions.filter((t: any) => t.type === 'earn'),
        ...botTransactions.filter((t: any) => t.type === 'earn')
      ];
      
      console.log(`📊 Sidebar: Found ${storedOpinions.length} opinions, ${allCreationTransactions.length} creation transactions`);
      
      return storedOpinions
        .filter(Boolean)
        .map((text: string, index: number) => {
          // Keep the original array index for URL routing
          const originalIndex = index;
          
          // Find creation transaction for THIS SPECIFIC OPINION
          // Use a more flexible matching approach
          const creationTransaction = allCreationTransactions
            .filter((t: any) => {
              if (!t.opinionText) return false;
              
              // Try exact match first
              if (t.opinionText === text) return true;
              
              // Try partial match (either direction)
              const textStart = text.slice(0, 50);
              const transactionStart = t.opinionText.slice(0, 50);
              
              if (textStart === transactionStart) return true;
              if (text.includes(transactionStart) || t.opinionText.includes(textStart)) return true;
              
              return false;
            })
            .sort((a: any, b: any) => {
              // Sort by timestamp descending to get the MOST RECENT creation
              const aTime = a.timestamp || new Date(a.date).getTime();
              const bTime = b.timestamp || new Date(b.date).getTime();
              return bTime - aTime;
            })[0];
          
          // Determine creation timestamp
          let createdAt: number;
          
          if (creationTransaction) {
            // Parse timestamp more carefully to ensure proper sorting
            let timestamp: number;
            if (creationTransaction.timestamp) {
              timestamp = new Date(creationTransaction.timestamp).getTime();
            } else if (creationTransaction.date) {
              timestamp = new Date(creationTransaction.date).getTime();
            } else {
              timestamp = Date.now() - (storedOpinions.length - index) * 60 * 1000; // Fallback
            }
            
            // Ensure timestamp is valid
            if (isNaN(timestamp)) {
              timestamp = Date.now() - (storedOpinions.length - index) * 60 * 1000;
            }
            
            createdAt = timestamp;
            console.log(`📋 CREATION found for "${text.slice(0, 30)}...": ${new Date(createdAt).toLocaleString()}`);
          } else {
            // FIXED FALLBACK: Create proper chronological order
            // Use current time minus decreasing amounts (newest opinions get newer timestamps)
            const minutesAgo = (storedOpinions.length - index) * 2; // 2 minute increments
            createdAt = Date.now() - (minutesAgo * 60 * 1000);
            
            console.log(`📋 FALLBACK timestamp for "${text.slice(0, 30)}..." (index ${index}): ${new Date(createdAt).toLocaleString()}`);
          }
          
          return {
            id: originalIndex.toString(), // Use original index as ID for URL consistency
            text,
            createdAt,
            originalIndex
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt); // Sort here to ensure newest first
    } catch (error) {
      console.error('Error getting all opinions:', error);
      return [];
    }
  };

  // FIXED: Get market data for an opinion with proper format handling
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    const marketData = safeGetFromStorage('opinionMarketData', {});
    
    if (marketData[opinionText]) {
      const data = marketData[opinionText];
      
      // Ensure we have all required fields
      const result: OpinionMarketData = {
        opinionText,
        timesPurchased: data.timesPurchased || 0,
        timesSold: data.timesSold || 0,
        currentPrice: data.currentPrice || 10,
        basePrice: data.basePrice || 10,
        volatility: data.volatility || 1.0, // Default volatility if not present
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        priceHistory: data.priceHistory || []
      };

      // Recalculate price if it seems incorrect
      const expectedPrice = calculatePrice(result.timesPurchased, result.timesSold, result.basePrice);
      if (Math.abs(expectedPrice - result.currentPrice) > 0.01) {
        console.log(`🔧 FIXING price for "${opinionText}": ${result.currentPrice} → ${expectedPrice}`);
        result.currentPrice = expectedPrice;
        
        // Update the stored data
        marketData[opinionText] = result;
        safeSetToStorage('opinionMarketData', marketData);
      }
      
      return result;
    } else {
      // Create new market data with default values
      const newData: OpinionMarketData = {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10,
        basePrice: 10,
        volatility: 1.0,
        lastUpdated: new Date().toISOString(),
        priceHistory: []
      };
      
      // Save the new market data
      marketData[opinionText] = newData;
      safeSetToStorage('opinionMarketData', marketData);
      
      return newData;
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

  // Determine volatility level with fallback
  const getVolatilityLevel = (volatility: number = 1.0): 'high' | 'medium' | 'low' => {
    if (volatility > 2.0) return 'high';
    if (volatility > 1.3) return 'medium';
    return 'low';
  };

  // Determine opinion source/attribution
  const getOpinionAttribution = (opinionText: string): { type: 'ai' | 'community' | 'user', emoji: string } => {
    // Check if this is from user's actual transactions (user-submitted)
    const userTransactions = safeGetFromStorage('transactions', []);
    const isUserSubmitted = userTransactions.some((t: any) => 
      t.type === 'earn' && t.opinionText && opinionText.includes(t.opinionText.slice(0, 20))
    );

    if (isUserSubmitted) {
      return { type: 'user', emoji: '✨' };
    }

    // Check if this is from bot transactions (bot-generated)
    const botTransactions = safeGetFromStorage('botTransactions', []);
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

  // FIXED: Load and process opinion data with better error handling
  useEffect(() => {
    setIsLoading(true);
    
    const updateOpinions = () => {
      try {
        // Fetch ALL opinions from storage
        const allOpinions = getAllOpinions();
        
        console.log(`📊 Sidebar updating: Found ${allOpinions.length} total opinions`);
        setDebugInfo(`Found ${allOpinions.length} opinions`);
        
        // Opinions are now already sorted by creation timestamp - NEWEST FIRST
        const sortedOpinions = allOpinions.filter(Boolean);
        
        console.log(`📊 After filtering: ${sortedOpinions.length} opinions`);
        if (sortedOpinions.length > 0) {
          console.log(`📊 Most recent: "${sortedOpinions[0]?.text?.slice(0, 30)}..." (Original ID: ${sortedOpinions[0]?.id}, Created: ${new Date(sortedOpinions[0]?.createdAt).toLocaleString()})`);
        }
        
        const processedOpinions: OpinionWithPrice[] = sortedOpinions
          .map((op: { id: string; text: string; createdAt: number; originalIndex: number }) => {
            try {
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
            } catch (error) {
              console.error('Error processing opinion:', error);
              // Return a fallback opinion
              return {
                id: op.id,
                text: op.text,
                currentPrice: 10,
                priceChange: 0,
                priceChangePercent: 0,
                trend: 'neutral' as const,
                volatility: 'low' as const,
                createdAt: op.createdAt,
                originalIndex: op.originalIndex
              };
            }
          });

        console.log(`📊 Processed ${processedOpinions.length} opinions for display`);
        setDebugInfo(`Processed ${processedOpinions.length} opinions`);

        setOpinionsWithPrices(processedOpinions);
        setIsLoading(false);
      } catch (error) {
        console.error('Error in updateOpinions:', error);
        setDebugInfo(`Error: ${error}`);
        setIsLoading(false);
      }
    };

    // Initial load
    updateOpinions();

    // Multiple update mechanisms for faster detection
    
    // 1. Fast interval for real-time updates
    const fastInterval = setInterval(updateOpinions, 2000); // Reduced to 2 seconds
    
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

    // 5. Add a custom event for manual refresh
    const handleManualRefresh = () => {
      console.log('🔄 Manual refresh triggered');
      updateOpinions();
    };
    
    window.addEventListener('sidebarRefresh', handleManualRefresh);

    return () => {
      clearInterval(fastInterval);
      clearInterval(visibilityInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('botActivityUpdate', handleBotActivity);
      window.removeEventListener('sidebarRefresh', handleManualRefresh);
    };
  }, []);

  // Add a manual refresh function that can be called from other components
  useEffect(() => {
    (window as any).refreshSidebar = () => {
      window.dispatchEvent(new CustomEvent('sidebarRefresh'));
    };
  }, []);

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.headerTitle}>
          Hot Talk
        </h2>
        <p className={styles.headerSubtitle}>
          A Dr. Hollywood Production
        </p>
        <div style={{ marginTop: '2.5rem' }}>
          <a href="/feed" className={styles.liveFeedLink}>
            <span className={styles.lightbulbPulse}>
              <Lightbulb size={24} />
            </span>
            Opinions List
          </a>
        </div>
      </div>

      <div className={styles.scrollArea}>
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
              console.log(`📋 Displaying opinion ${index}: Original ID=${opinion.id}, text="${opinion.text.slice(0, 30)}...", price=$${opinion.currentPrice}, createdAt=${new Date(opinion.createdAt).toLocaleString()}`);
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
                        ${opinion.currentPrice.toFixed(2)}
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

      </div>

      

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