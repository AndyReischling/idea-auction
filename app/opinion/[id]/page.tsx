'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { FirebaseDataService } from '../../lib/firebase-data-service';
import { realtimeDataService } from '../../lib/realtime-data-service';
import AuthModal from '../../components/AuthModal';
import styles from './page.module.css';

// Initialize Firebase Data Service
const firebaseDataService = FirebaseDataService.getInstance();

// Types
interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet' | 'short_loss' | 'short_win';
  opinionText: string;
  amount: number;
  price?: number;
  quantity?: number;
  shortId?: string;
  date: string;
}

interface ShortBetSettings {
  betAmount: number;
  targetDropPercentage: number;
  timeLimit: number;
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
  createdDate: string;
  expirationDate: string;
  status: 'active' | 'won' | 'lost';
}

interface OpinionAttribution {
  author: string;
  isBot: boolean;
  dateCreated: string;
  source: 'user' | 'bot_generated';
}

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create' }[];
  liquidityScore: number;
  dailyVolume: number;
  manipulation_protection: {
    rapid_trades: number;
    single_trader_percentage: number;
    last_manipulation_check: string;
  };
}

interface TraderHistoryItem {
  username: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: string;
  isBot: boolean;
}

export default function OpinionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, userProfile: authUserProfile } = useAuth();
  const [opinion, setOpinion] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'Loading...',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(10.00);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [timesPurchased, setTimesPurchased] = useState<number>(0);
  const [timesSold, setTimesSold] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [alreadyOwned, setAlreadyOwned] = useState<boolean>(false);
  const [ownedQuantity, setOwnedQuantity] = useState<number>(0);
  const [attribution, setAttribution] = useState<OpinionAttribution | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Short betting states
  const [showShortModal, setShowShortModal] = useState<boolean>(false);
  const [shortSettings, setShortSettings] = useState<ShortBetSettings>({
    betAmount: 100,
    targetDropPercentage: 25,
    timeLimit: 24
  });
  const [activeShorts, setActiveShorts] = useState<ShortPosition[]>([]);
  const [hasActiveShort, setHasActiveShort] = useState<boolean>(false);
  
  // Trader history modal state
  const [showTraderHistory, setShowTraderHistory] = useState<boolean>(false);
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  
  // Fix hydration by ensuring client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load user profile from Firebase
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.uid) return;
      
      try {
        const profile = await firebaseDataService.getUserProfile(user.uid);
        if (profile) {
          setUserProfile({
            username: profile.username,
            balance: profile.balance,
            joinDate: new Date(profile.joinDate).toLocaleDateString(),
            totalEarnings: profile.totalEarnings,
            totalLosses: profile.totalLosses
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    if (user?.uid) {
      loadUserProfile();
    }
  }, [user?.uid]);

  // UNIVERSAL PRICE CALCULATION - EXACT 0.1% movements
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Get user's purchase price for an opinion
  const getUserPurchasePrice = async (opinionText: string): Promise<number> => {
    if (!user?.uid) return 10.00;
    
    try {
      const portfolio = await firebaseDataService.getUserPortfolio(user.uid);
      if (portfolio && portfolio.ownedOpinions) {
        const ownedAsset = portfolio.ownedOpinions.find((asset: OpinionAsset) => asset.text === opinionText);
        return ownedAsset?.purchasePrice || 10.00;
      }
    } catch (error) {
      console.error('Error getting user purchase price:', error);
    }
    
    return 10.00;
  };

  // Calculate sell price (95% of current market price)
  const calculateSellPrice = (currentPrice: number, userPurchasePrice?: number): number => {
    return Math.round(currentPrice * 0.95 * 100) / 100;
  };

  // Load opinions from Firebase
  const loadOpinions = async () => {
    if (!user?.uid) return;
    
    try {
      const firebaseOpinions = await firebaseDataService.getOpinions(100);
      const mappedOpinions = firebaseOpinions.map((opinion, index) => ({
        id: index.toString(),
        text: opinion.text
      }));
      setOpinions(mappedOpinions);
    } catch (error) {
      console.error('Error loading opinions:', error);
    }
  };

  // Get market data for an opinion
  const getOpinionMarketData = async (opinionText: string): Promise<OpinionMarketData> => {
    if (!user?.uid) {
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00,
        basePrice: 10.00,
        lastUpdated: new Date().toISOString(),
        priceHistory: [],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    }

    try {
      const marketDataList = await firebaseDataService.getMarketData(opinionText);
      const existingData = marketDataList.find(data => data.opinionText === opinionText);
      
      if (existingData) {
        return {
          opinionText,
          timesPurchased: existingData.timesPurchased,
          timesSold: existingData.timesSold,
          currentPrice: existingData.currentPrice,
          basePrice: existingData.basePrice,
          lastUpdated: existingData.lastUpdated.toISOString(),
          priceHistory: existingData.priceHistory || [],
          liquidityScore: Math.min((existingData.timesPurchased + existingData.timesSold) / 20, 1),
          dailyVolume: 0,
          manipulation_protection: {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
      }
      
      // Create new market data
      const newMarketData = {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00,
        basePrice: 10.00,
        lastUpdated: new Date(),
        priceHistory: [{ price: 10.00, timestamp: new Date(), action: 'create' as const }]
      };
      
      await firebaseDataService.updateMarketData(opinionText, newMarketData);
      
      return {
        ...newMarketData,
        lastUpdated: newMarketData.lastUpdated.toISOString(),
        priceHistory: [{ price: 10.00, timestamp: new Date().toISOString(), action: 'create' }],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error getting market data:', error);
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00,
        basePrice: 10.00,
        lastUpdated: new Date().toISOString(),
        priceHistory: [],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    }
  };

  // Update market data
  const updateOpinionMarketData = async (opinionText: string, action: 'buy' | 'sell'): Promise<OpinionMarketData> => {
    if (!user?.uid) {
      return await getOpinionMarketData(opinionText);
    }

    try {
      const currentData = await getOpinionMarketData(opinionText);
      
      const newTimesPurchased = action === 'buy' ? currentData.timesPurchased + 1 : currentData.timesPurchased;
      const newTimesSold = action === 'sell' ? currentData.timesSold + 1 : currentData.timesSold;
      const newPrice = calculatePrice(newTimesPurchased, newTimesSold, currentData.basePrice);
      
      const updatedData = {
        opinionText,
        timesPurchased: newTimesPurchased,
        timesSold: newTimesSold,
        currentPrice: newPrice,
        basePrice: currentData.basePrice,
        lastUpdated: new Date(),
        priceHistory: [
          ...(currentData.priceHistory || []).slice(-19),
          { price: newPrice, timestamp: new Date(), action }
        ]
      };
      
      await firebaseDataService.updateMarketData(opinionText, updatedData);
      
      return {
        ...updatedData,
        lastUpdated: updatedData.lastUpdated.toISOString(),
        priceHistory: updatedData.priceHistory.map(p => ({
          ...p,
          timestamp: p.timestamp instanceof Date ? p.timestamp.toISOString() : p.timestamp
        })),
        liquidityScore: Math.min((newTimesPurchased + newTimesSold) / 20, 1),
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error updating market data:', error);
      return await getOpinionMarketData(opinionText);
    }
  };

  // Load user's owned opinions
  const loadOwnedOpinions = async () => {
    if (!user?.uid) return;
    
    try {
      // FIXED: Use realtimeDataService for unified data access
      const ownedOpinionsArray = await realtimeDataService.getUserPortfolio(user.uid);
      setOwnedOpinions(ownedOpinionsArray);
      
      // Check if user owns the current opinion
      if (opinion) {
        const ownedAsset = ownedOpinionsArray.find((asset: OpinionAsset) => asset.text === opinion);
        if (ownedAsset) {
          setAlreadyOwned(true);
          setOwnedQuantity(ownedAsset.quantity);
        }
      }
    } catch (error) {
      console.error('Error loading owned opinions:', error);
    }
  };

  // Load short positions
  const loadShortPositions = async () => {
    if (!user?.uid) return;
    
    try {
      const shortPositions = await firebaseDataService.getUserShortPositions(user.uid);
      const activeShorts = shortPositions.filter(short => short.status === 'active');
      setActiveShorts(activeShorts);
      
      if (opinion) {
        const hasShort = activeShorts.some(short => short.opinionText === opinion);
        setHasActiveShort(hasShort);
      }
    } catch (error) {
      console.error('Error loading short positions:', error);
    }
  };

  // Purchase opinion
  const purchaseOpinion = async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }

    if (!opinion) return;

    if (userProfile.balance < currentPrice) {
      setMessage('Insufficient funds! Generate more opinions to earn money.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (hasActiveShort) {
      setMessage('❌ Cannot buy shares of an opinion you have shorted! Close your short position first.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    try {
      const purchasePrice = currentPrice;
      const totalCost = purchasePrice;

      // Update market data
      const updatedMarketData = await updateOpinionMarketData(opinion, 'buy');

      // Update user portfolio
      const portfolio = await firebaseDataService.getUserPortfolio(user.uid) || { ownedOpinions: [] };
      
      let updatedOwnedOpinions = [...(portfolio.ownedOpinions || [])];
      
      if (alreadyOwned) {
        updatedOwnedOpinions = updatedOwnedOpinions.map(asset => {
          if (asset.text === opinion) {
            return {
              ...asset,
              quantity: asset.quantity + 1,
              currentPrice: updatedMarketData.currentPrice
            };
          }
          return asset;
        });
        setOwnedQuantity(ownedQuantity + 1);
      } else {
        const newAsset: OpinionAsset = {
          id: Date.now().toString(),
          text: opinion,
          purchasePrice: purchasePrice,
          currentPrice: updatedMarketData.currentPrice,
          purchaseDate: new Date().toLocaleDateString(),
          quantity: 1
        };
        updatedOwnedOpinions.push(newAsset);
        setAlreadyOwned(true);
        setOwnedQuantity(1);
      }

      // Update portfolio in Firebase
      await firebaseDataService.updateUserPortfolio(user.uid, {
        ownedOpinions: updatedOwnedOpinions
      });

      // Create transaction
      await firebaseDataService.createTransaction({
        userId: user.uid,
        type: 'buy',
        opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
        amount: -totalCost,
        price: purchasePrice,
        quantity: 1,
        timestamp: new Date(),
        date: new Date()
      });

      // Update user balance
      await firebaseDataService.updateUserBalance(user.uid, userProfile.balance - totalCost);

      // Add to activity feed
      await firebaseDataService.addActivityFeedItem({
        userId: user.uid,
        type: 'buy',
        username: userProfile.username,
        opinionText: opinion,
        amount: -totalCost,
        quantity: 1,
        timestamp: new Date()
      });

      // Update local state
      setUserProfile(prev => ({
        ...prev,
        balance: prev.balance - totalCost
      }));
      setOwnedOpinions(updatedOwnedOpinions);
      setCurrentPrice(updatedMarketData.currentPrice);
      setSellPrice(calculateSellPrice(updatedMarketData.currentPrice));
      setTimesPurchased(updatedMarketData.timesPurchased);
      
      setMessage(`Successfully purchased! Price: $${purchasePrice.toFixed(2)} → $${updatedMarketData.currentPrice.toFixed(2)}`);
      setTimeout(() => setMessage(''), 7000);
    } catch (error) {
      console.error('Error purchasing opinion:', error);
      setMessage('Error purchasing opinion. Please try again.');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Sell opinion
  const sellOpinion = async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }

    if (!opinion || !alreadyOwned || ownedQuantity === 0) return;

    try {
      const actualSellPrice = calculateSellPrice(currentPrice);
      const totalReceived = actualSellPrice;

      // Update market data
      const updatedMarketData = await updateOpinionMarketData(opinion, 'sell');

      // Update user portfolio
      const portfolio = await firebaseDataService.getUserPortfolio(user.uid);
      let updatedOwnedOpinions = [...(portfolio.ownedOpinions || [])];
      
      updatedOwnedOpinions = updatedOwnedOpinions.map(asset => {
        if (asset.text === opinion) {
          return {
            ...asset,
            quantity: asset.quantity - 1,
            currentPrice: updatedMarketData.currentPrice
          };
        }
        return asset;
      }).filter(asset => asset.quantity > 0);

      // Update portfolio in Firebase
      await firebaseDataService.updateUserPortfolio(user.uid, {
        ownedOpinions: updatedOwnedOpinions
      });

      // Create transaction
      await firebaseDataService.createTransaction({
        userId: user.uid,
        type: 'sell',
        opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
        amount: totalReceived,
        price: actualSellPrice,
        quantity: 1,
        timestamp: new Date(),
        date: new Date()
      });

      // Update user balance and earnings
      await firebaseDataService.updateUserBalance(user.uid, userProfile.balance + totalReceived);
      await firebaseDataService.updateUserEarnings(
        user.uid,
        userProfile.totalEarnings + totalReceived,
        userProfile.totalLosses
      );

      // Add to activity feed
      await firebaseDataService.addActivityFeedItem({
        userId: user.uid,
        type: 'sell',
        username: userProfile.username,
        opinionText: opinion,
        amount: totalReceived,
        quantity: 1,
        timestamp: new Date()
      });

      // Update local state
      const newQuantity = ownedQuantity - 1;
      setOwnedQuantity(newQuantity);
      if (newQuantity === 0) {
        setAlreadyOwned(false);
      }

      setUserProfile(prev => ({
        ...prev,
        balance: prev.balance + totalReceived,
        totalEarnings: prev.totalEarnings + totalReceived
      }));
      setOwnedOpinions(updatedOwnedOpinions);
      setCurrentPrice(updatedMarketData.currentPrice);
      setTimesSold(updatedMarketData.timesSold);
      
      const userPurchasePrice = await getUserPurchasePrice(opinion);
      const profitLoss = actualSellPrice - userPurchasePrice;
      const profitMessage = profitLoss > 0 ? `📈 Profit: +$${profitLoss.toFixed(2)}` : profitLoss < 0 ? `📉 Loss: $${Math.abs(profitLoss).toFixed(2)}` : '📊 Break even';
      
      setMessage(`Sold for $${actualSellPrice.toFixed(2)}! ${profitMessage}`);
      setTimeout(() => setMessage(''), 7000);
    } catch (error) {
      console.error('Error selling opinion:', error);
      setMessage('Error selling opinion. Please try again.');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Calculate short winnings
  const calculateShortWinnings = (betAmount: number, targetDropPercentage: number, timeLimit: number): number => {
    const difficultyMultiplier = Math.pow(targetDropPercentage / 10, 0.7);
    const timeMultiplier = Math.pow(48 / timeLimit, 0.3);
    const baseMultiplier = 1.5;
    const totalMultiplier = baseMultiplier * difficultyMultiplier * timeMultiplier;
    return Math.round(betAmount * totalMultiplier * 100) / 100;
  };

  // Place short bet
  const placeShortBet = async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }

    if (!opinion || userProfile.balance < shortSettings.betAmount) {
      setMessage('Insufficient funds for this bet!');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (hasActiveShort) {
      setMessage('You already have an active short position on this opinion!');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (ownedQuantity > 0) {
      setMessage('Cannot short opinions you currently own. Sell your position first.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    try {
      const targetPrice = Math.round((currentPrice * (1 - shortSettings.targetDropPercentage / 100)) * 100) / 100;
      const potentialWinnings = calculateShortWinnings(
        shortSettings.betAmount,
        shortSettings.targetDropPercentage,
        shortSettings.timeLimit
      );

      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + shortSettings.timeLimit);

      // Create short position in Firebase
      await firebaseDataService.createShortPosition({
        userId: user.uid,
        opinionId: id as string,
        opinionText: opinion,
        betAmount: shortSettings.betAmount,
        targetDropPercentage: shortSettings.targetDropPercentage,
        startingPrice: currentPrice,
        targetPrice,
        potentialWinnings,
        createdDate: new Date(),
        expirationDate: expirationTime,
        status: 'active'
      });

      // Update user balance
      await firebaseDataService.updateUserBalance(user.uid, userProfile.balance - shortSettings.betAmount);

      // Update local state
      setUserProfile(prev => ({
        ...prev,
        balance: prev.balance - shortSettings.betAmount
      }));
      setHasActiveShort(true);
      setShowShortModal(false);

      setMessage(`Short bet placed! Target: $${targetPrice.toFixed(2)} (${shortSettings.targetDropPercentage}% drop). Potential winnings: $${potentialWinnings.toFixed(2)}`);
      setTimeout(() => setMessage(''), 7000);

      // Reload short positions
      await loadShortPositions();
    } catch (error) {
      console.error('Error placing short bet:', error);
      setMessage('Error placing short bet. Please try again.');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Initialize page data
  useEffect(() => {
    if (!isClient || !user?.uid) return;

    const initializeData = async () => {
      try {
        await loadOpinions();
        await loadOwnedOpinions();
        await loadShortPositions();

        if (typeof id === 'string') {
          const idx = parseInt(id, 10);
          if (!isNaN(idx)) {
            const firebaseOpinions = await firebaseDataService.getOpinions(100);
            if (firebaseOpinions[idx]) {
              const currentOpinion = firebaseOpinions[idx].text;
              setOpinion(currentOpinion);

              const marketData = await getOpinionMarketData(currentOpinion);
              setCurrentPrice(marketData.currentPrice);
              setSellPrice(calculateSellPrice(marketData.currentPrice));
              setTimesPurchased(marketData.timesPurchased);
              setTimesSold(marketData.timesSold);

              // Set attribution
              setAttribution({
                author: userProfile.username,
                isBot: false,
                dateCreated: new Date().toLocaleDateString(),
                source: 'user'
              });
            } else {
              setOpinion('Opinion not found.');
            }
          }
        }
      } catch (error) {
        console.error('Error initializing page data:', error);
        setOpinion('Error loading opinion.');
      }
    };

    initializeData();
  }, [id, isClient, user?.uid, userProfile.username]);

  // Require authentication
  if (!isClient) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.authRequired}>
          <h2>Authentication Required</h2>
          <p>Please sign in to view and trade opinions.</p>
          <button onClick={() => setShowAuthModal(true)} className={styles.authButton}>
            Sign In
          </button>
        </div>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Back
        </button>
        <h1>Opinion Trading</h1>
      </div>

      {opinion && (
        <div className={styles.opinionContainer}>
          <div className={styles.opinionText}>
            <h2>{opinion}</h2>
            {attribution && (
              <div className={styles.attribution}>
                <span>by {attribution.author}</span>
                <span className={styles.date}>{attribution.dateCreated}</span>
              </div>
            )}
          </div>

          <div className={styles.marketInfo}>
            <div className={styles.priceInfo}>
              <div className={styles.currentPrice}>
                <span>Current Price</span>
                <span className={styles.price}>${currentPrice.toFixed(2)}</span>
              </div>
              
              {alreadyOwned && (
                <div className={styles.sellPrice}>
                  <span>Sell Price</span>
                  <span className={styles.price}>${sellPrice.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className={styles.marketStats}>
              <div className={styles.stat}>
                <span>Times Purchased</span>
                <span>{timesPurchased}</span>
              </div>
              <div className={styles.stat}>
                <span>Times Sold</span>
                <span>{timesSold}</span>
              </div>
              {alreadyOwned && (
                <div className={styles.stat}>
                  <span>Owned Quantity</span>
                  <span>{ownedQuantity}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button 
              onClick={purchaseOpinion} 
              disabled={userProfile.balance < currentPrice || hasActiveShort}
              className={styles.buyButton}
            >
              Buy for ${currentPrice.toFixed(2)}
            </button>
            
            {alreadyOwned && (
              <button 
                onClick={sellOpinion} 
                className={styles.sellButton}
              >
                Sell for ${sellPrice.toFixed(2)}
              </button>
            )}

            {!alreadyOwned && !hasActiveShort && (
              <button 
                onClick={() => setShowShortModal(true)}
                className={styles.shortButton}
              >
                Short Bet
              </button>
            )}
          </div>

          {message && (
            <div className={styles.message}>
              {message}
            </div>
          )}
        </div>
      )}

      <div className={styles.userInfo}>
        <div className={styles.balance}>
          <span>Balance: ${userProfile.balance.toFixed(2)}</span>
        </div>
        <div className={styles.earnings}>
          <span>Total Earnings: ${userProfile.totalEarnings.toFixed(2)}</span>
          <span>Total Losses: ${userProfile.totalLosses.toFixed(2)}</span>
        </div>
      </div>

      {/* Short Bet Modal */}
      {showShortModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Place Short Bet</h3>
            <div className={styles.shortSettings}>
              <div className={styles.setting}>
                <label>Bet Amount: $</label>
                <input
                  type="number"
                  value={shortSettings.betAmount}
                  onChange={(e) => setShortSettings({
                    ...shortSettings,
                    betAmount: parseFloat(e.target.value) || 0
                  })}
                  min="1"
                  max={userProfile.balance}
                />
              </div>
              <div className={styles.setting}>
                <label>Target Drop %:</label>
                <input
                  type="number"
                  value={shortSettings.targetDropPercentage}
                  onChange={(e) => setShortSettings({
                    ...shortSettings,
                    targetDropPercentage: parseFloat(e.target.value) || 0
                  })}
                  min="5"
                  max="50"
                />
              </div>
              <div className={styles.setting}>
                <label>Time Limit (hours):</label>
                <input
                  type="number"
                  value={shortSettings.timeLimit}
                  onChange={(e) => setShortSettings({
                    ...shortSettings,
                    timeLimit: parseFloat(e.target.value) || 0
                  })}
                  min="1"
                  max="168"
                />
              </div>
            </div>
            <div className={styles.shortPreview}>
              <p>Potential Winnings: ${calculateShortWinnings(shortSettings.betAmount, shortSettings.targetDropPercentage, shortSettings.timeLimit).toFixed(2)}</p>
              <p>Target Price: ${(currentPrice * (1 - shortSettings.targetDropPercentage / 100)).toFixed(2)}</p>
            </div>
            <div className={styles.modalActions}>
              <button onClick={placeShortBet} className={styles.confirmButton}>
                Place Short Bet
              </button>
              <button onClick={() => setShowShortModal(false)} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}