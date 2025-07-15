// =============================================================================
// Opinion detail page – Firestore‑native
// Rewrites the old localStorage fallback so **only Firestore** is queried.
// =============================================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { realtimeDataService } from '../../lib/realtime-data-service';
import { firebaseDataService } from '../../lib/firebase-data-service';
import { UnifiedMarketDataManager } from '../../lib/unified-system';
import { doc as fsDoc, getDoc, collection, query, where, limit, getDocs, orderBy, setDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// UI components & assets
import Sidebar from '../../components/Sidebar';
import AuthModal from '../../components/AuthModal';
import {
  ArrowLeft,
  PiggyBank,
  ScanSmiley,
  RssSimple,
  Balloon,
  TrendUp,
  TrendDown,
  ChartLineUp,
} from '@phosphor-icons/react';
import styles from './page.module.css';

// Data interfaces
interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create'; quantity?: number; username?: string; userId?: string }[];
  liquidityScore: number;
  dailyVolume: number;
}

interface OpinionDocument {
  text: string;
  author?: string;
  authorId?: string;
  createdAt?: any;
  source?: 'user' | 'bot_generated';
  isBot?: boolean;
}

interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  portfolio?: { [key: string]: number };
}

// Helper utilities
const iso = () => new Date().toISOString();
const ts = (x: any): string => {
  if (!x) return iso();
  if (typeof x === 'string') return x;
  if (typeof x.toDate === 'function') return x.toDate().toISOString();
  if (x instanceof Date) return x.toISOString();
  return iso();
};

// Sanitize opinion text to create valid Firestore field names
const sanitizeFieldName = (text: string): string => {
  // Replace periods and other invalid characters with underscores
  return text.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
};

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
const formatPercent = (change: number, base: number) => {
  const percent = ((change / base) * 100);
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
};

