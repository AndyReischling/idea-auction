'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import styles from './page.module.css';

import {
  ScanSmiley,
  Balloon,
  Wallet,
  Rss,
  CurrencyCircleDollar,
  ChartLine,
  Folder,
  DiceSix,
  TrendUp,
  ShoppingBag,
} from '@phosphor-icons/react';

import { useAuth } from '../../lib/auth-context';
import { firebaseDataService, UserProfile } from '../../lib/firebase-data-service';

/* ------------------------------------------------------------------ */
/* 🔖  Firestore data shapes                                           */
/* ------------------------------------------------------------------ */
// UserProfile interface is imported from firebase-data-service

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;  // ISO
  quantity: number;
}

interface Transaction {
  id: string;
  type:
    | 'buy'
    | 'sell'
    | 'earn'
    | 'bet_win'
    | 'bet_loss'
    | 'bet_place'
    | 'short_place'
    | 'short_win'
    | 'short_loss';
  amount: number;
  date: string;          // ISO
  description?: string;
  opinionText?: string;
  quantity?: number;
}

interface BettingActivity {
  id: string;
  type: 'portfolio_bet' | 'short_bet';
  title: string;
  subtitle: string;
  amount: number;
  potentialPayout: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  placedDate: string;    // ISO
  expiryDate: string;    // ISO
  progress?: number;     // shorts only
}

/* ------------------------------------------------------------------ */
/* 🧰  Helper utils                                                    */
/* ------------------------------------------------------------------ */
const iso = () => new Date().toISOString();
const safeSlice = (txt: string, n = 40) =>
  txt.length > n ? `${txt.slice(0, n)}…` : txt;

