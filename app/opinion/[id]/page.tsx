'use client';

/**
 * Opinion detail page – combines the **new Firestore‑centric data layer** with the
 * richer **UI/UX** from the legacy design. All timestamps are ISO strings and
 * we rely on FirebaseDataService for reads/writes – no localStorage business
 * logic is re‑introduced. (Buy/Sell/Short handlers are left as TODO stubs so the
 * file compiles even if you haven’t rebuilt those flows yet.)
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { FirebaseDataService } from '../../lib/firebase-data-service';

/* ── UI components & assets ─────────────────────────────────────────────── */
import Sidebar from '../../components/Sidebar';
import AuthModal from '../../components/AuthModal';
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
  CheckSquare,
} from '@phosphor-icons/react';
import styles from './page.module.css';

/* ── Data shapes ─────────────────────────────────────────────────────────── */
interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string; // ISO
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'create' }[];
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
}
interface OpinionAttribution {
  author: string;
  isBot: boolean;
  dateCreated: string;
  source: 'user' | 'bot_generated';
}

/* ── Helper utils ────────────────────────────────────────────────────────── */
const iso = () => new Date().toISOString();
const ts = (x: any): string => {
  if (!x) return iso();
  if (typeof x === 'string') return x;
  if (typeof x.toDate === 'function') return x.toDate().toISOString();
  if (x instanceof Date) return x.toISOString();
  return iso();
};
const priceDeltaClass = (delta: number) =>
  delta > 0 ? styles.positive : delta < 0 ? styles.negative : styles.neutral;

