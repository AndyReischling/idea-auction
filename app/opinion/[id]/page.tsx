// =============================================================================
// Opinion detail page – Firestore‑native
// Rewrites the old localStorage fallback so **only Firestore** is queried.
// =============================================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { firebaseDataService } from '../../lib/firebase-data-service';
import { UnifiedMarketDataManager } from '../../lib/unified-system';
import { doc as fsDoc, getDoc, collection, query, where, limit, getDocs, orderBy, setDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// UI components & assets
import Sidebar from '../../components/Sidebar';
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
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create'; quantity?: number }[];
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

  const popMsg = (m: string, ms = 3000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  // User's position in this opinion
  const userPosition = useMemo(() => {
    if (!docData) return 0;
    const portfolio = (profile as any).portfolio || {};
    return portfolio[docData.text] || 0;
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
          const p = await firebaseDataService.getUserProfile(user.uid);
          if (p) {
            // Fix balance if it's too low (existing users might need this)
            const fixedBalance = p.balance < 100 ? 10000 : p.balance;
            if (fixedBalance !== p.balance) {
              await firebaseDataService.updateUserProfile(user.uid, { balance: fixedBalance });
              popMsg('Balance updated to $10,000! 💰');
            }
            
            setProfile({
              username: p.username,
              balance: fixedBalance,
              joinDate: ts(p.joinDate),
              totalEarnings: p.totalEarnings || 0,
              totalLosses: p.totalLosses || 0,
              portfolio: (p as any).portfolio || {},
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
        }

      } catch (err) {
        console.error('Error loading data:', err);
        popMsg('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, ready, user?.uid]);

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
    const x = totalPoints > 1 ? (index / (totalPoints - 1)) * 760 + 20 : 400; // Center single point
    const y = chartData ? 280 - ((price - chartData.minPrice) / chartData.range) * 260 : 150;
    return {
      x: isNaN(x) ? 400 : Math.max(20, Math.min(780, x)), // Clamp to valid range
      y: isNaN(y) ? 150 : Math.max(20, Math.min(280, y))  // Clamp to valid range
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
      
      if (recentBuys >= 4) {
        const earliestBuy = recentTransactionsSnap.docs[recentTransactionsSnap.docs.length - 1];
        const nextAllowedTime = new Date(earliestBuy.data().timestamp.toDate().getTime() + 10 * 60 * 1000);
        const minutesLeft = Math.ceil((nextAllowedTime.getTime() - now.getTime()) / (60 * 1000));
        
        popMsg(`🚫 Anti-arbitrage limit: You've bought 4 shares in the last 10 minutes. Wait ${minutesLeft} minutes before buying again.`);
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
            quantity: 1 
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
        username: profile.username,
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
        [`portfolio.${docData.text}`]: (userPosition + 1),
        updatedAt: serverTimestamp()
      });
      
      // Commit all changes
      await batch.commit();
      
      // Update local state
      setMarket(updatedMarket);
      setProfile(prev => ({
        ...prev,
        balance: prev.balance - cost,
        portfolio: {
          ...((prev as any).portfolio || {}),
          [docData.text]: userPosition + 1
        }
      } as any));
      
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
            quantity: 1 
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
        username: profile.username,
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
        [`portfolio.${docData.text}`]: (userPosition - 1),
        updatedAt: serverTimestamp()
      });
      
      // Commit all changes
      await batch.commit();
      
      // Update local state
      setMarket(updatedMarket);
      setProfile(prev => ({
        ...prev,
        balance: prev.balance + sellPrice,
        portfolio: {
          ...((prev as any).portfolio || {}),
          [docData.text]: userPosition - 1
        }
      } as any));
      
      popMsg(`✅ Share sold for ${formatCurrency(sellPrice)}! New price: ${formatCurrency(newPrice)} (-0.1%)`);
      
    } catch (err) {
      console.error('❌ Sell error:', err);
      popMsg('❌ Error selling share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render guards
  if (!ready) return <div>Loading…</div>;
  if (!user) return <div className={styles.container}>Please sign in to view trading interface.</div>;

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <div className={styles.pageHeader}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <ArrowLeft size={24} /> Back
          </button>

          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders"><ScanSmiley size={24} /> Traders</a>
            <a href="/feed" className="nav-button feed"><RssSimple size={24} /> Feed</a>
            <a href="/generate" className="nav-button generate"><Balloon size={24} /> Generate</a>
            <div className={styles.walletDisplay}>
              <PiggyBank size={28} weight="fill" /> {formatCurrency(profile.balance)}
            </div>
          </div>
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
              <div className={styles.priceValue}>{chartData?.history.length || 0}</div>
            </div>
          </div>
        )}

        {/* Price Chart */}
        {chartData && (
          <div className={styles.chartContainer}>
            <div className={styles.chartVisual}>
              <svg className={styles.chartSvg} viewBox="0 0 800 300" width="800" height="300">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#333" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
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
                    <circle
                      key={i}
                      className={styles.dataPoint}
                      cx={coords.x}
                      cy={coords.y}
                      r="5"
                      fill="#22c55e"
                    >
                      <title>{`${formatCurrency(point.price)} - ${point.action} (${new Date(point.timestamp).toLocaleString()})`}</title>
                    </circle>
                  );
                })}
                
                {/* Y-axis labels */}
                <text x="10" y="30" className={styles.axisLabel}>
                  {formatCurrency(chartData.maxPrice)}
                </text>
                <text x="10" y="290" className={styles.axisLabel}>
                  {formatCurrency(chartData.minPrice)}
                </text>
                
                {/* Current price line */}
                {market && (
                  <>
                    <line
                      x1="20"
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
                <span>● Positive Trend</span>
              </div>
              <div className={styles.legendText}>
                • Interactive data points show price and time on hover
              </div>
            </div>
          </div>
        )}

        {/* Trading Actions */}
        <div className={styles.tradingActions}>
          <button 
            className={`${styles.tradingButton} ${styles.buyButton}`}
            onClick={executeBuy}
            disabled={loading}
          >
            {loading ? 'Processing...' : `Buy More (${formatCurrency(market?.currentPrice || 0)})`}
          </button>
          
          <button 
            className={`${styles.tradingButton} ${styles.sellButton}`}
            onClick={executeSell}
            disabled={loading || userPosition === 0}
          >
            {userPosition > 0 ? `Sell 1 for ${formatCurrency((market?.currentPrice || 0) * 0.95)}` : 'Sell 1 for $0.00'}
          </button>
          
          <button 
            className={`${styles.tradingButton} ${styles.shortButton}`}
            disabled={userPosition > 0}
          >
            {userPosition > 0 ? "Own Shares (Can't Short)" : "Short Position"}
          </button>
        </div>

        {/* Opinion Text */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionText}>
            <p>{docData?.text}</p>
          </div>
          
          {docData && (
            <div className={styles.attributionLine}>
              <span>{docData.author || 'Anonymous'}</span>
              <span>{new Date(ts(docData.createdAt)).toLocaleDateString()}</span>
            </div>
          )}
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
                <trendData.icon size={20} /> {trendData.label}
              </div>
              <div className={styles.statSubtext}>Net demand: {trendData.netDemand}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Trading Volume</div>
              <div className={styles.statValue}>{market.timesPurchased} buys</div>
              <div className={styles.statSubtext}>{market.timesSold} sells</div>
              <div className={styles.statSubtext}>Click to view trader history</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Sell Price</div>
              <div className={styles.statValue}>{formatCurrency(market.currentPrice * 0.95)}</div>
              <div className={styles.statSubtext}>
                Purchase: {formatCurrency(market.basePrice)} | Market: {formatCurrency(market.currentPrice)} | Sell: {formatCurrency(market.currentPrice * 0.95)}
              </div>
              <div className={styles.statLoss}>
                📉 Loss: {formatCurrency(market.currentPrice * 0.05)} (5% transaction cost + small market moves)
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
      </main>
    </div>
  );
}
