'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import styles from '../page.module.css';

import {
  ScanSmiley,
  Balloon,
  Wallet,
  Rss,
  CurrencyCircleDollar,
  ChartLine,
  Folder,
  DiceSix,
} from '@phosphor-icons/react';

import { useAuth } from '../../lib/auth-context';
import { firebaseDataService } from '../../lib/firebase-data-service';

/* ------------------------------------------------------------------ */
/* 🔖  Firestore data shapes                                           */
/* ------------------------------------------------------------------ */
interface UserProfile {
  username: string;
  balance: number;
  joinDate: string;      // ISO
  totalEarnings: number;
  totalLosses: number;
  isBot?: boolean;
  botId?: string;
}

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
  const [profile, setProfile]                       = useState<UserProfile>();
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
        const u = await fds.getUserProfile(uname); // Simplified - using existing method
        if (!u) {
          setMsg('User not found');
          return;
        }
        // Convert service UserProfile to local interface
        setProfile({
          username: u.username,
          balance: u.balance,
          joinDate: u.joinDate instanceof Date ? u.joinDate.toISOString() : String(u.joinDate),
          totalEarnings: u.totalEarnings,
          totalLosses: u.totalLosses,
        });

        /* 2️⃣ Grab portfolio + transactions */
        // Simplified implementation using existing methods
        const [allOpinions] = await Promise.all([
          fds.listUsers(100), // Using existing method as placeholder
        ]);

        // setOpinions(ops);
        // setTransactions(txs);

        /* 3️⃣ Merge bets + shorts into one activity array */
        const merged: BettingActivity[] = [
          // ...bets.map((b: any) => ({
          //   id: `bet_${b.id}`,
          //   type: 'portfolio_bet',
          //   title: `Portfolio Bet (${b.betType})`,
          //   subtitle: `${b.targetPercentage}% in ${b.timeFrame}d`,
          //   amount: b.amount,
          //   potentialPayout: b.potentialPayout,
          //   status: b.status,
          //   placedDate: b.placedDate,
          //   expiryDate: b.expiryDate,
          // })),
          // ...shorts.map((s: any) => ({
          //   id: `short_${s.id}`,
          //   type: 'short_bet',
          //   title: `Short ${safeSlice(s.opinionText, 30)}`,
          //   subtitle: `${s.targetDropPercentage}% drop`,
          //   amount: s.betAmount,
          //   potentialPayout: s.potentialWinnings,
          //   status: s.status,
          //   placedDate: s.createdDate,
          //   expiryDate: s.expirationDate,
          //   progress:
          //     ((s.startingPrice - s.currentPrice) /
          //       (s.startingPrice - s.targetPrice)) *
          //     100,
          // })),
        ];

        // Sort only if array has items
        if (merged.length > 0) {
          merged.sort(
            (a, b) => new Date(b.placedDate).getTime() - new Date(a.placedDate).getTime()
          );
        }

        setActivities(merged);

        /* 4️⃣ Fill sidebar with all opinion texts (lightweight) */
        // const allOpinionTexts = await fds.getAllOpinionTexts({ limit: 500 });
        setSidebarOpinions([
          // allOpinionTexts.map((t: string, i: number) => ({ id: String(i), text: t }))
        ]);
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
            <ScanSmiley size={38} />
            <h1 className={styles.pageTitle}>{profile.username}</h1>
          </div>
          <div className={styles.headerActions}>
            <a href="/feed"     className="nav-button feed"><Rss size={24}/> Live Feed</a>
            <a href="/generate" className="nav-button generate"><Balloon size={24}/> Generate</a>
            <button onClick={() => router.push('/profile')} className="nav-button traders">
              <Wallet size={24}/> My Portfolio
            </button>
          </div>
        </div>

        {/* ── wallet overview ─────────────────────────────────────── */}
        <section className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3><CurrencyCircleDollar size={20}/> Wallet</h3>
            <p>${profile.balance.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.portfolio}`}>
            <h3><ChartLine size={20}/> Portfolio</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>

          <div
            className={`${styles.walletCard} ${styles.pnl} ${
              pnl >= 0 ? styles.positive : styles.negative
            }`}
          >
            <h3><Folder size={20}/> P&nbsp;&amp;&nbsp;L</h3>
            <p>{pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}</p>
          </div>

          <div className={`${styles.walletCard} ${styles.bets}`}>
            <h3><DiceSix size={20}/> Active Bets</h3>
            <p>{activities.filter(a => a.status === 'active').length}</p>
          </div>
        </section>

        {/* ── opinion holdings (simplified) ───────────────────────── */}
        <section style={{ marginTop: 32 }}>
          <h2>Opinion Holdings</h2>
          {opinions.length === 0 ? (
            <p>No holdings yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
              {opinions.map(op => (
                <a
                  key={op.id}
                  href={`/opinion/${op.id}`}
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
                        {(op.currentPrice - op.purchasePrice).toFixed(2)}
                      </small>
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ── betting activity (compact) ──────────────────────────── */}
        <section style={{ marginTop: 48 }}>
          <h2>Portfolio Bets &amp; Shorts</h2>
          {activities.length === 0 ? (
            <p>No betting activity.</p>
          ) : (
            <div className={styles.betGrid}>
              {activities.slice(0, 12).map(act => (
                <div key={act.id} className={styles.betCard}>
                  <div className={styles.betHeader}>
                    <strong>{act.title}</strong>
                    <span className={styles[act.status]}>{act.status}</span>
                  </div>
                  <p className={styles.betSubtitle}>{act.subtitle}</p>
                  {act.type === 'short_bet' && (
                    <small>Progress {act.progress?.toFixed(1)}%</small>
                  )}
                  <p className={styles.betPayout}>
                    {act.status === 'active' && `Potential $${act.potentialPayout}`}
                    {act.status === 'won'    && `Won $${act.potentialPayout}`}
                    {act.status === 'lost'   && `Lost $${act.amount}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── recent transactions ─────────────────────────────────── */}
        <section style={{ marginTop: 48 }}>
          <h2>Recent Activity</h2>
          {transactions.length === 0 ? (
            <p>No recent transactions.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {transactions.map(tx => (
                <li key={tx.id} className={styles.txRow}>
                  <span>{tx.type}</span>
                  <span>{tx.description || tx.opinionText || '—'}</span>
                  <span
                    className={
                      tx.amount >= 0 ? styles.positive : styles.negative
                    }
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    ${tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
