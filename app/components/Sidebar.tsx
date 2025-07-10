'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, memo } from 'react';
import styles from './Sidebar.module.css';
import { Lightbulb } from "@phosphor-icons/react";
import { realtimeDataService } from '../lib/realtime-data-service';

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

function SidebarComponent({
  opinions = [],
}: {
  opinions?: OpinionItem[];
}) {
  const [opinionsWithPrices, setOpinionsWithPrices] = useState<OpinionWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionIds, setSubscriptionIds] = useState<string[]>([]);

  // Safe localStorage helpers - memoized (kept for fallback)
  const safeGetFromStorage = useCallback((key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }, []);

  const safeSetToStorage = useCallback((key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }, []);

  // Price calculation matching other components - memoized
  const calculatePrice = useCallback((timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    let priceMultiplier;
    
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    return Math.round(calculatedPrice * 100) / 100;
  }, []);

  // Get all opinions with proper creation timestamps and maintain array index mapping
  const getAllOpinions = async (): Promise<{ id: string; text: string; createdAt: number; originalIndex: number }[]> => {
    try {
      // Get opinions from Firebase/localStorage via realtimeDataService
      const storedOpinions: string[] = await realtimeDataService.getOpinions();
      
      // Get user transactions from Firebase first, then fallback to localStorage
      let userTransactions: any[] = [];
      try {
        userTransactions = await realtimeDataService.getUserTransactions();
      } catch (error) {
        console.log('📊 Sidebar: Using localStorage fallback for user transactions');
        userTransactions = safeGetFromStorage('transactions', []);
      }
      
      // Get bot transactions from localStorage (not yet migrated to Firebase)
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
  const getOpinionMarketData = async (opinionText: string): Promise<OpinionMarketData> => {
    try {
      // Get market data from Firebase/localStorage via realtimeDataService
      const marketData = await realtimeDataService.getMarketData();
      
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
          console.log(`🔧 Sidebar: FIXING price for "${opinionText}": ${result.currentPrice} → ${expectedPrice}`);
          result.currentPrice = expectedPrice;
          
          // Update the stored data via realtimeDataService
          marketData[opinionText] = result;
          safeSetToStorage('opinionMarketData', marketData);
        }
        
        return result;
      }
      
      // Default market data if not found
      const defaultData: OpinionMarketData = {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10,
        basePrice: 10,
        volatility: 1.0,
        lastUpdated: new Date().toISOString(),
        priceHistory: []
      };
      
      return defaultData;
    } catch (error) {
      console.error('Error getting market data:', error);
      
      // Fallback to default
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
    const priceHistory = marketData.priceHistory || [];
    
    if (priceHistory.length < 2) {
      return { trend: 'neutral', priceChange: 0, priceChangePercent: 0 };
    }
    
    const currentPrice = marketData.currentPrice;
    const previousPrice = priceHistory[priceHistory.length - 2]?.price || marketData.basePrice;
    
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
    
    let trend: 'up' | 'down' | 'neutral';
    
    if (priceChange > 0.05) {
      trend = 'up';
    } else if (priceChange < -0.05) {
      trend = 'down';
    } else {
      trend = 'neutral';
    }
    
    return {
      trend,
      priceChange: Math.round(priceChange * 100) / 100,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100
    };
  };

  // Determine volatility level with fallback
  const getVolatilityLevel = (volatility: number = 1.0): 'high' | 'medium' | 'low' => {
    if (volatility > 1.5) return 'high';
    if (volatility > 1.2) return 'medium';
    return 'low';
  };

  // Determine opinion source/attribution
  const getOpinionAttribution = (opinionText: string): { type: 'ai' | 'community' | 'user', emoji: string } => {
    const opinionAttributions = safeGetFromStorage('opinionAttributions', {});
    
    if (opinionAttributions[opinionText]) {
      const attribution = opinionAttributions[opinionText];
      
      if (attribution.type === 'ai') {
        return { type: 'ai', emoji: '🤖' };
      } else if (attribution.type === 'community') {
        return { type: 'community', emoji: '🌐' };
      } else if (attribution.type === 'user') {
        return { type: 'user', emoji: '👤' };
      }
    }
    
    // Check if it's a bot opinion
    const botOpinions = safeGetFromStorage('botOpinions', []);
    if (botOpinions.some((botOpinion: any) => 
      botOpinion.text === opinionText || 
      botOpinion.opinionText === opinionText ||
      botOpinion.opinion === opinionText
    )) {
      return { type: 'ai', emoji: '🤖' };
    }
    
    // Check if it's from bot transactions
    const botTransactions = safeGetFromStorage('botTransactions', []);
    if (botTransactions.some((t: any) => t.opinionText === opinionText)) {
      return { type: 'ai', emoji: '🤖' };
    }
    
    // Check if it's from user transactions (assuming user-created)
    const userTransactions = safeGetFromStorage('transactions', []);
    if (userTransactions.some((t: any) => t.opinionText === opinionText && t.type === 'earn')) {
      return { type: 'user', emoji: '👤' };
    }
    
    // Default to community
    return { type: 'community', emoji: '🌐' };
  };

  // Get trend indicator classes and emoji
  const getTrendIndicator = (trend: 'up' | 'down' | 'neutral', volatility: 'high' | 'medium' | 'low') => {
    if (trend === 'up') return { symbol: '↗', className: styles.up };
    if (trend === 'down') return { symbol: '↘', className: styles.down };
    return { symbol: '→', className: styles.neutral };
  };

  // Get price change class
  const getPriceChangeClass = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return styles.positive;
    if (trend === 'down') return styles.negative;
    return styles.neutral;
  };

  // Get volatility indicator
  const getVolatilityIndicator = (volatility: 'high' | 'medium' | 'low') => {
    if (volatility === 'high') return { text: 'High Vol', className: styles.high };
    if (volatility === 'medium') return { text: 'Med Vol', className: styles.medium };
    return { text: 'Low Vol', className: styles.low };
  };

  // Enhanced update function with real-time data
  const updateOpinions = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get all opinions with creation timestamps
      const allOpinions = await getAllOpinions();
      
      if (allOpinions.length === 0) {
        console.log('📊 Sidebar: No opinions found');
        setOpinionsWithPrices([]);
        setIsLoading(false);
        return;
      }
      
      // Get market data for all opinions
      const opinionsWithMarketData = await Promise.all(
        allOpinions.map(async (opinion) => {
          const marketData = await getOpinionMarketData(opinion.text);
          const { trend, priceChange, priceChangePercent } = calculatePriceTrend(marketData);
          const volatilityLevel = getVolatilityLevel(marketData.volatility);
          
          return {
            id: opinion.id,
            text: opinion.text,
            currentPrice: marketData.currentPrice,
            priceChange,
            priceChangePercent,
            trend,
            volatility: volatilityLevel,
            createdAt: opinion.createdAt,
            originalIndex: opinion.originalIndex
          };
        })
      );
      
      // Sort by creation time (most recent first)
      const sortedOpinions = opinionsWithMarketData.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log(`📊 Sidebar: Updated ${sortedOpinions.length} opinions with market data`);
      setOpinionsWithPrices(sortedOpinions);
      
    } catch (error) {
      console.error('Error updating opinions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getAllOpinions, getOpinionMarketData, calculatePriceTrend, getVolatilityLevel]);

  // Setup real-time subscriptions on mount
  useEffect(() => {
    const setupSubscriptions = () => {
      const subscriptionIds: string[] = [];
      
      // Subscribe to opinions changes
      const opinionsSub = realtimeDataService.subscribeToOpinions((opinions) => {
        console.log('📊 Sidebar: Opinions updated from Firebase/localStorage');
        updateOpinions();
      });
      subscriptionIds.push(opinionsSub);
      
      // Subscribe to market data changes
      const marketSub = realtimeDataService.subscribeToMarketData((marketData) => {
        console.log('📊 Sidebar: Market data updated from Firebase/localStorage');
        updateOpinions();
      });
      subscriptionIds.push(marketSub);
      
      setSubscriptionIds(subscriptionIds);
      
      // Initial load
      updateOpinions();
    };
    
    setupSubscriptions();
    
    // Cleanup subscriptions on unmount
    return () => {
      subscriptionIds.forEach(id => {
        realtimeDataService.unsubscribe(id);
      });
    };
  }, [updateOpinions]);

  // Handle storage changes (for localStorage fallback)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'opinions' || e.key === 'opinionMarketData') {
        console.log('📊 Sidebar: Storage change detected, updating opinions');
        updateOpinions();
      }
    };

    const handleBotActivity = () => {
      console.log('📊 Sidebar: Bot activity detected, updating opinions');
      updateOpinions();
    };

    const handleManualRefresh = () => {
      console.log('📊 Sidebar: Manual refresh requested, updating opinions');
      updateOpinions();
    };

    // Add event listeners for localStorage changes and bot activity
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('botActivityUpdated', handleBotActivity);
    window.addEventListener('manualRefresh', handleManualRefresh);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('botActivityUpdated', handleBotActivity);
      window.removeEventListener('manualRefresh', handleManualRefresh);
    };
  }, [updateOpinions]);

  // Add a manual refresh function that can be called from other components
  useEffect(() => {
    (window as any).refreshSidebar = () => {
      window.dispatchEvent(new CustomEvent('manualRefresh'));
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
                        {attribution.type === 'ai' ? 'AI' : 
                         attribution.type === 'community' ? 'Community' : 'User'}
                      </div>
                    </div>
                    
                    <div className={styles.priceSection}>
                      <div className={styles.priceDisplay}>
                        ${opinion.currentPrice.toFixed(2)}
                        <span className={trendIndicator.className}>
                          {trendIndicator.symbol}
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
                      {volatilityIndicator.text}
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

  // Export memoized component to prevent unnecessary re-renders
export default memo(SidebarComponent);