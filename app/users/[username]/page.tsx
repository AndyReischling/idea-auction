// =============================================================================
// app/users/[username]/page.tsx – View another user's profile with same styling as profile page
// -----------------------------------------------------------------------------
//  ✦ Fetches user data by username instead of current user
//  ✦ Uses exact same UI structure as profile page
//  ✦ Shows other user's portfolio, bets, and activity
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { firebaseDataService } from '../../lib/firebase-data-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { calculateMultiplier, calculatePayout } from '../../lib/multiplier-utils';
import Sidebar from '../../components/Sidebar';
import AuthButton from '../../components/AuthButton';
import AuthStatusIndicator from '../../components/AuthStatusIndicator';
import RecentActivity from '../../components/RecentActivity';
import styles from '../../page.module.css';
import {
  ScanSmiley, RssSimple, Balloon, Wallet, User, Coins,
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
  uid: string;
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
export default function UserDetailPage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // 📄 User profile being viewed
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // 💼 Portfolio & assets
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);

  // 🧾 Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // All opinion texts → used for sidebar links
  const [allOpinions, setAllOpinions] = useState<string[]>([]);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof username !== 'string') return;
    
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const uname = decodeURIComponent(username);
        
        // 1️⃣ Fetch the user by username
        const targetUser = await firebaseDataService.getUserByUsername(uname);
        if (!targetUser) {
          setLoading(false);
          return;
        }

        const userProfile: UserProfile = {
          username: targetUser.username,
          balance: targetUser.balance,
          joinDate: targetUser.joinDate instanceof Date ? targetUser.joinDate.toISOString() : (targetUser.joinDate || new Date().toISOString()),
          totalEarnings: targetUser.totalEarnings || 0,
          totalLosses: targetUser.totalLosses || 0,
          uid: targetUser.uid,
        };
        setProfile(userProfile);

        // 2️⃣ Fetch portfolio data from transactions
        const txData = await firebaseDataService.getUserTransactions(targetUser.uid, 200);
        
        if (txData && txData.length > 0) {
          // Calculate holdings from buy/sell transactions
          const holdingsMap = new Map<string, any>();
          
          for (const tx of txData) {
            if ((tx as any).type === 'buy' && (tx as any).opinionText) {
              const opinionText = (tx as any).opinionText;
              const existing = holdingsMap.get(opinionText) || {
                id: opinionText,
                text: opinionText,
                quantity: 0,
                totalCost: 0,
                purchaseDate: (tx as any).date,
              };
              
              existing.quantity += (tx as any).quantity || 1;
              existing.totalCost += (tx as any).amount || 0;
              existing.purchasePrice = existing.totalCost / existing.quantity;
              
              holdingsMap.set(opinionText, existing);
            } else if ((tx as any).type === 'sell' && (tx as any).opinionText) {
              const opinionText = (tx as any).opinionText;
              const existing = holdingsMap.get(opinionText);
              if (existing) {
                existing.quantity -= (tx as any).quantity || 1;
                if (existing.quantity <= 0) {
                  holdingsMap.delete(opinionText);
                }
              }
            }
          }
          
          // Convert holdings map to array and get current prices
          const holdings = await Promise.all(
            Array.from(holdingsMap.values()).map(async (holding: any) => {
              // Get current market price
              const marketData = await firebaseDataService.getMarketData(holding.text);
              const currentPrice = marketData?.currentPrice || holding.purchasePrice || 10;
              
              // Query Firestore to find the opinion document by text to get the actual document ID
              let opinionId = btoa(holding.text).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100); // fallback
              try {
                const q = query(
                  collection(db, 'opinions'),
                  where('text', '==', holding.text),
                  limit(1)
                );
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  opinionId = querySnapshot.docs[0].id; // Use actual Firestore document ID
                }
              } catch (error) {
                console.error('Error fetching opinion ID for:', holding.text, error);
                // Keep fallback ID if query fails
              }
              
              return {
                id: opinionId, // Use actual Firestore document ID
                text: holding.text,
                purchasePrice: holding.purchasePrice || 0,
                currentPrice: currentPrice,
                purchaseDate: holding.purchaseDate || new Date().toISOString(),
                quantity: holding.quantity || 0,
              };
            })
          );
          
          setOwnedOpinions(holdings.filter(h => h.quantity > 0));
        }

        // 3️⃣ Set transactions
        if (txData) {
          const processedTransactions = txData.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            date: tx.date,
            opinionText: tx.opinionText,
          }));
          
          // Sort transactions by most recent first
          processedTransactions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          
          setTransactions(processedTransactions);
        }

        // 4️⃣ Opinions list (for sidebar)
        try {
          const allOpinions = await firebaseDataService.searchOpinions('', 500);
          setAllOpinions(allOpinions.map(op => op.text));
        } catch (error) {
          console.warn('Could not load sidebar opinions:', error);
        }

      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [username]);

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
            <a href="/profile" className="nav-button">
              <User size={20} /> Profile
            </a>
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

        {/* Opinion Portfolio */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            {profile.username}'s Opinion Portfolio
          </h2>

          {ownedOpinions.length === 0 ? (
            <div className="empty-state">{profile.username} doesn't own any opinions yet.</div>
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
                          Purchased: {new Date(o.purchaseDate).toLocaleDateString()} | Qty: {o.quantity}
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
                  <button 
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
                  </button>
                    </div>
              )}
            </div>
          )}
        </section>

        {/* Portfolio Bets and Shorts */}
        <section style={{ margin: '40px 0' }}>
          <h2 style={{ 
            fontSize: 'var(--font-size-xl)',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            paddingLeft: '32px',
          }}>
            {profile.username}'s Portfolio Bets and Shorts
          </h2>

          {MOCK_PORTFOLIO_BETS.length === 0 && MOCK_SHORT_POSITIONS.length === 0 ? (
            <div className="empty-state">{profile.username} doesn't have any bets or shorts yet.</div>
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
        <RecentActivity userId={profile?.uid} maxItems={15} title={`${profile?.username}'s Recent Activity`} />

        {/* Floating BET Button */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          right: '40px',
          zIndex: 1000,
          padding: '3px',
          background: 'var(--black)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}>
          <button
            onClick={() => window.location.href = `/bet/${username}`}
            style={{
              width: '80px',
              height: '80px',
              background: 'var(--yellow)',
              color: 'var(--black)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all var(--transition)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = 'var(--light-yellow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'var(--yellow)';
            }}
          >
            <Coins size={20} weight="bold" />
            BET
          </button>
        </div>
      </main>
    </div>
  );
}
