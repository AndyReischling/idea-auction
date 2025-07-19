"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { db } from '../../lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  writeBatch, 
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { calculateMultiplier, calculatePayout } from '../../lib/multiplier-utils';
import { realtimeDataService } from '../../lib/realtime-data-service';
import { createMarketDataDocId, createBetId, createTransactionId, createActivityId } from '../../lib/document-id-utils';
import Sidebar from '../../components/Sidebar';
import AuthGuard from '../../components/AuthGuard';
import AuthButton from '../../components/AuthButton';
import AuthStatusIndicator from '../../components/AuthStatusIndicator';
import Navigation from '../../components/Navigation';
import { 
  User, 
  TrendUp, 
  TrendDown, 
  Clock, 
  CurrencyDollar, 
  Calculator,
  ArrowLeft,
  Target,
  Timer,
  Coins
} from '@phosphor-icons/react';
import '../../page.module.css';

interface UserProfile {
  uid: string;
  username: string;
  balance: number;
  joinDate: Date | string;
  totalEarnings: number;
  totalLosses: number;
  portfolio?: Record<string, any>;
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
  timestamp: Date;
  opinionText?: string;
  opinionId?: string;
  quantity?: number;
  price?: number;
}

interface BetFormData {
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  timeframe: number; // in hours
  amount: number;
}

const DEFAULT_BET_FORM: BetFormData = {
  betType: 'increase',
  targetPercentage: 10,
  timeframe: 168, // 7 days
  amount: 100
};

