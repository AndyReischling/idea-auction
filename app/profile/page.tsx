// =============================================================================
// app/profile/page.tsx – Firestore‑native profile dashboard (no localStorage)
// -----------------------------------------------------------------------------
//  ✦ Fetches all user‑centric data via `realtimeDataService` helpers
//  ✦ Subscribes to live updates where available (profile / portfolio)
//  ✦ Drops every legacy fallback that referenced browser localStorage
//  ✦ Keeps the previous UI intact – only the data layer changed
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { realtimeDataService } from '../lib/realtime-data-service';
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

// ──────────────────────────────────────────────────────────────────────────────
// Data shapes (firestore docs already match these)
// ──────────────────────────────────────────────────────────────────────────────
interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
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
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ── Initial data load + subscriptions ──────────────────────────────────────
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
          totalEarnings: p.totalEarnings,
          totalLosses: p.totalLosses,
        };
        setProfile(userProfile);
        // Fetch portfolio data when profile updates
        fetchPortfolioData(p);
      }
    );

    // 2️⃣  Portfolio data (using new portfolio structure)
    const fetchPortfolioData = async (userProfile: any) => {
      try {
        // Try to get the new portfolio structure first
        let portfolio: Portfolio;
        
        try {
          portfolio = await getUserPortfolio(user.uid);
        } catch (error) {
          console.warn('Failed to load new portfolio, trying migration...');
          await migrateUserPortfolio(user.uid);
          portfolio = await getUserPortfolio(user.uid);
        }
        
        // If no items in new portfolio but old portfolio exists, migrate
        if (portfolio.items.length === 0 && userProfile?.portfolio) {
          console.log('🔄 Migrating portfolio data...');
          await migrateUserPortfolio(user.uid);
          portfolio = await getUserPortfolio(user.uid);
        }
        
        // Get market data for current prices
        const marketData = await realtimeDataService.getMarketData();
        
        // Transform portfolio items to the expected format and get actual opinion IDs
        const transformedOpinions = await Promise.all(
          portfolio.items.map(async (item) => {
            // Query Firestore to get the actual document ID for this opinion text
            let actualOpinionId = item.opinionId; // fallback to original ID
            try {
              const q = query(
                collection(db, 'opinions'),
                where('text', '==', item.opinionText),
                limit(1)
              );
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                actualOpinionId = querySnapshot.docs[0].id; // Use actual Firestore document ID
              }
            } catch (error) {
              console.error('Error fetching actual opinion ID for:', item.opinionText, error);
              // Keep fallback ID if query fails
            }

            return {
              id: actualOpinionId, // Use actual Firestore document ID
              text: item.opinionText,
              purchasePrice: item.averagePrice,
              currentPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice,
              purchaseDate: new Date(item.lastUpdated).toLocaleDateString(),
              quantity: item.quantity,
            };
          })
        );
        
        setOwnedOpinions(transformedOpinions);
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
        setOwnedOpinions([]);
      }
    };

    // 3️⃣  Transactions snapshot listener
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

    setLoading(false);
    return () => {
      unsubProfile && realtimeDataService.unsubscribe(unsubProfile);
      unsubTx && realtimeDataService.unsubscribe(unsubTx);
    };
  }, [user?.uid]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  if (loading || !profile) return <div className="loading">Loading…</div>;



  // Mock bet positions data
  const mockBetPositions = [
    {
      id: '1',
      title: "trading_maven's portfolio",
      type: 'BET',
      percentage: 15,
      placedDate: '12/15/2024',
      daysHeld: 7,
      multiplier: '1.75x',
      wagered: 250.00,
      currentValue: 437.50,
      potential: 187.50
    },
    {
      id: '2',
      title: "crypto_bull's portfolio",
      type: 'BET',
      percentage: 10,
      placedDate: '12/12/2024',
      daysHeld: 3,
      multiplier: '2.071428571428571x',
      wagered: 100.00,
      currentValue: 207.14,
      potential: 107.14
    }
  ];

  // Mock short positions data
  const mockShortPositions = [
    {
      id: '1',
      title: "Cryptocurrency will replace traditional banking by 2026",
      type: 'SHORT',
      shortedDate: '12/10/2024',
      dropTarget: 20,
      progress: 55.6,
      entry: 25.00,
      currentValue: 22.50,
      shares: 20,
      obligation: true
    },
    {
      id: '2',
      title: "Remote work will become less popular post-pandemic",
      type: 'SHORT',
      shortedDate: '12/5/2024',
      dropTarget: 15,
      progress: 46.3,
      entry: 18.00,
      currentValue: 16.50,
      shares: 15,
      obligation: true
    }
  ];



  // Keep real data for owned opinions display
  const portfolioValue = ownedOpinions.reduce((sum, o) => sum + o.currentPrice * o.quantity, 0);
  const portfolioGainLoss = ownedOpinions.reduce((sum, o) => sum + (o.currentPrice - o.purchasePrice) * o.quantity, 0);
  const totalOpinions = ownedOpinions.length;

  // Calculate portfolio volatility based on price variations
  const priceVariations = ownedOpinions.map(o => Math.abs(o.currentPrice - o.purchasePrice) / o.purchasePrice);
  const avgVariation = priceVariations.length > 0 ? priceVariations.reduce((a, b) => a + b, 0) / priceVariations.length : 0;
  const portfolioVolatility = Math.min(avgVariation * 100, 100); // Cap at 100%

  // ── UI ──────────────────────────────────────────────────────────────────────
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
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🤖 Bots: Active Globally</p>
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

        {/* Portfolio Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
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
              P&L
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: portfolioGainLoss >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {portfolioGainLoss >= 0 ? '+' : ''}${portfolioGainLoss.toFixed(2)}
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
              ${(profile.totalEarnings || 0).toFixed(2)}
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
              Portfolio Volatility
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: portfolioVolatility > 100 ? 'var(--red)' : 
                     portfolioVolatility > 50 ? 'var(--yellow)' : 'var(--green)',
            }}>
              {portfolioVolatility.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* My Opinion Portfolio */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            My Opinion Portfolio
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
                  const gainLoss = (o.currentPrice - o.purchasePrice) * o.quantity;
                  const gainLossPercent = ((o.currentPrice - o.purchasePrice) / o.purchasePrice) * 100;
                  
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
                        minHeight: '200px',
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'background var(--transition)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-light)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--white)';
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
                        <p style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          margin: '0',
                        }}>
                          Purchased: {o.purchaseDate} | Qty: {o.quantity}
                        </p>
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
                              Bought: ${o.purchasePrice.toFixed(2)}
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
                              color: gainLoss >= 0 ? 'var(--green)' : 'var(--red)',
                              fontWeight: '600',
                            }}>
                              {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)}
                            </p>
                            <p style={{
                              fontSize: 'var(--font-size-xs)',
                              margin: '0',
                              color: gainLossPercent >= 0 ? 'var(--green)' : 'var(--red)',
                            }}>
                              ({gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(1)}%)
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

        {/* My Portfolio Bets and Shorts */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            My Portfolio Bets and Shorts
          </h2>

          <div style={{
            background: 'var(--white)',
            paddingLeft: '32px',
            paddingRight: '32px',
            paddingBottom: '20px',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '20px',
            }}>
              {/* BET Positions */}
              {mockBetPositions.map((position) => (
                <div key={position.id} style={{
                  background: 'var(--white)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-secondary)',
                  position: 'relative',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
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
                      background: 'var(--green)',
                      color: 'var(--white)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                    }}>
                      {position.type}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}>
                    Placed: {position.placedDate} | {position.daysHeld} days | {position.multiplier} multiplier
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
                        color: 'var(--green)',
                      }}>
                        +${position.potential.toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--green)',
                      }}>
                        (+{position.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* SHORT Positions */}
              {mockShortPositions.map((position) => (
                <div key={position.id} style={{
                  background: 'var(--white)',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-secondary)',
                  position: 'relative',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
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
                      background: 'var(--red)',
                      color: 'var(--white)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                    }}>
                      {position.type}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}>
                    Shorted: {position.shortedDate} | {position.dropTarget}% drop target | {position.progress}% progress
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
                        Entry: ${position.entry.toFixed(2)}
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
                        {position.shares} shares obligation
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    </div>
  );
}