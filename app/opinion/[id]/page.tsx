// =============================================================================
// Opinion detail page – Firestore‑native
// Rewrites the old localStorage fallback so **only Firestore** is queried.
// =============================================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { firebaseDataService } from '../../lib/firebase-data-service';
import { UnifiedMarketDataManager, UnifiedTransactionManager } from '../../lib/unified-system';
import { doc as fsDoc, getDoc, collection, query, where, limit, getDocs, orderBy, setDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// UI components & assets
import Sidebar from '../../components/Sidebar';
import Accordion from '../../components/Accordion';
import {
  ArrowLeft,
  PiggyBank,
  ScanSmiley,
  RssSimple,
  Balloon,
  RocketLaunch,
  ChartLineUp,
  ChartLineDown,
  Skull,
  FlowerLotus,
  Ticket,
  X,
  TrendUp,
  TrendDown,
  Clock,
  Info,
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

interface TradeHistoryItem {
  id: string;
  type: 'buy' | 'sell' | 'short';
  amount: number;
  price: number;
  quantity: number;
  date: string;
  username: string;
  isBot?: boolean;
  opinionText: string;
}

interface ShortPosition {
  id: string;
  opinionText: string;
  entryPrice: number;
  quantity: number;
  date: string;
  collateral: number;
  targetPrice: number;
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
const formatNumber = (num: number) => num.toLocaleString();

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
    balance: 0,
    joinDate: iso(),
    totalEarnings: 0,
    totalLosses: 0,
    portfolio: {},
  });
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [userShortPositions, setUserShortPositions] = useState<ShortPosition[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showShortModal, setShowShortModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [shortQuantity, setShortQuantity] = useState(1);
  const [shortCollateral, setShortCollateral] = useState(50);

  const popMsg = (m: string, ms = 5000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  // Trend analysis
  const trend = useMemo(() => {
    if (!market) return { icon: FlowerLotus, label: 'Stable', className: 'stable' } as const;
    const net = market.timesPurchased - market.timesSold;
    const recentTrend = market.priceHistory.slice(-5);
    const priceChange = recentTrend.length > 1 ? 
      recentTrend[recentTrend.length - 1].price - recentTrend[0].price : 0;
    
    if (net > 10 && priceChange > 0) return { icon: RocketLaunch, label: 'Bullish', className: 'bullish' } as const;
    if (net > 5 || priceChange > 0.5) return { icon: ChartLineUp, label: 'Rising', className: 'bullish' } as const;
    if (net > -5 && Math.abs(priceChange) < 0.5) return { icon: FlowerLotus, label: 'Stable', className: 'stable' } as const;
    if (net > -10 || priceChange < -0.5) return { icon: ChartLineDown, label: 'Declining', className: 'bearish' } as const;
    return { icon: Skull, label: 'Bearish', className: 'bearish' } as const;
  }, [market]);

  // User's position in this opinion
  const userPosition = useMemo(() => {
    if (!docData) return 0;
    const portfolio = (profile as any).portfolio || {};
    return portfolio[docData.text] || 0;
  }, [profile, docData]);

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

        // 2. Fetch market data
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
        }

        // 3. Fetch user profile
        if (user?.uid) {
          const p = await firebaseDataService.getUserProfile(user.uid);
          if (p) {
            setProfile({
              username: p.username,
              balance: p.balance,
              joinDate: ts(p.joinDate),
              totalEarnings: p.totalEarnings || 0,
              totalLosses: p.totalLosses || 0,
              portfolio: (p as any).portfolio || {},
            });
          }
        }

        // 4. Fetch trade history for this opinion
        const historyQuery = query(
          collection(db, 'transactions'),
          where('opinionText', '==', d.text),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const historySnap = await getDocs(historyQuery);
        const history = historySnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            amount: data.amount,
            price: data.price || 0,
            quantity: data.quantity || 1,
            date: ts(data.timestamp),
            username: data.username || 'Anonymous',
            isBot: data.isBot || false,
            opinionText: data.opinionText,
          };
        });
        setTradeHistory(history);

        // 5. Fetch user's short positions
        if (user?.uid) {
          const shortQuery = query(
            collection(db, 'short-positions'),
            where('userId', '==', user.uid),
            where('opinionText', '==', d.text),
            where('isActive', '==', true)
          );
          const shortSnap = await getDocs(shortQuery);
          const positions = shortSnap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              opinionText: data.opinionText,
              entryPrice: data.entryPrice,
              quantity: data.quantity,
              date: ts(data.timestamp),
              collateral: data.collateral,
              targetPrice: data.targetPrice,
            };
          });
          setUserShortPositions(positions);
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
    
    const minPrice = Math.min(...history.map(h => h.price));
    const maxPrice = Math.max(...history.map(h => h.price));
    const range = maxPrice - minPrice || 1;
    
    return { history, minPrice, maxPrice, range };
  }, [market]);

  // Trading functions
  const executeBuy = async () => {
    if (!user?.uid || !docData || !market) return;
    
    const totalCost = market.currentPrice * buyQuantity;
    if (totalCost > profile.balance) {
      popMsg('Insufficient balance');
      return;
    }

    try {
      setLoading(true);
      await UnifiedMarketDataManager.applyTrade(
        docData.text,
        'buy',
        buyQuantity,
        user.uid
      );
      
      // Update user balance and portfolio
      await firebaseDataService.updateUserProfile(user.uid, {
        balance: profile.balance - totalCost,
        [`portfolio.${docData.text}`]: (userPosition + buyQuantity),
      } as any);
      
      popMsg(`Successfully bought ${buyQuantity} shares for ${formatCurrency(totalCost)}`);
      setShowBuyModal(false);
      setBuyQuantity(1);
      
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Buy error:', err);
      popMsg('Error executing buy order');
    } finally {
      setLoading(false);
    }
  };

  const executeSell = async () => {
    if (!user?.uid || !docData || !market) return;
    
    if (sellQuantity > userPosition) {
      popMsg('Cannot sell more than you own');
      return;
    }

    try {
      setLoading(true);
      const totalValue = market.currentPrice * sellQuantity;
      
      await UnifiedMarketDataManager.applyTrade(
        docData.text,
        'sell',
        sellQuantity,
        user.uid
      );
      
      // Update user balance and portfolio
      await firebaseDataService.updateUserProfile(user.uid, {
        balance: profile.balance + totalValue,
        [`portfolio.${docData.text}`]: (userPosition - sellQuantity),
      } as any);
      
      popMsg(`Successfully sold ${sellQuantity} shares for ${formatCurrency(totalValue)}`);
      setShowSellModal(false);
      setSellQuantity(1);
      
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Sell error:', err);
      popMsg('Error executing sell order');
    } finally {
      setLoading(false);
    }
  };

  const executeShort = async () => {
    if (!user?.uid || !docData || !market) return;
    
    const requiredCollateral = (market.currentPrice * shortQuantity * shortCollateral) / 100;
    if (requiredCollateral > profile.balance) {
      popMsg('Insufficient collateral');
      return;
    }

    try {
      setLoading(true);
      
      // Create short position
      const shortPosition = {
        userId: user.uid,
        opinionText: docData.text,
        entryPrice: market.currentPrice,
        quantity: shortQuantity,
        collateral: requiredCollateral,
        targetPrice: market.currentPrice * 0.8, // 20% drop target
        isActive: true,
        timestamp: new Date(),
      };
      
      // Create short position using direct Firestore write
      await setDoc(doc(db, 'short-positions', `${user.uid}_${Date.now()}`), shortPosition);
      
      // Update user balance
      await firebaseDataService.updateUserProfile(user.uid, {
        balance: profile.balance - requiredCollateral,
      });
      
      popMsg(`Short position opened: ${shortQuantity} shares at ${formatCurrency(market.currentPrice)}`);
      setShowShortModal(false);
      setShortQuantity(1);
      setShortCollateral(50);
      
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Short error:', err);
      popMsg('Error opening short position');
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

        {/* Opinion Card */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionText}>
            <p>{docData?.text}</p>
          </div>
          
          {docData && (
            <div className={styles.attributionLine}>
              <span>{docData.isBot ? '🤖' : '👤'} {docData.author || 'Anonymous'}</span> •{' '}
              <span>{new Date(ts(docData.createdAt)).toLocaleDateString()}</span>
            </div>
          )}

          {/* Market Statistics */}
          {market && (
            <div className={styles.marketStats}>
              <div className={`${styles.statCard} ${styles.price}`}>
                <div className={styles.statTitle}>Current Price</div>
                <div className={styles.statValue}>{formatCurrency(market.currentPrice)}</div>
                <div className={styles.statSubtext}>
                  {market.currentPrice > market.basePrice ? '+' : ''}
                  {formatCurrency(market.currentPrice - market.basePrice)} from base
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.trend}`}>
                <div className={styles.statTitle}>Trend</div>
                <div className={`${styles.statValue} ${styles[trend.className]}`}>
                  <trend.icon size={20} /> {trend.label}
                </div>
                <div className={styles.statSubtext}>
                  {market.timesPurchased} buys, {market.timesSold} sells
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.volume}`}>
                <div className={styles.statTitle}>Daily Volume</div>
                <div className={styles.statValue}>{formatNumber(market.dailyVolume)}</div>
                <div className={styles.statSubtext}>Total transactions</div>
              </div>

              <div className={`${styles.statCard} ${styles.clickable}`} onClick={() => setShowHistoryModal(true)}>
                <div className={styles.statTitle}>Your Position</div>
                <div className={styles.statValue}>{userPosition}</div>
                <div className={styles.statSubtext}>
                  {userPosition > 0 ? 'shares owned' : 'Click to view history'}
                </div>
                <div className={styles.clickHint}>Click to view trading history</div>
              </div>
            </div>
          )}

          {/* Price Chart */}
          {chartData && (
            <div className={styles.chartContainer}>
              <div className={styles.chartTitle}>Price Chart</div>
              
              <div className={styles.chartSummary}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Current</div>
                  <div className={styles.summaryValue}>
                    {formatCurrency(market?.currentPrice || 0)}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>High</div>
                  <div className={`${styles.summaryValue} ${styles.positive}`}>
                    {formatCurrency(chartData.maxPrice)}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Low</div>
                  <div className={`${styles.summaryValue} ${styles.negative}`}>
                    {formatCurrency(chartData.minPrice)}
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Base</div>
                  <div className={styles.summaryValue}>
                    {formatCurrency(market?.basePrice || 0)}
                  </div>
                </div>
              </div>

              <div className={styles.chartVisual}>
                <div className={styles.lineChart}>
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
                          const x = (i / (chartData.history.length - 1)) * 760 + 20;
                          const y = 280 - ((point.price - chartData.minPrice) / chartData.range) * 260;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                      />
                    )}
                    
                    {/* Data points */}
                    {chartData.history.map((point, i) => {
                      const x = (i / (chartData.history.length - 1)) * 760 + 20;
                      const y = 280 - ((point.price - chartData.minPrice) / chartData.range) * 260;
                      return (
                        <circle
                          key={i}
                          className={styles.dataPoint}
                          cx={x}
                          cy={y}
                          r="4"
                          fill={point.action === 'buy' ? '#22c55e' : point.action === 'sell' ? '#ef4444' : '#6b7280'}
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
                      <line
                        x1="20"
                        y1={280 - ((market.currentPrice - chartData.minPrice) / chartData.range) * 260}
                        x2="780"
                        y2={280 - ((market.currentPrice - chartData.minPrice) / chartData.range) * 260}
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    )}
                  </svg>
                </div>
              </div>

              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendColor} ${styles.positive}`}></div>
                  <span>Buy Orders</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendColor} ${styles.negative}`}></div>
                  <span>Sell Orders</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendColor} style={{backgroundColor: '#fbbf24'}}></div>
                  <span>Current Price</span>
                </div>
              </div>
            </div>
          )}

          {/* Trading Actions */}
          <div className={styles.actionButtons}>
            <button 
              className={`${styles.actionButton} ${styles.buy}`}
              onClick={() => setShowBuyModal(true)}
              disabled={loading}
            >
              <TrendUp size={18} /> Buy
            </button>
            
            <button 
              className={`${styles.actionButton} ${styles.sell}`}
              onClick={() => setShowSellModal(true)}
              disabled={loading || userPosition === 0}
            >
              <TrendDown size={18} /> Sell
            </button>
            
            <button 
              className={`${styles.actionButton} ${styles.short}`}
              onClick={() => setShowShortModal(true)}
              disabled={loading}
            >
              <Ticket size={18} /> Short
            </button>
          </div>

          {/* Status Messages */}
          {msg && (
            <div className={styles.statusMessage}>
              {msg}
            </div>
          )}

          {/* User's Short Positions */}
          {userShortPositions.length > 0 && (
            <div className={styles.tradingInfo}>
              <h3 className={styles.tradingInfoTitle}>Your Short Positions</h3>
              <div className={styles.tradingInfoGrid}>
                {userShortPositions.map(position => (
                  <div key={position.id} className={styles.tradingInfoSection}>
                    <strong>
                      {position.quantity} shares @ {formatCurrency(position.entryPrice)}
                    </strong>
                    <p>Collateral: {formatCurrency(position.collateral)}</p>
                    <p>Target: {formatCurrency(position.targetPrice)}</p>
                    <p>Current P&L: {market ? formatCurrency((position.entryPrice - market.currentPrice) * position.quantity) : 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trading Details Accordion */}
        {market && (
          <Accordion title="Trading Details & Market Data">
            <div className={styles.tradingInfo}>
              <div className={styles.tradingInfoGrid}>
                <div className={styles.tradingInfoSection}>
                  <strong>Market Statistics</strong>
                  <ul>
                    <li>Base Price: {formatCurrency(market.basePrice)}</li>
                    <li>Current Price: {formatCurrency(market.currentPrice)}</li>
                    <li>Total Purchases: {market.timesPurchased}</li>
                    <li>Total Sales: {market.timesSold}</li>
                    <li>Liquidity Score: {market.liquidityScore.toFixed(2)}</li>
                    <li>Last Updated: {new Date(market.lastUpdated).toLocaleString()}</li>
                  </ul>
                </div>
                
                <div className={styles.tradingInfoSection}>
                  <strong>Your Portfolio</strong>
                  <ul>
                    <li>Shares Owned: {userPosition}</li>
                    <li>Current Value: {formatCurrency(userPosition * (market.currentPrice || 0))}</li>
                    <li>Available Balance: {formatCurrency(profile.balance)}</li>
                    <li>Short Positions: {userShortPositions.length}</li>
                  </ul>
                </div>
              </div>
            </div>
          </Accordion>
        )}
      </main>

      {/* Buy Modal */}
      {showBuyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.shortModal}>
            <div className={styles.modalHeader}>
              <h3>Buy Shares</h3>
              <button onClick={() => setShowBuyModal(false)} className={styles.closeButton}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.shortExplanation}>
                <h4>📈 How it works:</h4>
                <p><strong>When you buy</strong> → Price goes UP</p>
                <p><strong>More demand</strong> → Higher value</p>
                <p>You profit if the idea becomes more popular!</p>
              </div>
              
              <div className={styles.shortSettings}>
                <div className={styles.settingGroup}>
                  <label>How many shares?</label>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))}
                      className={styles.quantityBtn}
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(parseInt(e.target.value) || 1)}
                      className={styles.quantityInput}
                    />
                    <button 
                      onClick={() => setBuyQuantity(Math.min(50, buyQuantity + 1))}
                      className={styles.quantityBtn}
                    >+</button>
                  </div>
                </div>
                
                <div className={styles.quickSummary}>
                  <div className={styles.summaryRow}>
                    <span>Current Price:</span>
                    <span className={styles.currentPrice}>{formatCurrency(market?.currentPrice || 0)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>You're buying:</span>
                    <span>{buyQuantity} shares</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Total Cost:</span>
                    <span className={styles.totalCost}>{formatCurrency((market?.currentPrice || 0) * buyQuantity)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>After purchase:</span>
                    <span>Price will increase! 📈</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button onClick={() => setShowBuyModal(false)} className={`${styles.modalButton} ${styles.cancel}`}>
                  Cancel
                </button>
                <button 
                  onClick={executeBuy} 
                  className={`${styles.modalButton} ${styles.confirm}`}
                  disabled={loading || (market?.currentPrice || 0) * buyQuantity > profile.balance}
                >
                  {loading ? 'Buying...' : `Buy ${buyQuantity} shares`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.shortModal}>
            <div className={styles.modalHeader}>
              <h3>Sell Shares</h3>
              <button onClick={() => setShowSellModal(false)} className={styles.closeButton}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.shortExplanation}>
                <h4>📉 How it works:</h4>
                <p><strong>When you sell</strong> → Price goes DOWN</p>
                <p><strong>Less demand</strong> → Lower value</p>
                <p>Sell high to lock in profits!</p>
              </div>
              
              <div className={styles.shortSettings}>
                <div className={styles.settingGroup}>
                  <label>How many shares to sell?</label>
                  <p className={styles.portfolioInfo}>You own: <strong>{userPosition} shares</strong></p>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                      className={styles.quantityBtn}
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      max={userPosition}
                      value={sellQuantity}
                      onChange={(e) => setSellQuantity(parseInt(e.target.value) || 1)}
                      className={styles.quantityInput}
                    />
                    <button 
                      onClick={() => setSellQuantity(Math.min(userPosition, sellQuantity + 1))}
                      className={styles.quantityBtn}
                    >+</button>
                  </div>
                  <button 
                    onClick={() => setSellQuantity(userPosition)} 
                    className={styles.sellAllBtn}
                  >
                    Sell All
                  </button>
                </div>
                
                <div className={styles.quickSummary}>
                  <div className={styles.summaryRow}>
                    <span>Current Price:</span>
                    <span className={styles.currentPrice}>{formatCurrency(market?.currentPrice || 0)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>You're selling:</span>
                    <span>{sellQuantity} shares</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>You'll receive:</span>
                    <span className={styles.sellValue}>{formatCurrency((market?.currentPrice || 0) * sellQuantity)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>After sale:</span>
                    <span>Price will decrease! 📉</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button onClick={() => setShowSellModal(false)} className={`${styles.modalButton} ${styles.cancel}`}>
                  Cancel
                </button>
                <button 
                  onClick={executeSell} 
                  className={`${styles.modalButton} ${styles.confirm}`}
                  disabled={loading || sellQuantity > userPosition}
                >
                  {loading ? 'Selling...' : `Sell ${sellQuantity} shares`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Short Modal */}
      {showShortModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.shortModal}>
            <div className={styles.modalHeader}>
              <h3>Short Position</h3>
              <button onClick={() => setShowShortModal(false)} className={styles.closeButton}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.shortExplanation}>
                <h4>⚡ Advanced Strategy:</h4>
                <p><strong>Bet AGAINST the idea</strong> → Profit if price falls</p>
                <p><strong>Higher risk</strong> → Higher potential rewards</p>
                <p>⚠️ You can lose money if price goes up!</p>
              </div>
              
              <div className={styles.shortSettings}>
                <div className={styles.settingGroup}>
                  <label>Short how many shares?</label>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => setShortQuantity(Math.max(1, shortQuantity - 1))}
                      className={styles.quantityBtn}
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      value={shortQuantity}
                      onChange={(e) => setShortQuantity(parseInt(e.target.value) || 1)}
                      className={styles.quantityInput}
                    />
                    <button 
                      onClick={() => setShortQuantity(Math.min(25, shortQuantity + 1))}
                      className={styles.quantityBtn}
                    >+</button>
                  </div>
                </div>
                
                <div className={styles.settingGroup}>
                  <label>Safety deposit (collateral)</label>
                  <div className={styles.collateralOptions}>
                    <button 
                      onClick={() => setShortCollateral(50)}
                      className={`${styles.collateralBtn} ${shortCollateral === 50 ? styles.active : ''}`}
                    >50% (Risky)</button>
                    <button 
                      onClick={() => setShortCollateral(75)}
                      className={`${styles.collateralBtn} ${shortCollateral === 75 ? styles.active : ''}`}
                    >75% (Safe)</button>
                    <button 
                      onClick={() => setShortCollateral(100)}
                      className={`${styles.collateralBtn} ${shortCollateral === 100 ? styles.active : ''}`}
                    >100% (Very Safe)</button>
                  </div>
                </div>
                
                <div className={styles.quickSummary}>
                  <div className={styles.summaryRow}>
                    <span>Entry Price:</span>
                    <span>{formatCurrency(market?.currentPrice || 0)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Deposit Required:</span>
                    <span className={styles.depositCost}>
                      {formatCurrency(((market?.currentPrice || 0) * shortQuantity * shortCollateral) / 100)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Profit if price drops 20%:</span>
                    <span className={styles.profitEstimate}>
                      {formatCurrency((market?.currentPrice || 0) * shortQuantity * 0.2)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button onClick={() => setShowShortModal(false)} className={`${styles.modalButton} ${styles.cancel}`}>
                  Cancel
                </button>
                <button 
                  onClick={executeShort} 
                  className={`${styles.modalButton} ${styles.confirm}`}
                  disabled={loading || ((market?.currentPrice || 0) * shortQuantity * shortCollateral) / 100 > profile.balance}
                >
                  {loading ? 'Opening...' : `Short ${shortQuantity} shares`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trading History Modal */}
      {showHistoryModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.traderHistoryModal}>
            <div className={styles.modalHeader}>
              <h3>Trading History</h3>
              <button onClick={() => setShowHistoryModal(false)} className={styles.closeButton}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.historyExplanation}>
                <p>Recent trading activity for this opinion</p>
              </div>
              
              {tradeHistory.length === 0 ? (
                <div className={styles.noHistory}>
                  <div>📈</div>
                  <h4>No trading history yet</h4>
                  <p>Be the first to trade this opinion!</p>
                </div>
              ) : (
                <div className={styles.historyList}>
                  {tradeHistory.map((trade) => (
                    <div key={trade.id} className={styles.tradeItem}>
                      <div className={styles.tradeHeader}>
                        <div className={styles.traderInfo}>
                          <span className={`${styles.traderName} ${trade.isBot ? styles.botTrader : styles.humanTrader}`}>
                            {trade.isBot ? '🤖' : '👤'} {trade.username}
                          </span>
                          <span className={styles.tradeDate}>
                            {new Date(trade.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className={`${styles.tradeAction} ${styles[trade.type]}`}>
                          {trade.type.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className={styles.tradeDetails}>
                        <div className={styles.tradeDetailItem}>
                          <span>Quantity:</span>
                          <span>{trade.quantity}</span>
                        </div>
                        <div className={styles.tradeDetailItem}>
                          <span>Price:</span>
                          <span className={styles.tradePrice}>{formatCurrency(trade.price)}</span>
                        </div>
                        <div className={styles.tradeDetailItem}>
                          <span>Total:</span>
                          <span className={styles.tradeTotal}>
                            {formatCurrency(Math.abs(trade.amount))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className={styles.historyStats}>
                <div className={styles.statItem}>
                  <span>Total Trades:</span>
                  <span>{tradeHistory.length}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Total Volume:</span>
                  <span>{formatCurrency(tradeHistory.reduce((sum, t) => sum + Math.abs(t.amount), 0))}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Buy Orders:</span>
                  <span>{tradeHistory.filter(t => t.type === 'buy').length}</span>
                </div>
                <div className={styles.statItem}>
                  <span>Sell Orders:</span>
                  <span>{tradeHistory.filter(t => t.type === 'sell').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
