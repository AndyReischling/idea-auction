// =============================================================================
// app/profile/page.tsx – Firestore‑native profile dashboard (no localStorage)
// -----------------------------------------------------------------------------
//  ✦ Fetches all user‑centric data via `realtimeDataService` helpers
//  ✦ Subscribes to live updates where available (profile / portfolio / bets)
//  ✦ Drops every legacy fallback that referenced browser localStorage
//  ✦ Keeps the previous UI intact – only the data layer changed
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { realtimeDataService } from '../lib/realtime-data-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateMultiplier, calculatePayout } from '../lib/multiplier-utils';
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
  type: 'buy' | 'sell' | 'earn' | 'short_win' | 'short_loss' | 'short_place';
  amount: number;
  date: string;
  opinionText?: string;
}

// Portfolio Bet Interface (matches your existing implementation)
interface PortfolioBet {
  id: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  timeframe: number; // days
  amount: number;
  potentialPayout: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  placedDate: string;
  expiryDate: string;
  riskMultiplier: number;
}

// Short Position Interface (matches your existing implementation)
interface ShortPosition {
  id: string;
  opinionText: string;
  opinionId: string;
  targetDropPercentage: number;
  betAmount: number;
  potentialWinnings: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  createdDate: string;
  expirationDate: string;
  startingPrice: number;
  currentPrice: number;
  targetPrice: number;
  progress: number; // percentage progress toward target
  sharesObligation: number; // shares you'd need to buy if closed early
}

// Mock data - replace with real data once available
const MOCK_PORTFOLIO_BETS: PortfolioBet[] = [
  {
    id: 'bet1',
    targetUser: 'trading_maven',
    betType: 'increase',
    targetPercentage: 15,
    timeframe: 7,
    amount: 250.00,
    potentialPayout: calculatePayout(250.00, 15, 7 * 24), // 7 days = 168 hours
    status: 'active',
    placedDate: '12/15/2024',
    expiryDate: '12/22/2024',
    riskMultiplier: calculateMultiplier(15, 7 * 24),
  },
  {
    id: 'bet2',
    targetUser: 'crypto_bull',
    betType: 'decrease',
    targetPercentage: 10,
    timeframe: 3,
    amount: 100.00,
    potentialPayout: calculatePayout(100.00, 10, 3 * 24), // 3 days = 72 hours
    status: 'active',
    placedDate: '12/12/2024',
    expiryDate: '12/15/2024',
    riskMultiplier: calculateMultiplier(10, 3 * 24),
  },
];

const MOCK_SHORT_POSITIONS: ShortPosition[] = [
  {
    id: 'short1',
    opinionText: 'Cryptocurrency will replace traditional banking by 2026',
    opinionId: 'crypto_replace_banking',
    targetDropPercentage: 20,
    betAmount: 150.00,
    potentialWinnings: calculatePayout(150.00, 20, 168), // 7 days = 168 hours
    status: 'active',
    createdDate: '12/10/2024',
    expirationDate: '12/17/2024',
    startingPrice: 25.00,
    currentPrice: 22.50,
    targetPrice: 20.00,
    progress: 55.6, // (25-22.5)/(25-20) * 100
    sharesObligation: 20, // 20% of 100 shares if closed early
  },
  {
    id: 'short2',
    opinionText: 'Remote work will become less popular post-pandemic',
    opinionId: 'remote_work_decline',
    targetDropPercentage: 15,
    betAmount: 200.00,
    potentialWinnings: calculatePayout(200.00, 15, 168), // 7 days = 168 hours
    status: 'active',
    createdDate: '12/5/2024',
    expirationDate: '12/12/2024',
    startingPrice: 18.00,
    currentPrice: 19.25,
    targetPrice: 15.30,
    progress: -46.3, // Moving against us
    sharesObligation: 15, // 15% of 100 shares if closed early
  },
];

