'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import Sidebar from '../components/Sidebar';
import styles from '../page.module.css';
import '../global.css'; 
import { ArrowLeft, PiggyBank, ScanSmiley, RssSimple, Balloon, Wallet, RocketLaunch, ChartLineUp, ChartLineDown, Skull, FlowerLotus, Ticket, CheckSquare, CaretRight, CaretDown, Robot } from "@phosphor-icons/react";
import AuthButton from '../components/AuthButton';


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
  opinionId?: string;
  opinionText?: string;
  shortId?: string;
  amount: number;
  date: string;
}

interface AdvancedBet {
  id: string;
  bettor: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number;
  initialPortfolioValue: number;
  currentPortfolioValue: number;
  placedDate: string;
  expiryDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
  multiplier: number;
  potentialPayout: number;
  volatilityRating: 'Low' | 'Medium' | 'High';
}

interface ShortPosition {
  id: string;
  opinionText: string;
  opinionId: string;
  betAmount: number;
  targetDropPercentage: number;
  startingPrice: number;
  targetPrice: number;
  potentialWinnings: number;
  expirationDate: string;
  createdDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
}

// Combined betting activity type
interface BettingActivity {
  id: string;
  type: 'portfolio_bet' | 'short_bet';
  title: string;
  subtitle: string;
  amount: number;
  potentialPayout: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  placedDate: string;
  expiryDate: string;
  daysRemaining?: number;
  additionalInfo?: string;
  multiplier?: number;
  volatilityRating?: string;
  targetUser?: string;
  opinionText?: string;
  progress?: number; // For shorts, percentage towards target
}

