// =============================================================================
// app/profile/page.tsx – Enhanced profile dashboard with real-time portfolio sync
// -----------------------------------------------------------------------------
//  ✦ Uses UnifiedPortfolioService for real-time portfolio data
//  ✦ Enhanced portfolio statistics with comprehensive risk metrics
//  ✦ Accurate betting positions and shorts with current market values
//  ✦ Real-time opinion holdings with current prices and P&L
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { realtimeDataService } from '../lib/realtime-data-service';
import { unifiedPortfolioService } from '../lib/unified-portfolio-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from '../lib/portfolio-utils';
import Sidebar from '../components/Sidebar';
import AuthGuard from '../components/AuthGuard';
import Navigation from '../components/Navigation';
import RecentActivity from '../components/RecentActivity';
import styles from '../page.module.css';
import {
  Wallet, ScanSmiley, RssSimple, Balloon, SignOut,
} from '@phosphor-icons/react';
import ActivityIntegration from '../components/ActivityIntegration';

// ──────────────────────────────────────────────────────────────────────────────
// Data shapes for enhanced portfolio display
// ──────────────────────────────────────────────────────────────────────────────
interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface EnhancedOpinionAsset {
  id: string;
  text: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  lastUpdated: string;
}

interface PortfolioStats {
  portfolioValue: number;
  totalCost: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  totalQuantity: number;
  uniqueOpinions: number;
  topHoldings: any[];
  riskMetrics: {
    diversificationScore: number;
    volatilityScore: number;
    exposureRating: 'Low' | 'Medium' | 'High';
  };
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn';
  amount: number;
  date: string;
  opinionText?: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [ownedOpinions, setOwnedOpinions] = useState<EnhancedOpinionAsset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [userShorts, setUserShorts] = useState<any[]>([]);

  // Portfolio subscription IDs for cleanup
  const [portfolioSubscriptionId, setPortfolioSubscriptionId] = useState<string | null>(null);
  const [positionsSubscriptionId, setPositionsSubscriptionId] = useState<string | null>(null);
  const [riskPositionsSubscriptionId, setRiskPositionsSubscriptionId] = useState<string | null>(null);

  // ── Enhanced data load + subscriptions ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    // 1️⃣  Profile snapshot listener
    const unsubProfile = realtimeDataService.subscribeToUserProfile(
      user.uid,
      (p) => {
        const userProfile = {
          username: p.username,
          balance: p.balance,
          joinDate: p.joinDate?.toDate?.()?.toISOString?.() ?? p.joinDate,
          totalEarnings: p.totalEarnings || 0,
          totalLosses: p.totalLosses || 0,
        };
        setProfile(userProfile);
        setLoading(false);
      }
    );

    // 2️⃣  Enhanced Portfolio Statistics Subscription
    const statsSubscriptionId = unifiedPortfolioService.subscribeToPortfolioStats(
      user.uid,
      (stats: PortfolioStats) => {
        console.log('📊 Portfolio stats updated:', stats);
        setPortfolioStats(stats);
      }
    );
    setPortfolioSubscriptionId(statsSubscriptionId);

    // 3️⃣  Enhanced Trading Positions Subscription
    const tradingSubscriptionId = unifiedPortfolioService.subscribeToTradingPositions(
      user.uid,
      (positions: EnhancedOpinionAsset[]) => {
        console.log('💼 Trading positions updated:', positions.length, 'positions');
        setOwnedOpinions(positions);
      }
    );
    setPositionsSubscriptionId(tradingSubscriptionId);

    // 4️⃣  Risk Positions Subscription (Bets + Shorts)
    const riskSubscriptionId = unifiedPortfolioService.subscribeToRiskPositions(
      user.uid,
      (positions: { bets: any[]; shorts: any[] }) => {
        console.log('🎯 Risk positions updated:', positions.bets.length, 'bets,', positions.shorts.length, 'shorts');
        setUserBets(positions.bets);
        setUserShorts(positions.shorts);
      }
    );
    setRiskPositionsSubscriptionId(riskSubscriptionId);