/* ------------------------------------------------------------------ */
/* 🏗  Component                                                       */
/* ------------------------------------------------------------------ */
export default function UserDetailPage() {
  const router             = useRouter();
  const { username }       = useParams();               // route param
  const { user }           = useAuth();                 // current signed-in user
  const fds                = firebaseDataService;

  /* ── client-only gate – avoid hydration mismatch ── */
  const [ready, setReady]  = useState(false);
  useEffect(() => setReady(true), []);

  /* ── local state ── */
  const [profile, setProfile]                       = useState<UserProfile | null>(null);
  const [opinions, setOpinions]                     = useState<OpinionAsset[]>([]);
  const [transactions, setTransactions]             = useState<Transaction[]>([]);
  const [activities, setActivities]                 = useState<BettingActivity[]>([]);
  const [sidebarOpinions, setSidebarOpinions]       = useState<{id:string;text:string}[]>([]);
  const [msg, setMsg]                               = useState('');

  /* ---------------------------------------------------------------- */
  /* 🔄  Data loader (runs whenever the username in the URL changes)   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!ready || typeof username !== 'string') return;
    const uname = decodeURIComponent(username);

    const run = async () => {
      try {
        /* 1️⃣ Fetch the user (human or bot) */
        const u = await fds.getUserByUsername(uname); // Fetch user by username
        if (!u) {
          setMsg('User not found');
          return;
        }
        // Set the full user profile from firebase-data-service
        setProfile(u);

        /* 2️⃣ Grab portfolio data from user document */
        // Calculate portfolio holdings from transactions
        // Get all transactions first to calculate holdings
        const txData = await fds.getUserTransactions(u.uid, 200);
        
        if (txData && txData.length > 0) {
          // Calculate holdings from buy/sell transactions
          const holdingsMap = new Map<string, any>();
          
          for (const tx of txData) {
            if ((tx as any).type === 'buy' && (tx as any).opinionText) {
              const opinionText = (tx as any).opinionText;
              const existing = holdingsMap.get(opinionText) || {
                id: opinionText,
                text: opinionText,
                quantity: 0,
                totalCost: 0,
                purchaseDate: (tx as any).date,
              };
              
              existing.quantity += (tx as any).quantity || 1;
              existing.totalCost += (tx as any).amount || 0;
              existing.purchasePrice = existing.totalCost / existing.quantity;
              
              holdingsMap.set(opinionText, existing);
            } else if ((tx as any).type === 'sell' && (tx as any).opinionText) {
              const opinionText = (tx as any).opinionText;
              const existing = holdingsMap.get(opinionText);
              if (existing) {
                existing.quantity -= (tx as any).quantity || 1;
                if (existing.quantity <= 0) {
                  holdingsMap.delete(opinionText);
                }
              }
            }
          }
          
          // Convert holdings map to array and get current prices
          const holdings = await Promise.all(
            Array.from(holdingsMap.values()).map(async (holding: any) => {
              // Get current market price
              const marketData = await fds.getMarketData(holding.text);
              const currentPrice = marketData?.currentPrice || holding.purchasePrice || 10;
              
              return {
                id: holding.id,
                text: holding.text,
                purchasePrice: holding.purchasePrice || 0,
                currentPrice: currentPrice,
                purchaseDate: holding.purchaseDate || new Date().toISOString(),
                quantity: holding.quantity || 0,
              };
            })
          );
          
          setOpinions(holdings.filter(h => h.quantity > 0));
        }

        /* 3️⃣ Fetch bets and shorts from separate collections */
        const [bets, shorts] = await Promise.all([
          fds.getUserBets(u.uid, 50),
          fds.getUserShortPositions(u.uid, 50),
        ]);
        
        // Use the transactions already fetched for holdings calculation
        const allTransactions = txData;

        // Process transactions
        if (allTransactions && allTransactions.length > 0) {
          const processedTransactions = allTransactions.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            date: tx.date,
            description: tx.description,
            opinionText: tx.opinionText,
            quantity: tx.quantity,
          }));
          
          // Sort transactions by most recent first (descending order)
          processedTransactions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          
          setTransactions(processedTransactions);
        }

        /* 3️⃣ Merge bets + shorts into one activity array */
        const merged: BettingActivity[] = [
          ...(bets || []).map((b: any) => ({
            id: `bet_${b.id}`,
            type: 'portfolio_bet' as const,
            title: `Portfolio Bet (${b.betType || 'Unknown'})`,
            subtitle: `${b.targetPercentage || 0}% in ${b.timeFrame || 0}d`,
            amount: b.amount || 0,
            potentialPayout: b.potentialPayout || 0,
            status: b.status || 'active',
            placedDate: b.placedDate || new Date().toISOString(),
            expiryDate: b.expiryDate || new Date().toISOString(),
          })),
          ...(shorts || []).map((s: any) => ({
            id: `short_${s.id}`,
            type: 'short_bet' as const,
            title: `Short ${safeSlice(s.opinionText || 'Unknown', 30)}`,
            subtitle: `${s.targetDropPercentage || 0}% drop`,
            amount: s.betAmount || 0,
            potentialPayout: s.potentialWinnings || 0,
            status: s.status || 'active',
            placedDate: s.createdDate || new Date().toISOString(),
            expiryDate: s.expirationDate || new Date().toISOString(),
            progress: s.startingPrice && s.currentPrice && s.targetPrice
              ? ((s.startingPrice - s.currentPrice) / (s.startingPrice - s.targetPrice)) * 100
              : 0,
          })),
        ];

        // Sort by most recent first (descending order)
        merged.sort(
          (a, b) => new Date(b.placedDate).getTime() - new Date(a.placedDate).getTime()
        );

        setActivities(merged);

        /* 4️⃣ Fill sidebar with all opinion texts (lightweight) */
        try {
          const allOpinions = await fds.searchOpinions('', 500); // Get all opinions for sidebar
          setSidebarOpinions(
            allOpinions.map((opinion) => ({ id: opinion.id, text: opinion.text }))
          );
        } catch (error) {
          console.warn('Could not load sidebar opinions:', error);
          setSidebarOpinions([]);
        }
      } catch (err) {
        console.error(err);
        setMsg('Error loading data');
      }
    };

    run();
  }, [ready, username]);

  /* ---------------------------------------------------------------- */
  /* 📈 derived figures                                               */
  /* ---------------------------------------------------------------- */
  const portfolioValue = useMemo(
    () =>
      opinions.reduce(
        (tot, o) => tot + o.currentPrice * o.quantity,
        0
      ),
    [opinions]
  );

  const pnl = useMemo(
    () =>
      opinions.reduce(
        (tot, o) => tot + (o.currentPrice - o.purchasePrice) * o.quantity,
        0
      ),
    [opinions]
  );

  /* ---------------------------------------------------------------- */
  /* 🎨  UI                                                           */
  /* ---------------------------------------------------------------- */
  if (!ready) return <div>Loading…</div>;
  if (msg)     return <div>{msg}</div>;
  if (!profile) return <div>User not found.</div>;

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content" style={{ padding: 20 }}>
        {/* ── header/nav ───────────────────────────────────────────── */}
        <div className={styles.topNavigation}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold'
            }}>
              O
            </div>
            <div>
              <h1 className={styles.pageTitle} style={{ margin: 0, fontSize: '24px' }}>
                {profile.username}
              </h1>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🤖 Bots: Active Globally
                <span style={{ fontSize: '12px' }}>
                  Member since {new Date().toLocaleDateString()} Opinion Trader & Collector
                </span>
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => router.push('/users')} className="nav-button">
              <ScanSmiley size={20}/> View Traders
            </button>
            <a href="/feed" className="nav-button"><Rss size={20}/> Live Feed</a>
            <a href="/generate" className="nav-button"><Balloon size={20}/> Generate</a>
          </div>
        </div>

        {/* ── Info Banner ─────────────────────────────────────────── */}
        <div style={{
          background: 'var(--light-green)',
          border: '1px solid #22c55e',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            AI traders are active across all pages - they'll keep trading even when you navigate away
          </span>
          <button style={{
            background: 'var(--red)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Stop Global Bots
          </button>
        </div>

        {/* ── wallet overview ─────────────────────────────────────── */}
        <section className={styles.walletOverview}>
          <div className={styles.walletCard}>
            <h3><CurrencyCircleDollar size={20}/> Wallet</h3>
            <p>${profile.balance.toLocaleString()}</p>
          </div>

          <div className={styles.walletCard}>
            <h3><ChartLine size={20}/> Portfolio</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>

          <div
            className={`${styles.walletCard} ${
              pnl >= 0 ? styles.positive : styles.negative
            }`}
          >
            <h3><Folder size={20}/> P&nbsp;&amp;&nbsp;L</h3>
            <p>{pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}</p>
          </div>

          <div className={styles.walletCard}>
            <h3><DiceSix size={20}/> Active Bets</h3>
            <p>{activities.filter(a => a.status === 'active').length}</p>
          </div>
        </section>

        {/* ── opinion holdings ───────────────────────────────────── */}
        <section className={styles.section}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            margin: '0 0 20px 0',
            color: 'var(--text-primary)'
          }}>
            My Opinion Portfolio
          </h2>
          {opinions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No holdings yet.</p>
            </div>
          ) : (
            <div className={styles.holdingsGrid}>
              {opinions.map(op => (
                <a
                  key={op.id}
                  href={`/opinion/${encodeURIComponent(op.text)}`}
                  className={styles.opinionCard}
                >
                  <p className={styles.opinionText}>
                    “{safeSlice(op.text, 70)}”
                  </p>
                  <div className={styles.opinionMeta}>
                    <span>Qty {op.quantity}</span>
                    <span>
                      ${op.currentPrice.toFixed(2)}{' '}
                      <small
                        className={
                          op.currentPrice - op.purchasePrice >= 0
                            ? styles.positive
                            : styles.negative
                        }
                      >
                        {op.currentPrice - op.purchasePrice >= 0 ? '+' : ''}
                        ${(op.currentPrice - op.purchasePrice).toFixed(2)}
                      </small>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ── active bets & shorts ───────────────────────────────── */}
        <section className={styles.section}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <TrendUp size={20}/> Active Bets & Shorts
          </h2>
          {activities.filter(a => a.status === 'active').length === 0 ? (
            <div className={styles.emptyState}>
              <p>No active bets or shorts.</p>
            </div>
          ) : (
            <div className={styles.betGrid}>
              {activities
                .filter(a => a.status === 'active')
                .map(activity => (
                  <div key={activity.id} className={styles.betCard}>
                    <div className={styles.betHeader}>
                      <strong>{activity.title}</strong>
                      <div className={styles.betSubtitle}>{activity.subtitle}</div>
                    </div>
                    <div className={styles.betPayout}>
                      <span>Bet: ${activity.amount.toFixed(2)}</span>
                      <span>Potential: ${activity.potentialPayout.toFixed(2)}</span>
                    </div>
                    {activity.progress !== undefined && (
                      <div style={{ 
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px'
                      }}>
                        Progress: {activity.progress.toFixed(1)}%
                      </div>
                    )}
                    <div style={{ 
                      fontSize: '12px',
                      color: 'var(--text-secondary)'
                    }}>
                      Expires: {new Date(activity.expiryDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* ── recent activity ────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShoppingBag size={20}/> Recent Activity
          </h2>
          {transactions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No recent activity.</p>
            </div>
          ) : (
            <div className={styles.activityList}>
              {transactions.slice(0, 10).map(tx => (
                <div key={tx.id} className={styles.activityItem}>
                  <div className={styles.activityLeft}>
                    <div className={styles.activityType}>
                      {tx.type === 'buy' ? 'Buy' : 
                       tx.type === 'sell' ? 'Sell' : 
                       tx.type === 'earn' ? 'Earn' : 
                       tx.type === 'bet_win' ? 'Bet Win' : 
                       tx.type === 'bet_loss' ? 'Bet Loss' : 
                       tx.type === 'bet_place' ? 'Bet Place' : 
                       tx.type === 'short_place' ? 'Short Place' : 
                       tx.type === 'short_win' ? 'Short Win' : 
                       tx.type === 'short_loss' ? 'Short Loss' : 
                       'Transaction'}
                    </div>
                    <div className={styles.activityDescription}>
                      {tx.description || (tx.opinionText ? `"${safeSlice(tx.opinionText, 50)}"` : 'No description')}
                      {tx.quantity && tx.quantity > 1 && ` (${tx.quantity} shares)`}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)',
                      marginTop: '4px'
                    }}>
                      {new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString()}
                    </div>
                  </div>
                  <div 
                    className={`${styles.activityAmount} ${
                      tx.type === 'buy' || tx.type === 'bet_place' || tx.type === 'short_place' || tx.type === 'bet_loss' || tx.type === 'short_loss'
                        ? styles.negative 
                        : styles.positive
                    }`}
                  >
                    {tx.type === 'buy' || tx.type === 'bet_place' || tx.type === 'short_place' || tx.type === 'bet_loss' || tx.type === 'short_loss' 
                      ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
