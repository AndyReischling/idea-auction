'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth-context';
import { doc, getDoc, collection, query, where, getDocs, orderBy, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './lib/firebase';
import { calculateMultiplier, calculatePayout } from './lib/multiplier-utils';
import { 
  X, 
  ShoppingCart, 
  TrendDown, 
  User, 
  Clock, 
  CurrencyDollar,
  Plus,
  Minus,
  Target,
  Warning,
  HandPeace,
  DiceSix,
  ChartLineDown
} from '@phosphor-icons/react';

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

interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  portfolio?: { [key: string]: number };
}

interface ActivityDetailModalProps {
  activity: any;
  onClose: () => void;
  currentUser: any;
  onUpdateUser: (user: any) => void;
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
const iso = () => new Date().toISOString();

export default function ActivityDetailModal({ 
  activity, 
  onClose, 
  currentUser, 
  onUpdateUser 
}: ActivityDetailModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<OpinionMarketData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [msg, setMsg] = useState('');
  const [sellQuantity, setSellQuantity] = useState(1);
  const [betAmount, setBetAmount] = useState(100);
  const [targetDrop, setTargetDrop] = useState(25);
  const [timeLimit, setTimeLimit] = useState(24);
  const [userPosition, setUserPosition] = useState(0);
  const [shortPositions, setShortPositions] = useState<any[]>([]);
  const [buyLimitReached, setBuyLimitReached] = useState(false);
  const [buyLimitMessage, setBuyLimitMessage] = useState('');
  
  // Bet-specific state
  const [portfolioBetAmount, setPortfolioBetAmount] = useState(100);
  const [portfolioTargetChange, setPortfolioTargetChange] = useState(10);
  const [portfolioBetDirection, setPortfolioBetDirection] = useState<'increase' | 'decrease'>('increase');
  const [portfolioTimeLimit, setPortfolioTimeLimit] = useState(168); // 7 days in hours
  
  // Target user profile data
  const [targetUserProfile, setTargetUserProfile] = useState<any>(null);

  // Dynamic styling functions
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'generate': return '#3b82f6';
      case 'sell': return '#dc2626';
      case 'buy': return '#16a34a';
      case 'bet': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getActivityIcon = (type: string) => {
    if (type === 'buy') return <CurrencyDollar color="white" size={20} />;
    if (type === 'sell') return <HandPeace color="white" size={20} />;
    if (type === 'bet') return <DiceSix color="white" size={20} />;
    if (type === 'short') return <ChartLineDown color="white" size={20} />;
    return <Plus color="white" size={20} />;
  };

  const getActivityTitle = (type: string) => {
    switch (type) {
      case 'buy': return 'Buy Activity';
      case 'sell': return 'Sell Activity';
      case 'bet': return 'Bet Activity';
      case 'short': return 'Short Activity';
      case 'generate': return 'Generate Activity';
      default: return 'Activity Details';
    }
  };

  // Reset sell quantity when user position changes
  useEffect(() => {
    setSellQuantity(Math.min(sellQuantity, userPosition));
  }, [userPosition]);

  // Check buy limit when user or activity changes (not when market data changes)
  useEffect(() => {
    checkBuyLimit();
  }, [user, activity]);

  // Load market data and user profile
  useEffect(() => {
    const loadData = async () => {
      if (!activity?.opinionText) return;

      try {
        // Load market data
        const marketDocId = btoa(activity.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
        const marketDoc = await getDoc(doc(db, 'market-data', marketDocId));
        
        if (marketDoc.exists()) {
          setMarketData(marketDoc.data() as OpinionMarketData);
        }

        // Load user profile
        if (user?.uid) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            
            // Calculate user position
            const portfolio = profile.portfolio || {};
            const position = portfolio[activity.opinionText] || 0;
            setUserPosition(position);
          }
          
          // Load user's short positions for this opinion
          const shortQuery = query(
            collection(db, 'short-positions'),
            where('userId', '==', user.uid),
            where('opinionText', '==', activity.opinionText),
            where('status', '==', 'active')
          );
          
          const shortSnap = await getDocs(shortQuery);
          const positions = shortSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  setShortPositions(positions);
      }
      
      // Load target user profile for bet activities
      if (activity.type === 'bet' && activity.username) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('username', '==', activity.username));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            // Calculate portfolio metrics
            const portfolio = userData.portfolio || {};
            const portfolioValue = Object.values(portfolio).reduce((total: number, shares: any) => total + (shares * 10), 0); // Simplified calculation
            const totalEarnings = userData.totalEarnings || 0;
            const totalLosses = userData.totalLosses || 0;
            const pnlPercent = portfolioValue > 0 ? ((totalEarnings - totalLosses) / portfolioValue) * 100 : 0;
            
            // Get top 3 opinions
            const portfolioEntries = Object.entries(portfolio);
            const topOpinions = portfolioEntries
              .sort(([,a]: any, [,b]: any) => b - a)
              .slice(0, 3)
              .map(([opinionKey, shares]) => ({ opinion: opinionKey.slice(0, 30) + '...', shares }));
            
            setTargetUserProfile({
              ...userData,
              portfolioValue,
              pnlPercent,
              exposure: portfolioValue + (userData.balance || 0),
              volatility: Math.random() > 0.5 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low', // Simplified
              topOpinions
            });
          } else {
            // If user not found, create minimal profile data to still show metrics
            setTargetUserProfile({
              username: activity.username,
              balance: 0,
              portfolioValue: 0,
              pnlPercent: 0,
              exposure: 0,
              volatility: 'Low',
              topOpinions: []
            });
          }
        } catch (error) {
          console.error('Error loading target user profile:', error);
          // Set minimal profile data even on error so metrics section still shows
          setTargetUserProfile({
            username: activity.username,
            balance: 0,
            portfolioValue: 0,
            pnlPercent: 0,
            exposure: 0,
            volatility: 'Low',
            topOpinions: []
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  loadData();
  }, [activity, user]);

  const popMsg = (m: string, ms = 3000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  // Check if user has reached buy limit
  // NOTE: This limit is ONLY for BUY transactions and is NOT affected by sell operations
  const checkBuyLimit = async () => {
    if (!user?.uid || !activity?.opinionText) {
      setBuyLimitReached(false);
      setBuyLimitMessage('');
      return;
    }

    try {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      
      // Only check BUY transactions - sell operations do not affect buy limits
      const recentTransactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('opinionText', '==', activity.opinionText),
        where('type', '==', 'buy'), // Only BUY transactions count toward limit
        where('timestamp', '>=', tenMinutesAgo),
        orderBy('timestamp', 'desc')
      );
      
      const recentTransactionsSnap = await getDocs(recentTransactionsQuery);
      const recentBuys = recentTransactionsSnap.docs.length;
      
      if (recentBuys >= 4) {
        const earliestBuy = recentTransactionsSnap.docs[recentTransactionsSnap.docs.length - 1];
        const nextAllowedTime = new Date(earliestBuy.data().timestamp.toDate().getTime() + 10 * 60 * 1000);
        const minutesLeft = Math.ceil((nextAllowedTime.getTime() - now.getTime()) / (60 * 1000));
        
        setBuyLimitReached(true);
        setBuyLimitMessage(`You've reached the limit of 4 shares in 10 minutes. Wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before buying again.`);
      } else {
        setBuyLimitReached(false);
        setBuyLimitMessage('');
      }
    } catch (error) {
      console.error('Error checking buy limit:', error);
      setBuyLimitReached(false);
      setBuyLimitMessage('');
    }
  };

  const handleBuy = async () => {
    if (!user?.uid) {
      // Redirect to login if not authenticated
      window.location.href = '/auth';
      return;
    }
    
    if (!marketData || !userProfile || loading) return;
    
    try {
      setLoading(true);
      
      // Check if user has enough balance (1 share only)
      const cost = marketData.currentPrice;
      if (cost > userProfile.balance) {
        popMsg(`Insufficient balance! Need ${formatCurrency(cost)}, have ${formatCurrency(userProfile.balance)}`);
        return;
      }

      // Anti-arbitrage check: Max 4 shares per 10 minutes per opinion
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      
      const recentTransactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('opinionText', '==', activity.opinionText),
        where('type', '==', 'buy'),
        where('timestamp', '>=', tenMinutesAgo),
        orderBy('timestamp', 'desc')
      );
      
      const recentTransactionsSnap = await getDocs(recentTransactionsQuery);
      const recentBuys = recentTransactionsSnap.docs.length;
      
      console.log('🔍 Feed Modal Anti-arbitrage check:', {
        recentBuys,
        userPosition,
        canBuy: recentBuys < 4,
        opinionText: activity.opinionText
      });
      
      if (recentBuys >= 4) {
        const earliestBuy = recentTransactionsSnap.docs[recentTransactionsSnap.docs.length - 1];
        const nextAllowedTime = new Date(earliestBuy.data().timestamp.toDate().getTime() + 10 * 60 * 1000);
        const minutesLeft = Math.ceil((nextAllowedTime.getTime() - now.getTime()) / (60 * 1000));
        
        popMsg(`🚫 Anti-arbitrage limit: You've bought 4 shares in the last 10 minutes. Wait ${minutesLeft} minutes before buying again. (You still own ${userPosition} shares)`);
        return;
      }

      // Execute buy transaction (1 share only)
      const batch = writeBatch(db);
      
      // Calculate new price (0.1% increase per share)
      const newPrice = marketData.currentPrice * 1.001;
      
      // Update market data
      const marketDocId = btoa(activity.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      const updatedMarket = {
        ...marketData,
        timesPurchased: marketData.timesPurchased + 1,
        currentPrice: newPrice,
        lastUpdated: iso(),
        priceHistory: [
          ...marketData.priceHistory.slice(-19),
          {
            price: newPrice,
            timestamp: iso(),
            action: 'buy' as const,
            quantity: 1,
            username: userProfile.username,
            userId: user.uid
          }
        ],
        dailyVolume: marketData.dailyVolume + 1,
      };

      batch.set(doc(db, 'market-data', marketDocId), updatedMarket);

      // Update user profile
      const updatedProfile = {
        ...userProfile,
        balance: userProfile.balance - cost,
        portfolio: {
          ...userProfile.portfolio,
          [activity.opinionText]: userPosition + 1
        }
      };

      batch.set(doc(db, 'users', user.uid), updatedProfile);

      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      batch.set(doc(db, 'transactions', transactionId), {
        id: transactionId,
        type: 'buy',
        userId: user.uid,
        username: userProfile.username,
        amount: cost,
        opinionText: activity.opinionText,
        timestamp: serverTimestamp(),
        quantity: 1,
        price: newPrice
      });

      await batch.commit();
      
      setMarketData(updatedMarket);
      setUserProfile(updatedProfile);
      setUserPosition(userPosition + 1);
      
      // Check buy limit after successful BUY (not sell) to update UI
      setTimeout(() => {
        checkBuyLimit();
      }, 1000);
      
      popMsg(`✅ Successfully bought 1 share for ${formatCurrency(cost)}`);
      
    } catch (error) {
      console.error('Error buying shares:', error);
      popMsg('❌ Error buying shares. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!user?.uid) {
      // Redirect to login if not authenticated
      window.location.href = '/auth';
      return;
    }
    
    if (!marketData || !userProfile || loading || userPosition === 0) return;
    
    try {
      setLoading(true);
      
      // Determine actual quantity to sell (can't sell more than owned)
      const actualSellQuantity = Math.min(sellQuantity, userPosition);
      
      // Calculate sell price (95% of market price per share)
      const sellPricePerShare = marketData.currentPrice * 0.95;
      const totalSellValue = sellPricePerShare * actualSellQuantity;
      
      // Execute sell transaction
      const batch = writeBatch(db);
      
      // Calculate new price (0.1% decrease per share sold)
      const newPrice = marketData.currentPrice * Math.pow(0.999, actualSellQuantity);
      
      // Update market data
      const marketDocId = btoa(activity.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      const updatedMarket = {
        ...marketData,
        timesSold: marketData.timesSold + actualSellQuantity,
        currentPrice: newPrice,
        lastUpdated: iso(),
        priceHistory: [
          ...marketData.priceHistory.slice(-19),
          {
            price: newPrice,
            timestamp: iso(),
            action: 'sell' as const,
            quantity: actualSellQuantity,
            username: userProfile.username,
            userId: user.uid
          }
        ],
        dailyVolume: marketData.dailyVolume + actualSellQuantity,
      };

      batch.set(doc(db, 'market-data', marketDocId), updatedMarket);

      // Update user profile
      const updatedProfile = {
        ...userProfile,
        balance: userProfile.balance + totalSellValue,
        portfolio: {
          ...userProfile.portfolio,
          [activity.opinionText]: userPosition - actualSellQuantity
        }
      };

      batch.set(doc(db, 'users', user.uid), updatedProfile);

      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      batch.set(doc(db, 'transactions', transactionId), {
        id: transactionId,
        type: 'sell',
        userId: user.uid,
        username: userProfile.username,
        amount: totalSellValue,
        opinionText: activity.opinionText,
        timestamp: serverTimestamp(),
        quantity: actualSellQuantity,
        price: sellPricePerShare
      });

      await batch.commit();
      
      setMarketData(updatedMarket);
      setUserProfile(updatedProfile);
      setUserPosition(userPosition - actualSellQuantity);
      
      // Reset sell quantity if we sold all shares
      if (actualSellQuantity === userPosition) {
        setSellQuantity(1);
      }
      
      popMsg(`✅ Successfully sold ${actualSellQuantity} share${actualSellQuantity > 1 ? 's' : ''} for ${formatCurrency(totalSellValue)}`);
      
    } catch (error) {
      console.error('Error selling shares:', error);
      popMsg('❌ Error selling shares. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShort = async () => {
    if (!user?.uid) {
      // Redirect to login if not authenticated
      window.location.href = '/auth';
      return;
    }
    
    if (!marketData || !userProfile || loading) return;
    
    if (userPosition > 0) {
      popMsg('❌ Cannot short - you own shares in this opinion');
      return;
    }
    
    if (betAmount > userProfile.balance) {
      popMsg(`❌ Insufficient balance! Need ${formatCurrency(betAmount)}, have ${formatCurrency(userProfile.balance)}`);
      return;
    }
    
    if (betAmount < 1) {
      popMsg('❌ Bet amount must be at least $1');
      return;
    }
    
    if (targetDrop < 1 || targetDrop > 99) {
      popMsg('❌ Target drop must be between 1% and 99%');
      return;
    }
    
    if (timeLimit < 1 || timeLimit > 168) {
      popMsg('❌ Time limit must be between 1 and 168 hours');
      return;
    }
    
    try {
      setLoading(true);
      
      // Calculate target price and expiration
      const targetPrice = marketData.currentPrice * (1 - targetDrop / 100);
      const expirationTime = new Date(Date.now() + timeLimit * 60 * 60 * 1000);
      
      // Create short position
      const batch = writeBatch(db);
      const shortId = `short_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      // Create short position document
      batch.set(doc(db, 'short-positions', shortId), {
        id: shortId,
        userId: user.uid,
        username: userProfile.username,
        opinionText: activity.opinionText,
        betAmount: betAmount,
        targetDrop: targetDrop,
        timeLimit: timeLimit,
        startPrice: marketData.currentPrice,
        targetPrice: targetPrice,
        startTime: serverTimestamp(),
        expirationTime: expirationTime.toISOString(),
        status: 'active', // active, won, lost, expired
        potentialWin: potentialWin,
        riskMultiplier: calculateMultiplier(targetDrop, timeLimit),
        createdAt: serverTimestamp()
      });
      
      // Update user balance
      const updatedProfile = {
        ...userProfile,
        balance: userProfile.balance - betAmount
      };
      
      batch.set(doc(db, 'users', user.uid), updatedProfile);
      
      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      batch.set(doc(db, 'transactions', transactionId), {
        id: transactionId,
        type: 'short',
        userId: user.uid,
        username: userProfile.username,
        amount: -betAmount, // Negative because it's money risked
        opinionText: activity.opinionText,
        timestamp: serverTimestamp(),
        shortId: shortId,
        details: {
          betAmount: betAmount,
          targetDrop: targetDrop,
          timeLimit: timeLimit,
          targetPrice: targetPrice,
          startPrice: marketData.currentPrice
        }
      });
      
      await batch.commit();
      
      setUserProfile(updatedProfile);
      
      popMsg(`✅ Short position created! Betting ${formatCurrency(betAmount)} that price drops ${targetDrop}% in ${timeLimit} hours.`);
      
      // Refresh short positions
      try {
        const shortQuery = query(
          collection(db, 'short-positions'),
          where('userId', '==', user.uid),
          where('opinionText', '==', activity.opinionText),
          where('status', '==', 'active')
        );
        
        const shortSnap = await getDocs(shortQuery);
        const positions = shortSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setShortPositions(positions);
      } catch (error) {
        console.error('Error refreshing short positions:', error);
      }
      
    } catch (error) {
      console.error('Error creating short position:', error);
      popMsg('❌ Error creating short position. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToUserProfile = () => {
    if (activity.username) {
      router.push(`/users/${activity.username}`);
      onClose();
    }
  };

  const navigateToOpinion = () => {
    if (activity.opinionText) {
      const opinionId = btoa(activity.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      router.push(`/opinion/${opinionId}`);
      onClose();
    }
  };

  const handlePortfolioBet = async () => {
    if (!user || !userProfile) {
      popMsg('❌ Please sign in to place a bet.');
      return;
    }

    if (portfolioBetAmount > userProfile.balance) {
      popMsg('❌ Insufficient balance for this bet.');
      return;
    }

    setLoading(true);
    try {
      const betId = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const expiryDate = new Date(Date.now() + portfolioTimeLimit * 60 * 60 * 1000);
      
      const portfolioBet = {
        id: betId,
        userId: user.uid,
        username: userProfile.username,
        targetUser: activity.username,
        targetUserId: activity.userId,
        betType: portfolioBetDirection,
        targetPercentage: portfolioTargetChange,
        timeframe: portfolioTimeLimit,
        amount: portfolioBetAmount,
        potentialPayout: portfolioBetAmount * calculateMultiplier(portfolioTargetChange, portfolioTimeLimit),
        status: 'active',
        placedDate: serverTimestamp(),
        expiryDate: expiryDate.toISOString(),
        riskMultiplier: calculateMultiplier(portfolioTargetChange, portfolioTimeLimit)
      };

      const batch = writeBatch(db);
      
      // Save portfolio bet
      batch.set(doc(db, 'portfolio-bets', betId), portfolioBet);
      
      // Update user balance
      batch.set(doc(db, 'users', user.uid), {
        balance: userProfile.balance - portfolioBetAmount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Create transaction record
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      batch.set(doc(db, 'transactions', transactionId), {
        id: transactionId,
        type: 'bet',
        userId: user.uid,
        username: userProfile.username,
        amount: -portfolioBetAmount,
        timestamp: serverTimestamp(),
        metadata: {
          betType: 'portfolio',
          targetUser: activity.username,
          direction: portfolioBetDirection,
          targetChange: portfolioTargetChange,
          timeframe: portfolioTimeLimit
        }
      });

      await batch.commit();
      
      // Update local state
      setUserProfile(prev => prev ? { ...prev, balance: prev.balance - portfolioBetAmount } : null);
      
      popMsg(`✅ Portfolio bet placed! Betting ${formatCurrency(portfolioBetAmount)} that ${activity.username}'s portfolio will ${portfolioBetDirection} by ${portfolioTargetChange}% in ${portfolioTimeLimit} hours.`);
      
    } catch (error) {
      console.error('Error placing portfolio bet:', error);
      popMsg('❌ Error placing bet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToUserPage = () => {
    if (activity.username) {
      router.push(`/users/${activity.username}`);
      onClose();
    }
  };

  const potentialWin = betAmount * calculateMultiplier(targetDrop, timeLimit);

  return (
    <div 
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '800px',
        width: '100%'
      }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${getActivityColor(activity.type)}30`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: getActivityColor(activity.type),
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {getActivityIcon(activity.type)}
            </div>
            <div>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: '700',
                margin: '0',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-primary)'
              }}>
                {getActivityTitle(activity.type)}
              </h2>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                margin: '2px 0 0 0'
              }}>
                {activity.type === 'buy' ? 'Purchase this opinion' : 
                 activity.type === 'sell' ? 'View or sell this opinion' :
                 activity.type === 'bet' ? 'Place a bet on this activity' :
                 activity.type === 'short' ? 'Short this opinion' :
                 activity.type === 'generate' ? 'AI-generated opinion' :
                 'Trade this opinion or view details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-section)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div>
          
          {/* Transaction Details */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: 'var(--text-primary)'
            }}>
              Transaction Details
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  margin: '0 0 4px 0'
                }}>Type</p>
                <p style={{
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  color: 'var(--text-primary)',
                  margin: '0'
                }}>{activity.type}</p>
              </div>
              <div>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  margin: '0 0 4px 0'
                }}>Amount</p>
                <p style={{
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  margin: '0'
                }}>{formatCurrency(Math.abs(activity.amount || 0))}</p>
              </div>
              <div>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  margin: '0 0 4px 0'
                }}>Trader</p>
                <button 
                  onClick={navigateToUserProfile}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontWeight: '500',
                    color: getActivityColor(activity.type),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0',
                    fontSize: 'var(--font-size-base)'
                  }}
                >
                  <User size={16} />
                  {activity.username || 'Anonymous'}
                </button>
              </div>
              <div>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  margin: '0 0 4px 0'
                }}>Time</p>
                <p style={{
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  margin: '0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Clock size={16} />
                  {activity.relativeTime}
                </p>
              </div>
            </div>
            
            {activity.opinionText && (
              <div style={{ marginTop: '16px' }}>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)',
                  margin: '0 0 4px 0'
                }}>Opinion</p>
                <button
                  onClick={navigateToOpinion}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontWeight: '500',
                    color: getActivityColor(activity.type),
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '0',
                    fontSize: 'var(--font-size-base)',
                    lineHeight: '1.4'
                  }}
                >
                  "{activity.opinionText.slice(0, 100)}{activity.opinionText.length > 100 ? '...' : ''}"
                </button>
              </div>
            )}
          </div>

          {/* Trading Interface */}
          {activity.type === 'bet' ? (
            // Bet-specific interface
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
              marginBottom: '24px'
            }}>
              
              {/* Place Portfolio Bet */}
              <div className="card">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <Target size={20} style={{ color: getActivityColor(activity.type) }} />
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    margin: '0',
                    color: 'var(--text-primary)'
                  }}>Bet on <button 
                    onClick={navigateToUserProfile}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: getActivityColor(activity.type),
                      fontWeight: '600',
                      fontSize: 'var(--font-size-lg)',
                      cursor: 'pointer',
                      padding: '0',
                      textDecoration: 'underline'
                    }}
                  >
                    {activity.username}
                  </button>'s Portfolio</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      marginBottom: '8px'
                    }}>
                      Bet Amount ($):
                    </label>
                    <input
                      type="number"
                      value={portfolioBetAmount}
                      onChange={(e) => setPortfolioBetAmount(Number(e.target.value))}
                      disabled={user === null}
                      className="form-input"
                      min="1"
                      style={{
                        opacity: user === null ? '0.5' : '1',
                        cursor: user === null ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      marginBottom: '8px'
                    }}>
                      Direction:
                    </label>
                    <select
                      value={portfolioBetDirection}
                      onChange={(e) => setPortfolioBetDirection(e.target.value as 'increase' | 'decrease')}
                      disabled={user === null}
                      className="form-input"
                      style={{
                        opacity: user === null ? '0.5' : '1',
                        cursor: user === null ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="increase">Portfolio Will Increase</option>
                      <option value="decrease">Portfolio Will Decrease</option>
                    </select>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      marginBottom: '8px'
                    }}>
                      Target Change (%):
                    </label>
                    <input
                      type="number"
                      value={portfolioTargetChange}
                      onChange={(e) => setPortfolioTargetChange(Number(e.target.value))}
                      disabled={user === null}
                      className="form-input"
                      min="1"
                      max="100"
                      style={{
                        opacity: user === null ? '0.5' : '1',
                        cursor: user === null ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      marginBottom: '8px'
                    }}>
                      Time Limit (hours):
                    </label>
                    <input
                      type="number"
                      value={portfolioTimeLimit}
                      onChange={(e) => setPortfolioTimeLimit(Number(e.target.value))}
                      disabled={user === null}
                      className="form-input"
                      min="1"
                      max="720"
                      style={{
                        opacity: user === null ? '0.5' : '1',
                        cursor: user === null ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <p style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      margin: '0'
                    }}>
                      Potential Payout: {formatCurrency(portfolioBetAmount * calculateMultiplier(portfolioTargetChange, portfolioTimeLimit))}
                    </p>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end'
                    }}>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)',
                        margin: '0'
                      }}>Multiplier</span>
                      <span style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '600',
                        color: 'var(--green)',
                        margin: '0'
                      }}>{calculateMultiplier(portfolioTargetChange, portfolioTimeLimit).toFixed(1)}x</span>
                    </div>
                  </div>

                  <button
                    onClick={handlePortfolioBet}
                    disabled={loading || Boolean(user && userProfile && portfolioBetAmount > userProfile.balance)}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      backgroundColor: (loading || (user && userProfile && portfolioBetAmount > userProfile.balance)) ? 'var(--medium-gray)' : getActivityColor(activity.type),
                      color: 'white',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: (loading || (user && userProfile && portfolioBetAmount > userProfile.balance)) ? 'not-allowed' : 'pointer',
                      opacity: (loading || (user && userProfile && portfolioBetAmount > userProfile.balance)) ? '0.5' : '1'
                    }}
                  >
                    {loading ? (
                      <>
                        <Clock size={20} />
                        Processing...
                      </>
                    ) : user === null ? (
                      <>
                        <Target size={20} />
                        Sign in to Place Bet
                      </>
                    ) : userProfile && portfolioBetAmount > userProfile.balance ? (
                      <>
                        <Warning size={20} />
                        Insufficient Balance
                      </>
                    ) : (
                      <>
                        <Target size={20} />
                        Place Portfolio Bet
                      </>
                    )}
                  </button>
                </div>
              </div>

                             {/* Navigate to User */}
               <div className="card">
                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   gap: '8px',
                   marginBottom: '16px'
                 }}>
                   <User size={20} style={{ color: getActivityColor(activity.type) }} />
                   <h3 style={{
                     fontSize: 'var(--font-size-2xl)',
                     fontWeight: '700',
                     margin: '0',
                     color: 'var(--text-primary)'
                   }}>View User Profile</h3>
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   <div>
                     <p style={{
                       fontSize: 'var(--font-size-lg)',
                       color: 'var(--black)',
                       margin: '0 0 16px 0'
                     }}>
                       Explore <button 
                         onClick={navigateToUserProfile}
                         style={{
                           background: 'none',
                           border: 'none',
                           color: getActivityColor(activity.type),
                           fontWeight: '500',
                           fontSize: 'var(--font-size-lg)',
                           cursor: 'pointer',
                           padding: '0',
                           textDecoration: 'underline'
                         }}
                       >
                         {activity.username}
                       </button>'s trading activity, portfolio, and performance history.
                     </p>
                   </div>
                   
                   {/* Portfolio Metrics */}
                   {targetUserProfile && (
                     <div style={{
                       display: 'grid',
                       gridTemplateColumns: '1fr 1fr',
                       gap: '24px',
                       padding: '32px',
                       backgroundColor: 'var(--bg-light)',
                       borderRadius: 'var(--radius-md)',
                       border: '1px solid var(--border-primary)'
                     }}>
                       <div>
                         <p style={{
                           fontSize: 'var(--font-size-lg)',
                           color: 'var(--text-secondary)',
                           margin: '0 0 16px 0',
                           fontWeight: '600'
                         }}>Portfolio Value</p>
                         <p style={{
                           fontSize: 'var(--font-size-3xl)',
                           fontWeight: '700',
                           margin: '0',
                           color: 'var(--text-primary)'
                         }}>${targetUserProfile.portfolioValue?.toFixed(2) || '0.00'}</p>
                       </div>
                       
                       <div>
                         <p style={{
                           fontSize: 'var(--font-size-lg)',
                           color: 'var(--text-secondary)',
                           margin: '0 0 16px 0',
                           fontWeight: '600'
                         }}>P+L%</p>
                         <p style={{
                           fontSize: 'var(--font-size-3xl)',
                           fontWeight: '700',
                           margin: '0',
                           color: targetUserProfile.pnlPercent >= 0 ? 'var(--green)' : 'var(--red)'
                         }}>{targetUserProfile.pnlPercent >= 0 ? '+' : ''}{targetUserProfile.pnlPercent?.toFixed(1) || '0.0'}%</p>
                       </div>
                       
                       <div>
                         <p style={{
                           fontSize: 'var(--font-size-lg)',
                           color: 'var(--text-secondary)',
                           margin: '0 0 16px 0',
                           fontWeight: '600'
                         }}>Exposure</p>
                         <p style={{
                           fontSize: 'var(--font-size-3xl)',
                           fontWeight: '700',
                           margin: '0',
                           color: 'var(--text-primary)'
                         }}>${targetUserProfile.exposure?.toFixed(2) || '0.00'}</p>
                       </div>
                       
                       <div>
                         <p style={{
                           fontSize: 'var(--font-size-lg)',
                           color: 'var(--text-secondary)',
                           margin: '0 0 16px 0',
                           fontWeight: '600'
                         }}>Volatility</p>
                         <p style={{
                           fontSize: 'var(--font-size-3xl)',
                           fontWeight: '700',
                           margin: '0',
                           color: targetUserProfile.volatility === 'High' ? 'var(--red)' : 
                                 targetUserProfile.volatility === 'Medium' ? 'var(--yellow)' : 'var(--green)'
                         }}>{targetUserProfile.volatility || 'Low'}</p>
                       </div>
                     </div>
                   )}
                   
                   {/* Top 3 Opinions */}
                   {targetUserProfile?.topOpinions?.length > 0 && (
                     <div style={{
                       padding: '32px',
                       backgroundColor: 'var(--bg-light)',
                       borderRadius: 'var(--radius-md)',
                       border: '1px solid var(--border-primary)'
                     }}>
                       <p style={{
                         fontSize: 'var(--font-size-lg)',
                         fontWeight: '600',
                         margin: '0 0 20px 0',
                         color: 'var(--text-primary)'
                       }}>Top Holdings</p>
                       {targetUserProfile.topOpinions.map((item: any, index: number) => (
                         <div key={index} style={{
                           display: 'flex',
                           justifyContent: 'space-between',
                           alignItems: 'center',
                           marginBottom: index < 2 ? '16px' : '0'
                         }}>
                           <span style={{
                             fontSize: 'var(--font-size-base)',
                             color: 'var(--text-secondary)',
                             flex: 1,
                             marginRight: '8px'
                           }}>{item.opinion}</span>
                           <span style={{
                             fontSize: 'var(--font-size-base)',
                             fontWeight: '600',
                             color: 'var(--text-primary)'
                           }}>{item.shares} shares</span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   <button
                     onClick={navigateToUserPage}
                     className="btn btn-secondary"
                     style={{
                       width: '100%',
                       backgroundColor: getActivityColor(activity.type),
                       color: 'white',
                       padding: '12px 16px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '8px',
                       cursor: 'pointer',
                       border: `2px solid ${getActivityColor(activity.type)}`,
                       borderRadius: 'var(--radius-md)'
                     }}
                   >
                     <User size={20} />
                     View {activity.username}'s Profile
                   </button>
                 </div>
               </div>
            </div>
          ) : activity.opinionText ? (
            // Regular opinion trading interface
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
              marginBottom: '24px'
            }}>
              
              {/* Buy Shares */}
              <div className="card">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <ShoppingCart size={20} style={{ color: 'var(--green)' }} />
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    margin: '0',
                    color: 'var(--text-primary)'
                  }}>Buy Shares</h3>
                </div>
                
                {!marketData ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)'
                  }}>
                    Loading market data...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-secondary)',
                        margin: '0 0 4px 0'
                      }}>Current Price: {formatCurrency(marketData.currentPrice)}</p>
                      <p style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: '0'
                      }}>
                        Cost per Share: {formatCurrency(marketData.currentPrice)}
                      </p>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-secondary)',
                        margin: '8px 0 0 0',
                        fontStyle: 'italic'
                      }}>
                        One share per transaction (anti-arbitrage protection)
                      </p>
                    </div>
                    
                    <button
                      onClick={handleBuy}
                      disabled={loading || buyLimitReached || Boolean(user && userProfile && userProfile.balance < marketData.currentPrice)}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        backgroundColor: (loading || buyLimitReached || (user && userProfile && userProfile.balance < marketData.currentPrice)) ? 'var(--medium-gray)' : 'var(--green)',
                        color: 'white',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: (loading || buyLimitReached || (user && userProfile && userProfile.balance < marketData.currentPrice)) ? '0.5' : '1',
                        cursor: (loading || buyLimitReached || (user && userProfile && userProfile.balance < marketData.currentPrice)) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ShoppingCart size={20} />
                      {loading ? 'Processing...' : user === null ? 'Sign in to Buy 1 Share' : buyLimitReached ? 'Buy Limit Reached' : 'Buy 1 Share'}
                    </button>
                    
                    {buyLimitReached && (
                      <div style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--red)',
                        marginTop: '8px',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        {buyLimitMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sell Shares */}
              <div className="card">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <HandPeace size={20} style={{ color: 'var(--red)' }} />
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    margin: '0',
                    color: 'var(--text-primary)'
                  }}>Sell Shares</h3>
                </div>
                
                {!marketData ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)'
                  }}>
                    Loading market data...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-secondary)',
                        margin: '0 0 8px 0'
                      }}>
                        You own: {userPosition} shares
                      </p>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-secondary)',
                        margin: '0 0 8px 0'
                      }}>
                        Sell Price: {formatCurrency(marketData.currentPrice * 0.95)} per share (5% spread)
                      </p>
                    </div>
                    
                    {userPosition > 0 && (
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          marginBottom: '8px'
                        }}>
                          Quantity to Sell:
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <button
                            onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                            disabled={loading || !user}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'var(--bg-section)',
                              border: '2px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: (loading || !user) ? 'not-allowed' : 'pointer',
                              opacity: (loading || !user) ? '0.5' : '1',
                              transition: 'var(--transition)'
                            }}
                          >
                            <Minus size={16} />
                          </button>
                          <span style={{
                            width: '48px',
                            textAlign: 'center',
                            fontWeight: '500',
                            fontSize: 'var(--font-size-base)'
                          }}>{Math.min(sellQuantity, userPosition)}</span>
                          <button
                            onClick={() => setSellQuantity(Math.min(userPosition, sellQuantity + 1))}
                            disabled={loading || !user}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'var(--bg-section)',
                              border: '2px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: (loading || !user) ? 'not-allowed' : 'pointer',
                              opacity: (loading || !user) ? '0.5' : '1',
                              transition: 'var(--transition)'
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <p style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: '0'
                      }}>
                        Total Value: {formatCurrency(marketData.currentPrice * 0.95 * Math.min(sellQuantity, userPosition))}
                      </p>
                    </div>
                    
                    <button
                      onClick={handleSell}
                      disabled={loading || userPosition === 0 || !user}
                      className="btn"
                      style={{
                        width: '100%',
                        backgroundColor: (loading || userPosition === 0 || !user) ? 'var(--medium-gray)' : 'var(--red)',
                        color: 'white',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: (loading || userPosition === 0 || !user) ? 'not-allowed' : 'pointer',
                        opacity: (loading || userPosition === 0 || !user) ? '0.5' : '1'
                      }}
                    >
                      {loading ? (
                        <>
                          <Clock size={20} />
                          Processing...
                        </>
                      ) : !user ? (
                        <>
                          <HandPeace size={20} />
                          Sign in to Sell Shares
                        </>
                      ) : userPosition === 0 ? (
                        <>
                          <Warning size={20} />
                          No Shares to Sell
                        </>
                      ) : (
                        <>
                          <HandPeace size={20} />
                          Sell {Math.min(sellQuantity, userPosition)} Share{Math.min(sellQuantity, userPosition) > 1 ? 's' : ''}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Short Position */}
              <div className="card">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <TrendDown size={20} style={{ color: 'var(--red)' }} />
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    margin: '0',
                    color: 'var(--text-primary)'
                  }}>Short Position</h3>
                </div>
                
                {!marketData ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)'
                  }}>
                    Loading market data...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '8px'
                      }}>
                        Bet Amount ($):
                      </label>
                      <input
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(Number(e.target.value))}
                        disabled={user === null}
                        className="form-input"
                        min="1"
                        style={{
                          opacity: user === null ? '0.5' : '1',
                          cursor: user === null ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '8px'
                      }}>
                        Target Drop (%):
                      </label>
                      <input
                        type="number"
                        value={targetDrop}
                        onChange={(e) => setTargetDrop(Number(e.target.value))}
                        disabled={user === null}
                        className="form-input"
                        min="1"
                        max="99"
                        style={{
                          opacity: user === null ? '0.5' : '1',
                          cursor: user === null ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '8px'
                      }}>
                        Time Limit (hours):
                      </label>
                      <input
                        type="number"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        disabled={user === null}
                        className="form-input"
                        min="1"
                        max="168"
                        style={{
                          opacity: user === null ? '0.5' : '1',
                          cursor: user === null ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <p style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: '0'
                      }}>
                        Potential Win: {formatCurrency(potentialWin)}
                      </p>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end'
                      }}>
                        <span style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--text-secondary)',
                          margin: '0'
                        }}>Multiplier</span>
                        <span style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: '600',
                          color: 'var(--green)',
                          margin: '0'
                        }}>{calculateMultiplier(targetDrop, timeLimit).toFixed(1)}x</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleShort}
                      disabled={loading || Boolean(user && userPosition > 0) || Boolean(user && userProfile && betAmount > userProfile.balance)}
                      className="btn"
                      style={{
                        width: '100%',
                        backgroundColor: (loading || (user && userPosition > 0) || (user && userProfile && betAmount > userProfile.balance)) ? 'var(--medium-gray)' : 'var(--red)',
                        color: 'white',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: (loading || (user && userPosition > 0) || (user && userProfile && betAmount > userProfile.balance)) ? 'not-allowed' : 'pointer',
                        opacity: (loading || (user && userPosition > 0) || (user && userProfile && betAmount > userProfile.balance)) ? '0.5' : '1'
                      }}
                    >
                      {loading ? (
                        <>
                          <Clock size={20} />
                          Processing...
                        </>
                      ) : user === null ? (
                        <>
                          <Target size={20} />
                          Sign in to Create Short Position
                        </>
                      ) : userPosition > 0 ? (
                        <>
                          <Warning size={20} />
                          Own Shares - Cannot Short
                        </>
                      ) : userProfile && betAmount > userProfile.balance ? (
                        <>
                          <Warning size={20} />
                          Insufficient Balance
                        </>
                      ) : (
                        <>
                          <Target size={20} />
                          Create Short Position
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Current Short Positions */}
          {shortPositions.length > 0 && (
            <div className="card" style={{
              marginBottom: '24px',
              backgroundColor: 'var(--bg-light)',
              border: '2px solid var(--red)'
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                margin: '0 0 16px 0',
                color: 'var(--text-primary)'
              }}>Your Active Short Positions</h3>
              <div style={{
                display: 'grid',
                gap: '12px'
              }}>
                {shortPositions.map((position) => {
                  const timeRemaining = new Date(position.expirationTime).getTime() - Date.now();
                  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
                  const minutesRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));
                  const isExpired = timeRemaining <= 0;
                  
                  return (
                    <div key={position.id} style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-section)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px 0'
                        }}>Bet Amount</p>
                        <p style={{
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          margin: '0'
                        }}>{formatCurrency(position.betAmount)}</p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px 0'
                        }}>Target Drop</p>
                        <p style={{
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          margin: '0'
                        }}>{position.targetDrop}%</p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px 0'
                        }}>Target Price</p>
                        <p style={{
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          margin: '0'
                        }}>{formatCurrency(position.targetPrice)}</p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px 0'
                        }}>Time Remaining</p>
                        <p style={{
                          fontWeight: '600',
                          color: isExpired ? 'var(--red)' : 'var(--text-primary)',
                          margin: '0'
                        }}>
                          {isExpired ? 'Expired' : `${hoursRemaining}h ${minutesRemaining}m`}
                        </p>
                      </div>
                      <div>
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px 0'
                        }}>Potential Win</p>
                        <p style={{
                          fontWeight: '600',
                          color: 'var(--green)',
                          margin: '0'
                        }}>{formatCurrency(position.potentialWin)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Position */}
          {userPosition > 0 && (
            <div className="card" style={{
              marginBottom: '24px',
              backgroundColor: 'var(--bg-light)',
              border: `2px solid ${getActivityColor(activity.type)}`
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                margin: '0 0 12px 0',
                color: 'var(--text-primary)'
              }}>Your Position</h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <p style={{
                  color: 'var(--text-primary)',
                  margin: '0',
                  fontSize: 'var(--font-size-base)'
                }}>Shares owned: <strong>{userPosition}</strong></p>
                <button
                  onClick={handleSell}
                  disabled={loading}
                  className="btn"
                  style={{
                    backgroundColor: getActivityColor(activity.type),
                    color: 'white',
                    padding: '8px 16px',
                    opacity: loading ? '0.5' : '1',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Processing...' : `Sell 1 Share (${formatCurrency((marketData?.currentPrice || 0) * 0.95)})`}
                </button>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {msg && (
            <div style={{
              margin: '16px 0',
              padding: '12px',
              backgroundColor: 'var(--warning)',
              border: '2px solid var(--yellow)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{
                color: 'var(--black)',
                fontSize: 'var(--font-size-sm)',
                margin: '0'
              }}>{msg}</p>
            </div>
          )}

          {/* User Balance */}
          {userProfile && (
            <div className="card" style={{ marginTop: '24px' }}>
              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
                margin: '0 0 4px 0'
              }}>Your Balance</p>
              <p style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: '600',
                color: 'var(--text-primary)',
                margin: '0',
                fontFamily: 'var(--font-number)'
              }}>{formatCurrency(userProfile.balance)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 