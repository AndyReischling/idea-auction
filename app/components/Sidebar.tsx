'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
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
  const [refreshCounter, setRefreshCounter] = useState(0); // Force refresh mechanism

  // Note: No localStorage helpers - Firebase only

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
      // FIXED: Use Firebase data service to get user's opinions
      const storedOpinions: string[] = await realtimeDataService.getOpinions();
      
      console.log('📊 Sidebar: Loading opinions from Firebase/localStorage, found:', storedOpinions.length);
      
      // Get user transactions from Firebase only
      let userTransactions: any[] = [];
      try {
        userTransactions = await realtimeDataService.getUserTransactions();
      } catch (error) {
        console.log('📊 Sidebar: Firebase error getting user transactions');
        userTransactions = [];
      }
      
      // REMOVED: Bot transactions should not be mixed with user opinions
      // Bot transactions are separate from user transactions now
      
      // Get user creation transactions only
      const userCreationTransactions = userTransactions.filter((t: any) => t.type === 'earn' || t.type === 'generate');
      
      console.log(`📊 Sidebar: Found ${storedOpinions.length} opinions, ${userCreationTransactions.length} creation transactions`);
      
      // Process all valid opinions - simplified and reliable
      return storedOpinions
        .filter((opinion: any) => opinion && typeof opinion === 'string' && opinion.trim().length > 0)
        .map((text: string, arrayIndex: number) => {
          // Try to find actual creation timestamp from transactions
          const creationTransaction = userCreationTransactions.find((t: any) => t.opinionText === text);
          let createdAt = Date.now() - (arrayIndex * 2 * 60 * 1000); // Default fallback
          
          if (creationTransaction && creationTransaction.timestamp) {
            // Use actual transaction timestamp
            createdAt = new Date(creationTransaction.timestamp).getTime();
          }
          
          return {
            id: arrayIndex.toString(),
            text,
            createdAt,
            originalIndex: arrayIndex
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt); // Sort newest first
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
          
          // Note: Price corrections happen in Firebase via realtimeDataService
          // No localStorage updates needed
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
    try {
      // FIXED: Since sidebar now only shows user opinions (from Firebase), all opinions are user-generated
      // Bot opinions are stored separately and not shown in user's sidebar
      return { type: 'user', emoji: '👤' };
      
    } catch (error) {
      console.error('Error determining opinion attribution:', error);
      return { type: 'user', emoji: '👤' };
    }
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
      console.log('📊 Sidebar: Starting updateOpinions...');
      setIsLoading(true);
      
      // Note: Using Firebase data only, no localStorage debug needed
      
      // Get all opinions with creation timestamps
      const allOpinions = await getAllOpinions();
      console.log('📊 Sidebar: getAllOpinions returned:', allOpinions.length, 'opinions');
      
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
      console.log('📊 Sidebar: First 3 opinions:', sortedOpinions.slice(0, 3).map(op => ({
        id: op.id,
        text: op.text.slice(0, 30) + '...',
        currentPrice: op.currentPrice,
        createdAt: new Date(op.createdAt).toLocaleString()
      })));
      
      setOpinionsWithPrices(sortedOpinions);
      
    } catch (error) {
      console.error('Error updating opinions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove function dependencies to prevent circular dependency

  // Setup real-time subscriptions on mount
  useEffect(() => {
    const setupSubscriptions = () => {
      const newSubscriptionIds: string[] = [];
      
      // Subscribe to opinions changes
      const opinionsSub = realtimeDataService.subscribeToOpinions((opinions) => {
        console.log('📊 Sidebar: Opinions updated from Firebase/localStorage');
        updateOpinions();
      });
      newSubscriptionIds.push(opinionsSub);
      
      // Subscribe to market data changes
      const marketSub = realtimeDataService.subscribeToMarketData((marketData) => {
        console.log('📊 Sidebar: Market data updated from Firebase/localStorage');
        updateOpinions();
      });
      newSubscriptionIds.push(marketSub);
      
      setSubscriptionIds(newSubscriptionIds);
      
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
  }, []); // Remove updateOpinions dependency to prevent loop

  // Handle storage changes (for localStorage fallback)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'opinions' || e.key === 'opinionMarketData') {
        console.log('📊 Sidebar: Storage change detected, updating opinions');
        setRefreshCounter(prev => prev + 1); // Force component refresh
      }
    };

    // CRITICAL FIX: Add polling to check for localStorage changes in same tab
    const checkForOpinionChanges = () => {
      try {
        const currentOpinions = JSON.parse(localStorage.getItem('opinions') || '[]');
        const currentCount = currentOpinions.length;
        const storedCount = localStorage.getItem('sidebar_opinion_count');
        const lastKnownCount = storedCount ? parseInt(storedCount) : 0;
        
        if (currentCount !== lastKnownCount) {
          localStorage.setItem('sidebar_opinion_count', currentCount.toString());
          setRefreshCounter(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error checking for opinion changes:', error);
      }
    };

    const handleBotActivity = () => {
      console.log('📊 Sidebar: Bot activity detected, updating opinions');
      updateOpinions();
    };

    const handleManualRefresh = () => {
      console.log('📊 Sidebar: Manual refresh requested, updating opinions');
      // CRITICAL FIX: Force fresh data read and trigger re-render
      try {
        const freshOpinions = JSON.parse(localStorage.getItem('opinions') || '[]');
        console.log('🔍 DIRECT localStorage read:', freshOpinions);
        setRefreshCounter(prev => prev + 1); // Force component refresh
      } catch (error) {
        console.error('Error reading fresh opinions:', error);
        setRefreshCounter(prev => prev + 1); // Force component refresh anyway
      }
    };

    const handleLocalStorageChange = (e: CustomEvent) => {
      if (e.detail.key === 'opinions') {
        setRefreshCounter(prev => prev + 1); // Force component refresh
      }
    };

    // Add event listeners for localStorage changes and bot activity
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('botActivityUpdated', handleBotActivity);
    window.addEventListener('manualRefresh', handleManualRefresh);
    window.addEventListener('localStorageChange', handleLocalStorageChange as EventListener);

    // CRITICAL FIX: Start polling for opinion changes
    const pollInterval = setInterval(checkForOpinionChanges, 1000); // Check every second

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('botActivityUpdated', handleBotActivity);
      window.removeEventListener('manualRefresh', handleManualRefresh);
      window.removeEventListener('localStorageChange', handleLocalStorageChange as EventListener);
      clearInterval(pollInterval); // Clean up polling
    };
  }, []); // Remove updateOpinions dependency to prevent loop

  // Add a manual refresh function that can be called from other components
  useEffect(() => {
    (window as any).refreshSidebar = () => {
      window.dispatchEvent(new CustomEvent('manualRefresh'));
    };
  }, []);

  // Force update when refreshCounter changes
  useEffect(() => {
    if (refreshCounter > 0) {
      updateOpinions();
    }
  }, [refreshCounter, updateOpinions]);

  // Simple logging for debugging
  if (opinionsWithPrices.length > 0) {
    console.log(`📊 Sidebar: Rendering ${opinionsWithPrices.length} opinions`);
  }

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

  // Export component WITHOUT memoization to ensure it re-renders when opinions change
export default SidebarComponent;