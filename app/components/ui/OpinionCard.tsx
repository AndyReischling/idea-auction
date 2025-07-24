import React from 'react';
import Link from 'next/link';

export interface OpinionCardData {
  id?: string;
  text?: string;
  quantity?: number;
  averagePrice?: number;
  currentPrice?: number;
  currentValue?: number;
  unrealizedGainLoss?: number;
  unrealizedGainLossPercent?: number;
  author?: string;
  volume?: number;
  isBot?: boolean;
}

interface OpinionCardProps {
  opinion: OpinionCardData;
  variant?: 'default' | 'compact';
  className?: string;
  onClick?: () => void;
}

export function OpinionCard({ 
  opinion, 
  variant = 'default', 
  className = '',
  onClick 
}: OpinionCardProps) {
  const {
    id,
    text,
    quantity,
    averagePrice,
    currentPrice,
    currentValue,
    unrealizedGainLoss = 0,
    unrealizedGainLossPercent = 0,
    author,
    volume,
    isBot
  } = opinion;

  // Handle missing or invalid data with more resilience
  const validId = id || `opinion-${Math.random().toString(36).substr(2, 9)}`;
  
  if (!id) {
    console.warn('OpinionCard: Missing opinion ID, using generated ID:', validId, opinion);
  }

  if (!text || text.trim() === '') {
    console.warn('OpinionCard: Missing opinion text for ID:', validId);
  }

  const displayText = text || 'Opinion text not available';
  const isPositiveGain = unrealizedGainLoss >= 0;
  const href = `/opinion/${validId}`;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Compact variant for lists
  if (variant === 'compact') {
    return (
      <Link href={href} className={`block ${className}`} onClick={handleCardClick}>
        <div style={{
          background: 'var(--white)',
          padding: '16px',
          border: '1px solid var(--border-secondary)',
          borderRadius: 'var(--radius-md)',
          transition: 'all var(--transition)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: '500',
                color: 'var(--text-primary)',
                lineHeight: '1.3',
                margin: '0 0 4px 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {displayText}
              </p>
              {author && (
                <p style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  margin: 0
                }}>
                  {author}{isBot && ' • Bot'}
                </p>
              )}
            </div>
            {currentPrice && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-number)',
                  margin: '0 0 2px 0'
                }}>
                  ${currentPrice.toFixed(2)}
                </p>
                {unrealizedGainLoss !== 0 && (
                  <p style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: '600',
                    color: isPositiveGain ? '#22c55e' : 'var(--coral-red)',
                    fontFamily: 'var(--font-number)',
                    margin: 0
                  }}>
                    {isPositiveGain ? '+' : ''}${unrealizedGainLoss.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default rectangular trading card - matching original design
  return (
    <Link href={href} className={`block ${className}`} onClick={handleCardClick}>
             <div style={{
         background: 'var(--white)',
         padding: '20px',
         border: '1px solid var(--border-secondary)',
         borderRadius: 'var(--radius-md)',
         boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
         transition: 'all var(--transition)',
         cursor: 'pointer',
         height: '100%',
         display: 'flex',
         flexDirection: 'column',
         minHeight: '200px',
         width: '100%',
       }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      }}
      >
        {/* Opinion Text */}
        <div style={{ flex: 1, marginBottom: '16px' }}>
          <h3 style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: '500',
            color: 'var(--text-primary)',
            lineHeight: '1.4',
            margin: '0 0 12px 0',
          }}>
            {displayText}
          </h3>
          
          {/* Purchase Info */}
          {quantity && (
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary)',
              margin: '0 0 8px 0',
            }}>
              Purchased: 7/16/2025 | Qty: {quantity}
            </p>
          )}
        </div>

        {/* Price Section */}
        {currentPrice && (
          <>
            {/* Purchase Price */}
            {averagePrice && (
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                margin: '0 0 4px 0',
              }}>
                Bought: ${averagePrice.toFixed(2)}
              </p>
            )}
            
            {/* Current Price and Gain/Loss */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 'auto',
            }}>
              <div>
                <p style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-number)',
                  margin: 0,
                }}>
                  ${currentPrice.toFixed(2)}
                </p>
              </div>
              
              {unrealizedGainLoss !== 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: 'var(--font-size-md)',
                    fontWeight: '600',
                    color: isPositiveGain ? '#22c55e' : 'var(--coral-red)',
                    fontFamily: 'var(--font-number)',
                    margin: '0 0 2px 0',
                  }}>
                    {isPositiveGain ? '+' : ''}${unrealizedGainLoss.toFixed(2)}
                  </p>
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: isPositiveGain ? '#22c55e' : 'var(--coral-red)',
                    fontFamily: 'var(--font-number)',
                    margin: 0,
                  }}>
                    ({isPositiveGain ? '+' : ''}{unrealizedGainLossPercent.toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Link>
  );
} 