// ──────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // 📄 User profile
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // 💼 Portfolio & assets
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);

  // 🧾 Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // All opinion texts → used for sidebar links
  const [allOpinions, setAllOpinions] = useState<string[]>([]);

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
            
            // If the key looks sanitized (contains underscores), try to find the original opinion text
            if (opinionKey.includes('_')) {
              // Query all opinions to find the one whose sanitized version matches this key
              const sanitizeFieldName = (text: string): string => {
                return text.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
              };
              
              const allOpinionsSnap = await getDocs(collection(db, 'opinions'));
              const matchingOpinion = allOpinionsSnap.docs.find(doc => 
                sanitizeFieldName(doc.data().text) === opinionKey
              );
              
              if (matchingOpinion) {
                opinionText = matchingOpinion.data().text;
              }
            }

            // Query Firestore to find the opinion document by text
            const q = query(
              collection(db, 'opinions'),
              where('text', '==', opinionText),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            
            let opinionId = btoa(opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100); // fallback
            if (!querySnapshot.empty) {
              opinionId = querySnapshot.docs[0].id; // Use actual Firestore document ID
            }

            return {
              id: opinionId,
              text: String(opinionText), // Ensure it's a string
              purchasePrice: marketData[opinionText]?.basePrice || 10.00,
              currentPrice: marketData[opinionText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: Number(quantity) || 1,
            };
          } catch (error) {
            console.error('Error fetching opinion ID for:', opinionKey, error);
            // Fallback to base64 ID if query fails
            const fallbackText = typeof portfolioData === 'object' && portfolioData !== null 
              ? Object.keys(portfolioData)[0] || opinionKey 
              : opinionKey;
            const fallbackQuantity = typeof portfolioData === 'object' && portfolioData !== null
              ? Object.values(portfolioData)[0] as number
              : portfolioData as number;
            
            return {
              id: btoa(String(fallbackText)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100),
              text: String(fallbackText), // Ensure it's a string
              purchasePrice: marketData[fallbackText]?.basePrice || 10.00,
              currentPrice: marketData[fallbackText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: Number(fallbackQuantity) || 1,
            };
          }
        })
      );
      
      // De-duplicate entries by opinion ID and combine quantities
      const deduplicatedMap = new Map<string, OpinionAsset>();
      
      portfolioEntries.forEach(entry => {
        const existing = deduplicatedMap.get(entry.id);
        if (existing) {
          // Combine quantities for the same opinion
          existing.quantity += entry.quantity;
        } else {
          deduplicatedMap.set(entry.id, entry);
        }
      });
      
      // Convert back to array and filter out zero quantities
      const transformedPortfolio = Array.from(deduplicatedMap.values()).filter(entry => entry.quantity > 0);
      
      console.log('📊 Portfolio deduplication:', {
        originalEntries: portfolioEntries.length,
        deduplicatedEntries: transformedPortfolio.length,
        duplicateIds: portfolioEntries.map(e => e.id),
        finalIds: transformedPortfolio.map(e => e.id)
      });
      
      setOwnedOpinions(transformedPortfolio);
    };

    // 3️⃣  Transactions (latest 100)
    const unsubTx = realtimeDataService.subscribeToUserTransactions(
      user.uid,
      (tx: Transaction[]) => setTransactions(tx.slice(0, 100))
    );

    // 4️⃣  Opinions list (for sidebar)
    realtimeDataService.getOpinions().then(setAllOpinions);

    setLoading(false);
    return () => {
      unsubProfile && realtimeDataService.unsubscribe(unsubProfile);
      unsubTx && realtimeDataService.unsubscribe(unsubTx);
    };
  }, [user?.uid]);

  if (!user) return <AuthGuard><AuthButton /></AuthGuard>;
  if (loading || !profile) return <div className="loading">Loading…</div>;

  // Derived sums
  const portfolioValue = ownedOpinions.reduce(
    (t, o) => t + o.currentPrice * o.quantity,
    0
  );
  const pnl = portfolioValue + profile.balance + profile.totalEarnings - profile.totalLosses - 10000; // example calc
  const activeBets = ownedOpinions.length;

  // Portfolio Betting Exposure & Volatility Calculations
  const activeBetsData = MOCK_PORTFOLIO_BETS.filter(bet => bet.status === 'active');
  const activeShortsData = MOCK_SHORT_POSITIONS.filter(short => short.status === 'active');
  
  // Total Exposure: Amount at risk from active bets and shorts
  const betsExposure = activeBetsData.reduce((sum, bet) => sum + bet.amount, 0);
  const shortsExposure = activeShortsData.reduce((sum, short) => sum + short.betAmount, 0);
  const totalExposure = betsExposure + shortsExposure;
  
  // Portfolio Volatility: Potential swing range as percentage of total portfolio value
  const maxBetsWin = activeBetsData.reduce((sum, bet) => sum + bet.potentialPayout, 0);
  const maxBetsLoss = activeBetsData.reduce((sum, bet) => sum + bet.amount, 0);
  const maxShortsWin = activeShortsData.reduce((sum, short) => sum + short.potentialWinnings, 0);
  const maxShortsLoss = activeShortsData.reduce((sum, short) => sum + short.betAmount, 0);
  
  const maxWinScenario = maxBetsWin + maxShortsWin;
  const maxLossScenario = maxBetsLoss + maxShortsLoss;
  const totalSwingRange = maxWinScenario - (-maxLossScenario); // Total potential swing
  
  // Calculate volatility as percentage of total portfolio value (including betting positions)
  const totalPortfolioValue = portfolioValue + profile.balance;
  const portfolioVolatility = totalPortfolioValue > 0 ? (totalSwingRange / totalPortfolioValue) * 100 : 0;

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
              <div className="user-name">{profile.username} <span style={{ color: 'var(--green)', fontSize: 'var(--font-size-sm)' }}>🤖 Bots: Active Globally</span></div>
              <p>Member since {new Date(profile.joinDate).toLocaleDateString()} Opinion Trader & Collector</p>
            </div>
          </div>

          <div className="navigation-buttons">
            <AuthStatusIndicator />
            <a href="/users" className="nav-button">
              <ScanSmiley size={20} /> View Traders
            </a>
            <a href="/feed" className="nav-button">
              <RssSimple size={20} /> Live Feed
            </a>
            <a href="/generate" className="nav-button">
              <Balloon size={20} /> Generate
            </a>
            <AuthButton />
          </div>
        </div>

        {/* Global Bot Status Notification */}
        <div style={{
          background: 'var(--light-green)',
          color: 'var(--black)',
          padding: '12px 20px',
          margin: '20px 0',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 'var(--font-size-sm)',
        }}>
          <span>AI traders are active across all pages - they'll keep trading even when you navigate away</span>
          <button style={{
            background: 'none',
            border: 'none',
            color: 'var(--black)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontWeight: '600',
          }}>
            Stop Global Bots
          </button>
        </div>

                 {/* Dashboard Metrics */}
         <div style={{
           display: 'grid',
           gridTemplateColumns: 'repeat(6, 1fr)',
           gap: '1px',
           background: 'var(--border-primary)',
           margin: '20px 0',
         }}>
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
              color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
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
              Active Bets
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--text-primary)',
            }}>
              {activeBets}
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
              Exposure
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: totalExposure > 0 ? 'var(--red)' : 'var(--text-primary)',
            }}>
              ${totalExposure.toFixed(2)}
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
            <div className="empty-state">You don't own any opinions yet.</div>
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
                const gain = (o.currentPrice - o.purchasePrice) * o.quantity;
                const pct = ((o.currentPrice - o.purchasePrice) / o.purchasePrice) * 100;
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
                            color: pct >= 0 ? 'var(--green)' : 'var(--red)',
                            fontWeight: '600',
                          }}>
                            {pct >= 0 ? '+' : ''}${gain.toFixed(2)} ({pct.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </a>
                                  );
                })}
                </div>
                
                {/* View All Opinions Button */}
                {ownedOpinions.length > 6 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '24px',
                  }}>
                    <a 
                      href="/profile/opinions" 
                      style={{
                        background: 'var(--green)',
                        color: 'var(--white)',
                        padding: '12px 24px',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all var(--transition)',
                        display: 'inline-block',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#0d6b47';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--green)';
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

{MOCK_PORTFOLIO_BETS.length === 0 && MOCK_SHORT_POSITIONS.length === 0 ? (
              <div className="empty-state">You don't have any bets or shorts yet.</div>
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
                  {/* Portfolio Bets */}
                  {MOCK_PORTFOLIO_BETS.map((bet: PortfolioBet, index: number) => {
                    const isWinning = bet.status === 'won' || bet.status === 'active';
                    const potentialReturn = bet.potentialPayout - bet.amount;
                    
                    return (
                      <a
                        key={`bet-${bet.id}-${index}`}
                        href={`/users/${bet.targetUser}`}
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
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px',
                          }}>
                            <p style={{
                              fontSize: 'var(--font-size-md)',
                              fontWeight: '500',
                              margin: '0',
                              color: 'var(--text-primary)',
                              lineHeight: '1.4',
                              flex: 1,
                              paddingRight: '8px',
                            }}>
                              {bet.targetUser}'s portfolio {bet.betType === 'increase' ? '↗' : '↘'} {bet.targetPercentage}%
                            </p>
                            <span style={{
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: '600',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: bet.betType === 'increase' ? 'var(--green)' : 'var(--red)',
                              color: 'var(--white)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0,
                            }}>
                              BET
                            </span>
                          </div>
                          <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary)',
                            margin: '0',
                          }}>
                            Placed: {bet.placedDate} | {bet.timeframe} days | {bet.riskMultiplier}x multiplier
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
                                Wagered: ${bet.amount.toFixed(2)}
                              </p>
                              <p style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: '700',
                                margin: '4px 0 0 0',
                                color: 'var(--text-primary)',
                              }}>
                                ${bet.potentialPayout.toFixed(2)}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{
                                fontSize: 'var(--font-size-sm)',
                                margin: '0',
                                color: isWinning ? 'var(--green)' : 'var(--red)',
                                fontWeight: '600',
                              }}>
                                {bet.status === 'active' ? `+$${potentialReturn.toFixed(2)} potential` : 
                                 bet.status === 'won' ? `+$${potentialReturn.toFixed(2)} won` :
                                 `-$${bet.amount.toFixed(2)} lost`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                  
                  {/* Short Positions */}
                  {MOCK_SHORT_POSITIONS.map((short: ShortPosition, index: number) => {
                    const isWinning = short.progress > 0;
                    const potentialReturn = short.potentialWinnings - short.betAmount;
                    
                    return (
                      <a
                        key={`short-${short.id}-${index}`}
                        href={`/opinion/${short.opinionId}`}
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
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px',
                          }}>
                            <p style={{
                              fontSize: 'var(--font-size-md)',
                              fontWeight: '500',
                              margin: '0',
                              color: 'var(--text-primary)',
                              lineHeight: '1.4',
                              flex: 1,
                              paddingRight: '8px',
                            }}>
                              {short.opinionText}
                            </p>
                            <span style={{
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: '600',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--red)',
                              color: 'var(--white)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              flexShrink: 0,
                            }}>
                              SHORT
                            </span>
                          </div>
                          <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary)',
                            margin: '0',
                          }}>
                            Shorted: {short.createdDate} | {short.targetDropPercentage}% drop target | {short.progress.toFixed(1)}% progress
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
                                Entry: ${short.startingPrice.toFixed(2)}
                              </p>
                              <p style={{
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: '700',
                                margin: '4px 0 0 0',
                                color: 'var(--text-primary)',
                              }}>
                                ${short.currentPrice.toFixed(2)}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{
                                fontSize: 'var(--font-size-sm)',
                                margin: '0',
                                color: isWinning ? 'var(--green)' : 'var(--red)',
                                fontWeight: '600',
                              }}>
                                {short.status === 'active' ? `${short.sharesObligation} shares obligation` : 
                                 short.status === 'won' ? `+$${potentialReturn.toFixed(2)} won` :
                                 `-$${short.betAmount.toFixed(2)} lost`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Recent Activity Section */}
          <RecentActivity userId={user?.uid} maxItems={15} title="My Recent Activity" />
        </main>
      </div>
    );
  }
