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
import Sidebar from '../components/Sidebar';
import AuthGuard from '../components/AuthGuard';
import AuthButton from '../components/AuthButton';
import AuthStatusIndicator from '../components/AuthStatusIndicator';
import RecentActivity from '../components/RecentActivity';
import styles from '../page.module.css';
import {
  ScanSmiley, RssSimple, Balloon, Wallet,
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

    // 2️⃣  Portfolio data (fetch from user profile's portfolio field)
    const fetchPortfolioData = async (userProfile: any) => {
      if (!userProfile?.portfolio) {
        setOwnedOpinions([]);
        return;
      }

      // Get market data to get current prices
      const marketData = await realtimeDataService.getMarketData();
      
      // Fetch actual opinion document IDs from Firestore
      const portfolioEntries = await Promise.all(
        Object.entries(userProfile.portfolio).map(async ([opinionKey, portfolioData]) => {
          try {
            // Extract text and quantity from portfolio data
            // opinionKey is now the sanitized field name, we need to find the original opinion text
            let opinionText = opinionKey;
            let quantity = typeof portfolioData === 'object' && portfolioData !== null
              ? Object.values(portfolioData)[0] as number
              : portfolioData as number;
            
            // Try to find the original opinion text by querying the opinions collection
            const q = query(
              collection(db, 'opinions'),
              where('text', '>=', opinionText.slice(0, 10)),
              limit(50)
            );
            
            const snap = await getDocs(q);
            let foundOpinion: any = null;
            
            // Search for exact match or close match
            snap.docs.forEach(doc => {
              const data = doc.data();
              if (data.text && (
                data.text === opinionText || 
                data.text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === opinionKey.toLowerCase() ||
                opinionKey.includes(data.text.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
              )) {
                foundOpinion = { id: doc.id, ...data };
              }
            });

            if (foundOpinion) {
              opinionText = foundOpinion.text;
            }

            // Get current market price
            const marketInfo = marketData[opinionText];
            const currentPrice = marketInfo?.currentPrice || 10.0;

            return {
              id: foundOpinion?.id || opinionKey,
              text: opinionText,
              purchasePrice: 10.0, // Default purchase price
              currentPrice,
              purchaseDate: userProfile.joinDate?.toDate?.()?.toLocaleDateString?.() || 'Unknown',
              quantity,
            };
          } catch (error) {
            console.error('Error processing portfolio entry:', error);
            return null;
          }
        })
      );

      const validOpinions = portfolioEntries.filter(Boolean) as OpinionAsset[];
      
      // Remove duplicates by text content
      const uniqueOpinions = validOpinions.reduce((acc, current) => {
        const existing = acc.find(item => item.text === current.text);
        if (existing) {
          // If duplicate found, keep the one with higher quantity
          if (current.quantity > existing.quantity) {
            return acc.map(item => item.text === current.text ? current : item);
          }
          return acc;
        } else {
          return [...acc, current];
        }
        
        return acc;
      }, [] as OpinionAsset[]);
      
      setOwnedOpinions(uniqueOpinions);
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
          <div className="user-header">
            <div className="user-avatar">{profile.username[0]}</div>
            <div className="user-info">
              <div className="user-name">{profile.username}</div>
              <p>🤖 Bots: Active Globally</p>
              <p>Member since {new Date(profile.joinDate).toLocaleDateString()} | Opinion Trader & Collector</p>
            </div>
          </div>

          <div className="navigation-buttons">
            <AuthStatusIndicator />
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={20} /> View Traders
            </a>
            <a href="/feed" className="nav-button feed">
              <RssSimple size={20} /> Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
              <Balloon size={20} /> Generate
            </a>
            <AuthButton />
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

        {/* Recent Activity */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            Recent Activity
          </h2>

          <div style={{
            background: 'var(--white)',
            paddingLeft: '32px',
            paddingRight: '32px',
            paddingBottom: '20px',
          }}>
            <RecentActivity userId={user?.uid} maxItems={15} title="My Recent Activity" />
          </div>
        </section>
      </main>
    </div>
  );
}
