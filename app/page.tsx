'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';

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

export default function UserProfile() {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000, // Starting with $10,000 fake money
    joinDate: new Date().toLocaleDateString(),
    totalEarnings: 0,
    totalLosses: 0
  });

  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allOpinions, setAllOpinions] = useState<string[]>([]);

  // Load data from localStorage
  useEffect(() => {
    try {
      // Load existing opinions for sidebar
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setAllOpinions(parsed);
        }
      }

      // Load user profile
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
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
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, []);

  // Save user profile to localStorage
  const saveUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  // Calculate portfolio value
  const portfolioValue = ownedOpinions.reduce((total, opinion) => 
    total + (opinion.currentPrice * opinion.quantity), 0
  );

  // Calculate total gains/losses
  const totalGainsLosses = ownedOpinions.reduce((total, opinion) => 
    total + ((opinion.currentPrice - opinion.purchasePrice) * opinion.quantity), 0
  );

  // Generate random price for demonstration
  const getRandomPrice = () => Math.floor(Math.random() * 100) + 10;

  // Mock function to simulate buying an opinion
  const buyOpinion = (opinionText: string) => {
    const price = getRandomPrice();
    if (userProfile.balance >= price) {
      const newAsset: OpinionAsset = {
        id: Date.now().toString(),
        text: opinionText,
        purchasePrice: price,
        currentPrice: price,
        purchaseDate: new Date().toLocaleDateString(),
        quantity: 1
      };

      const newTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'buy',
        opinionId: newAsset.id,
        opinionText: opinionText.slice(0, 50) + '...',
        amount: -price,
        date: new Date().toLocaleDateString()
      };

      setOwnedOpinions(prev => [...prev, newAsset]);
      setRecentTransactions(prev => [newTransaction, ...prev.slice(0, 9)]);
      saveUserProfile({
        ...userProfile,
        balance: userProfile.balance - price
      });

      localStorage.setItem('ownedOpinions', JSON.stringify([...ownedOpinions, newAsset]));
      localStorage.setItem('transactions', JSON.stringify([newTransaction, ...recentTransactions.slice(0, 9)]));
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1200px' }}>
      {/* Header with Generate Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}>
          {/* User Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #e9ecef',
            flex: 1,
            marginRight: '1rem'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold',
              marginRight: '1.5rem'
            }}>
              {userProfile.username[0].toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', margin: 0, color: '#333' }}>{userProfile.username}</h1>
              <p style={{ margin: '0.25rem 0', color: '#666' }}>Member since {userProfile.joinDate}</p>
              <p style={{ margin: 0, color: '#666' }}>Opinion Trader & Collector</p>
            </div>
          </div>

          {/* Generate Opinion Button */}
          <a
            href="/generate"
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none'
            }}
          >
            ✨ Generate Opinions
          </a>
        </div>

        {/* Wallet Overview */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#e8f5e8', 
            borderRadius: '8px', 
            border: '1px solid #c3e6c3' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#155724' }}>💰 Wallet Balance</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#155724' }}>
              ${userProfile.balance.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px', 
            border: '1px solid #bbdefb' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0d47a1' }}>📊 Portfolio Value</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#0d47a1' }}>
              ${portfolioValue.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: totalGainsLosses >= 0 ? '#e8f5e8' : '#ffebee', 
            borderRadius: '8px', 
            border: `1px solid ${totalGainsLosses >= 0 ? '#c3e6c3' : '#ffcdd2'}` 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: totalGainsLosses >= 0 ? '#155724' : '#c62828' }}>
              📈 P&L
            </h3>
            <p style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              margin: 0, 
              color: totalGainsLosses >= 0 ? '#155724' : '#c62828' 
            }}>
              {totalGainsLosses >= 0 ? '+' : ''}${totalGainsLosses.toLocaleString()}
            </p>
          </div>

          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#fff3e0', 
            borderRadius: '8px', 
            border: '1px solid #ffcc02' 
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#e65100' }}>🏆 Opinions Owned</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#e65100' }}>
              {ownedOpinions.length}
            </p>
          </div>
        </div>

        {/* Opinion Portfolio */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            💼 Your Opinion Portfolio
          </h2>
          
          {ownedOpinions.length === 0 ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              color: '#666'
            }}>
              <p>You don't own any opinions yet!</p>
              <p>Start by buying some opinions from the marketplace.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {ownedOpinions.map((opinion) => {
                const gainLoss = (opinion.currentPrice - opinion.purchasePrice) * opinion.quantity;
                const gainLossPercent = ((opinion.currentPrice - opinion.purchasePrice) / opinion.purchasePrice) * 100;
                
                return (
                  <div key={opinion.id} style={{ 
                    padding: '1rem', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    backgroundColor: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                          {opinion.text.slice(0, 80)}...
                        </p>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                          Purchased: {opinion.purchaseDate} | Qty: {opinion.quantity}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                          Bought: ${opinion.purchasePrice}
                        </p>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>
                          Current: ${opinion.currentPrice}
                        </p>
                        <p style={{ 
                          margin: '0', 
                          fontWeight: 'bold',
                          color: gainLoss >= 0 ? '#28a745' : '#dc3545' 
                        }}>
                          {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Buy Section */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            🛒 Quick Buy Available Opinions
          </h2>
          
          {allOpinions.length === 0 ? (
            <p style={{ color: '#666' }}>No opinions available. Generate some first!</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {allOpinions.slice(0, 6).map((opinion, index) => (
                <div key={index} style={{ 
                  padding: '1rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                    {opinion.slice(0, 100)}...
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                      ${getRandomPrice()}
                    </span>
                    <button
                      onClick={() => buyOpinion(opinion)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
            📋 Recent Activity
          </h2>
          
          {recentTransactions.length === 0 ? (
            <p style={{ color: '#666' }}>No recent transactions.</p>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} style={{ 
                  padding: '1rem', 
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: 'bold' }}>
                      {transaction.type === 'buy' ? '🛒 Bought' : transaction.type === 'sell' ? '💰 Sold' : '✨ Earned'} Opinion
                    </p>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                      {transaction.opinionText || 'Generated opinion'} • {transaction.date}
                    </p>
                  </div>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: transaction.amount >= 0 ? '#28a745' : '#dc3545'
                  }}>
                    {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}