export default function OpinionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  // Client-only gate
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Core state
  const [docData, setDocData] = useState<OpinionDocument | null>(null);
  const [market, setMarket] = useState<OpinionMarketData | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    username: 'Loading…',
    balance: 10000, // Show proper initial balance instead of 0
    joinDate: iso(),
    totalEarnings: 0,
    totalLosses: 0,
    portfolio: {},
  });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTraderHistoryModal, setShowTraderHistoryModal] = useState(false);
  const [isHowBettingWorksExpanded, setIsHowBettingWorksExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [authorUsername, setAuthorUsername] = useState<string>('');
  const [resolvedUsernames, setResolvedUsernames] = useState<{ [userId: string]: string }>({});

  const popMsg = (m: string, ms = 3000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  // Function to resolve username from userId for historical transactions
  const resolveUsername = async (userId: string): Promise<string> => {
    if (!userId) return 'Anonymous Trader';
    
    // Return cached username if available
    if (resolvedUsernames[userId]) {
      return resolvedUsernames[userId];
    }
    
    try {
      const userProfile = await realtimeDataService.getUserProfile(userId);
      const username = userProfile?.username || 'Anonymous Trader';
      
      // Cache the resolved username
      setResolvedUsernames(prev => ({
        ...prev,
        [userId]: username
      }));
      
      return username;
    } catch (error) {
      console.error('Error resolving username for userId:', userId, error);
      return 'Anonymous Trader';
    }
  };

  // Helper function to get display username with fallbacks
  const getDisplayUsername = () => {
    console.log('🔍 Getting display username:', {
      hasUser: !!user,
      userId: user?.uid,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileUsername: profile?.username,
      userDisplayName: user?.displayName
    });

    if (!user) {
      console.log('❌ No user found, using Anonymous');
      return 'Anonymous';
    }

    const displayUsername = profile?.username || user.email?.split('@')[0] || user.displayName || 'Anonymous';
    console.log('✅ Display username resolved to:', displayUsername);
    return displayUsername;
  };

  // Component to display resolved username for historical transactions
  const TraderName = ({ trade }: { trade: any }) => {
    const [displayName, setDisplayName] = useState<string>(trade.username || 'Anonymous Trader');

    useEffect(() => {
      const loadUsername = async () => {
        if (trade.username) {
          setDisplayName(trade.username);
        } else if (trade.userId) {
          const resolvedName = await resolveUsername(trade.userId);
          setDisplayName(resolvedName);
        }
      };

      loadUsername();
    }, [trade.username, trade.userId]);

    return <span>{displayName}</span>;
  };

  // User's position in this opinion
  const userPosition = useMemo(() => {
    if (!docData) return 0;
    const portfolio = (profile as any).portfolio || {};
    const fieldName = sanitizeFieldName(docData.text);
    const position = portfolio[fieldName] || 0;
    
    // Debug logging
    console.log('🔍 User position debug:', {
      opinionText: docData.text,
      sanitizedFieldName: fieldName,
      portfolio: portfolio,
      position: position,
      portfolioKeys: Object.keys(portfolio)
    });
    
    return position;
  }, [profile, docData]);

  // Market trend analysis
  const trendData = useMemo(() => {
    if (!market) return { label: 'Stable', icon: TrendUp, className: 'stable', netDemand: 0 };
    
    const netDemand = market.timesPurchased - market.timesSold;
    if (netDemand > 0) {
      return { label: 'Rising', icon: ChartLineUp, className: 'bullish', netDemand };
    } else if (netDemand < 0) {
      return { label: 'Declining', icon: TrendDown, className: 'bearish', netDemand };
    }
    return { label: 'Stable', icon: TrendUp, className: 'stable', netDemand };
  }, [market]);

  // Price change calculations
  const priceChange = useMemo(() => {
    if (!market) return { absolute: 0, percent: 0 };
    const absolute = market.currentPrice - market.basePrice;
    const percent = (absolute / market.basePrice) * 100;
    return { absolute, percent };
  }, [market]);

  // Data loading
  useEffect(() => {
    if (!ready || typeof id !== 'string') return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch opinion document
        const snap = await getDoc(fsDoc(db, 'opinions', id));
        if (!snap.exists()) {
          popMsg('Opinion not found');
          return;
        }
        const d = snap.data() as OpinionDocument;
        setDocData(d);

        // 1.5. Fetch author username if we have an authorId
        if (d.authorId) {
          try {
            const authorProfile = await realtimeDataService.getUserProfile(d.authorId);
            if (authorProfile && authorProfile.username) {
              setAuthorUsername(authorProfile.username);
            } else {
              // Fallback to email without @domain if no username found
              setAuthorUsername(d.author?.split('@')[0] || 'Anonymous');
            }
          } catch (err) {
            console.error('Error fetching author profile:', err);
            // Gracefully handle authentication or permission errors
            setAuthorUsername(d.author?.split('@')[0] || 'Anonymous');
          }
        } else {
          // Fallback to email without @domain if no authorId
          setAuthorUsername(d.author?.split('@')[0] || 'Anonymous');
        }

        // 2. Fetch or create market data
        const marketQuery = query(
          collection(db, 'market-data'),
          where('opinionText', '==', d.text),
          limit(1)
        );
        const marketSnap = await getDocs(marketQuery);
        
        if (!marketSnap.empty) {
          const mkt = marketSnap.docs[0].data();
          setMarket({
            opinionText: mkt.opinionText || d.text,
            timesPurchased: mkt.timesPurchased || 0,
            timesSold: mkt.timesSold || 0,
            currentPrice: mkt.currentPrice || 10.0,
            basePrice: mkt.basePrice || 10.0,
            lastUpdated: ts(mkt.lastUpdated),
            priceHistory: (mkt.priceHistory || []).map((p: any) => ({
              price: p.price,
              timestamp: ts(p.timestamp),
              action: p.action,
              quantity: p.quantity || 1,
            })),
            liquidityScore: mkt.liquidityScore || 1.0,
            dailyVolume: (mkt.timesPurchased || 0) + (mkt.timesSold || 0),
          });
        } else {
          // Create initial market data
          const initialMarket = {
            opinionText: d.text,
            timesPurchased: 0,
            timesSold: 0,
            currentPrice: 10.0,
            basePrice: 10.0,
            lastUpdated: iso(),
            priceHistory: [{ price: 10.0, timestamp: iso(), action: 'create' as const, quantity: 1 }],
            liquidityScore: 1.0,
            dailyVolume: 0,
          };
          
          const docId = btoa(d.text).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
          await setDoc(doc(db, 'market-data', docId), initialMarket);
          setMarket(initialMarket);
        }

        // 3. Fetch user profile
        if (user?.uid) {
          try {
            const p = await realtimeDataService.getUserProfile(user.uid);
            if (p) {
              // Fix balance if it's too low (existing users might need this)
              const fixedBalance = p.balance < 100 ? 10000 : p.balance;
              if (fixedBalance !== p.balance) {
                await realtimeDataService.updateUserProfile(user.uid, { balance: fixedBalance });
                popMsg('Balance updated to $10,000! 💰');
              }
              
              const portfolio = (p as any).portfolio || {};
              const sanitizedOpinionKey = sanitizeFieldName(d.text);
              const userShares = portfolio[sanitizedOpinionKey] || 0;
              
              console.log('📊 Portfolio data loaded:', {
                opinionText: d.text,
                sanitizedKey: sanitizedOpinionKey,
                userShares: userShares,
                fullPortfolio: portfolio,
                portfolioKeys: Object.keys(portfolio)
              });
              
              setProfile({
                username: p.username,
                balance: fixedBalance,
                joinDate: ts(p.joinDate),
                totalEarnings: p.totalEarnings || 0,
                totalLosses: p.totalLosses || 0,
                portfolio: portfolio,
              });
            } else {
              // Create new user profile with correct balance
              const newProfile = {
                uid: user.uid,
                username: user.email?.split('@')[0] || 'User',
                balance: 10000,
                totalEarnings: 0,
                totalLosses: 0,
                joinDate: new Date(),
              };
              await firebaseDataService.createUserProfile(user.uid, newProfile);
              setProfile({
                username: newProfile.username,
                balance: 10000,
                joinDate: iso(),
                totalEarnings: 0,
                totalLosses: 0,
                portfolio: {},
              });
              popMsg('Welcome! You start with $10,000! 🎉');
            }
          } catch (err) {
            console.error('Error loading user profile:', err);
            // Set default profile if there's an error
            setProfile({
              username: user.email?.split('@')[0] || 'User',
              balance: 10000,
              joinDate: iso(),
              totalEarnings: 0,
              totalLosses: 0,
              portfolio: {},
            });
          }
        }

      } catch (err) {
        console.error('Error loading data:', err);
        popMsg('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    console.log('📥 Loading data for opinion:', id, 'User:', user?.uid || 'none', 'Ready:', ready);
    console.log('🔐 Current auth state:', {
      hasUser: !!user,
      userId: user?.uid,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileUsername: profile?.username
    });
    
    loadData();
  }, [id, ready, user?.uid]);

  // Automatic portfolio refresh system
  useEffect(() => {
    if (!user?.uid || !docData) return;

    const refreshUserData = async () => {
      try {
        const p = await realtimeDataService.getUserProfile(user.uid);
        if (p) {
          const portfolio = (p as any).portfolio || {};
          const sanitizedOpinionKey = sanitizeFieldName(docData.text);
          const userShares = portfolio[sanitizedOpinionKey] || 0;
          
          console.log('🔄 Auto-refreshing portfolio data:', {
            opinionText: docData.text,
            sanitizedKey: sanitizedOpinionKey,
            userShares: userShares,
            previousPosition: userPosition,
            portfolioKeys: Object.keys(portfolio)
          });
          
          setProfile(prev => ({
            ...prev,
            balance: p.balance,
            portfolio: portfolio,
          }));
        }
      } catch (err) {
        console.error('Error auto-refreshing portfolio:', err);
      }
    };

    // Refresh immediately when dependencies change
    refreshUserData();

    // Set up periodic refresh every 5 seconds to ensure data is always current
    const intervalId = setInterval(refreshUserData, 5000);

    // Also refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page became visible, refreshing portfolio...');
        refreshUserData();
      }
    };

    // Refresh when window gains focus
    const handleFocus = () => {
      console.log('🎯 Window focused, refreshing portfolio...');
      refreshUserData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, docData?.text]);

  // Chart data processing
  const chartData = useMemo(() => {
    if (!market) return null;
    
    const history = market.priceHistory.length > 0 ? 
      market.priceHistory : 
      [{ price: market.basePrice, timestamp: market.lastUpdated, action: 'create' as const }];
    
    // Filter out any invalid prices
    const validHistory = history.filter(h => h.price && !isNaN(h.price) && h.price > 0);
    
    if (validHistory.length === 0) {
      // Fallback if no valid price data
      return {
        history: [{ price: 10.0, timestamp: iso(), action: 'create' as const }],
        minPrice: 10.0,
        maxPrice: 10.0,
        range: 1.0
      };
    }
    
    const prices = validHistory.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    
    // Ensure we have a minimum range for single-point charts
    const safeRange = range > 0 ? range : Math.max(minPrice * 0.1, 1.0);
    
    return { 
      history: validHistory, 
      minPrice, 
      maxPrice, 
      range: safeRange 
    };
  }, [market]);

  // Helper function to safely calculate SVG coordinates
  const getChartCoordinates = (index: number, price: number, totalPoints: number) => {
    const x = totalPoints > 1 ? (index / (totalPoints - 1)) * 700 + 80 : 430; // Center single point with more left padding
    const y = chartData ? 250 - ((price - chartData.minPrice) / chartData.range) * 200 : 150;
    return {
      x: isNaN(x) ? 430 : Math.max(80, Math.min(780, x)), // Clamp to valid range with more padding
      y: isNaN(y) ? 150 : Math.max(50, Math.min(250, y))  // Clamp to valid range with more padding
    };
  };

  // Simple buy function - increases price by 0.1%
  const executeBuy = async () => {
    if (!user?.uid || !docData || !market || loading) return;
    
    try {
      setLoading(true);
      
      // Check if user has enough balance
      const cost = market.currentPrice;
      if (cost > profile.balance) {
        popMsg(`Insufficient balance! Need ${formatCurrency(cost)}, have ${formatCurrency(profile.balance)}`);
        return;
      }
      
      // Anti-arbitrage check: Max 4 shares per 10 minutes per opinion
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      
      // Query recent transactions for this user and opinion
      const recentTransactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('opinionText', '==', docData.text),
        where('type', '==', 'buy'),
        where('timestamp', '>=', tenMinutesAgo),
        orderBy('timestamp', 'desc')
      );
      
      const recentTransactionsSnap = await getDocs(recentTransactionsQuery);
      const recentBuys = recentTransactionsSnap.docs.length;
      
      console.log('🔍 Opinion Detail Anti-arbitrage check:', {
        recentBuys,
        userPosition,
        canBuy: recentBuys < 4,
        opinionText: docData.text
      });
      
      if (recentBuys >= 4) {
        const earliestBuy = recentTransactionsSnap.docs[recentTransactionsSnap.docs.length - 1];
        const nextAllowedTime = new Date(earliestBuy.data().timestamp.toDate().getTime() + 10 * 60 * 1000);
        const minutesLeft = Math.ceil((nextAllowedTime.getTime() - now.getTime()) / (60 * 1000));
        
        popMsg(`🚫 Anti-arbitrage limit: You've bought 4 shares in the last 10 minutes. Wait ${minutesLeft} minutes before buying again. (You still own ${userPosition} shares)`);
        return;
      }
      
      // Calculate new price (0.1% increase)
      const newPrice = market.currentPrice * 1.001;
      
      console.log('🔄 Executing buy:', {
        currentPrice: market.currentPrice,
        newPrice,
        cost,
        balance: profile.balance,
        userPosition: userPosition,
        recentBuys: recentBuys
      });
      
      // Update market data
      const docId = btoa(docData.text).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      const updatedMarket = {
        ...market,
        timesPurchased: market.timesPurchased + 1,
        currentPrice: newPrice,
        lastUpdated: iso(),
        priceHistory: [
          ...market.priceHistory.slice(-19), // Keep last 20 points
          { 
            price: newPrice, 
            timestamp: iso(), 
            action: 'buy' as const, 
            quantity: 1,
            username: getDisplayUsername(),
            userId: user.uid
          }
        ],
        dailyVolume: market.dailyVolume + 1,
      };
      
      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      const transaction = {
        id: transactionId,
        type: 'buy',
        userId: user.uid,
        username: getDisplayUsername(),
        amount: cost,
        opinionText: docData.text,
        opinionId: id,
        timestamp: serverTimestamp(),
        metadata: {
          oldPrice: market.currentPrice,
          newPrice: newPrice,
          source: 'opinion-page'
        }
      };
      
      // Use batch write for consistency
      const batch = writeBatch(db);
      
      // Update market data
      batch.set(doc(db, 'market-data', docId), updatedMarket);
      
      // Save transaction
      batch.set(doc(db, 'transactions', transactionId), transaction);
      
      // Update user profile
      batch.update(doc(db, 'users', user.uid), {
        balance: profile.balance - cost,
        [`portfolio.${sanitizeFieldName(docData.text)}`]: (userPosition + 1),
        updatedAt: serverTimestamp()
      });
      
      console.log('💾 Committing portfolio update:', {
        userId: user.uid,
        opinionText: docData.text,
        sanitizedFieldName: sanitizeFieldName(docData.text),
        oldPosition: userPosition,
        newPosition: userPosition + 1,
        portfolioUpdate: {
          [`portfolio.${sanitizeFieldName(docData.text)}`]: (userPosition + 1)
        }
      });

      // Commit all changes
      await batch.commit();
      console.log('✅ Batch committed successfully');
      
      // Update local state
      setMarket(updatedMarket);
      const newPortfolio = {
        ...((profile as any).portfolio || {}),
        [sanitizeFieldName(docData.text)]: userPosition + 1
      };
      
      setProfile(prev => ({
        ...prev,
        balance: prev.balance - cost,
        portfolio: newPortfolio
      } as any));
      
      console.log('🔄 Local state updated:', {
        newPortfolio,
        newPosition: userPosition + 1,
        totalShares: newPortfolio[sanitizeFieldName(docData.text)]
      });
      
      // Force refresh portfolio from database after successful purchase
      setTimeout(async () => {
        try {
          const freshProfile = await realtimeDataService.getUserProfile(user.uid);
          if (freshProfile) {
            console.log('🔄 Refreshed portfolio from database:', freshProfile.portfolio);
            setProfile(prev => ({
              ...prev,
              portfolio: freshProfile.portfolio || {}
            } as any));
          }
        } catch (err) {
          console.error('Error refreshing portfolio:', err);
        }
      }, 1000); // Wait 1 second to ensure database write is complete
      
      popMsg(`✅ Share purchased for ${formatCurrency(cost)}! New price: ${formatCurrency(newPrice)} (+0.1%) | ${4 - recentBuys - 1} more allowed in 10min`);
      
    } catch (err) {
      console.error('❌ Buy error:', err);
      popMsg('❌ Error purchasing share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Sell function (existing logic)
  const executeSell = async () => {
    if (!user?.uid || !docData || !market || userPosition === 0 || loading) return;
    
    try {
      setLoading(true);
      
      // IMPORTANT: Sell function is completely independent of buy restrictions
      // Users can always sell shares they own, regardless of arbitrage prevention
      console.log('🔄 Executing sell (independent of buy restrictions):', {
        userPosition,
        currentPrice: market.currentPrice,
        userCanSell: userPosition > 0,
        opinionText: docData.text
      });
      
      // Calculate sell price with 5% spread
      const sellPrice = market.currentPrice * 0.95;
      const newPrice = market.currentPrice * 0.999; // Slight price decrease on sell
      
      console.log('🔄 Executing sell:', {
        currentPrice: market.currentPrice,
        sellPrice,
        newPrice,
        userPosition: userPosition,
        balance: profile.balance
      });
      
      // Update market data
      const docId = btoa(docData.text).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      const updatedMarket = {
        ...market,
        timesSold: market.timesSold + 1,
        currentPrice: newPrice,
        lastUpdated: iso(),
        priceHistory: [
          ...market.priceHistory.slice(-19), // Keep last 20 points
          { 
            price: newPrice, 
            timestamp: iso(), 
            action: 'sell' as const, 
            quantity: 1,
            username: getDisplayUsername(),
            userId: user.uid
          }
        ],
        dailyVolume: market.dailyVolume + 1,
      };
      
      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const transaction = {
        id: transactionId,
        type: 'sell',
        userId: user.uid,
        username: getDisplayUsername(),
        amount: sellPrice,
        opinionText: docData.text,
        opinionId: id,
        timestamp: serverTimestamp(),
        metadata: {
          oldPrice: market.currentPrice,
          newPrice: newPrice,
          source: 'opinion-page'
        }
      };
      
      // Use batch write for consistency
      const batch = writeBatch(db);
      
      // Update market data
      batch.set(doc(db, 'market-data', docId), updatedMarket);
      
      // Save transaction
      batch.set(doc(db, 'transactions', transactionId), transaction);
      
      // Update user profile
      batch.update(doc(db, 'users', user.uid), {
        balance: profile.balance + sellPrice,
        [`portfolio.${sanitizeFieldName(docData.text)}`]: (userPosition - 1),
        updatedAt: serverTimestamp()
      });
      
      console.log('💾 Committing sell portfolio update:', {
        userId: user.uid,
        opinionText: docData.text,
        sanitizedFieldName: sanitizeFieldName(docData.text),
        oldPosition: userPosition,
        newPosition: userPosition - 1,
        portfolioUpdate: {
          [`portfolio.${sanitizeFieldName(docData.text)}`]: (userPosition - 1)
        }
      });

      // Commit all changes
      await batch.commit();
      console.log('✅ Sell batch committed successfully');
      
      // Update local state
      setMarket(updatedMarket);
      const newPortfolio = {
        ...((profile as any).portfolio || {}),
        [sanitizeFieldName(docData.text)]: userPosition - 1
      };
      
      setProfile(prev => ({
        ...prev,
        balance: prev.balance + sellPrice,
        portfolio: newPortfolio
      } as any));
      
      console.log('🔄 Sell local state updated:', {
        newPortfolio,
        newPosition: userPosition - 1,
        totalShares: newPortfolio[sanitizeFieldName(docData.text)]
      });
      
      // Force refresh portfolio from database after successful sale
      setTimeout(async () => {
        try {
          const freshProfile = await realtimeDataService.getUserProfile(user.uid);
          if (freshProfile) {
            console.log('🔄 Post-sell refreshed portfolio from database:', freshProfile.portfolio);
            setProfile(prev => ({
              ...prev,
              portfolio: freshProfile.portfolio || {}
            } as any));
          }
        } catch (err) {
          console.error('Error refreshing portfolio after sell:', err);
        }
      }, 1000); // Wait 1 second to ensure database write is complete
      
      popMsg(`✅ Share sold for ${formatCurrency(sellPrice)}! New price: ${formatCurrency(newPrice)} (-0.1%)`);
      
    } catch (err) {
      console.error('❌ Sell error:', err);
      popMsg('❌ Error selling share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Authentication-aware trading action handlers
  const handleBuy = () => {
    console.log('🛒 Buy button clicked:', {
      hasUser: !!user,
      userId: user?.uid,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileUsername: profile?.username,
      timestamp: new Date().toISOString()
    });

    if (!user) {
      console.log('❌ No user for buy, showing auth modal');
      setShowAuthModal(true);
      return;
    }
    executeBuy();
  };

  const handleSell = () => {
    console.log('🔄 Sell button clicked:', {
      user: !!user,
      userPosition: userPosition,
      loading: loading,
      canSell: userPosition > 0,
      portfolio: (profile as any).portfolio,
      opinionText: docData?.text,
      sanitizedFieldName: docData ? sanitizeFieldName(docData.text) : 'unknown'
    });
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (userPosition === 0) {
      popMsg(`❌ No shares to sell. You currently own ${userPosition} shares of this opinion.`);
      return;
    }
    
    executeSell();
  };



  const handleShort = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    // Short functionality would be implemented here
    popMsg('Short functionality coming soon!');
  };

  // Render guards
  if (!ready) return <div>Loading…</div>;

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content" style={{ paddingTop: '80px' }}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.leftActions}>
            <a href="/profile" className="nav-button portfolio">
              <ArrowLeft size={24} /> Back to Portfolio
            </a>
          </div>

          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders"><ScanSmiley size={24} /> Traders</a>
            <a href="/feed" className="nav-button feed"><RssSimple size={24} /> Feed</a>
            <a href="/generate" className="nav-button generate"><Balloon size={24} /> Generate</a>
            <div className={styles.walletDisplay}>
              <PiggyBank size={28} weight="fill" /> {!user ? 'Sign in to trade' : formatCurrency(profile.balance)}
            </div>
          </div>
        </div>

        {/* Opinion Text */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionText}>
            <p>{docData?.text}</p>
          </div>
          
          {docData && (
            <div className={styles.attributionLine}>
              <span>{authorUsername || 'Anonymous'}</span>
              <span>{new Date(ts(docData.createdAt)).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Price Summary */}
        {market && (
          <div className={styles.priceSummary}>
            <div className={styles.priceItem}>
              <div className={styles.priceLabel}>Starting Price</div>
              <div className={styles.priceValue}>{formatCurrency(market.basePrice)}</div>
            </div>
            <div className={styles.priceDivider}></div>
            <div className={styles.priceItem}>
              <div className={styles.priceLabel}>Current Price</div>
              <div className={styles.priceValue}>{formatCurrency(market.currentPrice)}</div>
            </div>
            <div className={styles.priceDivider}></div>
            <div className={styles.priceItem}>
              <div className={styles.priceLabel}>Total Change</div>
              <div className={`${styles.priceValue} ${priceChange.absolute >= 0 ? styles.positive : styles.negative}`}>
                {priceChange.absolute >= 0 ? '+' : ''}{formatCurrency(priceChange.absolute)} ({formatPercent(priceChange.absolute, market.basePrice)})
              </div>
            </div>
            <div className={styles.priceDivider}></div>
            <div className={styles.priceItem}>
              <div className={styles.priceLabel}>Data Points</div>
              <div className={styles.priceValue}>{chartData?.history?.length || 0}</div>
            </div>
          </div>
        )}

        {/* Price Chart */}
        {chartData && chartData.history && chartData.history.length > 0 && (
          <div className={styles.chartContainer}>
            <div className={styles.chartVisual}>
              <svg className={styles.chartSvg} viewBox="0 0 900 320" width="900" height="320">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#333" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect x="80" y="50" width="700" height="200" fill="url(#grid)" />
                
                {/* Price line */}
                {chartData.history.length > 1 && (
                  <path
                    className={styles.priceLine}
                    d={chartData.history.map((point, i) => {
                      const coords = getChartCoordinates(i, point.price, chartData.history.length);
                      return `${i === 0 ? 'M' : 'L'} ${coords.x} ${coords.y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                  />
                )}
                
                {/* Data points */}
                {chartData.history.map((point, i) => {
                  const coords = getChartCoordinates(i, point.price, chartData.history.length);
                  return (
                    <g key={i}>
                      <circle
                        className={styles.dataPoint}
                        cx={coords.x}
                        cy={coords.y}
                        r={hoveredPoint === i ? "7" : "5"}
                        fill={point.action === 'buy' ? "#22c55e" : point.action === 'sell' ? "#ef4444" : "#64748b"}
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      {hoveredPoint === i && (
                        <g>
                          {(() => {
                            const tooltipWidth = 140;
                            const tooltipHeight = 50;
                            const tooltipX = coords.x < 150 ? coords.x + 10 : coords.x > 730 ? coords.x - 150 : coords.x - 70;
                            const tooltipY = coords.y < 80 ? coords.y + 10 : coords.y - 60;
                            const textX = coords.x < 150 ? coords.x + 80 : coords.x > 730 ? coords.x - 80 : coords.x;
                            const textY = coords.y < 80 ? coords.y + 38 : coords.y - 32;
                            
                            return (
                              <>
                                <rect
                                  x={tooltipX}
                                  y={tooltipY}
                                  width={tooltipWidth}
                                  height={tooltipHeight}
                                  fill="rgba(0, 0, 0, 0.95)"
                                  stroke="#22c55e"
                                  strokeWidth="1"
                                  rx="6"
                                  filter="drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))"
                                />
                                <text
                                  x={textX}
                                  y={textY - 8}
                                  textAnchor="middle"
                                  fill="#ffffff"
                                  fontSize="12"
                                  fontWeight="600"
                                  fontFamily="system-ui, -apple-system, sans-serif"
                                >
                                  {(point.username || 'Anonymous').length > 12 ? 
                                    (point.username || 'Anonymous').substring(0, 12) + '...' : 
                                    (point.username || 'Anonymous')}
                                </text>
                                <text
                                  x={textX}
                                  y={textY + 6}
                                  textAnchor="middle"
                                  fill="#22c55e"
                                  fontSize="11"
                                  fontWeight="500"
                                  fontFamily="system-ui, -apple-system, sans-serif"
                                >
                                  {formatCurrency(point.price)}
                                </text>
                                <text
                                  x={textX}
                                  y={textY + 18}
                                  textAnchor="middle"
                                  fill="#a1a1aa"
                                  fontSize="9"
                                  fontFamily="system-ui, -apple-system, sans-serif"
                                >
                                  {point.action.toUpperCase()} • {new Date(point.timestamp).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </text>
                              </>
                            );
                          })()}
                        </g>
                      )}
                    </g>
                  );
                })}
                
                {/* Y-axis labels */}
                <text x="15" y="60" className={styles.axisLabel} textAnchor="start">
                  {formatCurrency(chartData.maxPrice)}
                </text>
                <text x="15" y="245" className={styles.axisLabel} textAnchor="start">
                  {formatCurrency(chartData.minPrice)}
                </text>
                
                {/* Current price line */}
                {market && (
                  <>
                    <line
                      x1="80"
                      y1={getChartCoordinates(0, market.currentPrice, 1).y}
                      x2="780"
                      y2={getChartCoordinates(0, market.currentPrice, 1).y}
                      stroke="#fbbf24"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                    <text 
                      x="790" 
                      y={getChartCoordinates(0, market.currentPrice, 1).y + 5} 
                      className={styles.currentPriceLabel}
                      textAnchor="start"
                    >
                      {formatCurrency(market.currentPrice)}
                    </text>
                  </>
                )}
              </svg>
            </div>
            
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{backgroundColor: '#22c55e'}}></div>
                <span>● Buy Orders</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{backgroundColor: '#ef4444'}}></div>
                <span>● Sell Orders</span>
              </div>
              <div className={styles.legendText}>
                • Hover over data points to see trader info, price, and date
              </div>
            </div>
          </div>
        )}

        {/* Trading Actions */}
        <div className={styles.tradingActions}>
          <button 
            className={`${styles.tradingButton} ${styles.buyButton}`}
            onClick={handleBuy}
            disabled={loading}
          >
            {loading ? 'Processing...' : `Buy (${formatCurrency(market?.currentPrice || 0)})`}
          </button>
          
          <button 
            className={`${styles.tradingButton} ${styles.sellButton}`}
            onClick={handleSell}
            disabled={loading || (!user ? false : userPosition === 0)}
          >
            {userPosition > 0 ? `Sell 1 for ${formatCurrency((market?.currentPrice || 0) * 0.95)}` : `No shares owned`}
          </button>
          
          <button 
            className={`${styles.tradingButton} ${styles.shortButton}`}
            onClick={handleShort}
            disabled={!user ? false : userPosition > 0}
          >
            {userPosition > 0 ? "Own Shares (Can't Short)" : "Short Position"}
          </button>
        </div>



        {/* Market Statistics Grid */}
        {market && (
          <div className={styles.marketStatsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Current Price</div>
              <div className={styles.statValue}>{formatCurrency(market.currentPrice)}</div>
              <div className={styles.statSubtext}>Base price: {formatCurrency(market.basePrice)}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Market Trend</div>
              <div className={`${styles.statValue} ${styles.trendValue}`}>
                {trendData?.icon && <trendData.icon size={20} />} {trendData?.label || 'Stable'}
              </div>
              <div className={styles.statSubtext}>Net demand: {trendData?.netDemand || 0}</div>
            </div>

            <div className={`${styles.statCard} ${styles.clickable}`} onClick={() => setShowTraderHistoryModal(true)}>
              <div className={styles.statTitle}>Trading Volume</div>
              <div className={styles.statValue}>{market.timesPurchased || 0} buys</div>
              <div className={styles.statSubtext}>{market.timesSold || 0} sells</div>
              <div className={styles.statSubtext}>Click to view trader history</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Sell Price</div>
              <div className={styles.statValue}>{formatCurrency(market.currentPrice * 0.95)}</div>
              <div className={styles.statSubtext}>
                Purchase: {formatCurrency(market.basePrice)} | Market: {formatCurrency(market.currentPrice)} | Sell: {formatCurrency(market.currentPrice * 0.95)}
              </div>
              <div className={styles.statLoss}>
                Loss: {formatCurrency(market.currentPrice * 0.05)} (5% transaction cost + small market moves)
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {msg && (
          <div className={styles.statusMessage}>
            {msg}
          </div>
        )}

        {/* How Betting Works Section */}
        <div className={styles.howBettingWorksSection}>
          <div 
            className={styles.howBettingWorksHeader} 
            onClick={() => setIsHowBettingWorksExpanded(!isHowBettingWorksExpanded)}
          >
            <h3>How Betting Works</h3>
            <span className={`${styles.expandIcon} ${isHowBettingWorksExpanded ? styles.expanded : ''}`}>
              ▼
            </span>
          </div>
          
          {isHowBettingWorksExpanded && (
            <div className={styles.howBettingWorksContent}>
              <div className={styles.bettingExplanationGrid}>
                <div className={styles.bettingMethod}>
                  <h4 className={styles.buyingTitle}>Buying</h4>
                  <p>
                    When you <strong>buy</strong> an opinion, you're betting that it will become more popular and valuable over time. 
                    Each purchase increases the opinion's price by exactly <strong>0.1%</strong>, creating compound growth as demand builds.
                  </p>
                  <ul>
                    <li><strong>Price Impact:</strong> Each buy = +0.1% price increase</li>
                    <li><strong>Trading Limit:</strong> Max 4 shares per 10 minutes per opinion (anti-arbitrage)</li>
                    <li><strong>Profit Mechanism:</strong> Sell later when price is higher than your purchase price</li>
                    <li><strong>Balance Required:</strong> Must have sufficient funds to cover full purchase price</li>
                  </ul>
                </div>

                <div className={styles.bettingMethod}>
                  <h4 className={styles.sellingTitle}>Selling</h4>
                  <p>
                    <strong>Selling</strong> allows you to cash out your position. You receive <strong>95% of current market price</strong> 
                    (5% transaction spread). Each sell decreases the opinion's price by <strong>0.1%</strong>.
                  </p>
                  <ul>
                    <li><strong>Payout:</strong> 95% of current price (5% transaction cost)</li>
                    <li><strong>Price Impact:</strong> Each sell = -0.1% price decrease</li>
                    <li><strong>Requirement:</strong> Must own at least 1 share to sell</li>
                    <li><strong>Instant:</strong> No waiting period or restrictions</li>
                  </ul>
                </div>

                <div className={styles.bettingMethod}>
                  <h4 className={styles.shortingTitle}>Shorting</h4>
                  <p>
                    <strong>Shorting</strong> lets you bet against an opinion's popularity. You can only short opinions 
                    you <strong>don't own</strong> - this prevents conflicts of interest and market manipulation.
                  </p>
                  <ul>
                    <li><strong>Restriction:</strong> Cannot short opinions you own shares in</li>
                    <li><strong>Profit:</strong> When opinion price falls below your short entry point</li>
                    <li><strong>Risk:</strong> Unlimited loss potential if price keeps rising</li>
                    <li><strong>Collateral:</strong> Requires deposit to cover potential losses</li>
                  </ul>
                </div>
              </div>

              <div className={styles.detailedMechanics}>
                <h4>Detailed Price Mechanics</h4>
                <div className={styles.mechanicsGrid}>
                  <div className={styles.mechanicsItem}>
                    <h5>Price Formula</h5>
                    <p>Base Price × (1.001)^(Net Demand)</p>
                    <p><small>Net Demand = Total Buys - Total Sells</small></p>
                  </div>
                  <div className={styles.mechanicsItem}>
                    <h5>Price Floors</h5>
                    <p>Minimum price: 50% of base price</p>
                    <p><small>Most opinions start at $10, minimum $5</small></p>
                  </div>
                  <div className={styles.mechanicsItem}>
                    <h5>Compound Growth</h5>
                    <p>Each trade builds on previous price</p>
                    <p><small>10 buys = 1.001^10 = +1.0% total increase</small></p>
                  </div>
                </div>
              </div>

              <div className={styles.importantNote}>
                <h4>Trading Rules & Limits</h4>
                <ul>
                  <li><strong>Anti-Arbitrage:</strong> Maximum 4 purchases per 10 minutes per opinion</li>
                  <li><strong>Selling Spread:</strong> 5% transaction cost protects against market manipulation</li>
                  <li><strong>Shorting Conflicts:</strong> Cannot short opinions you own (prevents self-manipulation)</li>
                  <li><strong>Balance Checks:</strong> All trades require sufficient funds upfront</li>
                  <li><strong>Price Discovery:</strong> All prices determined by actual supply and demand</li>
                  <li><strong>No Hidden Fees:</strong> Only cost is the 5% selling spread (clearly displayed)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />

      {/* Trader History Modal */}
      {showTraderHistoryModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTraderHistoryModal(false)}>
          <div className={styles.traderHistoryModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Trading History</h3>
              <button className={styles.closeButton} onClick={() => setShowTraderHistoryModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.historyExplanation}>
                Complete trading history for this opinion, showing all buy and sell transactions with trader details and timestamps.
              </div>
              <div className={styles.historyList}>
                {market?.priceHistory && Array.isArray(market.priceHistory) && market.priceHistory.length > 0 ? (
                  market.priceHistory
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((trade, index) => (
                      <div key={index} className={styles.tradeItem}>
                        <div className={styles.tradeHeader}>
                          <div className={styles.traderInfo}>
                            <div className={`${styles.traderName} ${styles.humanTrader}`}>
                              {trade.action === 'create' ? 'Market Created' : <TraderName trade={trade} />}
                            </div>
                            <div className={styles.tradeDate}>
                              {new Date(trade.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className={`${styles.tradeAction} ${styles[trade.action] || styles.buy}`}>
                            {trade.action === 'create' ? 'Created' : trade.action}
                          </div>
                        </div>
                        <div className={styles.tradeDetails}>
                          <div className={styles.tradeDetailItem}>
                            <span>Price</span>
                            <span className={styles.tradePrice}>{formatCurrency(trade.price)}</span>
                          </div>
                          <div className={styles.tradeDetailItem}>
                            <span>Quantity</span>
                            <span>{trade.quantity || 1}</span>
                          </div>
                          <div className={styles.tradeDetailItem}>
                            <span>Total</span>
                            <span className={styles.tradeTotal}>{formatCurrency(trade.price * (trade.quantity || 1))}</span>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className={styles.noHistory}>
                    <div>Charts</div>
                    <h4>No Trading History</h4>
                    <p>This opinion hasn't been traded yet.</p>
                  </div>
                )}
              </div>
              {market?.priceHistory && Array.isArray(market.priceHistory) && market.priceHistory.length > 0 && (
                <div className={styles.historyStats}>
                  <div className={styles.statItem}>
                    <span>Total Trades</span>
                    <span>{market.priceHistory.filter(t => t.action !== 'create').length}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>Total Buys</span>
                    <span>{market.timesPurchased || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>Total Sells</span>
                    <span>{market.timesSold || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
