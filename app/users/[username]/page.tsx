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
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from '../../lib/portfolio-utils';
import { realtimeDataService } from '../../lib/realtime-data-service';
import Sidebar from '../../components/Sidebar';
import AuthButton from '../../components/AuthButton';
import AuthStatusIndicator from '../../components/AuthStatusIndicator';
import Navigation from '../../components/Navigation';
import RecentActivity from '../../components/RecentActivity';
import styles from '../../page.module.css';
import {
  Wallet, User, Coins, ScanSmiley, RssSimple, Balloon, SignOut,
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

  // Check if current user is viewing their own profile - only check when we have complete data
  const isOwnProfile = !loading && user && profile && (
    user.displayName === profile.username || 
    user.email?.split('@')[0] === profile.username ||
    user.uid === profile.uid ||
    // Also check if the URL username matches the current user's username stored in their profile
    (typeof username === 'string' && decodeURIComponent(username) === user.displayName) ||
    (typeof username === 'string' && decodeURIComponent(username) === user.email?.split('@')[0])
  );

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

        // 2️⃣ Fetch portfolio data using proper portfolio service
        let portfolio: Portfolio;
        try {
          portfolio = await getUserPortfolio(targetUser.uid);
        } catch (error) {
          console.warn('Failed to load new portfolio, trying migration...');
          await migrateUserPortfolio(targetUser.uid);
          portfolio = await getUserPortfolio(targetUser.uid);
        }
        
        // If no items in new portfolio but old portfolio exists, migrate
        if (portfolio.items.length === 0 && (targetUser as any)?.portfolio) {
          console.log('🔄 Migrating portfolio data...');
          await migrateUserPortfolio(targetUser.uid);
          portfolio = await getUserPortfolio(targetUser.uid);
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

        // 3️⃣ Fetch transaction data for transactions section
        const txData = await firebaseDataService.getUserTransactions(targetUser.uid, 200);

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
            (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
              {isOwnProfile ? 'Total Opinions' : 'Active Bets'}
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: 'var(--text-primary)',
            }}>
              {isOwnProfile ? ownedOpinions.length : activeBets}
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
              {isOwnProfile ? 'Total Earnings' : 'Exposure'}
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: isOwnProfile ? 'var(--green)' : (totalExposure > 0 ? 'var(--red)' : 'var(--text-primary)'),
            }}>
              {isOwnProfile ? `$${(profile.totalEarnings || 0).toFixed(2)}` : `$${totalExposure.toFixed(2)}`}
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
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: '20px',
              }}>
                {/* Grid items ordered by: most recent (top-left), 2nd most recent (top-middle), 3rd most recent (top-right), 4th most recent (bottom-left), 5th most recent (bottom-middle), 6th most recent (bottom-right) */}
                {ownedOpinions
                  .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                  .slice(0, 6)
                  .map((o, index) => {
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

        {/* Recent Activity Section */}
        <RecentActivity userId={profile?.uid} maxItems={15} title={`${profile?.username}'s Recent Activity`} />

        {/* Floating BET Button - Only show for other users, not own profile */}
        {!isOwnProfile && (
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
        )}
      </main>
    </div>
  );
}