    // 5️⃣  Transactions snapshot listener
    const unsubTx = realtimeDataService.subscribeToUserTransactions(
      user.uid,
      (txs) => {
        const formattedTransactions = txs.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          date: tx.timestamp?.toDate?.()?.toLocaleDateString?.() || 'Unknown',
          opinionText: tx.opinionText,
        }));
        setTransactions(formattedTransactions);
      }
    );

    return () => {
      // Clean up all subscriptions
      try {
        if (typeof unsubProfile === 'function') unsubProfile();
        if (typeof unsubTx === 'function') unsubTx();
      } catch (error) {
        console.warn('Error cleaning up profile subscriptions:', error);
      }
      
      if (portfolioSubscriptionId) {
        unifiedPortfolioService.unsubscribe(portfolioSubscriptionId);
      }
      if (positionsSubscriptionId) {
        unifiedPortfolioService.unsubscribe(positionsSubscriptionId);
      }
      if (riskPositionsSubscriptionId) {
        unifiedPortfolioService.unsubscribe(riskPositionsSubscriptionId);
      }
    };
  }, [user?.uid, portfolioSubscriptionId, positionsSubscriptionId, riskPositionsSubscriptionId]);

  // ── Enhanced derived stats ──────────────────────────────────────────────────────────────
  if (loading || !profile) return <div className="loading">Loading…</div>;

  // Use enhanced portfolio statistics
  const portfolioValue = portfolioStats?.portfolioValue || 0;
  const portfolioGainLoss = portfolioStats?.unrealizedGainLoss || 0;
  const totalOpinions = portfolioStats?.uniqueOpinions || 0;
  const portfolioVolatility = portfolioStats?.riskMetrics?.volatilityScore || 0;
  const diversificationScore = portfolioStats?.riskMetrics?.diversificationScore || 0;
  const exposureRating = portfolioStats?.riskMetrics?.exposureRating || 'Low';

  // ── UI with Enhanced Portfolio Display ──────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <div style={{ flex: 1 }}></div>
          
          <div className="navigation-buttons" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0px',
            flexWrap: 'nowrap',
            justifyContent: 'flex-start',
            minWidth: 'max-content',
            overflow: 'visible',
            order: -1,
          }}>
            {/* Username Section */}
            <div className="nav-button" style={{
              padding: '0px 20px',
              color: 'var(--text-black)',
              borderRight: '1px solid var(--border-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: '400',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-number)',
              gap: '12px',
              background: 'transparent',
              cursor: 'default',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              <div className="user-avatar">{profile.username[0]}</div>
              <div>
                <div className="user-name">{profile.username}</div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Real-time Portfolio Tracking</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Member since {new Date(profile.joinDate).toLocaleDateString()} | Opinion Trader & Collector</p>
              </div>
            </div>

            {/* Signed In */}
            <div className="nav-button" style={{
              padding: '0px 20px',
              color: 'var(--text-black)',
              borderRight: '1px solid var(--border-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: '400',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-number)',
              gap: '12px',
              background: 'transparent',
              cursor: 'default',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--green)',
              }} />
              Signed In
            </div>

            {/* View Traders */}
            <a href="/users" className="nav-button">
              <ScanSmiley size={24} />
              View Traders
            </a>

            {/* Live Feed */}
            <a href="/feed" className="nav-button">
              <RssSimple size={24} />
              Live Feed
            </a>

            {/* Generate */}
            <a href="/generate" className="nav-button">
              <Balloon size={24} />
              Generate
            </a>

            {/* Sign Out */}
            <button className="auth-button" onClick={() => window.location.href = '/auth'}>
              <SignOut size={24} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Enhanced Portfolio Statistics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0',
          margin: '40px 0',
          border: '2px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Wallet Balance
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--text-primary)',
            }}>
              ${profile.balance.toFixed(2)}
            </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Portfolio Value
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--text-primary)',
            }}>
              ${portfolioValue.toFixed(2)}
            </p>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              margin: '4px 0 0 0',
              color: 'var(--text-secondary)',
            }}>
              Cost: ${portfolioStats?.totalCost.toFixed(2) || '0.00'}
            </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Unrealized P&L
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: portfolioGainLoss >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {portfolioGainLoss >= 0 ? '+' : ''}${portfolioGainLoss.toFixed(2)}
            </p>
                         <p style={{
               fontSize: 'var(--font-size-xs)',
               margin: '4px 0 0 0',
               color: (portfolioStats?.unrealizedGainLossPercent || 0) >= 0 ? 'var(--green)' : 'var(--red)',
             }}>
               ({(portfolioStats?.unrealizedGainLossPercent || 0) >= 0 ? '+' : ''}{(portfolioStats?.unrealizedGainLossPercent || 0).toFixed(2)}%)
             </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Total Opinions
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--text-primary)',
            }}>
              {totalOpinions}
            </p>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              margin: '4px 0 0 0',
              color: 'var(--text-secondary)',
            }}>
              {portfolioStats?.totalQuantity || 0} shares
            </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Total Earnings
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--green)',
            }}>
              ${profile.totalEarnings.toFixed(2)}
            </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Diversification
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: diversificationScore > 70 ? 'var(--green)' : 
                     diversificationScore > 40 ? 'var(--yellow)' : 'var(--red)',
            }}>
              {diversificationScore.toFixed(0)}%
            </p>
          </div>

          <div style={{
            background: 'var(--white)',
            padding: '20px',
            textAlign: 'center',
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-sm)',
              margin: '0 0 8px 0',
              color: 'var(--text-secondary)',
              fontWeight: '400',
            }}>
              Risk Rating
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: exposureRating === 'High' ? 'var(--red)' : 
                     exposureRating === 'Medium' ? 'var(--yellow)' : 'var(--green)',
            }}>
              {exposureRating}
            </p>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              margin: '4px 0 0 0',
              color: 'var(--text-secondary)',
            }}>
              {portfolioVolatility.toFixed(0)}% volatility
            </p>
          </div>
        </div>

        {/* Enhanced Opinion Portfolio Display */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            My Opinion Portfolio ({ownedOpinions.length} positions)
          </h2>

          {ownedOpinions.length === 0 ? (
            <div className="empty-state">
              You don't own any opinions yet. Start by buying some from the <a href="/">market</a>.
            </div>
          ) : (
            <div style={{
              background: 'var(--white)',
              paddingLeft: '32px',
              paddingRight: '32px',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
              }}>
                {ownedOpinions.slice(0, 6).map((o, index) => {
                  return (
                    <a
                      key={`${o.id}-${index}`}
                      href={`/opinion/${o.id}`}
                      style={{
                        background: 'var(--white)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        minHeight: '220px',
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'all var(--transition)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-light)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--white)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: 'var(--font-size-md)',
                          fontWeight: '500',
                          margin: '0 0 8px 0',
                          color: 'var(--text-primary)',
                          lineHeight: '1.4',
                        }}>
                          {o.text}
                        </p>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          marginBottom: '8px',
                        }}>
                          <span>Qty: {o.quantity}</span>
                          <span>Avg: ${o.averagePrice.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div style={{
                        borderTop: '1px solid var(--border-secondary)',
                        paddingTop: '12px',
                        marginTop: 'auto',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          gap: '8px',
                        }}>
                          <div>
                            <p style={{
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--text-secondary)',
                              margin: '0',
                            }}>
                              Value: ${o.currentValue.toFixed(2)}
                            </p>
                            <p style={{
                              fontSize: 'var(--font-size-lg)',
                              fontWeight: '700',
                              margin: '4px 0 0 0',
                              color: 'var(--text-primary)',
                            }}>
                              ${o.currentPrice.toFixed(2)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{
                              fontSize: 'var(--font-size-sm)',
                              margin: '0',
                              color: o.unrealizedGainLoss >= 0 ? 'var(--green)' : 'var(--red)',
                              fontWeight: '600',
                            }}>
                              {o.unrealizedGainLoss >= 0 ? '+' : ''}${o.unrealizedGainLoss.toFixed(2)}
                            </p>
                            <p style={{
                              fontSize: 'var(--font-size-xs)',
                              margin: '0',
                              color: o.unrealizedGainLossPercent >= 0 ? 'var(--green)' : 'var(--red)',
                            }}>
                              ({o.unrealizedGainLossPercent >= 0 ? '+' : ''}{o.unrealizedGainLossPercent.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {ownedOpinions.length > 6 && (
                <div style={{
                  marginTop: '20px',
                  textAlign: 'center',
                  paddingBottom: '20px',
                }}>
                  <a
                    href="/profile/opinions"
                    style={{
                      display: 'inline-block',
                      padding: '12px 24px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid var(--border-primary)',
                      fontSize: 'var(--font-size-base)',
                      fontWeight: '600',
                      transition: 'all var(--transition)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--green)';
                      e.currentTarget.style.color = 'var(--white)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    View All {ownedOpinions.length} Opinions
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Enhanced Portfolio Bets and Shorts */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            My Portfolio Bets and Shorts ({userBets.length + userShorts.length} positions)
          </h2>

          {userBets.length === 0 && userShorts.length === 0 ? (
            <div className="empty-state">
              No active betting positions. Start by placing bets on other traders' portfolios.
            </div>
          ) : (
            <div style={{
              background: 'var(--white)',
              paddingLeft: '32px',
              paddingRight: '32px',
              paddingBottom: '20px',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: '20px',
              }}>
                {/* Enhanced BET Positions */}
                {userBets.map((position: any) => (
                  <div key={position.id} style={{
                    background: 'var(--white)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-secondary)',
                    position: 'relative',
                    transition: 'all var(--transition)',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                    }}>
                      <h3 style={{
                        fontSize: 'var(--font-size-md)',
                        fontWeight: '600',
                        margin: '0',
                        color: 'var(--text-primary)',
                        lineHeight: '1.4',
                        maxWidth: '70%',
                      }}>
                        {position.title}
                      </h3>
                      <div style={{
                        background: position.riskLevel === 'High' ? 'var(--red)' : 
                                   position.riskLevel === 'Medium' ? 'var(--yellow)' : 'var(--green)',
                        color: 'var(--white)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                      }}>
                        {position.type} • {position.riskLevel}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      marginBottom: '16px',
                    }}>
                      Placed: {position.placedDate} | {position.daysHeld} days | {position.multiplier}x multiplier
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                    }}>
                      <div>
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                        }}>
                          Wagered: ${position.wagered.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: '700',
                          color: 'var(--text-primary)',
                        }}>
                          ${position.currentValue.toFixed(2)}
                        </div>
                      </div>
                      <div style={{
                        textAlign: 'right',
                      }}>
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600',
                          color: position.potential >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {position.potential >= 0 ? '+' : ''}${position.potential.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: position.percentage >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          ({position.percentage >= 0 ? '+' : ''}{position.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Enhanced SHORT Positions */}
                {userShorts.map((position: any) => (
                  <div key={position.id} style={{
                    background: 'var(--white)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-secondary)',
                    position: 'relative',
                    transition: 'all var(--transition)',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                    }}>
                      <h3 style={{
                        fontSize: 'var(--font-size-md)',
                        fontWeight: '600',
                        margin: '0',
                        color: 'var(--text-primary)',
                        lineHeight: '1.4',
                        maxWidth: '70%',
                      }}>
                        {position.title}
                      </h3>
                      <div style={{
                        background: position.riskLevel === 'High' ? 'var(--red)' : 
                                   position.riskLevel === 'Medium' ? 'var(--yellow)' : 'var(--green)',
                        color: 'var(--white)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                      }}>
                        {position.type} • {position.riskLevel}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      marginBottom: '16px',
                    }}>
                      Shorted: {position.shortedDate} | {position.dropTarget}% target | {position.progress.toFixed(1)}% progress
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                    }}>
                      <div>
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          marginBottom: '4px',
                        }}>
                          Entry: ${position.entry.toFixed(2)} → ${position.currentPrice.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: '700',
                          color: 'var(--text-primary)',
                        }}>
                          ${position.currentValue.toFixed(2)}
                        </div>
                      </div>
                      <div style={{
                        textAlign: 'right',
                      }}>
                        <div style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600',
                          color: 'var(--text-secondary)',
                        }}>
                          {position.shares} shares
                        </div>
                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          color: position.progress > 50 ? 'var(--green)' : 'var(--red)',
                        }}>
                          Target: ${position.targetPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section style={{ margin: '20px 0' }}>
          <div style={{
            background: 'var(--white)',
            paddingLeft: '32px',
            paddingRight: '32px',
            paddingBottom: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-secondary)',
            transition: 'all var(--transition)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <RecentActivity userId={user?.uid} maxItems={15} title="My Recent Activity" />
          </div>
        </section>
      </main>

      {/* Activity Integration for real-time updates */}
      <ActivityIntegration userProfile={profile || undefined} />
    </div>
  );
}