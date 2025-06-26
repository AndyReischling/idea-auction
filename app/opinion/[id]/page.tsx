'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

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
  type: 'buy' | 'sell' | 'earn';
  opinionId?: string;
  opinionText?: string;
  amount: number;
  date: string;
}

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' }[];
}

export default function OpinionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [opinion, setOpinion] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000,
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(10);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [timesPurchased, setTimesPurchased] = useState<number>(0);
  const [timesSold, setTimesSold] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [alreadyOwned, setAlreadyOwned] = useState<boolean>(false);
  const [ownedQuantity, setOwnedQuantity] = useState<number>(0);

  // Enhanced pricing algorithm
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10, volatility: number = 1): number => {
    // Net demand = purchases - sales
    const netDemand = timesPurchased - timesSold;
    
    // Exponential growth for high demand, decay for negative demand
    let priceMultiplier;
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.15, netDemand) * volatility;
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.9, Math.abs(netDemand))) * volatility;
    }
    
    // Minimum price floor
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    return Math.round(calculatedPrice);
  };

  // Calculate sell price (typically 85-95% of current market price based on liquidity)
  const calculateSellPrice = (currentPrice: number, timesPurchased: number): number => {
    // Higher liquidity (more purchases) = better sell price
    const liquidityBonus = Math.min(0.1, timesPurchased * 0.01);
    const sellRatio = 0.85 + liquidityBonus; // 85% base + up to 10% liquidity bonus
    
    return Math.round(currentPrice * sellRatio);
  };

  // Calculate opinion volatility based on content
  const calculateVolatility = (opinionText: string): number => {
    const text = opinionText.toLowerCase();
    let volatility = 1.0;
    
    // High volatility keywords
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('stock')) volatility += 0.5;
    if (text.includes('controversial') || text.includes('hot take') || text.includes('unpopular')) volatility += 0.3;
    if (text.includes('prediction') || text.includes('will') || text.includes('future')) volatility += 0.2;
    if (text.includes('politics') || text.includes('election')) volatility += 0.4;
    
    // Low volatility keywords
    if (text.includes('safe') || text.includes('boring') || text.includes('obvious')) volatility -= 0.2;
    if (text.includes('traditional') || text.includes('conservative')) volatility -= 0.1;
    
    return Math.max(0.5, Math.min(2.0, volatility));
  };

  // Get market data for an opinion
  const getOpinionMarketData = (opinionText: string): OpinionMarketData => {
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    
    if (marketData[opinionText]) {
      return marketData[opinionText];
    } else {
      const basePrice = 10;
      const volatility = calculateVolatility(opinionText);
      
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: basePrice,
        basePrice,
        volatility,
        lastUpdated: new Date().toISOString(),
        priceHistory: []
      };
    }
  };

  // Update market data for an opinion
  const updateOpinionMarketData = (opinionText: string, action: 'buy' | 'sell'): OpinionMarketData => {
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    const currentData = getOpinionMarketData(opinionText);
    
    const newTimesPurchased = action === 'buy' ? currentData.timesPurchased + 1 : currentData.timesPurchased;
    const newTimesSold = action === 'sell' ? currentData.timesSold + 1 : currentData.timesSold;
    const newPrice = calculatePrice(newTimesPurchased, newTimesSold, currentData.basePrice, currentData.volatility);
    
    const updatedData: OpinionMarketData = {
      ...currentData,
      timesPurchased: newTimesPurchased,
      timesSold: newTimesSold,
      currentPrice: newPrice,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        ...currentData.priceHistory.slice(-19), // Keep last 20 entries
        { price: newPrice, timestamp: new Date().toISOString(), action }
      ]
    };
    
    marketData[opinionText] = updatedData;
    localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
    
    return updatedData;
  };

  // Update all owned opinions with new market prices
  const updateOwnedOpinionPrices = () => {
    const storedAssets = localStorage.getItem('ownedOpinions');
    if (!storedAssets) return;
    
    const owned = JSON.parse(storedAssets);
    const updatedOwned = owned.map((asset: OpinionAsset) => {
      const marketData = getOpinionMarketData(asset.text);
      return {
        ...asset,
        currentPrice: marketData.currentPrice
      };
    });
    
    setOwnedOpinions(updatedOwned);
    localStorage.setItem('ownedOpinions', JSON.stringify(updatedOwned));
  };

  useEffect(() => {
    if (typeof id !== 'string') {
      setOpinion('Opinion not found.');
      return;
    }

    try {
      const stored = localStorage.getItem('opinions');
      if (!stored) {
        setOpinion('Opinion not found.');
        setOpinions([]);
        return;
      }

      const all = JSON.parse(stored);
      const mappedOpinions = all.map((text: string, i: number) => ({
        id: i.toString(),
        text,
      }));
      setOpinions(mappedOpinions);

      const idx = parseInt(id, 10);
      if (!isNaN(idx) && all[idx] !== undefined) {
        const currentOpinion = all[idx];
        setOpinion(currentOpinion);
        
        const marketData = getOpinionMarketData(currentOpinion);
        setCurrentPrice(marketData.currentPrice);
        setSellPrice(calculateSellPrice(marketData.currentPrice, marketData.timesPurchased));
        setTimesPurchased(marketData.timesPurchased);
        setTimesSold(marketData.timesSold);
      } else {
        setOpinion('Opinion not found.');
      }

      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
      }

      updateOwnedOpinionPrices();
      
      const storedAssets = localStorage.getItem('ownedOpinions');
      if (storedAssets && all[idx]) {
        const owned = JSON.parse(storedAssets);
        const ownedAsset = owned.find((asset: OpinionAsset) => 
          asset.text === all[idx]
        );
        if (ownedAsset) {
          setAlreadyOwned(true);
          setOwnedQuantity(ownedAsset.quantity);
        }
      }

    } catch (error) {
      console.error('Error loading opinion data:', error);
      setOpinion('Error loading opinion.');
    }
  }, [id]);

  const purchaseOpinion = () => {
    if (!opinion) return;

    if (userProfile.balance < currentPrice) {
      setMessage('Insufficient funds! Generate more opinions to earn money.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    const updatedMarketData = updateOpinionMarketData(opinion, 'buy');

    // If user already owns this opinion, increase quantity
    if (alreadyOwned) {
      const updatedOwnedOpinions = ownedOpinions.map(asset => {
        if (asset.text === opinion) {
          return {
            ...asset,
            quantity: asset.quantity + 1,
            currentPrice: updatedMarketData.currentPrice
          };
        }
        return asset;
      });
      setOwnedOpinions(updatedOwnedOpinions);
      setOwnedQuantity(ownedQuantity + 1);
      localStorage.setItem('ownedOpinions', JSON.stringify(updatedOwnedOpinions));
    } else {
      // Create new asset
      const newAsset: OpinionAsset = {
        id: Date.now().toString(),
        text: opinion,
        purchasePrice: currentPrice,
        currentPrice: updatedMarketData.currentPrice,
        purchaseDate: new Date().toLocaleDateString(),
        quantity: 1
      };

      const updatedOwnedOpinions = [...ownedOpinions, newAsset];
      setOwnedOpinions(updatedOwnedOpinions);
      localStorage.setItem('ownedOpinions', JSON.stringify(updatedOwnedOpinions));
      setAlreadyOwned(true);
      setOwnedQuantity(1);
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'buy',
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: -currentPrice,
      date: new Date().toLocaleDateString()
    };

    updateOwnedOpinionPrices();

    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance - currentPrice
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));

    const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));

    const oldPrice = currentPrice;
    setCurrentPrice(updatedMarketData.currentPrice);
    setSellPrice(calculateSellPrice(updatedMarketData.currentPrice, updatedMarketData.timesPurchased));
    setTimesPurchased(updatedMarketData.timesPurchased);
    
    setMessage(`Successfully purchased! Price increased from $${oldPrice} to $${updatedMarketData.currentPrice}.`);
    setTimeout(() => setMessage(''), 7000);
  };

  const sellOpinion = () => {
    if (!opinion || !alreadyOwned || ownedQuantity === 0) return;

    const updatedMarketData = updateOpinionMarketData(opinion, 'sell');

    // Update owned opinions - decrease quantity or remove if 0
    const updatedOwnedOpinions = ownedOpinions.map(asset => {
      if (asset.text === opinion) {
        const newQuantity = asset.quantity - 1;
        return {
          ...asset,
          quantity: newQuantity,
          currentPrice: updatedMarketData.currentPrice
        };
      }
      return asset;
    }).filter(asset => asset.quantity > 0);

    setOwnedOpinions(updatedOwnedOpinions);
    localStorage.setItem('ownedOpinions', JSON.stringify(updatedOwnedOpinions));

    const newQuantity = ownedQuantity - 1;
    setOwnedQuantity(newQuantity);
    if (newQuantity === 0) {
      setAlreadyOwned(false);
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'sell',
      opinionText: opinion.length > 50 ? opinion.slice(0, 50) + '...' : opinion,
      amount: sellPrice,
      date: new Date().toLocaleDateString()
    };

    updateOwnedOpinionPrices();

    const updatedProfile = {
      ...userProfile,
      balance: userProfile.balance + sellPrice,
      totalEarnings: userProfile.totalEarnings + sellPrice
    };
    setUserProfile(updatedProfile);
    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));

    const existingTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const updatedTransactions = [newTransaction, ...existingTransactions.slice(0, 9)];
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));

    const oldPrice = currentPrice;
    setCurrentPrice(updatedMarketData.currentPrice);
    setSellPrice(calculateSellPrice(updatedMarketData.currentPrice, updatedMarketData.timesPurchased));
    setTimesSold(updatedMarketData.timesSold);
    
    setMessage(`Successfully sold for $${sellPrice}! Market price adjusted from $${oldPrice} to $${updatedMarketData.currentPrice}.`);
    setTimeout(() => setMessage(''), 7000);
  };

  const getMarketTrend = () => {
    const netDemand = timesPurchased - timesSold;
    if (netDemand > 5) return { emoji: '🚀', text: 'Bullish', color: '#28a745' };
    if (netDemand > 2) return { emoji: '📈', text: 'Rising', color: '#28a745' };
    if (netDemand > -2) return { emoji: '➡️', text: 'Stable', color: '#6c757d' };
    if (netDemand > -5) return { emoji: '📉', text: 'Declining', color: '#dc3545' };
    return { emoji: '💀', text: 'Bearish', color: '#dc3545' };
  };

  const trend = getMarketTrend();

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar opinions={opinions} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '900px' }}>
        {/* Header with Navigation */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem' 
        }}>
          <button
            onClick={() => router.push('/')}
            style={{ 
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            ← Back to Profile
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a href="/users" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6f42c1', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              📊 View Traders
            </a>
            <a href="/generate" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              ✨ Generate
            </a>
            <div style={{ padding: '0.75rem 1rem', backgroundColor: '#e8f5e8', borderRadius: '6px', border: '1px solid #c3e6c3', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>💰 Wallet</p>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#155724' }}>${userProfile.balance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Main Opinion Card */}
        <div style={{ padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e9ecef', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', margin: 0, color: '#333', fontWeight: 'bold' }}>💬 Opinion #{id}</h1>
            {alreadyOwned && (
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                ✅ Owned: {ownedQuantity}
              </div>
            )}
          </div>
          
          <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '2rem', borderLeft: '4px solid #007bff' }}>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.6', margin: 0, fontStyle: 'italic', color: '#2c3e50' }}>
              "{opinion}"
            </p>
          </div>

          {/* Enhanced Market Data */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #bbdefb' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1565c0', fontSize: '1.1rem' }}>💰 Current Price</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#1565c0' }}>${currentPrice}</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>Base price: $10</p>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffcc02' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#e65100', fontSize: '1.1rem' }}>📊 Market Trend</h3>
              <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: trend.color }}>
                {trend.emoji} {trend.text}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
                Net demand: {timesPurchased - timesSold}
              </p>
            </div>

            <div style={{ padding: '1.5rem', backgroundColor: '#e8f5e8', borderRadius: '8px', border: '1px solid #c3e6c3' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#155724', fontSize: '1.1rem' }}>🔄 Trading Volume</h3>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#155724' }}>
                {timesPurchased} buys
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>
                {timesSold} sells
              </p>
            </div>

            {alreadyOwned && (
              <div style={{ padding: '1.5rem', backgroundColor: '#f8d7da', borderRadius: '8px', border: '1px solid #f5c6cb' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#721c24', fontSize: '1.1rem' }}>💸 Sell Price</h3>
                <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#721c24' }}>${sellPrice}</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
                  {Math.round((sellPrice / currentPrice) * 100)}% of market price
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {!alreadyOwned || ownedQuantity === 0 ? (
              <button
                onClick={purchaseOpinion}
                disabled={userProfile.balance < currentPrice}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1.1rem',
                  backgroundColor: userProfile.balance < currentPrice ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: userProfile.balance < currentPrice ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {userProfile.balance < currentPrice 
                  ? `Need $${currentPrice - userProfile.balance} more`
                  : `Buy for $${currentPrice}`
                }
              </button>
            ) : (
              <>
                <button
                  onClick={purchaseOpinion}
                  disabled={userProfile.balance < currentPrice}
                  style={{
                    padding: '1rem 2rem',
                    fontSize: '1.1rem',
                    backgroundColor: userProfile.balance < currentPrice ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: userProfile.balance < currentPrice ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {userProfile.balance < currentPrice 
                    ? `Need $${currentPrice - userProfile.balance} more`
                    : `Buy More ($${currentPrice})`
                  }
                </button>
                
                <button
                  onClick={sellOpinion}
                  style={{
                    padding: '1rem 2rem',
                    fontSize: '1.1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Sell 1 for ${sellPrice}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: message.includes('Successfully') ? '#d4edda' : 
                           message.includes('Insufficient') ? '#f8d7da' : '#fff3cd',
            color: message.includes('Successfully') ? '#155724' : 
                   message.includes('Insufficient') ? '#721c24' : '#856404',
            border: `1px solid ${message.includes('Successfully') ? '#c3e6cb' : 
                                 message.includes('Insufficient') ? '#f5c6cb' : '#ffeaa7'}`,
            textAlign: 'center',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}>
            {message}
          </div>
        )}

        {/* Enhanced Trading Info */}
        <div style={{ padding: '1.5rem', backgroundColor: '#e9ecef', borderRadius: '8px', fontSize: '0.95rem', color: '#6c757d' }}>
          <p style={{ margin: '0 0 1rem 0' }}>
            💡 <strong>Enhanced Trading System:</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', margin: 0 }}>
            <div>
              <strong>Dynamic Pricing:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                <li>Prices rise exponentially with net demand</li>
                <li>Volatility based on opinion content</li>
                <li>Selling pressure reduces prices</li>
              </ul>
            </div>
            <div>
              <strong>Selling Mechanism:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                <li>Sell price is 85-95% of market price</li>
                <li>Higher liquidity = better sell ratios</li>
                <li>Each sale affects market price</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}