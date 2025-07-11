"use client";

/**
 * Traders leaderboard – **Firestore‑native edition**
 * ---------------------------------------------------------------------------
 * All data is sourced straight from Firestore.  *Nothing* touches localStorage
 * any more.  The page still renders the same leaderboard / detailed‑user modals
 * but every query is re‑implemented with typed Firebase helpers.
 *
 * Collections used:
 *   • users               – one doc per user (public profile)
 *   • user-portfolios     – holdings & snapshots → /user-portfolios/{uid}
 *   • market-data         – opinionPrices keyed by opinionText
 *   • opinions            – opinions text catalogue (for sidebar)
 *   • advanced-bets       – portfolio bets
 *   • short-positions     – short positions
 *   • transactions        – recent activity
 *
 * Each query is wrapped in a tiny `useFirestoreCollection` helper so it can be
 * unsubscribed automatically when the component unmounts.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  CollectionReference,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth-context";

/* ── UI ─────────────────────────────────────────────────────────────────── */
import Sidebar from "../components/Sidebar";
import LeaderboardCard from "./components/LeaderboardCard"; // (extract‑ed)
import UserDetailModal from "../components/UserDetailModal"; // (extract‑ed)
import AuthGuard from "../components/AuthGuard";
import ActivityIntegration from "../components/ActivityIntegration";
import styles from "./page.module.css";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface UserDoc {
  id: string;
  username: string;
  joinDate: string; // ISO
  avatar?: string;
}
interface PortfolioDoc {
  userId: string;
  ownedOpinions: Array<{
    opinionId: string;
    opinionText: string;
    quantity: number;
    purchasePrice: number;
  }>;
  shortExposure: number;
  betExposure: number;
  snapshots?: Array<{ value: number; timestamp: string }>;
}
interface OpinionPrice {
  currentPrice: number;
  timesPurchased: number;
  timesSold: number;
}

/* ── Helper hook – live collection subscription ────────────────────────── */
function useCollection<T = any>(ref: CollectionReference, deps: any[] = []) {
  const [docs, setDocs] = useState<T[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(ref, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return docs;
}

/* ── Main Page component ────────────────────────────────────────────────── */
export default function UsersPage() {
  const { user, userProfile } = useAuth();

  /* 1️⃣  Fetch core collections */
  const users = useCollection<UserDoc>(collection(db, "users"));
  const portfolios = useCollection<PortfolioDoc>(collection(db, "user-portfolios"));
  const marketData = useCollection<{ opinionText: string } & OpinionPrice>(collection(db, "market-data"));

  /* 2️⃣  Derived helpers */
  const priceMap = useMemo(() => {
    const m = new Map<string, OpinionPrice>();
    marketData.forEach((d) => m.set(d.opinionText, d));
    return m;
  }, [marketData]);

  const leaderboard = useMemo(() => {
    return users.map((u) => {
      const pf = portfolios.find((p) => p.userId === u.id);
      if (!pf) return null;
      const value = pf.ownedOpinions.reduce((sum, op) => {
        const md = priceMap.get(op.opinionText);
        return sum + (md?.currentPrice ?? op.purchasePrice) * op.quantity;
      }, 0);
      const exposure = (pf.shortExposure || 0) + (pf.betExposure || 0);
      return {
        uid: u.id,
        username: u.username,
        joinDate: u.joinDate,
        portfolioValue: value - exposure,
        exposure,
        opinionsCount: pf.ownedOpinions.length,
      };
    }).filter(Boolean) as any[];
  }, [users, portfolios, priceMap]);

  /* 3️⃣  UI state */
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selectedUser = leaderboard.find((l) => l.uid === selectedUid);

  /* 4️⃣  Sidebar opinions list (static – one‑off fetch) */
  const [opinionTexts, setOpinionTexts] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const qs = query(collection(db, "opinions"), orderBy("createdAt", "desc"), limit(300));
      const snap = await getDocs(qs);
      setOpinionTexts(snap.docs.map((d) => (d.data() as any).text as string));
    })();
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <AuthGuard>
      <ActivityIntegration userProfile={userProfile ? {
        username: userProfile.username,
        balance: userProfile.balance,
        joinDate: userProfile.joinDate instanceof Date ? userProfile.joinDate.toISOString() : String(userProfile.joinDate || new Date().toISOString()),
        totalEarnings: userProfile.totalEarnings,
        totalLosses: userProfile.totalLosses
      } : undefined} />
      <div className="page-container">
        <Sidebar />

        <main className="main-content">
          <h1 className={styles.pageTitle}>Portfolio Leaderboard</h1>

          {leaderboard.length === 0 ? (
            <p style={{ padding: 40 }}>Loading traders…</p>
          ) : (
            <div className={styles.grid}>
              {leaderboard
                .sort((a, b) => b.portfolioValue - a.portfolioValue)
                .map((row, idx) => (
                  <LeaderboardCard
                    key={row.uid}
                    rank={idx + 1}
                    data={row}
                    isMe={row.uid === user?.uid}
                    onClick={() => setSelectedUid(row.uid)}
                  />
                ))}
            </div>
          )}
        </main>

        {selectedUser && (
          <UserDetailModal uid={selectedUser.uid} onClose={() => setSelectedUid(null)} />
        )}
      </div>
    </AuthGuard>
  );
}
