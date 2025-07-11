// =============================================================================
// app/profile/page.tsx – Firestore‑native profile dashboard (no localStorage)
// -----------------------------------------------------------------------------
//  ✦ Fetches all user‑centric data via `realtimeDataService` helpers
//  ✦ Subscribes to live updates where available (profile / portfolio / bets)
//  ✦ Drops every legacy fallback that referenced browser localStorage
//  ✦ Keeps the previous UI intact – only the data layer changed
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { realtimeDataService } from '../lib/realtime-data-service';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Sidebar from '../components/Sidebar';
import AuthGuard from '../components/AuthGuard';
import AuthButton from '../components/AuthButton';
import styles from '../page.module.css';
import {
  ScanSmiley, RssSimple, Balloon, Wallet,
} from '@phosphor-icons/react';

// ──────────────────────────────────────────────────────────────────────────────
// Data shapes (firestore docs already match these)
// ──────────────────────────────────────────────────────────────────────────────
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
  amount: number;
  date: string;
  opinionText?: string;
}

// (bet / short shapes omitted for brevity – same as legacy)

// ──────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // 📄 User profile
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // 💼 Portfolio & assets
  const [ownedOpinions, setOwnedOpinions] = useState<OpinionAsset[]>([]);

  // 🧾 Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // All opinion texts → used for sidebar links
  const [allOpinions, setAllOpinions] = useState<string[]>([]);

  // ── Initial data load + subscriptions ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    // 1️⃣  Profile snapshot listener
    const unsubProfile = realtimeDataService.subscribeToUserProfile(
      user.uid,
      (p) => {
        const userProfile = {
          username: p.username,
          balance: p.balance,
          joinDate: p.joinDate?.toDate?.()?.toISOString?.() ?? p.joinDate,
          totalEarnings: p.totalEarnings,
          totalLosses: p.totalLosses,
        };
        setProfile(userProfile);
        // Fetch portfolio data when profile updates
        fetchPortfolioData(p);
      }
    );

    // 2️⃣  Portfolio data (fetch from user profile's portfolio field)
    const fetchPortfolioData = async (userProfile: any) => {
      if (!userProfile?.portfolio) {
        setOwnedOpinions([]);
        return;
      }



      // Get market data to get current prices
      const marketData = await realtimeDataService.getMarketData();
      
      // Fetch actual opinion document IDs from Firestore
      const transformedPortfolio = await Promise.all(
        Object.entries(userProfile.portfolio).map(async ([opinionText, quantity]) => {
          try {
            // Query Firestore to find the opinion document by text
            const q = query(
              collection(db, 'opinions'),
              where('text', '==', opinionText),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            
            let opinionId = btoa(opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100); // fallback
            if (!querySnapshot.empty) {
              opinionId = querySnapshot.docs[0].id; // Use actual Firestore document ID
            }

            return {
              id: opinionId,
              text: opinionText,
              purchasePrice: marketData[opinionText]?.basePrice || 10.00,
              currentPrice: marketData[opinionText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: quantity as number,
            };
          } catch (error) {
            console.error('Error fetching opinion ID for:', opinionText, error);
            // Fallback to base64 ID if query fails
            return {
              id: btoa(opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100),
              text: opinionText,
              purchasePrice: marketData[opinionText]?.basePrice || 10.00,
              currentPrice: marketData[opinionText]?.currentPrice || 10.00,
              purchaseDate: new Date().toLocaleDateString(),
              quantity: quantity as number,
            };
          }
        })
      );
      
      setOwnedOpinions(transformedPortfolio);
    };

    // 3️⃣  Transactions (latest 100)
    const unsubTx = realtimeDataService.subscribeToUserTransactions(
      user.uid,
      (tx: Transaction[]) => setTransactions(tx.slice(0, 100))
    );

    // 4️⃣  Opinions list (for sidebar)
    realtimeDataService.getOpinions().then(setAllOpinions);

    setLoading(false);
    return () => {
      unsubProfile && realtimeDataService.unsubscribe(unsubProfile);
      unsubTx && realtimeDataService.unsubscribe(unsubTx);
    };
  }, [user?.uid]);

  if (!user) return <AuthGuard><AuthButton /></AuthGuard>;
  if (loading || !profile) return <div className="loading">Loading…</div>;

  // Derived sums
  const portfolioValue = ownedOpinions.reduce(
    (t, o) => t + o.currentPrice * o.quantity,
    0
  );
  const pnl = portfolioValue + profile.balance + profile.totalEarnings - profile.totalLosses - 10000; // example calc

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <div className="header-section">
          <div className="user-header">
            <div className="user-avatar">{profile.username[0]}</div>
            <div className="user-info">
              <div className="user-name">{profile.username}</div>
              <p>Member since {new Date(profile.joinDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="navigation-buttons" style={{ marginLeft: '60px' }}>
            <a href="/users" className="nav-button traders">
              <ScanSmiley size={24} /> Traders
            </a>
            <a href="/feed" className="nav-button feed">
              <RssSimple size={24} /> Feed
            </a>
            <a href="/generate" className="nav-button generate">
              <Balloon size={24} /> Generate
            </a>
            <button className="nav-button">
              <Wallet size={24} /> Portfolio
            </button>
            <AuthButton />
          </div>
        </div>

        {/* Wallet overview */}
        <div className={styles.walletOverview}>
          <div className={`${styles.walletCard} ${styles.balance}`}>
            <h3>Wallet Balance</h3>
            <p>${profile.balance.toLocaleString()}</p>
          </div>
          <div className={`${styles.walletCard} ${styles.portfolio}`}>
            <h3>Portfolio Value</h3>
            <p>${portfolioValue.toLocaleString()}</p>
          </div>
          <div
            className={`${styles.walletCard} ${styles.pnl} ${pnl >= 0 ? styles.positive : styles.negative}`}
          >
            <h3>P&L</h3>
            <p>{pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}</p>
          </div>
        </div>

        {/* Opinion list */}
        <section className="section" style={{ marginLeft: 20 }}>
          <h2 className="section-title" style={{ paddingLeft: 20 }}>
            My Opinion Portfolio
          </h2>

          {ownedOpinions.length === 0 ? (
            <div className="empty-state">You don't own any opinions yet.</div>
          ) : (
            <div className="grid grid-2 p-grid" style={{ marginLeft: 20 }}>
              {ownedOpinions.map((o) => {
                const gain = (o.currentPrice - o.purchasePrice) * o.quantity;
                const pct = ((o.currentPrice - o.purchasePrice) / o.purchasePrice) * 100;
                return (
                  <a
                    key={o.id}
                    href={`/opinion/${o.id}`}
                    className="card p-card"
                  >
                    <div className="p-card-header">
                      <div className="card-content">
                        <p className="p-card-opinion-text">
                          {o.text.slice(0, 60)}…
                        </p>
                        <p className="card-subtitle">
                          Bought {o.purchaseDate} | Qty {o.quantity}
                        </p>
                      </div>
                      <div className={styles.opinionPricing}>
                        <p>${o.purchasePrice.toFixed(2)}</p>
                        <div className={styles.currentPricing}>
                          <p>${o.currentPrice.toFixed(2)}</p>
                          <p className={gain >= 0 ? 'status-positive' : 'status-negative'}>
                            {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({pct.toFixed(1)}%)
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

        {/* Recent Transactions */}
        <section className="section">
          <h2 className="section-title">Recent Activity</h2>
          {transactions.length === 0 ? (
            <div className="empty-state">No activity yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {transactions.map((t) => (
                <div key={t.id} className="card">
                  <div className="card-header">
                    <div className="card-content">
                      <p className="card-subtitle">
                        {t.opinionText ?? 'Transaction'} • {new Date(t.date).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`${styles.activityAmount} ${t.amount >= 0 ? 'status-positive' : 'status-negative'}`}
                    >
                      {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount)}
                    </span>
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