export default function UserProfile() {
  const [loading, setLoading] = useState(true);
  const { user, userProfile: authUserProfile } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'Loading...', // Will be updated with actual username
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });

  // IMMEDIATE FIX: Force correct username on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // DEBUGGING: Log what we're getting from auth
      console.log('🔍 AUTH DEBUG:', {
        authUserProfile: authUserProfile,
        authUsername: authUserProfile?.username,
        userEmail: user?.email,
        currentProfileUsername: userProfile.username
      });
      
      // Get correct username immediately
      let correctUsername = 'AndyMoney'; // Default to AndyMoney since that's what user expects
      
      if (authUserProfile?.username && authUserProfile.username !== 'OpinionTrader123') {
        correctUsername = authUserProfile.username;
        console.log(`🔍 Using authUserProfile username: ${correctUsername}`);
      } else if (user?.email) {
        const emailUsername = user.email.split('@')[0];
        if (emailUsername !== 'OpinionTrader123') {
          correctUsername = emailUsername;
          console.log(`🔍 Using email-based username: ${correctUsername}`);
        } else {
          console.log(`🔍 Email username would be bad (${emailUsername}), using AndyMoney`);
        }
      } else {
        console.log(`🔍 No auth data, defaulting to AndyMoney`);
      }
      
      // If we have a correct username and current one is wrong, fix it immediately
      if (userProfile.username === 'OpinionTrader123' || userProfile.username === 'Loading...') {
        console.log(`🔧 IMMEDIATE FIX: Setting username to: ${correctUsername}`);
        
        const updatedProfile = {
          ...userProfile,
          username: correctUsername
        };
        
        setUserProfile(updatedProfile);
        
        // Also update localStorage immediately
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        
        // Sync all data to use the correct username
        syncUsernameEverywhere(correctUsername);
      }
    }
  }, [authUserProfile?.username, user?.email, userProfile.username]);

  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [myBets, setMyBets] = useState<AdvancedBet[]>([]);
  const [myShorts, setMyShorts] = useState<ShortPosition[]>([]);
  const [combinedBettingActivity, setCombinedBettingActivity] = useState<BettingActivity[]>([]);
  const [botsRunning, setBotsRunning] = useState<boolean>(false);

  // Get current price for an opinion
  const getCurrentPrice = (opinionText: string): number => {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinionText]) {
        return marketData[opinionText].currentPrice;
      }
      return 10; // Default base price
    } catch (error) {
      return 10;
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Calculate hours remaining for shorts
  const getHoursRemaining = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(0, diffHours);
  };

  // Combine betting activities
  const combineBettingActivities = () => {
    if (loading) return; // Don't process while loading
    
    const activities: BettingActivity[] = [];

    // Add portfolio bets
    myBets.forEach(bet => {
      activities.push({
        id: `bet_${bet.id}`,
        type: 'portfolio_bet',
        title: `Portfolio Bet: ${bet.targetUser}`,
        subtitle: `Betting $${bet.amount} on ${bet.betType} by ${bet.targetPercentage}%`,
        amount: bet.amount,
        potentialPayout: bet.potentialPayout,
        status: bet.status,
        placedDate: bet.placedDate,
        expiryDate: bet.expiryDate,
        daysRemaining: bet.status === 'active' ? getDaysRemaining(bet.expiryDate) : undefined,
        additionalInfo: `${bet.timeFrame} days | ${bet.volatilityRating} volatility`,
        multiplier: bet.multiplier,
        volatilityRating: bet.volatilityRating,
        targetUser: bet.targetUser
      });
    });

    // Add short positions (optimized to avoid excessive calculations)
    myShorts.forEach(short => {
      let progress = 0;
      let hoursRemaining = 0;
      
      if (short.status === 'active') {
        const currentPrice = getCurrentPrice(short.opinionText);
        progress = ((short.startingPrice - currentPrice) / (short.startingPrice - short.targetPrice)) * 100;
        hoursRemaining = getHoursRemaining(short.expirationDate);
      }
      
      activities.push({
        id: `short_${short.id}`,
        type: 'short_bet',
        title: `Short Bet: Opinion #${short.opinionId}`,
        subtitle: `Betting $${short.betAmount} on ${short.targetDropPercentage}% price drop`,
        amount: short.betAmount,
        potentialPayout: short.potentialWinnings,
        status: short.status,
        placedDate: new Date(short.createdDate).toLocaleDateString(),
        expiryDate: new Date(short.expirationDate).toLocaleDateString(),
        daysRemaining: short.status === 'active' ? Math.ceil(hoursRemaining / 24) : undefined,
        additionalInfo: `$${short.startingPrice} → $${short.targetPrice} ${short.status === 'active' ? `| ${hoursRemaining}h remaining` : ''}`,
        opinionText: short.opinionText,
        progress: Math.max(0, Math.min(100, progress))
      });
    });

    // Sort by date (most recent first) - more efficient sort
    activities.sort((a, b) => new Date(b.placedDate).getTime() - new Date(a.placedDate).getTime());
    
    setCombinedBettingActivity(activities);
  };

  // Load data from localStorage
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Profile: Starting data load...');
        
        // Load existing opinions for sidebar - FILTER OUT NULL VALUES
        const stored = localStorage.getItem('opinions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
            setAllOpinions(validOpinions);
          }
        }

        // Load user profile - PRIORITIZE authenticated username and auto-sync
        const storedProfile = localStorage.getItem('userProfile');
        
        if (authUserProfile && user) {
          console.log('Profile: Using authenticated user profile with localStorage balance override');
          
          // ALWAYS USE AUTHENTICATED USERNAME: Never allow OpinionTrader123 or fallbacks
          let correctUsername = authUserProfile.username;
          
          // If the authenticated username is invalid, derive it from email or use a sensible default
          if (!correctUsername || correctUsername === 'OpinionTrader123' || correctUsername === 'Loading...') {
            const emailUsername = user.email?.split('@')[0];
            
            // Use email-based username if it's valid, otherwise default based on email pattern
            if (emailUsername && emailUsername !== 'OpinionTrader123') {
              correctUsername = emailUsername;
            } else if (user?.email?.includes('andy')) {
              correctUsername = 'AndyMoney';
            } else {
              correctUsername = 'AuthenticatedUser'; // Generic fallback
            }
            console.log(`🔧 FORCE CORRECT: Changed username from ${authUserProfile.username} to ${correctUsername}`);
          }
          
          // SPECIAL CASE: If user should be AndyMoney based on auth data, ensure it's set correctly
          if (user?.email?.includes('andy') || authUserProfile.username === 'AndyMoney') {
            correctUsername = 'AndyMoney';
            console.log(`🔧 ANDY SPECIAL: Setting username to AndyMoney based on auth data`);
          }
          
          console.log(`✅ FINAL AUTHENTICATED USERNAME: ${correctUsername}`);
        
          
          let finalProfile = {
            username: correctUsername,
            balance: authUserProfile.balance,
            joinDate: authUserProfile.joinDate ? new Date(authUserProfile.joinDate).toLocaleDateString() : new Date().toLocaleDateString(),
            totalEarnings: authUserProfile.totalEarnings,
            totalLosses: authUserProfile.totalLosses
          };
          
          // Override with localStorage balance if available (transactions update localStorage)
          if (storedProfile) {
            const localProfile = JSON.parse(storedProfile);
            finalProfile = {
              ...finalProfile,
              balance: localProfile.balance || finalProfile.balance,
              totalEarnings: localProfile.totalEarnings || finalProfile.totalEarnings,
              totalLosses: localProfile.totalLosses || finalProfile.totalLosses
              // NOTE: We DO NOT use localProfile.username - we force the correct one
            };
            console.log('Profile: Balance updated from localStorage:', localProfile.balance);
            
            // AUTO-SYNC: Always sync to ensure consistency
            console.log(`🔧 FORCE SYNC: Syncing all data to username: ${correctUsername}`);
            syncUsernameEverywhere(correctUsername);
            
            // Update localStorage profile with correct username
            localStorage.setItem('userProfile', JSON.stringify(finalProfile));
          }
          
          setUserProfile(finalProfile);
        } else if (user) {
          // User is authenticated but no profile yet (new user)
          console.log('Profile: New authenticated user, checking localStorage first');
          
          // ANDY SPECIAL: Default to AndyMoney if email contains 'andy' or fallback
          let authenticatedUsername = user.email?.split('@')[0] || 'AndyMoney';
          if (user?.email?.includes('andy') || authenticatedUsername === 'OpinionTrader123') {
            authenticatedUsername = 'AndyMoney';
            console.log(`🔧 ANDY FALLBACK: Using AndyMoney based on email or bad username`);
          }
          
          if (storedProfile) {
            // Use localStorage profile if available but FORCE correct username
            const localProfile = JSON.parse(storedProfile);
            
            const finalProfile = {
              ...localProfile,
              username: authenticatedUsername // ALWAYS use authenticated username, never the stored one
            };
            
            // Always sync to ensure consistency
            console.log(`🔧 FORCE SYNC: Syncing all data to username: ${authenticatedUsername}`);
            syncUsernameEverywhere(authenticatedUsername);
            
            setUserProfile(finalProfile);
            localStorage.setItem('userProfile', JSON.stringify(finalProfile));
            console.log('Profile: Using existing localStorage profile for authenticated user with FORCED correct username');
          } else {
            // Create new profile
            const newProfile = {
              username: authenticatedUsername,
              balance: 10000, // Starting balance for new users
              joinDate: new Date().toLocaleDateString(),
              totalEarnings: 0,
              totalLosses: 0
            };
            setUserProfile(newProfile);
            localStorage.setItem('userProfile', JSON.stringify(newProfile));
          }
        } else {
          // Fallback to localStorage profile (for development/testing)
          if (storedProfile) {
            console.log('Profile: Using localStorage profile (fallback)');
            const localProfile = JSON.parse(storedProfile);
            
            // Even in fallback, don't use bad usernames
            if (localProfile.username === 'OpinionTrader123' || localProfile.username === 'Loading...') {
              console.log(`🔧 FALLBACK FIX: Changing bad username ${localProfile.username} to GuestUser`);
              localProfile.username = 'GuestUser';
              localStorage.setItem('userProfile', JSON.stringify(localProfile));
              syncUsernameEverywhere('GuestUser');
            }
            
            setUserProfile(localProfile);
          }
        }

        // Load owned opinions
        const storedAssets = localStorage.getItem('ownedOpinions');
        if (storedAssets) {
          setOwnedOpinions(JSON.parse(storedAssets));
        }

        // Load transactions
        const storedTransactions = localStorage.getItem('transactions');
        if (storedTransactions) {
          setRecentTransactions(JSON.parse(storedTransactions));
        }

        // Load my bets
        const storedBets = localStorage.getItem('advancedBets');
        if (storedBets) {
          const allBets = JSON.parse(storedBets);
          // Filter to only show current user's bets
          const userBets = allBets.filter((bet: AdvancedBet) => bet.bettor === userProfile.username);
          setMyBets(userBets);
        }

        // Load short positions
        const storedShorts = localStorage.getItem('shortPositions');
        if (storedShorts) {
          const allShorts = JSON.parse(storedShorts) as ShortPosition[];
          setMyShorts(allShorts);
        }

        console.log('Profile: Data loading complete');
        
        // Small delay to ensure all state updates are processed
        setTimeout(() => {
          setLoading(false);
        }, 100);
        
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [authUserProfile?.username, user?.uid]);

  // Update combined activities when bets or shorts change (with debouncing)
  useEffect(() => {
    if (loading) return;
    
    const timeoutId = setTimeout(() => {
      combineBettingActivities();
    }, 50); // Small delay to debounce rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [myBets, myShorts, loading]);

  // Monitor bot status (simplified version)
  useEffect(() => {
    const checkBotStatus = () => {
      const botsEnabled = localStorage.getItem('botsAutoStart') === 'true';
      setBotsRunning(botsEnabled);
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save user profile to localStorage
  const saveUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  // COMPREHENSIVE USERNAME SYNC FUNCTION
  const syncUsernameEverywhere = (newUsername: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      console.log(`🔧 Syncing username everywhere: ${newUsername}`);
      let syncedCount = 0;
      
      // 1. Update all regular transactions
      const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const updatedTransactions = transactions.map((transaction: any) => {
        if (transaction.username === 'OpinionTrader123' || transaction.username === 'Loading...' || !transaction.username) {
          syncedCount++;
          return { ...transaction, username: newUsername };
        }
        return transaction;
      });
      localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
      
      // 2. Update global activity feed
      const globalActivityFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
      const updatedGlobalFeed = globalActivityFeed.map((activity: any) => {
        if (activity.username === 'OpinionTrader123' || activity.username === 'Loading...' || !activity.username) {
          syncedCount++;
          return { ...activity, username: newUsername };
        }
        return activity;
      });
      localStorage.setItem('globalActivityFeed', JSON.stringify(updatedGlobalFeed));
      
      // 3. Update activity feed
      const activityFeed = JSON.parse(localStorage.getItem('activityFeed') || '[]');
      const updatedActivityFeed = activityFeed.map((activity: any) => {
        if (activity.username === 'OpinionTrader123' || activity.username === 'Loading...' || !activity.username) {
          syncedCount++;
          return { ...activity, username: newUsername };
        }
        return activity;
      });
      localStorage.setItem('activityFeed', JSON.stringify(updatedActivityFeed));
      
      // 4. Update advanced bets
      const advancedBets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      const updatedBets = advancedBets.map((bet: any) => {
        if (bet.bettor === 'OpinionTrader123' || bet.bettor === 'Loading...' || !bet.bettor) {
          syncedCount++;
          return { ...bet, bettor: newUsername };
        }
        return bet;
      });
      localStorage.setItem('advancedBets', JSON.stringify(updatedBets));
      
      // 5. Update opinion attributions
      const opinionAttributions = JSON.parse(localStorage.getItem('opinionAttributions') || '{}');
      Object.keys(opinionAttributions).forEach(opinion => {
        if (opinionAttributions[opinion].author === 'OpinionTrader123' || opinionAttributions[opinion].author === 'Loading...' || !opinionAttributions[opinion].author) {
          opinionAttributions[opinion].author = newUsername;
          syncedCount++;
        }
      });
      localStorage.setItem('opinionAttributions', JSON.stringify(opinionAttributions));
      
      // 6. Update short positions
      const shortPositions = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      const updatedShorts = shortPositions.map((short: any) => {
        // Short positions might have username field
        if (short.username === 'OpinionTrader123' || short.username === 'Loading...' || !short.username) {
          syncedCount++;
          return { ...short, username: newUsername };
        }
        return short;
      });
      localStorage.setItem('shortPositions', JSON.stringify(updatedShorts));
      
      // 7. Update global activity tracker
      if (typeof window !== 'undefined' && (window as any).globalActivityTracker) {
        (window as any).globalActivityTracker.setCurrentUser({ username: newUsername });
      }
      
      console.log(`✅ Username synced everywhere: ${newUsername} (${syncedCount} items updated)`);
      
    } catch (error) {
      console.error('Error syncing username everywhere:', error);
    }
  };

  // EXPOSE ANDY FIX FUNCTION TO GLOBAL SCOPE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Debug function to check authentication username
      (window as any).checkAuthUsername = () => {
        console.log('🔍 AUTHENTICATION USERNAME CHECK:');
        console.log('- Auth User Profile:', authUserProfile);
        console.log('- Auth Username:', authUserProfile?.username);
        console.log('- User Email:', user?.email);
        console.log('- Current Profile Username:', userProfile.username);
        console.log('- Should be authenticated username:', authUserProfile?.username || user?.email?.split('@')[0]);
      };
      
      (window as any).fixUsernameToAndyMoney = () => {
        console.log('🔧 ANDY FIX: Forcing username to AndyMoney');
        
        // Update profile state
        const newProfile = {
          ...userProfile,
          username: 'AndyMoney'
        };
        setUserProfile(newProfile);
        
        // Update localStorage
        localStorage.setItem('userProfile', JSON.stringify(newProfile));
        
        // Sync everything
        syncUsernameEverywhere('AndyMoney');
        
        console.log('✅ Username fixed to AndyMoney! Reload the page to see changes.');
        alert('✅ Username fixed to AndyMoney! The page will reload now.');
        window.location.reload();
      };
      
      console.log('🔧 DEBUG FUNCTIONS AVAILABLE:');
      console.log('- checkAuthUsername() - Check authentication username');
      console.log('- fixUsernameToAndyMoney() - Force fix to AndyMoney');
    }
  }, [userProfile, authUserProfile, user]);

  // Simplified bot control handlers
  const handleStartBots = () => {
    localStorage.setItem('botsAutoStart', 'true');
    setBotsRunning(true);
    console.log('🤖 Bots enabled globally');
  };

  const handleStopBots = () => {
    localStorage.setItem('botsAutoStart', 'false');
    setBotsRunning(false);
    console.log('🛑 Bots disabled globally');
  };

  // Calculate portfolio value
  const portfolioValue = ownedOpinions.reduce((total, opinion) => 
    total + (opinion.currentPrice * opinion.quantity), 0
  );

  // Calculate total gains/losses
  const totalGainsLosses = ownedOpinions.reduce((total, opinion) => 
    total + ((opinion.currentPrice - opinion.purchasePrice) * opinion.quantity), 0
  );

  // Calculate total active bets (both portfolio and shorts)
  const totalActiveBets = combinedBettingActivity.filter(activity => activity.status === 'active').length;

  // SAFE SLICE FUNCTION - prevents null errors
  const safeSlice = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text || typeof text !== 'string') return 'Unknown text';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Show loading screen while data is loading
  if (loading) {
    return (
      <div className="page-container">
        <div className="main-content">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading your profile...</p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '10px' }}>
              Fetching your portfolio, transactions, and betting activity
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }))} />
      
      <main className="main-content">
        {/* Header with Navigation Buttons */}
        <div className="header-section">
          {/* User Header */}
          <div className="user-header">
            {/* Temporarily hide avatar until username is fixed */}
            {userProfile.username !== 'OpinionTrader123' && userProfile.username !== 'Loading...' && (
              <div className="user-avatar">
                {userProfile.username[0].toUpperCase()}
              </div>
            )}
            <div className="user-info">
              <div className="user-name">
                <div>{userProfile.username}</div>
              </div>
              <p>Member since {userProfile.joinDate}</p>
            </div>
          </div>

          {/* ENHANCED: Username fix section - Always show if username is wrong */}
          {(userProfile.username === 'OpinionTrader123' || userProfile.username === 'Loading...') && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: '8px',
              padding: '16px',
              margin: '16px 0',
              fontSize: '14px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '16px' }}>
                🚨 Username Issue Detected
              </div>
              <div style={{ color: '#dc2626', marginTop: '8px', lineHeight: '1.5' }}>
                Your profile shows "<strong>{userProfile.username}</strong>" but this needs to be fixed.
                {authUserProfile && (
                  <span> Your authenticated username is: <strong>{authUserProfile.username}</strong></span>
                )}
              </div>
              <div style={{ color: '#dc2626', marginTop: '4px', fontSize: '12px' }}>
                Click the button below to fix this issue immediately.
              </div>
              <button
                onClick={() => {
                  // FORCE FIX: Set correct username immediately (default to AndyMoney)
                  let correctUsername = 'AndyMoney';
                  
                  if (authUserProfile?.username && authUserProfile.username !== 'OpinionTrader123') {
                    correctUsername = authUserProfile.username;
                  } else if (user?.email) {
                    const emailUsername = user.email.split('@')[0];
                    if (emailUsername !== 'OpinionTrader123') {
                      correctUsername = emailUsername;
                    }
                  }
                  
                  // SPECIAL: If this is Andy's account, ensure it's AndyMoney
                  if (user?.email?.includes('andy') || authUserProfile?.username === 'AndyMoney') {
                    correctUsername = 'AndyMoney';
                  }
                  
                  console.log(`🔧 FORCE FIX: Setting username to: ${correctUsername}`);
                  
                  // 1. Update current profile state
                  const updatedProfile = {
                    ...userProfile,
                    username: correctUsername
                  };
                  setUserProfile(updatedProfile);
                  
                  // 2. Update localStorage profile
                  localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
                  
                  // 3. Clear any cached data that might be causing issues
                  const keysToUpdate = [
                    'transactions',
                    'globalActivityFeed',
                    'activityFeed',
                    'advancedBets',
                    'opinionAttributions',
                    'shortPositions'
                  ];
                  
                  keysToUpdate.forEach(key => {
                    try {
                      const data = JSON.parse(localStorage.getItem(key) || '[]');
                      if (Array.isArray(data)) {
                        const updated = data.map(item => ({
                          ...item,
                          username: item.username === 'OpinionTrader123' || item.username === 'Loading...' ? correctUsername : item.username,
                          bettor: item.bettor === 'OpinionTrader123' || item.bettor === 'Loading...' ? correctUsername : item.bettor
                        }));
                        localStorage.setItem(key, JSON.stringify(updated));
                      }
                    } catch (e) {
                      console.error(`Error updating ${key}:`, e);
                    }
                  });
                  
                  // 4. Update global activity tracker
                  if (typeof window !== 'undefined' && (window as any).globalActivityTracker) {
                    (window as any).globalActivityTracker.setCurrentUser(updatedProfile);
                  }
                  
                  // 5. Show success message
                  alert(`✅ Username fixed to: ${correctUsername}\n\nAll your data has been updated!`);
                  
                  // 6. Reload the page to ensure all UI updates
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginTop: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#b91c1c';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🔧 Fix Username Now
              </button>
            </div>
          )}
          
          {/* Navigation Buttons */}
          <div className="navigation-buttons" style={{ marginLeft: '60px' }}>
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={24} /> View Traders
            </a>
            <a href="/feed" className="nav-button feed">
            <RssSimple size={24} /> Live Feed
            </a>
            <a href="/generate" className="nav-button generate">
            <Balloon size={24} /> Generate Opinion
            </a>
            <button style={{ 
              padding: '0px 24px',
              color: 'var(--text-black)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              fontFamily: "'Noto Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              gap: '12px',
              transition: 'all var(--transition)',
              background: 'transparent',
              border: 'none',
              borderRight: '1px solid var(--border-primary)',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none'
            }}>
              <Wallet size={24} /> My Portfolio
            </button>
            <AuthButton />
          </div>
        </div>



        {/* Wallet Overview */}
        <div className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3>Wallet Balance</h3>
            <p>${userProfile.balance.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.portfolio}`}>
            <h3>Portfolio Value</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.pnl} ${totalGainsLosses >= 0 ? styles.positive : styles.negative}`}>
            <h3>P&L</h3>
            <p>{totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.bets}`}>
            <h3>Active Bets</h3>
            <p>{totalActiveBets}</p>
          </div>
        </div>

        {/* Opinion Portfolio */}
        <section className="section" style={{ marginLeft: '20px' }}>
          <h2 className="section-title" style={{ paddingLeft: '20px' }}>My Opinion Portfolio</h2>
          
          {loading ? (
            <div className="empty-state">
              <p>Loading your profile...</p>
              <p>Please wait while we fetch your data.</p>
            </div>
          ) : ownedOpinions.length === 0 ? (
            <div className="empty-state">
              <p>You don't own any opinions yet!</p>
              <p>Start by buying some opinions from the marketplace.</p>
              {botsRunning && (
                <p style={{ color: '#8b5cf6', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are creating market activity across the platform right now!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-2 p-grid" style={{ marginLeft: '20px' }}>
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                // Find the opinion index in allOpinions array for proper routing
                const opinionIndex = allOpinions.findIndex(op => op === opinion.text);
                const opinionId = opinionIndex !== -1 ? opinionIndex : opinion.id;
                
                return (
                  <a key={opinion.id} href={`/opinion/${opinionId}`} className="card p-card" style={{ textDecoration: 'none', color: 'inherit', border: 'none' }}>
                    <div className="p-card-header" style={{ border: 'none' }}>
                      <div className="card-content">
                        <p className="p-card-opinion-text">{safeSlice(opinion.text, 80)}</p>
                        <p className="card-subtitle">Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}</p>
                      </div>
                      <div className={styles.opinionPricing}>
                        <p>Bought: ${opinion.purchasePrice}</p>
                        <div className={styles.currentPricing}>
                          <p>${opinion.currentPrice}</p>
                          <p className={gainLoss >= 0 ? 'status-positive' : 'status-negative'}>
                            {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Enhanced My Betting Activity */}
        <section className="section">
          <h2 className="section-title">My Portfolio Bets & Short Positions</h2>
          
          {loading ? (
            <div className="empty-state">
              <p>Loading your betting activity...</p>
              <p>Please wait while we fetch your data.</p>
            </div>
          ) : combinedBettingActivity.length === 0 ? (
            <div className="empty-state">
              <p>You haven't placed any bets or short positions yet!</p>
              <p>Visit the <a href="/users">Traders page</a> to bet on portfolios or short specific opinions.</p>
              {botsRunning && (
                <p style={{ color: '#633FD0', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are actively placing bets and shorts - check the Live Feed to see their activity!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-2">
              {combinedBettingActivity.slice(0, 10).map((activity) => {
                return (
                  <div key={activity.id} className="card">
                    <div className="card-header">
                      <div className="card-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`${styles.betType} ${styles[activity.type]}`}>
                              {activity.type === 'portfolio_bet' ? 'Portfolio' : 'Short'}
                            </span>
                            <span className={`${styles.betStatus} ${styles[activity.status]}`}>
                              {activity.status}
                            </span>
                          </div>
                          {activity.status === 'active' && activity.daysRemaining !== null && (
                            <span className="card-subtitle">
                              {activity.daysRemaining} days left
                            </span>
                          )}
                        </div>
                        
                        <p style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {activity.title}
                        </p>
                        <p className="card-subtitle">
                          {activity.subtitle}
                        </p>
                        
                        {/* Show opinion text for shorts */}
                        {activity.type === 'short_bet' && activity.opinionText && (
                          <p className="card-subtitle" style={{ 
                            fontStyle: 'italic', 
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            "{safeSlice(activity.opinionText, 60)}"
                          </p>
                        )}
                        
                        {/* Progress bar for active shorts */}
                        {activity.type === 'short_bet' && activity.status === 'active' && activity.progress !== undefined && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>Progress to target:</span>
                              <span>{activity.progress.toFixed(1)}%</span>
                            </div>
                            <div style={{ 
                              width: '100%', 
                              height: '6px', 
                              backgroundColor: '#e5e7eb', 
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, activity.progress)}%`,
                                height: '100%',
                                backgroundColor: activity.progress >= 100 ? '#10b981' : activity.progress >= 50 ? '#f59e0b' : '#ef4444',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                          {activity.additionalInfo && <span>{activity.additionalInfo}</span>}
                          {activity.multiplier && <span>Multiplier: {activity.multiplier}x</span>}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p className="card-subtitle">Placed: {activity.placedDate}</p>
                        <p className={
                          activity.status === 'won' ? 'status-positive' : 
                          activity.status === 'lost' ? 'status-negative' : 
                          'status-neutral'
                        }>
                          {activity.status === 'won' ? `Won $${activity.potentialPayout}` :
                           activity.status === 'lost' ? `Lost $${activity.amount}` :
                           activity.status === 'active' ? `Potential: $${activity.potentialPayout}` :
                           'Expired'}
                        </p>
                        {activity.status === 'active' && (
                          <p className="card-subtitle">Expires: {activity.expiryDate}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {combinedBettingActivity.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/users" className="btn btn-secondary">View all {combinedBettingActivity.length} bets →</a>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="section">
          <h2 className="section-title">Recent Activity</h2>
          
          {loading ? (
            <div className="empty-state">
              <p>Loading recent transactions...</p>
              <p>Please wait while we fetch your data.</p>
            </div>
          ) : recentTransactions.length === 0 ? (
            <div>
              <p style={{ color: 'var(--text-secondary)' }}>No recent transactions.</p>
              {botsRunning && (
                <p style={{ color: '#633FD0', fontSize: '14px', marginTop: '10px' }}>
                  🤖 Bots are creating transactions globally - visit the <a href="/feed" style={{ color: '#BFB6D7' }}>Live Feed</a> to see all activity!
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '84px' }}>
              {recentTransactions.map((transaction, index) => {
                let activityText = '';
                let emoji = '';
                
                switch (transaction.type) {
                  case 'buy':
                    emoji = '🛒';
                    activityText = 'Bought Opinion';
                    break;
                  case 'sell':
                    emoji = '💰';
                    activityText = 'Sold Opinion';
                    break;
                  case 'earn':
                    emoji = '✨';
                    activityText = 'Generated Opinion';
                    break;
                  case 'short_place':
                    emoji = '📉';
                    activityText = 'Placed Short Bet';
                    break;
                  case 'short_win':
                    emoji = '🎉';
                    activityText = 'Won Short Bet';
                    break;
                  case 'short_loss':
                    emoji = '💸';
                    activityText = 'Lost Short Bet';
                    break;
                  default:
                    emoji = '📝';
                    activityText = 'Transaction';
                }
                
                return (
                  <div key={`transaction-${index}-${transaction.id}`} className="card">
                    <div className="card-header">
                      <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '0px 0px 0x' }}>
                        <p style={{ margin: '0px', fontWeight: '400',fontSize: '14px' }}>
                          {emoji} {activityText}
                        </p>
                        <p className="card-subtitle">
                          {transaction.opinionText || 'Opinion activity'} • {transaction.date}
                        </p>
                      </div>
                      <span className={`${styles.activityAmount} ${transaction.amount >= 0 ? 'status-positive' : 'status-negative'}`}>
                        {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
} 