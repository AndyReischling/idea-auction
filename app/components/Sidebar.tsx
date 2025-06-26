'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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
  const getOpinionAttribution = (opinionText: string): { type: 'generated' | 'user', source: string, color: string } => {
    // Check if this is from user's actual transactions (user-submitted)
    const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const isUserSubmitted = userTransactions.some((t: any) => 
      t.type === 'earn' && t.opinionText && opinionText.includes(t.opinionText.slice(0, 20))
    );

    if (isUserSubmitted) {
      return { type: 'user', source: 'User Generated', color: '#007bff' };
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
      return { type: 'generated', source: 'AI Generated', color: '#28a745' };
    }

    // Default to user-submitted for shorter, more casual opinions
    return { type: 'user', source: 'Community', color: '#6f42c1' };
  };

  // Load and process opinion data
  useEffect(() => {
    const processedOpinions: OpinionWithPrice[] = opinions
      .filter(Boolean)
      .map((op, i) => {
        const text = typeof op === 'string' ? op : op.text;
        const id = typeof op === 'string' ? `${i}` : op.id;
        
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

  // Get trend indicator
  const getTrendIndicator = (trend: 'up' | 'down' | 'neutral', volatility: 'high' | 'medium' | 'low') => {
    const baseStyle = {
      fontSize: '0.9rem',
      fontWeight: 'bold' as const,
      marginLeft: '0.25rem'
    };

    if (trend === 'up') {
      return (
        <span style={{ ...baseStyle, color: volatility === 'high' ? '#22c55e' : '#16a34a' }}>
          {volatility === 'high' ? '🚀' : '📈'}
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span style={{ ...baseStyle, color: volatility === 'high' ? '#ef4444' : '#dc2626' }}>
          {volatility === 'high' ? '💥' : '📉'}
        </span>
      );
    } else {
      return (
        <span style={{ ...baseStyle, color: '#6b7280' }}>
          ➡️
        </span>
      );
    }
  };

  // Get price change color
  const getPriceChangeColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return '#16a34a';
      case 'down': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <aside
      style={{
        width: 280,
        height: '100vh',
        overflowY: 'auto',
        padding: '1rem',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRight: '1px solid #dee2e6',
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ 
        marginBottom: '1.5rem',
        padding: '0.75rem',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        textAlign: 'center'
      }}>
        <h2 style={{ 
          fontSize: '1.1rem', 
          margin: 0, 
          color: '#495057',
          fontWeight: '600'
        }}>
          📊 Opinion Exchange
        </h2>
        <p style={{ 
          fontSize: '0.75rem', 
          margin: '0.25rem 0 0 0', 
          color: '#6c757d' 
        }}>
          Live Market Prices
        </p>
      </div>

      {/* Live Feed Link */}
      <a
        href="/feed"
        style={{
          display: 'block',
          padding: '0.75rem',
          backgroundColor: '#dc3545',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '1rem',
          transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#c82333';
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#dc3545';
        }}
      >
        📡 Live Trading Feed
      </a>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '0.7rem', 
          color: '#6c757d',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid #e9ecef'
        }}>
          <span>Opinion</span>
          <span>Price</span>
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {opinionsWithPrices.map((opinion) => (
          <li key={opinion.id} style={{ marginBottom: '0.5rem' }}>
            <Link
              href={`/opinion/${opinion.id}`}
              style={{ 
                textDecoration: 'none',
                display: 'block',
                padding: '0.75rem',
                backgroundColor: '#fff',
                borderRadius: '6px',
                border: '1px solid #e9ecef',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9fa';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '0.5rem'
              }}>
                <div style={{ flex: 1, marginRight: '0.5rem' }}>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#495057',
                    lineHeight: '1.3',
                    marginBottom: '0.25rem'
                  }}>
                    {opinion.text.slice(0, 45)}
                    {opinion.text.length > 45 && '...'}
                  </div>
                  
                  {/* Attribution Badge */}
                  <div style={{ marginBottom: '0.25rem' }}>
                    {(() => {
                      const attribution = getOpinionAttribution(opinion.text);
                      return (
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '0.125rem 0.375rem',
                          backgroundColor: attribution.color,
                          color: 'white',
                          borderRadius: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          {attribution.type === 'generated' ? '🤖 AI' : 
                           attribution.source === 'Community' ? '👥 Community' : '✨ User'}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div style={{ 
                  textAlign: 'right',
                  minWidth: '60px'
                }}>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: '600',
                    color: '#495057',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                  }}>
                    ${opinion.currentPrice}
                    {getTrendIndicator(opinion.trend, opinion.volatility)}
                  </div>
                </div>
              </div>

              {/* Price change indicator */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: '0.7rem'
              }}>
                <div style={{ 
                  color: getPriceChangeColor(opinion.trend),
                  fontWeight: '500'
                }}>
                  {opinion.priceChange !== 0 && (
                    <>
                      {opinion.priceChange > 0 ? '+' : ''}${opinion.priceChange.toFixed(1)}
                      {' '}({opinion.priceChangePercent > 0 ? '+' : ''}{opinion.priceChangePercent.toFixed(1)}%)
                    </>
                  )}
                  {opinion.priceChange === 0 && (
                    <span style={{ color: '#6c757d' }}>No change</span>
                  )}
                </div>
                
                <div style={{ 
                  fontSize: '0.65rem',
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {opinion.volatility === 'high' ? '⚡ High Vol' : 
                   opinion.volatility === 'medium' ? '🔄 Med Vol' : '🔒 Low Vol'}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Market Summary */}
      <div style={{ 
        marginTop: '1.5rem',
        padding: '0.75rem',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: '#6c757d',
          textAlign: 'center',
          marginBottom: '0.5rem'
        }}>
          Market Status
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-around',
          fontSize: '0.7rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#16a34a', fontWeight: '600' }}>
              {opinionsWithPrices.filter(op => op.trend === 'up').length}
            </div>
            <div style={{ color: '#6c757d' }}>Rising</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#dc2626', fontWeight: '600' }}>
              {opinionsWithPrices.filter(op => op.trend === 'down').length}
            </div>
            <div style={{ color: '#6c757d' }}>Falling</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontWeight: '600' }}>
              {opinionsWithPrices.filter(op => op.trend === 'neutral').length}
            </div>
            <div style={{ color: '#6c757d' }}>Stable</div>
          </div>
        </div>
      </div>
    </aside>
  );
}