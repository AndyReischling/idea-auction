// app/lib/firebase-data-service.ts
// -----------------------------------------------------------------------------
// Firestore wrapper (singleton) – **2025-07** refresh
// -----------------------------------------------------------------------------

import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  QueryConstraint,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9_9vbw7jTunztB5almko8YGLvEAFMhBM",
  authDomain: "idea-auction.firebaseapp.com",
  projectId: "idea-auction",
  storageBucket: "idea-auction.firebasestorage.app",
  messagingSenderId: "883026956008",
  appId: "1:883026956008:web:592cb6387b0ca81bf4435d",
  measurementId: "G-78MY9HRLSF"
};

// -----------------------------------------------------------------------------
// ☝🏼  Init (if not done elsewhere)
// -----------------------------------------------------------------------------
const app   = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// -----------------------------------------------------------------------------
// 🏷️  Interfaces (trimmed for brevity – unchanged ones omitted)
// -----------------------------------------------------------------------------
export interface UserProfile {
  uid: string;
  username: string;
  balance: number;
  totalEarnings: number;
  totalLosses: number;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Opinion {
  id: string;
  text: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketData {
  id: string;
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: Date;
}

// -----------------------------------------------------------------------------
// 🔧  Helpers
// -----------------------------------------------------------------------------
const toDate = (v: any): Date =>
  v instanceof Date
    ? v
    : v?.seconds
    ? new Date(v.seconds * 1000)
    : typeof v === 'string' || typeof v === 'number'
    ? new Date(v)
    : new Date();

const toTimestamp = (d?: Date) => (d ? Timestamp.fromDate(d) : serverTimestamp());

function mapSnapshot<T>(snap: any): T {
  const data = snap.data();
  // Call-site knows the real shape – here we only normalise dates
  Object.keys(data).forEach((k) => {
    if (data[k]?.seconds !== undefined) data[k] = toDate(data[k]);
  });
  return { id: snap.id, ...data } as T;
}

// Firestore allows max 500 writes per batch
const BATCH_LIMIT = 500;

// -----------------------------------------------------------------------------
//  🍱  Singleton service
// -----------------------------------------------------------------------------
class FirebaseDataService {
  /* ------------------------------------------------------------------------
   * USER PROFILES
   * --------------------------------------------------------------------- */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? mapSnapshot<UserProfile>(snap) : null;
  }

  async createUserProfile(uid: string, payload: Partial<UserProfile>) {
    await setDoc(doc(db, 'users', uid), {
      ...payload,
      uid,
      joinDate: toTimestamp(payload.joinDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUserProfile(uid: string, updates: Partial<UserProfile>) {
    const patch: any = { ...updates, updatedAt: serverTimestamp() };
    if (updates.joinDate) patch.joinDate = toTimestamp(updates.joinDate);
    await updateDoc(doc(db, 'users', uid), patch);
  }

  /* ------------------------------------------------------------------------
   * LIGHTWEIGHT TEXT SEARCH (prefix match – Firestore-native)
   * --------------------------------------------------------------------- */
  async searchOpinions(qText: string, limit = 20): Promise<Opinion[]> {
    const q = query(
      collection(db, 'opinions'),
      where('text', '>=', qText),
      where('text', '<=', qText + '\uf8ff'),
      fsLimit(limit)
    );
    return (await getDocs(q)).docs.map(mapSnapshot<Opinion>);
  }

  async searchUsers(qName: string, limit = 20): Promise<UserProfile[]> {
    const q = query(
      collection(db, 'users'),
      where('username', '>=', qName),
      where('username', '<=', qName + '\uf8ff'),
      fsLimit(limit)
    );
    return (await getDocs(q)).docs.map(mapSnapshot<UserProfile>);
  }

  /* ------------------------------------------------------------------------
   * LIST HELPERS (dashboard / leaderboard)
   * --------------------------------------------------------------------- */
  async listUsers(limit = 50): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), orderBy('balance', 'desc'), fsLimit(limit));
    return (await getDocs(q)).docs.map(mapSnapshot<UserProfile>);
  }

  /** Pulls the public profile **plus** the portfolio value in one call */
  async listUsersWithPortfolios(limit = 50) {
    const users = await this.listUsers(limit);
    const portfolios: Record<string, number> = {};

    // fetch portfolios in parallel
    await Promise.all(
      users.map(async (u) => {
        const pSnap = await getDoc(doc(db, 'user-portfolios', u.uid));
        const p = pSnap.exists() ? pSnap.data() : {};
        portfolios[u.uid] = p.totalValue ?? 0;
      })
    );

    return users.map((u) => ({ ...u, portfolioValue: portfolios[u.uid] }));
  }

  /* ------------------------------------------------------------------------
   * INCREMENTS – safe counters without race conditions
   * --------------------------------------------------------------------- */
  async incrementUserStat(uid: string, field: 'balance' | 'totalEarnings' | 'totalLosses', by = 1) {
    await updateDoc(doc(db, 'users', uid), {
      [field]: increment(by),
      updatedAt: serverTimestamp(),
    });
  }

  async incrementMarketStat(
    opinionText: string,
    field: 'timesPurchased' | 'timesSold',
    by = 1
  ) {
    const id = `market_${opinionText.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}`;
    await updateDoc(doc(db, 'market-data', id), {
      [field]: increment(by),
      lastUpdated: serverTimestamp(),
    });
  }

  /* ------------------------------------------------------------------------
   * DANGER-ZONE – batch delete (dev / tests)
   * --------------------------------------------------------------------- */
  async deleteCollectionDocs(colName: string, whereClause?: QueryConstraint) {
    const q = whereClause
      ? query(collection(db, colName), whereClause, fsLimit(BATCH_LIMIT))
      : query(collection(db, colName), fsLimit(BATCH_LIMIT));

    const snaps = await getDocs(q);
    if (snaps.empty) return 0;

    const batch = writeBatch(db);
    snaps.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return snaps.size;
  }
}

// public singleton
export const firebaseDataService = new FirebaseDataService();
