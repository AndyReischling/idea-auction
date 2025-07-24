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
import { collection, query, where, limit, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { calculateMultiplier, calculatePayout } from '../../lib/multiplier-utils';
import { getUserPortfolio, migrateUserPortfolio, type Portfolio } from '../../lib/portfolio-utils';
import { realtimeDataService } from '../../lib/realtime-data-service';
import { unifiedPortfolioService } from '../../lib/unified-portfolio-service';
import Sidebar from '../../components/Sidebar';
import AuthButton from '../../components/AuthButton';
import AuthStatusIndicator from '../../components/AuthStatusIndicator';
import Navigation from '../../components/Navigation';
import RecentActivity from '../../components/RecentActivity';
import FirestoreDataDiagnostic from '../../components/FirestoreDataDiagnostic';
import styles from '../../page.module.css';
import {
  Wallet, User, Coins, ScanSmiley, RssSimple, Balloon, SignOut,
} from '@phosphor-icons/react';

// Diagnostic function to debug bot portfolio data
async function debugBotPortfolioData(botId: string, botUsername: string) {
  console.log('🔍 DIAGNOSTIC START:', { botId, botUsername });
  
  try {
    // Check consolidated-bot-portfolios
    const consolidatedRef = doc(db, 'consolidated-bot-portfolios', botId);
    const consolidatedSnap = await getDoc(consolidatedRef);
    console.log('📊 Consolidated portfolio exists:', consolidatedSnap.exists());
    if (consolidatedSnap.exists()) {
      const data = consolidatedSnap.data();
      console.log('📊 Consolidated portfolio data:', data);
    }

    // Check bot-portfolios collection
    const botPortfoliosQuery = query(collection(db, 'bot-portfolios'));
    const botPortfoliosSnap = await getDocs(botPortfoliosQuery);
    const botDocs = botPortfoliosSnap.docs.filter(doc => doc.id.startsWith(botId + '_'));
    console.log('📊 Individual bot portfolio docs found:', botDocs.length);
    botDocs.forEach(doc => {
      console.log('📊 Bot portfolio doc:', doc.id, doc.data());
    });

    // Check user-portfolios (in case bot data is stored there)
    const userPortfolioRef = doc(db, 'user-portfolios', botId);
    const userPortfolioSnap = await getDoc(userPortfolioRef);
    console.log('📊 User portfolio exists:', userPortfolioSnap.exists());
    if (userPortfolioSnap.exists()) {
      const data = userPortfolioSnap.data();
      console.log('📊 User portfolio data:', data);
    }

    // Check transactions for this bot
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', botId),
      limit(5)
    );
    const transactionsSnap = await getDocs(transactionsQuery);
    console.log('📊 Bot transactions found:', transactionsSnap.size);
    transactionsSnap.docs.forEach(doc => {
      console.log('📊 Bot transaction:', doc.data());
    });

  } catch (error) {
    console.error('❌ DIAGNOSTIC ERROR:', error);
  }
}

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
  const [isBot, setIsBot] = useState<boolean>(false);

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
        
        // 1️⃣ Fetch the user by username - check both users and autonomous-bots collections
        let targetUser = await firebaseDataService.getUserByUsername(uname);
        let userIsBot = false;
        
        // If not found in users collection, check autonomous-bots collection
        if (!targetUser) {
          console.log('🔍 User not found in users collection, checking autonomous-bots...');
          try {
            const autonomousBotsRef = collection(db, "autonomous-bots");
            const autonomousBotsSnap = await getDocs(autonomousBotsRef);
            
            // Look for bot with matching username
            console.log('🔍 DEBUG: Searching for bot:', uname);
            for (const botDoc of autonomousBotsSnap.docs) {
              const botData = botDoc.data();
              const botUsername = botData.personality?.name || botData.username || `Bot_${botDoc.id}`;
              console.log('🔍 DEBUG: Checking bot:', botUsername, 'with doc ID:', botDoc.id);
              console.log('🔍 DEBUG: Bot data fields:', { 
                'personality.name': botData.personality?.name,
                'username': botData.username,
                'docId': botDoc.id 
              });
              
              if (botUsername === uname || botDoc.id === uname || (`bot_${botDoc.id}` === uname)) {
                                 // Found the bot! Create a user-like object
                 targetUser = {
                   uid: botDoc.id, // ✅ FIX: Use botDoc.id (document ID) consistently
                   username: botUsername,
                   balance: botData.balance || 0,
                   totalEarnings: botData.totalEarnings || 0,
                   totalLosses: botData.totalLosses || 0,
                   joinDate: botData.joinDate || new Date().toISOString(),
                   ...botData  // Include all other bot properties
                 } as any;
                                 userIsBot = true;
                console.log('🤖 Found bot user:', botUsername, 'with ID:', botDoc.id);
                console.log('🔍 DEBUG: Bot Identity Check');
                console.log('🆔 Document ID (for queries):', botDoc.id);
                console.log('👤 Display Username:', botUsername);
                console.log('⚡ Bot Active Status:', botData.isActive);
                console.log('💰 Bot Balance:', botData.balance);
                console.log('📅 Last Active:', botData.lastActive);
                break;
              }
            }
          } catch (error) {
            console.error('❌ Error checking autonomous-bots:', error);
          }
        }
        
        if (!targetUser) {
          console.error('❌ User not found in either users or autonomous-bots collections:', uname);
          setLoading(false);
          return;
        }

        // Validate that user has required uid field (check both uid and id)
        const userId = targetUser.uid || (targetUser as any).id;

        // 🔍 DEBUG: Add comprehensive logging to identify the username/userId mismatch issue
        console.log('🔍 DETAILED USER RESOLUTION DEBUG:');
        console.log('📍 URL Username:', uname);
        console.log('👤 Found User Object:', {
          uid: targetUser.uid,
          id: (targetUser as any).id,
          username: targetUser.username,
          displayUsername: (targetUser as any).personality?.name || targetUser.username,
          isBot: userIsBot,
          balance: targetUser.balance
        });
        console.log('🆔 Resolved UserId for queries:', userId);
        console.log('📊 This userId will be used for:');
        console.log('  - Portfolio queries: user-portfolios/' + userId);
        console.log('  - Activity queries: activity-feed?userId=' + userId);
        console.log('  - Transactions: transactions?userId=' + userId);
        console.log('  - Recent Activity Component userId:', userId);

        // ✅ DIAGNOSTIC: Debug bot portfolio data
        if (userIsBot) {
          console.log('🔍 DIAGNOSTIC: Running bot portfolio data check...');
          await debugBotPortfolioData(userId, targetUser.username);
        }

        if (!userId) {
          console.error('❌ User missing uid/id field:', targetUser);
          setLoading(false);
          return;
        }

        console.log(`✅ User data loaded successfully:`, {
          username: targetUser.username,
          uid: userId,
          isBot: userIsBot,
          isOwnProfile: false, // Will be calculated after profile state is set
          portfolioItems: 'Loading...',
          bets: 'Loading...',
          shorts: 'Loading...',
          transactions: 'Loading...'
        });

        // ✅ DEBUG: Log userId being used for queries
        console.log('🔍 DEBUG: userId for queries:', userId);

        // ✅ FIX: Convert UserProfile types to match local interface
        const userProfile: UserProfile = {
          username: targetUser.username,
          balance: targetUser.balance,
          joinDate: targetUser.joinDate instanceof Date ? targetUser.joinDate.toISOString() : (targetUser.joinDate || new Date().toISOString()),
          totalEarnings: targetUser.totalEarnings || 0,
          totalLosses: targetUser.totalLosses || 0,
          uid: userId,
        };
        
        setProfile(userProfile);
        setIsBot(userIsBot);
        setLoading(false);

        // 🔄 SET UP REAL-TIME SUBSCRIPTIONS FOR ALL DATA

        // REAL-TIME SUBSCRIPTION 1: User profile data  
        console.log('🔍 DEBUG: Setting up profile subscription - userIsBot:', userIsBot, 'userId:', userId);
        if (userIsBot) {
          // ✅ BOT FIX: Subscribe to autonomous-bots collection for bots
          console.log('🤖 Setting up bot profile subscription for:', userId);
          const botDocRef = doc(db, 'autonomous-bots', userId);
          const unsubscribeBot = onSnapshot(botDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const botData = snapshot.data();
              const botUsername = botData.personality?.name || botData.username || `Bot_${userId}`;
              console.log('🤖 Bot profile subscription triggered - username:', botUsername, 'balance:', botData.balance);
              const updatedProfile: UserProfile = {
                username: botUsername,
                balance: botData.balance || 0,
                joinDate: botData.joinDate || new Date().toISOString(),
                totalEarnings: botData.totalEarnings || 0,
                totalLosses: botData.totalLosses || 0,
                uid: userId,
              };
              setProfile(updatedProfile);
              console.log('🤖 Bot profile updated:', botUsername, 'Balance:', botData.balance);
            } else {
              console.log('🤖 ❌ Bot document does not exist for ID:', userId);
            }
          });
          unsubscriptions.push(unsubscribeBot);
        } else {
          // ✅ Regular user subscription to users collection
          const userDocRef = query(collection(db, 'users'), where('uid', '==', userId));
          const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
            if (!snapshot.empty) {
              const userData = snapshot.docs[0].data();
              const updatedProfile: UserProfile = {
                username: userData.username || (profile?.username || 'Unknown'),
                balance: userData.balance || 0,
                joinDate: userData.joinDate instanceof Date ? userData.joinDate.toISOString() : (userData.joinDate || profile?.joinDate || new Date().toISOString()),
                totalEarnings: userData.totalEarnings || 0,
                totalLosses: userData.totalLosses || 0,
                uid: userId,
              };
              setProfile(updatedProfile);
              console.log('🔄 User profile updated:', updatedProfile.username, 'Balance:', updatedProfile.balance);
            }
          });
          unsubscriptions.push(unsubscribeUser);
        }

        // REAL-TIME SUBSCRIPTION 2: Portfolio data - real-time subscription instead of intervals
        const setupPortfolioSubscription = async () => {
          // Initial load
          const portfolioData = await unifiedPortfolioService.loadUserPortfolio(userId, { ...targetUser, isBot: userIsBot });
          setOwnedOpinions(portfolioData);
          console.log(`🔄 Portfolio initially loaded:`, portfolioData.length, 'opinions');
          
          // Set up real-time subscription to user-portfolios collection
          const portfolioRef = doc(db, 'user-portfolios', userId);
          const unsubscribePortfolio = onSnapshot(portfolioRef, async (snapshot) => {
            if (snapshot.exists()) {
              console.log('🔄 Portfolio document updated, reloading...');
              const refreshedData = await unifiedPortfolioService.loadUserPortfolio(userId, { ...targetUser, isBot: userIsBot });
              setOwnedOpinions(refreshedData);
              console.log(`🔄 Portfolio refreshed via real-time update:`, refreshedData.length, 'opinions');
            }
          });
          unsubscriptions.push(unsubscribePortfolio);
          
          // Also subscribe to market data changes for price updates
          const marketDataQuery = collection(db, 'market-data');
          const unsubscribeMarket = onSnapshot(marketDataQuery, async (snapshot) => {
            // Only refresh if there are actual changes
            if (!snapshot.metadata.hasPendingWrites) {
              console.log('🔄 Market data updated, refreshing portfolio prices...');
              const refreshedData = await unifiedPortfolioService.loadUserPortfolio(userId, { ...targetUser, isBot: userIsBot });
              setOwnedOpinions(refreshedData);
            }
          });
          unsubscriptions.push(unsubscribeMarket);
        };
        
        await setupPortfolioSubscription();

        // REAL-TIME SUBSCRIPTION 3: User bets - real-time subscription
        const setupBetsSubscription = () => {
          const betsQuery = query(
            collection(db, 'advanced-bets'), 
            where('userId', '==', userId)
          );
          const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
            const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserBets(betsData);
            console.log(`🔄 Bets updated via real-time subscription:`, betsData.length, 'bets');
          });
          unsubscriptions.push(unsubscribeBets);
        };
        
        setupBetsSubscription();

        // REAL-TIME SUBSCRIPTION 4: User shorts - real-time subscription
        const setupShortsSubscription = () => {
          const shortsQuery = query(
            collection(db, 'short-positions'), 
            where('userId', '==', userId)
          );
          const unsubscribeShorts = onSnapshot(shortsQuery, (snapshot) => {
            const shortsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserShorts(shortsData);
            console.log(`🔄 Shorts updated via real-time subscription:`, shortsData.length, 'short positions');
          });
          unsubscriptions.push(unsubscribeShorts);
        };
        
        setupShortsSubscription();
        


        // REAL-TIME SUBSCRIPTION 5: Transactions
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          // Removed isBot filter - transactions documents don't have this field
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

        // REAL-TIME SUBSCRIPTION 6: Activity feed with immediate data refresh triggers
        const setupActivitySubscription = () => {
          const activityQuery = query(
            collection(db, 'activity-feed'),
            where('userId', '==', userId),
            limit(20)
          );
          
          const unsubscribeActivity = onSnapshot(activityQuery, async (snapshot: any) => {
            const activities = snapshot.docs.map((doc: any) => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
            }));
            
            // Sort by most recent first
            activities.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRecentActivity(activities);
            console.log('🔄 Activity feed updated:', activities.length, 'activities');
            
            // ✅ CRITICAL FIX: Validate that activities belong to the correct user
            if (activities.length > 0) {
              const invalidActivities = activities.filter((activity: any) => {
                // Check if activity username matches expected user or if it's clearly from a different user
                const isValidActivity = (
                  activity.userId === userId ||
                  activity.username === targetUser?.username ||
                  activity.username === (targetUser as any)?.personality?.name ||
                  (userIsBot && activity.isBot && activity.username?.includes(userId))
                );
                
                if (!isValidActivity) {
                  console.warn('⚠️ Found activity that may not belong to current user:', {
                    expectedUserId: userId,
                    expectedUsername: targetUser?.username,
                    activityUserId: activity.userId,
                    activityUsername: activity.username,
                    activityType: activity.type
                  });
                }
                
                return !isValidActivity;
              });
              
              if (invalidActivities.length > 0) {
                console.error('❌ DATA INCONSISTENCY: Found activities that don\'t match current user');
                console.error('❌ This indicates a data integrity issue that needs to be resolved');
                console.error('❌ Expected user:', { userId, username: targetUser?.username });
                console.error('❌ Invalid activities:', invalidActivities.map((a: any) => ({ username: a.username, type: a.type })));
              }
            }
            
            // CRITICAL: When new activity occurs, immediately refresh all data
            if (!snapshot.metadata.hasPendingWrites && activities.length > 0) {
              console.log('🔄 New activity detected, triggering immediate data refresh...');
              
              // Refresh portfolio data
              try {
                const refreshedPortfolio = await unifiedPortfolioService.loadUserPortfolio(userId, { ...targetUser, isBot: userIsBot });
                setOwnedOpinions(refreshedPortfolio);
                console.log('✅ Portfolio refreshed after activity');
              } catch (error) {
                console.warn('Failed to refresh portfolio after activity:', error);
              }
            }
          });
          unsubscriptions.push(unsubscribeActivity);
        };
        
        setupActivitySubscription();

        // REAL-TIME SUBSCRIPTION 7: Global activity events for immediate updates
        const handleGlobalActivityUpdate = async (event: any) => {
          const { userId: eventUserId } = event.detail;
          if (eventUserId === userId) {
            console.log('🔄 Global activity event received, refreshing all data for user:', eventUserId);
            
            // Refresh all data immediately when global activity occurs
            try {
              const [refreshedPortfolio, refreshedBets, refreshedShorts] = await Promise.all([
                unifiedPortfolioService.loadUserPortfolio(userId, { ...targetUser, isBot: userIsBot }),
                unifiedPortfolioService.getUserBets(userId),
                unifiedPortfolioService.getUserShorts(userId)
              ]);
              
              setOwnedOpinions(refreshedPortfolio);
              setUserBets(refreshedBets);
              setUserShorts(refreshedShorts);
              console.log('✅ All data refreshed after global activity event');
            } catch (error) {
              console.warn('Failed to refresh data after global activity event:', error);
            }
          }
        };
        
        // Listen for global activity events
        window.addEventListener('user-activity-updated', handleGlobalActivityUpdate);
        window.addEventListener('user-profile-updated', handleGlobalActivityUpdate);
        unsubscriptions.push(() => {
          window.removeEventListener('user-activity-updated', handleGlobalActivityUpdate);
          window.removeEventListener('user-profile-updated', handleGlobalActivityUpdate);
        });

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

  // ✅ FIX: Accurate derived calculations
  const portfolioValue = ownedOpinions.reduce(
    (t, o) => t + o.currentPrice * o.quantity,
    0
  );
  
  // ✅ FIX: More accurate P&L calculation
  // P&L = Current Portfolio Value + Current Balance + Total Earnings - Total Losses - Starting Balance (10000)
  const startingBalance = 10000; // Default starting balance for all users
  const realizedPnL = profile.totalEarnings - profile.totalLosses; // Realized gains/losses from trades
  const unrealizedPnL = ownedOpinions.reduce((total, opinion) => {
    return total + ((opinion.currentPrice - opinion.purchasePrice) * opinion.quantity);
  }, 0); // Unrealized gains/losses from current positions
  const pnl = realizedPnL + unrealizedPnL; // Total P&L
  
  const activeBets = userBets.length; // ✅ FIX: Use actual bet count, not opinion count

  // ✅ FIX: Enhanced data validation and calculations using real data
  if (profile) {
    console.log(`📊 PROFILE DEBUG - IsBot: ${isBot}, Username: "${profile.username}", Balance: ${profile.balance}`);
    console.log(`📊 ${profile.username} Profile Data:`, {
      portfolioValue: portfolioValue.toFixed(2),
      balance: profile.balance.toFixed(2),
      realizedPnL: realizedPnL.toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      totalPnL: pnl.toFixed(2),
      ownedOpinions: ownedOpinions.length,
      userBets: userBets.length,
      userShorts: userShorts.length,
      activeBets: activeBets
    });
  }

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
              <div className="user-avatar" style={{ 
                backgroundColor: isBot ? '#10b981' : undefined 
              }}>
                {isBot ? '🤖' : profile.username[0]}
              </div>
              <div>
                <div className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {profile.username}
                  {isBot && (
                    <span style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      BOT
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🤖 Bots: Active Globally</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  {isBot ? 'Autonomous Trading Bot • ' : ''}Member since {new Date(profile.joinDate).toLocaleDateString()} | Opinion Trader & Collector
                </p>
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
              P&L {/* Total realized + unrealized gains/losses */}
            </h3>
            <p style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0',
              color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </p>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              margin: '4px 0 0 0',
              color: 'var(--text-secondary)',
            }}>
              Realized: {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)} | 
              Unrealized: {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
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
                      {position.title || `Bet on ${position.targetUser || 'Unknown'}` || 'Portfolio Bet'}
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
                      {position.type || position.betType || 'BET'}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}>
                    Placed: {position.placedDate || 'N/A'} | {position.daysHeld || 0} days | {position.multiplier || 'N/A'} multiplier
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
                        Wagered: ${(position.wagered || position.betAmount || 0).toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                      }}>
                        ${(position.currentValue || position.betAmount || 0).toFixed(2)}
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
                        +${(position.potential || position.potentialWinnings || 0).toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--green)',
                      }}>
                        (+{(position.percentage || position.targetPercentage || 0).toFixed(2)}%)
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
                      {position.title || position.opinionText || 'Short Position'}
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
                      {position.type || 'SHORT'}
                    </div>
                  </div>

                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}>
                    Shorted: {position.shortedDate || position.createdDate || 'N/A'} | {position.dropTarget || position.targetDropPercentage || 0}% drop target | {position.progress || 0}% progress
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
                        Entry: ${(position.entry || position.startingPrice || 0).toFixed(2)}
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                      }}>
                        ${(position.currentValue || position.targetPrice || 0).toFixed(2)}
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
                        {position.shares || 'N/A'} shares obligation
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
        
        {/* 🔍 FIRESTORE DATA DIAGNOSTIC */}
        {process.env.NODE_ENV === 'development' && (
          <FirestoreDataDiagnostic />
        )}
        
        {/* 🔍 DEBUG: Display diagnostic information temporarily */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            background: '#f0f0f0',
            padding: '20px',
            margin: '20px 0',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#333'
          }}>
            <h4>🔍 Debug Info (Development Only)</h4>
            <p><strong>URL Username:</strong> {username}</p>
            <p><strong>Profile UID:</strong> {profile?.uid}</p>
            <p><strong>Profile Username:</strong> {profile?.username}</p>
            <p><strong>Is Bot:</strong> {isBot ? 'Yes' : 'No'}</p>
            <p><strong>Portfolio Items:</strong> {ownedOpinions.length}</p>
            <p><strong>User Bets:</strong> {userBets.length}</p>
            <p><strong>User Shorts:</strong> {userShorts.length}</p>
            <p><strong>Recent Activity:</strong> {recentActivity.length}</p>
          </div>
        )}

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
