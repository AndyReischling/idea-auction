import React from 'react';
import styles from '../page.module.css';
import { Trophy, Crown, Robot } from '@phosphor-icons/react';

interface LeaderboardCardProps {
  rank: number;
  data: {
    uid: string;
    username: string;
    joinDate: string;
    portfolioValue: number;
    exposure: number;
    opinionsCount: number;
    betsCount?: number;
    performanceChange?: number;
    performancePercent?: number;
    volatility?: 'Low' | 'Medium' | 'High';
    holdings?: number;
    topHoldings?: Array<{
      text: string;
      value: number;
      currentPrice: number;
      purchasePrice: number;
      percentChange: number;
      quantity: number;
    }>;
    isBot?: boolean;
  };
  isMe: boolean;
  onClick: () => void;
  onNavigate: () => void;
}

export default function LeaderboardCard({ rank, data, isMe, onClick, onNavigate }: LeaderboardCardProps) {
  const formatCurrency = (value: number) => {
    return value >= 0 ? `$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPerformanceColor = (value: number) => {
    if (value > 0) return styles.positive;
    if (value < 0) return styles.negative;
    return styles.neutral;
  };

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'High': return styles.volatilityHigh;
      case 'Medium': return styles.volatilityMedium;
      case 'Low': return styles.volatilityLow;
      default: return '';
    }
  };

  return (
    <div className={`${styles.newLeaderboardCard} ${isMe ? styles.isMe : ''}`}>
      {/* Header Section */}
      <div className={styles.cardHeader}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            <Trophy size={28} weight="fill" color="#FFB000" />
          </div>
          <div className={styles.userDetails}>
            <h3 className={styles.username}>
              {data.isBot ? (
                <Robot size={18} weight="fill" color="#6366F1" />
              ) : (
                <Crown size={18} weight="fill" color="#FFD700" />
              )}
              {data.username}
            </h3>
            <p className={styles.userStats}>
              {data.opinionsCount} opinions • Joined {formatDate(data.joinDate)}
            </p>
            <p className={styles.betsCount}>
              {data.betsCount || 0} bets
            </p>
          </div>
        </div>
        
        <div className={styles.portfolioDisplay}>
          <div className={styles.portfolioLabel}>PORTFOLIO VALUE</div>
          <div className={`${styles.portfolioValue} ${data.portfolioValue >= 0 ? styles.positive : styles.negative}`}>
            {formatCurrency(data.portfolioValue)}
          </div>
          <div className={`${styles.performanceChange} ${getPerformanceColor(data.performanceChange || 0)}`}>
            +{formatCurrency(data.performanceChange || 0)}({(data.performancePercent || 0).toFixed(2)}%)
          </div>
          <div className={styles.exposure}>
            Exposure: {formatCurrency(data.exposure)}
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className={styles.metricsSection}>
        <div className={styles.metricBox}>
          <div className={styles.metricLabel}>7-DAY PERFORMANCE</div>
          <div className={`${styles.metricValue} ${getPerformanceColor(data.performanceChange || 0)}`}>
            +{(data.performancePercent || 0).toFixed(2)}%
          </div>
        </div>
        
        <div className={styles.metricBox}>
          <div className={styles.metricLabel}>VOLATILITY</div>
          <div className={`${styles.metricValue} ${getVolatilityColor(data.volatility || 'Low')}`}>
            {data.volatility || 'Low'}
          </div>
        </div>
        
        <div className={styles.metricBox}>
          <div className={styles.metricLabel}>HOLDINGS</div>
          <div className={styles.metricValue}>
            {data.holdings || 0}
          </div>
        </div>
      </div>

      {/* Top Holdings Section */}
      <div className={styles.holdingsSection}>
        <div className={styles.holdingsTitle}>Top Holdings:</div>
        <div className={styles.holdingsContent}>
          {data.topHoldings && data.topHoldings.length > 0 ? (
            data.topHoldings.map((holding, index) => (
              <div key={index} className={styles.holdingItem}>
                <div className={styles.holdingText}>"{holding.text}"</div>
                <div className={styles.holdingDetails}>
                  <span className={styles.holdingValue}>
                    {formatCurrency(holding.currentPrice)} × {holding.quantity}
                  </span>
                  <span className={styles.holdingTotalValue}>
                    = {formatCurrency(holding.value)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <span className={styles.noHoldings}>No holdings yet</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.actionButtons}>
        <button 
          className={styles.detailsButton}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
        >
          DETAILS
        </button>
        <button 
          className={styles.betButton}
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/bet/${data.username}`;
          }}
        >
          BET
        </button>
      </div>
    </div>
  );
} 