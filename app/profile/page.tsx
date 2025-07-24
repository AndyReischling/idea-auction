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
import { OpinionCard } from '../components/ui/OpinionCard';
import { opinionConflictResolver } from '../lib/opinion-conflict-resolver';
import { collection, query, where, limit, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from '../lib/portfolio-utils';
import Sidebar from '../components/Sidebar';
import Header from '../components/ui/Header';
import AuthGuard from '../components/AuthGuard';
import RecentActivity from '../components/RecentActivity';
import ActivityIntegration from '../components/ActivityIntegration';
import styles from '../page.module.css';
import {
  Wallet, ScanSmiley, RssSimple, Balloon, SignOut,
} from '@phosphor-icons/react';

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
  id?: string;
  text?: string;
  opinionId?: string;      // Real data uses opinionId
  opinionText?: string;    // Real data uses opinionText
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost?: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  lastUpdated?: string;
  author?: string;
  volume?: number;
  isBot?: boolean;
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
  const [riskPositionsLoading, setRiskPositionsLoading] = useState(true);
  const [riskPositionsError, setRiskPositionsError] = useState<string | null>(null);

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

    // 2️⃣  Enhanced Portfolio Data Loading - Using actual available methods
    const loadPortfolioData = async () => {
      try {
        const portfolioItems = await unifiedPortfolioService.loadUserPortfolio(user.uid);
        setOwnedOpinions(portfolioItems as any); // Type assertion for compatibility
        
        // Calculate portfolio stats from the loaded data
        const totalValue = portfolioItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
        const totalCost = portfolioItems.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
        const unrealizedGainLoss = totalValue - totalCost;
        const unrealizedGainLossPercent = totalCost > 0 ? (unrealizedGainLoss / totalCost) * 100 : 0;
        
        const calculatedStats = {
          totalValue,
          totalCost,
          unrealizedGainLoss,
          unrealizedGainLossPercent,
          totalPositions: portfolioItems.length,
        };
        
        setPortfolioStats(calculatedStats as any);
        console.log('📊 Portfolio data updated:', calculatedStats);
      } catch (error) {
        console.error('Error loading portfolio data:', error);
      }
    };

    // 3️⃣  Risk Positions Loading (Bets + Shorts) - Using actual available methods
    const loadRiskPositions = async () => {
      try {
        setRiskPositionsLoading(true);
        const [betsData, shortsData] = await Promise.all([
          unifiedPortfolioService.getUserBets(user.uid),
          unifiedPortfolioService.getUserShorts(user.uid)
        ]);
        
        setUserBets(betsData || []);
        setUserShorts(shortsData || []);
        setRiskPositionsLoading(false);
        setRiskPositionsError(null);
        
        console.log('🎯 Risk positions updated:', betsData.length, 'bets,', shortsData.length, 'shorts');
      } catch (error) {
        console.error('Error loading risk positions:', error);
        setRiskPositionsError('Failed to load betting and short positions');
        setRiskPositionsLoading(false);
      }
    };

    // 4️⃣  Initial data load
    loadPortfolioData();
    loadRiskPositions();

    // 5️⃣  Set up real-time subscriptions using Firestore listeners
    const setupRealtimeSubscriptions = () => {
      const unsubscriptions: (() => void)[] = [];

      // Portfolio subscription
      const portfolioRef = doc(db, 'user-portfolios', user.uid);
      const unsubscribePortfolio = onSnapshot(portfolioRef, () => {
        loadPortfolioData(); // Reload when portfolio changes
      });
      unsubscriptions.push(unsubscribePortfolio);

      // Bets subscription  
      const betsQuery = query(collection(db, 'advanced-bets'), where('userId', '==', user.uid));
      const unsubscribeBets = onSnapshot(betsQuery, () => {
        loadRiskPositions(); // Reload when bets change
      });
      unsubscriptions.push(unsubscribeBets);

      // Shorts subscription
      const shortsQuery = query(collection(db, 'short-positions'), where('userId', '==', user.uid));
      const unsubscribeShorts = onSnapshot(shortsQuery, () => {
        loadRiskPositions(); // Reload when shorts change
      });
      unsubscriptions.push(unsubscribeShorts);

      return unsubscriptions;
    };

    const subscriptions = setupRealtimeSubscriptions();

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

    // Set a timeout to handle potential subscription failures
    const riskPositionsTimeout = setTimeout(() => {
      if (riskPositionsLoading) {
        console.warn('Risk positions subscription timeout - may be no data available');
        setRiskPositionsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      clearTimeout(riskPositionsTimeout);
      
      // Clean up the new real-time subscriptions
      try {
        subscriptions.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        });
      } catch (error) {
        console.warn('Error cleaning up profile subscriptions:', error);
      }
      
      // Clean up the old subscription
      if (unsubProfile) {
        realtimeDataService.unsubscribe(unsubProfile);
      }
      if (unsubTx) {
        realtimeDataService.unsubscribe(unsubTx);
      }
    };
  }, [user?.uid]); // 🔧 FIX: Only depend on user.uid - don't include subscription IDs that are set inside this effect!

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
      <Header />
      <Sidebar />

      <main className="main-content" style={{ paddingTop: '40px' }}>
        {/* Enhanced Portfolio Statistics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0',
          margin: '20px 0',
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

              
              <div className="opinion-cards-grid">
                {ownedOpinions.slice(0, 6).map((o, index) => {
                  // Use the conflict resolver to normalize opinion data
                  const normalizedOpinion = opinionConflictResolver.normalizeOpinionData(o);
                  
                  return (
                    <OpinionCard
                      key={`${normalizedOpinion.id || index}`}
                      opinion={normalizedOpinion}
                      variant="default"
                    />
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
            {/* Debug info for development */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ 
                fontSize: 'var(--font-size-xs)', 
                color: 'var(--text-secondary)', 
                fontWeight: '400',
                marginTop: '4px'
              }}>
                Debug: {userBets.length} bets, {userShorts.length} shorts, loading: {riskPositionsLoading ? 'yes' : 'no'}
              </div>
            )}
          </h2>

          {riskPositionsLoading ? (
            <div style={{
              background: 'var(--white)',
              paddingLeft: '32px',
              paddingRight: '32px',
              paddingTop: '40px',
              paddingBottom: '40px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-base)',
            }}>
              📊 Loading your betting and short positions...
            </div>
          ) : riskPositionsError ? (
            <div style={{
              background: 'var(--white)',
              paddingLeft: '32px',
              paddingRight: '32px',
              paddingTop: '40px',
              paddingBottom: '40px',
              textAlign: 'center',
              color: 'var(--red)',
              fontSize: 'var(--font-size-base)',
            }}>
              ⚠️ Error loading betting and short positions: {riskPositionsError}
              <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
                Please try refreshing the page or contact support.
              </p>
            </div>
          ) : userBets.length === 0 && userShorts.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              paddingLeft: '32px',
              paddingRight: '32px',
              paddingTop: '40px',
              paddingBottom: '40px',
              textAlign: 'center',
            }}>
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-lg)',
                marginBottom: '16px',
              }}>
                🎯 No Active Betting Positions
              </div>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-base)',
                marginBottom: '20px',
                lineHeight: '1.5',
              }}>
                You haven't placed any bets or shorts yet. Here's what you can do:
              </p>
              <div style={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}>
                <a
                  href="/users"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    background: 'var(--green)',
                    color: 'var(--white)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    transition: 'all var(--transition)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  🏆 Bet on Traders
                </a>
                <a
                  href="/"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600',
                    transition: 'all var(--transition)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--border-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  📈 Short Opinions
                </a>
              </div>
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
                {/* Enhanced BET Positions with Real Data */}
                {userBets.map((position: any, index: number) => {
                  console.log(`🎯 Rendering bet position ${index + 1}:`, position);
                  return (
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
                  );
                })}

                {/* Enhanced SHORT Positions with Real Data */}
                {userShorts.map((position: any, index: number) => {
                  console.log(`📉 Rendering short position ${index + 1}:`, position);
                  return (
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
                  );
                })}
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