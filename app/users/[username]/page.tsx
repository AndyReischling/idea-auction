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
import ActivityIntegration from '../../components/ActivityIntegration';
import { collection, query, where, limit, getDocs, onSnapshot } from 'firebase/firestore';
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

// Real data - removed mock data

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

  // Real bets and shorts data
  const [userBets, setUserBets] = useState<any[]>([]);
  const [userShorts, setUserShorts] = useState<any[]>([]);
  
  // Real-time activity updates
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

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
    
    let unsubscriptions: (() => void)[] = [];
    
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const uname = decodeURIComponent(username);
        
        // 1️⃣ Fetch the user by username
        const targetUser = await firebaseDataService.getUserByUsername(uname);
        if (!targetUser) {
          console.error('❌ User not found:', uname);
          setLoading(false);
          return;
        }

        // Validate that user has required uid field (check both uid and id)
        const userId = targetUser.uid || (targetUser as any).id;
        if (!userId) {
          console.error('❌ User missing uid/id field:', targetUser);
          setLoading(false);
          return;
        }

        const userProfile: UserProfile = {
          username: targetUser.username,
          balance: targetUser.balance,
          joinDate: targetUser.joinDate instanceof Date ? targetUser.joinDate.toISOString() : (targetUser.joinDate || new Date().toISOString()),
          totalEarnings: targetUser.totalEarnings || 0,
          totalLosses: targetUser.totalLosses || 0,
          uid: userId, // Use the validated userId
        };
        setProfile(userProfile);

        // 🔄 SET UP REAL-TIME SUBSCRIPTIONS FOR ALL DATA

        // REAL-TIME SUBSCRIPTION 1: User profile data
        const userDocRef = query(collection(db, 'users'), where('uid', '==', userId));
        const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const updatedProfile: UserProfile = {
              username: userData.username || userProfile.username,
              balance: userData.balance || 0,
              joinDate: userData.joinDate instanceof Date ? userData.joinDate.toISOString() : (userData.joinDate || userProfile.joinDate),
              totalEarnings: userData.totalEarnings || 0,
              totalLosses: userData.totalLosses || 0,
              uid: userId,
            };
            setProfile(updatedProfile);
            console.log('🔄 User profile updated:', updatedProfile.username, 'Balance:', updatedProfile.balance);
          }
        });
        unsubscriptions.push(unsubscribeUser);

        // REAL-TIME SUBSCRIPTION 2: Portfolio data
        const portfolioDocRef = query(collection(db, 'user-portfolios'), where('userId', '==', userId));
        const unsubscribePortfolio = onSnapshot(portfolioDocRef, async (snapshot) => {
          try {
            let portfolioItems: any[] = [];
            if (!snapshot.empty) {
              const portfolioDoc = snapshot.docs[0];
              const portfolioData = portfolioDoc.data();
              portfolioItems = portfolioData.items || [];
            }

            // Get market data for current prices
            const marketData = await realtimeDataService.getMarketData();
            
            // Transform portfolio items to the expected format
            const transformedOpinions = await Promise.all(
              portfolioItems.map(async (item) => {
                let actualOpinionId = item.opinionId;
                try {
                  const q = query(
                    collection(db, 'opinions'),
                    where('text', '==', item.opinionText),
                    limit(1)
                  );
                  const querySnapshot = await getDocs(q);
                  
                  if (!querySnapshot.empty) {
                    actualOpinionId = querySnapshot.docs[0].id;
                  }
                } catch (error) {
                  console.error('Error fetching actual opinion ID for:', item.opinionText, error);
                }

                return {
                  id: actualOpinionId,
                  text: item.opinionText,
                  purchasePrice: item.averagePrice,
                  currentPrice: marketData[item.opinionText]?.currentPrice || item.averagePrice,
                  purchaseDate: new Date(item.lastUpdated).toLocaleDateString(),
                  quantity: item.quantity,
                };
              })
            );
            
            setOwnedOpinions(transformedOpinions);
            console.log('🔄 Portfolio updated:', transformedOpinions.length, 'opinions');
          } catch (error) {
            console.error('Error processing portfolio update:', error);
          }
        });
        unsubscriptions.push(unsubscribePortfolio);

        // REAL-TIME SUBSCRIPTION 3: User bets
        const betsQuery = query(
          collection(db, 'advanced-bets'),
          where('userId', '==', userId)
        );
        const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
          const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUserBets(betsData);
          console.log('🔄 Bets updated:', betsData.length, 'active bets');
        });
        unsubscriptions.push(unsubscribeBets);

        // REAL-TIME SUBSCRIPTION 4: User shorts
        const shortsQuery = query(
          collection(db, 'short-positions'),
          where('userId', '==', userId)
        );
        const unsubscribeShorts = onSnapshot(shortsQuery, (snapshot) => {
          const shortsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUserShorts(shortsData);
          console.log('🔄 Shorts updated:', shortsData.length, 'short positions');
        });
        unsubscriptions.push(unsubscribeShorts);

        // REAL-TIME SUBSCRIPTION 5: Transactions
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          limit(200)
        );
        const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
          console.log('🔄 Transactions updated:', processedTransactions.length, 'transactions');
        });
        unsubscriptions.push(unsubscribeTransactions);

        // REAL-TIME SUBSCRIPTION 6: Activity feed (already exists, keeping it)
        const activityQuery = query(
          collection(db, 'activity-feed'),
          where('userId', '==', userId),
          limit(20)
        );
        
        const unsubscribeActivity = onSnapshot(activityQuery, (snapshot: any) => {
          const activities = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
          }));
          
          // Sort by most recent first
          activities.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setRecentActivity(activities);
          console.log('🔄 Activity feed updated:', activities.length, 'activities');
        });
        unsubscriptions.push(unsubscribeActivity);

        // Load sidebar opinions (one-time)
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

    // Start the async fetch
    fetchUserData();
    
    // Return synchronous cleanup function
    return () => {
      console.log('🧹 Cleaning up', unsubscriptions.length, 'subscriptions for user:', username);
      unsubscriptions.forEach(unsub => unsub());
    };
  }, [username]);

  if (loading || !profile) return <div className="loading">Loading…</div>;

  // Derived sums
  const portfolioValue = ownedOpinions.reduce(
    (t, o) => t + o.currentPrice * o.quantity,
    0
  );
  const pnl = portfolioValue + profile.balance + profile.totalEarnings - profile.totalLosses - 10000; // example calc
  const activeBets = ownedOpinions.length;

  // Real data is loaded in useEffect and stored in state

  // Portfolio Betting Exposure & Volatility Calculations - using real data
  const activeBetsData = userBets.filter((bet: any) => bet.status === 'active');
  const activeShortsData = userShorts.filter((short: any) => short.status === 'active');
  
  // Total Exposure: Amount at risk from active bets and shorts
  const betsExposure = activeBetsData.reduce((sum: number, bet: any) => sum + (bet.amount || 0), 0);
  const shortsExposure = activeShortsData.reduce((sum: number, short: any) => sum + (short.betAmount || short.amount || 0), 0);
  const totalExposure = betsExposure + shortsExposure;
  
  // Portfolio Volatility: Potential swing range as percentage of total portfolio value
  const maxBetsWin = activeBetsData.reduce((sum: number, bet: any) => sum + (bet.potentialPayout || bet.amount * 2 || 0), 0);
  const maxBetsLoss = activeBetsData.reduce((sum: number, bet: any) => sum + (bet.amount || 0), 0);
  const maxShortsWin = activeShortsData.reduce((sum: number, short: any) => sum + (short.potentialWinnings || short.amount * 1.5 || 0), 0);
  const maxShortsLoss = activeShortsData.reduce((sum: number, short: any) => sum + (short.betAmount || short.amount || 0), 0);
  
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
              {portfolioVolatility.toFixed(2)}%
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
                                {pct >= 0 ? '+' : ''}${gain.toFixed(2)} ({pct.toFixed(2)}%)
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
              {userBets.map((position: any) => (
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
                        (+{position.percentage.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* SHORT Positions */}
              {userShorts.map((position: any) => (
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
      
      {/* Activity Integration for real-time updates */}
      <ActivityIntegration userProfile={profile || undefined} />
    </div>
  );
}