/* ── Component ───────────────────────────────────────────────────────────── */
export default function OpinionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const fds = FirebaseDataService.getInstance();

  /* Client‑only gate (avoid hydration mismatches) */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  /* State */
  const [doc, setDoc] = useState<OpinionDocument | null>(null);
  const [market, setMarket] = useState<OpinionMarketData | null>(null);
  const [attr, setAttr] = useState<OpinionAttribution | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    username: 'Loading…',
    balance: 0,
    joinDate: iso(),
    totalEarnings: 0,
    totalLosses: 0,
  });
  const [msg, setMsg] = useState('');
  const popMsg = (m: string, ms = 5000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  /* Trend helpers */
  const trend = useMemo(() => {
    if (!market) return { icon: FlowerLotus, label: 'Stable', className: 'stable' };
    const net = market.timesPurchased - market.timesSold;
    if (net > 5) return { icon: RocketLaunch, label: 'Bullish', className: 'bullish' };
    if (net > 2) return { icon: ChartLineUp, label: 'Rising', className: 'bullish' };
    if (net > -2) return { icon: FlowerLotus, label: 'Stable', className: 'stable' };
    if (net > -5) return { icon: ChartLineDown, label: 'Declining', className: 'bearish' };
    return { icon: Skull, label: 'Bearish', className: 'bearish' };
  }, [market]);

  /* Data loader */
  useEffect(() => {
    if (!ready || typeof id !== 'string') return;

    const run = async () => {
      try {
        // 1️⃣ Doc‑id first
        let d: OpinionDocument | undefined;
        try {
          const { doc: fsDoc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase');
          const snap = await getDoc(fsDoc(db, 'opinions', id));
          if (snap.exists()) d = snap.data() as OpinionDocument;
        } catch {
          /* ignore */
        }

        // 2️⃣ Legacy array‑index fallback
        if (!d) {
          const docs = await fds.getOpinions(100);
          const idx = parseInt(id, 10);
          if (!isNaN(idx)) d = docs[idx] as OpinionDocument | undefined;
        }

        if (!d) {
          popMsg('Opinion not found');
          return;
        }

        setDoc(d);
        setAttr({
          author: d.author ?? 'Unknown',
          isBot: !!d.isBot,
          source: d.source ?? 'user',
          dateCreated: ts(d.createdAt),
        });

        // Market data
        const mdList = await fds.getMarketData(d.text);
        const found: any = mdList.find((m) => m.opinionText === d.text);
        if (found) {
          const { id: _omit, ...rest } = found;
          setMarket({
            ...rest,
            lastUpdated: ts(rest.lastUpdated),
            priceHistory: (rest.priceHistory || []).map((p: any) => ({
              price: p.price,
              timestamp: ts(p.timestamp),
              action: p.action,
            })),
            liquidityScore: rest.liquidityScore ?? 0,
            dailyVolume: rest.dailyVolume ?? 0,
          });
        }

        // User profile
        if (user?.uid) {
          const p = await fds.getUserProfile(user.uid);
          if (p) {
            setProfile({
              username: p.username,
              balance: p.balance,
              joinDate: ts(p.joinDate),
              totalEarnings: p.totalEarnings,
              totalLosses: p.totalLosses,
            });
          }
        }
      } catch (err) {
        console.error(err);
        popMsg('Error loading data');
      }
    };

    run();
  }, [id, ready, user?.uid]);

  /* Derived chart data */
  const chart = useMemo(() => {
    if (!market) return null;
    const hist = market.priceHistory.length ? market.priceHistory : [
      { price: market.basePrice, timestamp: market.lastUpdated, action: 'create' },
    ];
    const min = Math.min(...hist.map((h) => h.price));
    const max = Math.max(...hist.map((h) => h.price));
    const range = max - min || 1;
    return { hist, min, max, range };
  }, [market]);

  /* Placeholder trading handlers (TODO) */
  const buy = () => popMsg('Buy flow – TODO');
  const sell = () => popMsg('Sell flow – TODO');
  const openShort = () => popMsg('Short flow – TODO');

  /* Auth gate */
  if (!ready) return <div>Loading…</div>;
  if (!user) {
    return (
      <div className={styles.container}>Please sign in.</div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        {/* Header & nav */}
        <div className={styles.pageHeader}>
          <button onClick={() => router.back()} className={styles.backButton}>
            <ArrowLeft size={24} /> Back
          </button>

          <div className={styles.headerActions}>
            <a href="/users" className="nav-button traders"><ScanSmiley size={24} /> Traders</a>
            <a href="/feed" className="nav-button feed"><RssSimple size={24} /> Feed</a>
            <a href="/generate" className="nav-button generate"><Balloon size={24} /> Generate</a>
            <div className={styles.walletDisplay}>
              <PiggyBank size={28} weight="fill" /> ${profile.balance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Opinion card */}
        <div className={styles.opinionCard}>
          <div className={styles.opinionText}>{doc?.text}</div>
          {attr && (
            <div className={styles.attributionLine}>
              <span>{attr.isBot ? '🤖' : '👤'} {attr.author}</span> •{' '}
              <span>{new Date(attr.dateCreated).toLocaleDateString()}</span>
            </div>
          )}

          {/* Market mini‑stats */}
          {market && (
            <div className={styles.marketStatsRow}>
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Price</span>
                <span className={styles.statValue}>${market.currentPrice.toFixed(2)}</span>
              </div>
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Buys</span>
                <span className={styles.statValue}>{market.timesPurchased}</span>
              </div>
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Sells</span>
                <span className={styles.statValue}>{market.timesSold}</span>
              </div>
              <div className={`${styles.statTile} ${styles[trend.className]}`}>
                <span className={styles.statLabel}>Trend</span>
                <span className={styles.statValue}><trend.icon size={20} /> {trend.label}</span>
              </div>
            </div>
          )}

          {/* Price spark‑chart (simple bars) */}
          {chart && (
            <div className={styles.chartStrip}>
              {chart.hist.map((h, i) => {
                const pct = ((h.price - chart.min) / chart.range) * 100;
                const delta = i === 0 ? 0 : h.price - chart.hist[i - 1].price;
                return (
                  <div key={i} className={styles.chartBarWrapper} title={`${h.price.toFixed(2)} @ ${new Date(h.timestamp).toLocaleString()}`}>
                    <div
                      className={`${styles.chartBar} ${priceDeltaClass(delta)}`}
                      style={{ height: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actionRow}>
            <button className={`${styles.actionButton} ${styles.buy}`} onClick={buy}>Buy</button>
            <button className={`${styles.actionButton} ${styles.sell}`} onClick={sell}>Sell</button>
            <button className={`${styles.actionButton} ${styles.short}`} onClick={openShort} title="Short (TODO)"><Ticket size={18} weight="fill" /> Short</button>
          </div>

          {msg && <div className={styles.message}>{msg}</div>}
        </div>

        {/* Details accordion */}
        {market && (
          <Accordion title="Market details">
            <pre className={styles.json}>{JSON.stringify(market, null, 2)}</pre>
          </Accordion>
        )}
      </main>
    </div>
  );
}