export default function BetPage() {
  const { username } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [betForm, setBetForm] = useState<BetFormData>(DEFAULT_BET_FORM);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Calculate derived values
  const multiplier = calculateMultiplier(betForm.targetPercentage, betForm.timeframe);
  const potentialPayout = calculatePayout(betForm.amount, betForm.targetPercentage, betForm.timeframe);
  const potentialReturn = potentialPayout - betForm.amount;

  // Load user profiles and portfolio data
  useEffect(() => {
    if (!user?.uid || !username) return;
    
    setLoading(true);
    let unsubProfile: string | undefined;

    const loadData = async () => {
      try {
        // Load current user profile using realtimeDataService for consistency with profile page
        unsubProfile = await realtimeDataService.subscribeToUserProfile(
          user.uid,
          (p) => {
            const userProfile = {
              uid: user.uid,
              username: p.username,
              balance: p.balance,
              joinDate: p.joinDate?.toDate?.()?.toISOString?.() ?? p.joinDate,
              totalEarnings: p.totalEarnings,
              totalLosses: p.totalLosses,
              portfolio: p.portfolio || {}
            };
            setCurrentUserProfile(userProfile);
            setUserProfile(userProfile); // Keep for backward compatibility
          }
        );

        // Load current user's portfolio using realtimeDataService for consistency
        const userProfile = await realtimeDataService.getUserProfile(user.uid);
        if (userProfile?.portfolio) {
          const marketData = await realtimeDataService.getMarketData();
          
          const portfolioEntries = await Promise.all(
            Object.entries(userProfile.portfolio).map(async ([opinionKey, portfolioData]) => {
              try {
                let opinionText = opinionKey;
                let quantity = typeof portfolioData === 'object' && portfolioData !== null
                  ? Object.values(portfolioData)[0] as number
                  : portfolioData as number;
                
                if (opinionKey.includes('_')) {
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

                const q = query(
                  collection(db, 'opinions'),
                  where('text', '==', opinionText),
                  limit(1)
                );
                const querySnapshot = await getDocs(q);
                
                let opinionId = createMarketDataDocId(opinionText);
                if (!querySnapshot.empty) {
                  opinionId = querySnapshot.docs[0].id;
                }

                return {
                  id: opinionId,
                  text: String(opinionText),
                  purchasePrice: marketData[opinionText]?.basePrice || 10.00,
                  currentPrice: marketData[opinionText]?.currentPrice || 10.00,
                  purchaseDate: new Date().toLocaleDateString(),
                  quantity: Number(quantity) || 1,
                };
              } catch (error) {
                console.error('Error fetching opinion ID for:', opinionKey, error);
                const fallbackText = typeof portfolioData === 'object' && portfolioData !== null 
                  ? Object.keys(portfolioData)[0] || opinionKey 
                  : opinionKey;
                const fallbackQuantity = typeof portfolioData === 'object' && portfolioData !== null
                  ? Object.values(portfolioData)[0] as number
                  : portfolioData as number;
                
                return {
                  id: createMarketDataDocId(String(fallbackText)),
                  text: String(fallbackText),
                  purchasePrice: marketData[fallbackText]?.basePrice || 10.00,
                  currentPrice: marketData[fallbackText]?.currentPrice || 10.00,
                  purchaseDate: new Date().toLocaleDateString(),
                  quantity: Number(fallbackQuantity) || 1,
                };
              }
            })
          );
          
          const deduplicatedMap = new Map<string, OpinionAsset>();
          portfolioEntries.forEach(entry => {
            const existing = deduplicatedMap.get(entry.id);
            if (existing) {
              existing.quantity += entry.quantity;
            } else {
              deduplicatedMap.set(entry.id, entry);
            }
          });
          
          const transformedPortfolio = Array.from(deduplicatedMap.values()).filter(entry => entry.quantity > 0);
          setOwnedOpinions(transformedPortfolio);
        }

        // Load target user profile
        const usersQuery = query(
          collection(db, 'users'),
          where('username', '==', username),
          limit(1)
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        if (!usersSnapshot.empty) {
          const targetUserDoc = usersSnapshot.docs[0];
          const targetUserData = targetUserDoc.data();
          
          // Handle different joinDate formats for target user
          let targetJoinDate = new Date();
          if (targetUserData.joinDate) {
            if (typeof targetUserData.joinDate.toDate === 'function') {
              // Firestore timestamp
              targetJoinDate = targetUserData.joinDate.toDate();
            } else if (targetUserData.joinDate instanceof Date) {
              // Already a Date object
              targetJoinDate = targetUserData.joinDate;
            } else if (typeof targetUserData.joinDate === 'string') {
              // String date
              targetJoinDate = new Date(targetUserData.joinDate);
            }
          }
          
          setTargetProfile({
            uid: targetUserDoc.id,
            username: targetUserData.username,
            balance: targetUserData.balance || 10000,
            joinDate: targetJoinDate,
            totalEarnings: targetUserData.totalEarnings || 0,
            totalLosses: targetUserData.totalLosses || 0,
            portfolio: targetUserData.portfolio || {}
          });

          // Calculate target user's portfolio value
          const portfolioData = targetUserData.portfolio || {};
          let totalValue = 0;
          
          for (const [opinionText, holding] of Object.entries(portfolioData)) {
            const holdingData = holding as any;
            if (holdingData.quantity > 0) {
              // Get current price from market-data
              try {
                const marketDoc = await getDoc(doc(db, 'market-data', opinionText));
                if (marketDoc.exists()) {
                  const marketData = marketDoc.data();
                  totalValue += (marketData.currentPrice || 0) * holdingData.quantity;
                }
              } catch (error) {
                console.warn('Error fetching market data for:', opinionText);
              }
            }
          }
          
          setPortfolioValue(totalValue);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup subscription on unmount
    return () => {
      if (unsubProfile) {
        realtimeDataService.unsubscribe(unsubProfile);
      }
    };
  }, [user, username]);

  // Calculate derived values for current user (the one placing the bet)
  const currentUserPortfolioValue = ownedOpinions.reduce(
    (total, opinion) => total + opinion.currentPrice * opinion.quantity,
    0
  );
  const currentUserPnL = currentUserProfile?.totalEarnings && currentUserProfile?.totalLosses 
    ? currentUserProfile.totalEarnings - currentUserProfile.totalLosses 
    : 0;
  const currentUserActiveBets = ownedOpinions.length;

  // Mock calculations for exposure and volatility - these would need real bet data
  const MOCK_EXPOSURE = 700; // This should be calculated from actual bet data
  const MOCK_VOLATILITY = 19.9; // This should be calculated from portfolio variance

  const handleSubmitBet = async () => {
    if (!user || !currentUserProfile || !targetProfile) {
      alert('Please sign in to place a bet.');
      return;
    }

    if (betForm.amount > (currentUserProfile?.balance || 0)) {
      alert('Insufficient balance for this bet.');
      return;
    }

    if (betForm.amount < 1) {
      alert('Bet amount must be at least $1.');
      return;
    }

    if (betForm.targetPercentage < 1 || betForm.targetPercentage > 99) {
      alert('Target percentage must be between 1% and 99%.');
      return;
    }

    if (betForm.timeframe < 1 || betForm.timeframe > 168) {
      alert('Timeframe must be between 1 and 168 hours.');
      return;
    }

    setSubmitting(true);
    try {
      const betId = createBetId();
      const expiryDate = new Date(Date.now() + betForm.timeframe * 60 * 60 * 1000);
      
      const portfolioBet = {
        id: betId,
        userId: user.uid,
        username: currentUserProfile?.username || 'User',
        targetUser: targetProfile?.username || 'User',
        targetUserId: targetProfile?.uid || '',
        betType: betForm.betType,
        targetPercentage: betForm.targetPercentage,
        timeframe: betForm.timeframe,
        amount: betForm.amount,
        potentialPayout: potentialPayout,
        status: 'active',
        placedDate: serverTimestamp(),
        expiryDate: expiryDate.toISOString(),
        riskMultiplier: multiplier,
        initialPortfolioValue: portfolioValue
      };

      const batch = writeBatch(db);
      
      // Save portfolio bet
      batch.set(doc(db, 'portfolio-bets', betId), portfolioBet);
      
      // Update user balance
      batch.set(doc(db, 'users', user.uid), {
        balance: (currentUserProfile?.balance || 0) - betForm.amount,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Create transaction record
      const transactionId = createTransactionId();
      batch.set(doc(db, 'transactions', transactionId), {
        id: transactionId,
        type: 'bet',
        userId: user.uid,
        username: currentUserProfile?.username || 'User',
        amount: -betForm.amount,
        timestamp: serverTimestamp(),
        metadata: {
          betType: 'portfolio',
          targetUser: targetProfile.username,
          direction: betForm.betType,
          targetChange: betForm.targetPercentage,
          timeframe: betForm.timeframe
        }
      });

      // Add to activity feed
      const activityId = createActivityId();
      batch.set(doc(db, 'activity-feed', activityId), {
        id: activityId,
        type: 'bet',
        userId: user.uid,
        username: currentUserProfile?.username || 'User',
        targetUser: targetProfile?.username || 'User',
        amount: -betForm.amount,
        timestamp: serverTimestamp(),
        metadata: {
          betType: 'portfolio',
          direction: betForm.betType,
          targetChange: betForm.targetPercentage,
          timeframe: betForm.timeframe
        }
      });

      await batch.commit();
      
      alert(`✅ Portfolio bet placed! Betting $${betForm.amount.toFixed(2)} that ${targetProfile?.username || 'User'}'s portfolio will ${betForm.betType} by ${betForm.targetPercentage}% in ${betForm.timeframe} hours.`);
      
      // Navigate back to user profile
      router.push(`/users/${username}`);
      
    } catch (error) {
      console.error('Error placing portfolio bet:', error);
      alert('❌ Error placing bet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatTimeframe = (hours: number) => {
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} days`;
    return `${days} days ${remainingHours} hours`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <main className="main-content">
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <div className="page-container">
        <Sidebar />
        <main className="main-content">
          <div className="error">User not found</div>
        </main>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="page-container">
        <Sidebar />
        <main className="main-content" style={{ paddingTop: '110px' }}>
          {/* Header */}
          <div className="header-section">
            <div className="user-header">
              <button
                onClick={() => router.back()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginRight: '16px',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: '500'
                }}
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <div className="user-avatar">
                <Target size={24} />
              </div>
                        <div className="user-info">
            <div className="user-name">Bet on {targetProfile.username}</div>
            <p>Place a bet on {targetProfile.username}'s portfolio performance</p>
            <p>Current portfolio value: {formatCurrency(portfolioValue)}</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              You are betting as: @{currentUserProfile?.username || 'loading...'}
            </p>
          </div>
            </div>

            <Navigation currentPage="bet" />
          </div>

          {/* Bet Form */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px',
            margin: '40px 32px 20px',
            border: '2px solid var(--border-primary)',
            maxWidth: '1200px',
            marginLeft: '24px',
            marginRight: '24px'
          }}>
            <h2 style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: '700',
              margin: '0 0 30px 0',
              color: 'var(--text-primary)',
              textAlign: 'center'
            }}>
              Portfolio Bet Configuration
            </h2>

            {/* Portfolio Stats Dashboard - Target User's Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '1px',
              background: 'var(--border-primary)',
              marginBottom: '40px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '2px solid var(--border-primary)'
            }}>
              <div style={{
                background: 'var(--bg-card)',
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
                  {formatCurrency(targetProfile?.balance || 0)}
                </p>
                <p style={{
                  fontSize: 'var(--font-size-xs)',
                  margin: '4px 0 0 0',
                  color: 'var(--text-secondary)',
                }}>
                  @{targetProfile?.username || 'user'}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
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
                  {formatCurrency(portfolioValue)}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
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
                  color: (targetProfile?.totalEarnings || 0) - (targetProfile?.totalLosses || 0) >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {(targetProfile?.totalEarnings || 0) - (targetProfile?.totalLosses || 0) >= 0 ? '+' : ''}{formatCurrency((targetProfile?.totalEarnings || 0) - (targetProfile?.totalLosses || 0))}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                padding: '20px',
                textAlign: 'center',
              }}>
                <h3 style={{
                  fontSize: 'var(--font-size-sm)',
                  margin: '0 0 8px 0',
                  color: 'var(--text-secondary)',
                  fontWeight: '400',
                }}>
                  Active Positions
                </h3>
                <p style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: '700',
                  margin: '0',
                  color: 'var(--text-primary)',
                }}>
                  {Object.keys(targetProfile?.portfolio || {}).length}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                padding: '20px',
                textAlign: 'center',
              }}>
                <h3 style={{
                  fontSize: 'var(--font-size-sm)',
                  margin: '0 0 8px 0',
                  color: 'var(--text-secondary)',
                  fontWeight: '400',
                }}>
                  Your Betting Balance
                </h3>
                <p style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: '700',
                  margin: '0',
                  color: 'var(--text-primary)',
                }}>
                  {formatCurrency(currentUserProfile?.balance || 0)}
                </p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
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
                  color: 'var(--text-primary)',
                }}>
                  {MOCK_VOLATILITY}%
                </p>
              </div>
            </div>

            {/* Bet Type Selection */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Bet Direction
              </label>
              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <button
                  onClick={() => setBetForm({ ...betForm, betType: 'increase' })}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    border: '2px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    background: betForm.betType === 'increase' ? 'var(--green)' : 'var(--bg-card)',
                    color: betForm.betType === 'increase' ? 'white' : 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <TrendUp size={20} />
                  Portfolio Increase
                </button>
                <button
                  onClick={() => setBetForm({ ...betForm, betType: 'decrease' })}
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    border: '2px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    background: betForm.betType === 'decrease' ? 'var(--red)' : 'var(--bg-card)',
                    color: betForm.betType === 'decrease' ? 'white' : 'var(--text-primary)',
                    fontWeight: '600',
                    fontSize: 'var(--font-size-base)',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <TrendDown size={20} />
                  Portfolio Decrease
                </button>
              </div>
            </div>

            {/* Target Percentage */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Target Percentage Change
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <input
                  type="range"
                  min="1"
                  max="99"
                  value={betForm.targetPercentage}
                  onChange={(e) => setBetForm({ ...betForm, targetPercentage: parseInt(e.target.value) })}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '4px',
                    background: 'var(--border-primary)',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  minWidth: '60px',
                  padding: '8px 16px',
                  background: 'var(--bg-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  textAlign: 'center'
                }}>
                  {betForm.targetPercentage}%
                </div>
              </div>
            </div>

            {/* Timeframe */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Timeframe ({formatTimeframe(betForm.timeframe)})
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={betForm.timeframe}
                  onChange={(e) => setBetForm({ ...betForm, timeframe: parseInt(e.target.value) })}
                  style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '4px',
                    background: 'var(--border-primary)',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  minWidth: '100px',
                  padding: '8px 16px',
                  background: 'var(--bg-light)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Clock size={16} />
                  {betForm.timeframe}h
                </div>
              </div>
            </div>

            {/* Bet Amount */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--font-size-base)',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Bet Amount
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <CurrencyDollar size={20} color="var(--text-secondary)" />
                <input
                  type="number"
                  min="1"
                  max={currentUserProfile?.balance || 10000}
                  value={betForm.amount}
                  onChange={(e) => setBetForm({ ...betForm, amount: parseFloat(e.target.value) || 0 })}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '2px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--text-primary)',
                    background: 'var(--white)',
                    outline: 'none'
                  }}
                />
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-secondary)'
                }}>
                  Max: {formatCurrency(currentUserProfile?.balance || 0)}
                </div>
              </div>
            </div>

            {/* Bet Summary */}
            <div style={{
              background: 'var(--bg-light)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-secondary)',
              marginBottom: '30px'
            }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '700',
                margin: '0 0 16px 0',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Calculator size={20} />
                Bet Summary
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                fontSize: 'var(--font-size-base)'
              }}>
                <div>
                  <strong>Betting:</strong> {formatCurrency(betForm.amount)}
                </div>
                <div>
                  <strong>Target:</strong> {betForm.betType === 'increase' ? '↗' : '↘'} {betForm.targetPercentage}%
                </div>
                <div>
                  <strong>Timeframe:</strong> {formatTimeframe(betForm.timeframe)}
                </div>
                <div>
                  <strong>Multiplier:</strong> {multiplier.toFixed(2)}x
                </div>
                <div style={{ color: 'var(--green)', fontWeight: '600' }}>
                  <strong>Potential Payout:</strong> {formatCurrency(potentialPayout)}
                </div>
                <div style={{ color: 'var(--green)', fontWeight: '600' }}>
                  <strong>Potential Return:</strong> +{formatCurrency(potentialReturn)}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitBet}
              disabled={submitting || !currentUserProfile || betForm.amount > (currentUserProfile?.balance || 0)}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: 'var(--yellow)',
                color: 'var(--black)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: '700',
                cursor: submitting || !currentUserProfile || betForm.amount > (currentUserProfile?.balance || 0) ? 'not-allowed' : 'pointer',
                opacity: submitting || !currentUserProfile || betForm.amount > (currentUserProfile?.balance || 0) ? 0.5 : 1,
                transition: 'all var(--transition)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Coins size={20} />
              {submitting ? 'Placing Bet...' : 'Place Portfolio Bet'}
            </button>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
} 