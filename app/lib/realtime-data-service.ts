// Updated RealtimeDataService – Firestore‑only (no localStorage)
// -----------------------------------------------------------------------------
// ‼️  This refactor removes every localStorage reference. All reads/writes now
//     flow exclusively through Firestore – which already provides an offline
//     persistence layer. The public API surface of the class is unchanged, so
//     other imports keep working.

"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "firebase/auth";

// -----------------------------------------------------------------------------
// 🔖  Types
// -----------------------------------------------------------------------------
interface RealtimeDataConfig {
  /** whether Firestore listeners/write ops are enabled */
  useFirebase: boolean;
  /** ms between polling refreshes (cache invalidation) */
  syncInterval: number;
  /** true when navigator reports offline – purely informational */
  offlineMode: boolean;
}

interface DataSubscription {
  id: string;
  collection: string;
  userId?: string;
  callback: (data: any) => void;
  unsubscribe?: Unsubscribe;
  isActive: boolean;
}

interface CachedData {
  [key: string]: {
    data: any;
    timestamp: string;
    source: "firebase";
    isStale: boolean;
  };
}

// -----------------------------------------------------------------------------
// 🏗  RealtimeDataService (singleton)
// -----------------------------------------------------------------------------
export class RealtimeDataService {
  private static instance: RealtimeDataService;

  private subscriptions = new Map<string, DataSubscription>();
  private cache: CachedData = {};
  private config: RealtimeDataConfig = {
    useFirebase: true,
    syncInterval: 5_000,
    offlineMode: false,
  };
  private isOnline = true;
  private currentUser: User | null = null;

  // Firestore collection references
  private readonly collections = {
    users: collection(db, "users"),
    opinions: collection(db, "opinions"),
    marketData: collection(db, "market-data"),
    transactions: collection(db, "transactions"),
    activityFeed: collection(db, "activity-feed"),
    userPortfolios: collection(db, "user-portfolios"),
  } as const;

  private constructor() {
    this.setupNetworkMonitoring();
    this.setupAuthListener();
  }

  public static getInstance() {
    if (!RealtimeDataService.instance) {
      RealtimeDataService.instance = new RealtimeDataService();
    }
    return RealtimeDataService.instance;
  }

  // ---------------------------------------------------------------------------
  // 🌐  Network & auth state
  // ---------------------------------------------------------------------------
  private setupNetworkMonitoring() {
    if (typeof window === "undefined") return;
    this.isOnline = navigator.onLine;
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.config.offlineMode = false;
      console.log("🌐 Online – Firestore sync resumed");
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.config.offlineMode = true;
      console.log("🌐 Offline – Firestore persistence only (reads are cached)");
    });
  }

  private setupAuthListener() {
    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      if (user) {
        console.log("👤 Signed‑in user detected – enabling realtime sync");
        this.refreshAllSubscriptions();
      } else {
        console.log("👤 No user – clearing subscriptions");
        this.stopAllSubscriptions();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 👤  User profile helpers
  // ---------------------------------------------------------------------------
  async getUserProfile(uid: string = this.currentUser?.uid!): Promise<any | null> {
    if (!uid) return null;
    const cacheKey = `userProfile_${uid}`;
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    try {
      const snap = await getDoc(doc(this.collections.users, uid));
      if (!snap.exists()) return null;
      const data = snap.data();
      this.updateCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      return null;
    }
  }

  subscribeToUserProfile(uid: string, cb: (p: any) => void) {
    const id = `userProfile_${uid}`;
    const unsub = onSnapshot(doc(this.collections.users, uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        this.updateCache(id, data);
        cb(data);
      }
    });
    this.subscriptions.set(id, { id, collection: "users", userId: uid, callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // 💬  Opinions (per‑user)
  // ---------------------------------------------------------------------------
  async getOpinions(): Promise<string[]> {
    if (!this.currentUser) return [];
    const cacheKey = "opinions";
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    const q = query(this.collections.opinions, where("createdBy", "==", this.currentUser.uid));
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => d.data())
      .filter((d) => d.text)
      .sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds)
      .map((d: any) => d.text as string);

    this.updateCache(cacheKey, list);
    return list;
  }

  // Get all public opinions (for home page/marketplace)
  async getAllOpinions(): Promise<string[]> {
    const cacheKey = "allOpinions";
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    const q = query(this.collections.opinions, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => d.data())
      .filter((d) => d.text)
      .map((d: any) => d.text as string);

    this.updateCache(cacheKey, list);
    return list;
  }

  subscribeToOpinions(cb: (ops: string[]) => void) {
    if (!this.currentUser) {
      cb([]);
      return "opinions";
    }
    const id = "opinions";
    const q = query(this.collections.opinions, where("createdBy", "==", this.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .filter((d) => d.text)
        .sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds)
        .map((d: any) => d.text as string);
      this.updateCache(id, list);
      cb(list);
    });
    this.subscriptions.set(id, { id, collection: "opinions", callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  subscribeToAllOpinions(cb: (ops: string[]) => void) {
    const id = "allOpinions";
    const q = query(this.collections.opinions, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data())
        .filter((d) => d.text)
        .map((d: any) => d.text as string);
      this.updateCache(id, list);
      cb(list);
    });
    this.subscriptions.set(id, { id, collection: "opinions", callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // 💲  Market data
  // ---------------------------------------------------------------------------
  async getMarketData() {
    const cacheKey = "marketData";
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    const snap = await getDocs(this.collections.marketData);
    const map: any = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.opinionText) map[data.opinionText] = data;
    });
    this.updateCache(cacheKey, map);
    return map;
  }

  subscribeToMarketData(cb: (m: any) => void) {
    const id = "marketData";
    const unsub = onSnapshot(this.collections.marketData, (snap) => {
      const map: any = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.opinionText) map[data.opinionText] = data;
      });
      this.updateCache(id, map);
      cb(map);
    });
    this.subscriptions.set(id, { id, collection: "market-data", callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // 📜  Activity feed
  // ---------------------------------------------------------------------------
  async getActivityFeed(limitCount = 100) {
    const cacheKey = `activityFeed_${limitCount}`;
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    const q = query(this.collections.activityFeed, orderBy("timestamp", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() ?? d.data().timestamp }));
    this.updateCache(cacheKey, list);
    return list;
  }

  subscribeToActivityFeed(cb: (arr: any[]) => void, limitCount = 100) {
    const id = `activityFeed_${limitCount}`;
    const q = query(this.collections.activityFeed, orderBy("timestamp", "desc"), limit(limitCount));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() ?? d.data().timestamp }));
      this.updateCache(id, list);
      cb(list);
    });
    this.subscriptions.set(id, { id, collection: "activity-feed", callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // 💸  Transactions
  // ---------------------------------------------------------------------------
  async getUserTransactions(uid: string = this.currentUser?.uid!): Promise<any[]> {
    if (!uid) return [];
    const cacheKey = `tx_${uid}`;
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    const q = query(this.collections.transactions, where("userId", "==", uid));
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() ?? d.data().timestamp }))
      .sort((a: any, b: any) => +new Date(b.timestamp) - +new Date(a.timestamp));
    this.updateCache(cacheKey, list);
    return list;
  }

  subscribeToUserTransactions(uid: string, cb: (tx: any[]) => void) {
    const id = `tx_${uid}`;
    const q = query(this.collections.transactions, where("userId", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() ?? d.data().timestamp }))
        .sort((a: any, b: any) => +new Date(b.timestamp) - +new Date(a.timestamp));
      this.updateCache(id, list);
      cb(list);
    });
    this.subscriptions.set(id, { id, collection: "transactions", userId: uid, callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // 💼  Portfolio data
  // ---------------------------------------------------------------------------
  async getUserPortfolio(uid: string = this.currentUser?.uid!): Promise<any[]> {
    if (!uid) return [];
    const cacheKey = `portfolio_${uid}`;
    if (this.cache[cacheKey] && !this.cache[cacheKey].isStale) return this.cache[cacheKey].data;

    try {
      const snap = await getDoc(doc(this.collections.userPortfolios, uid));
      if (!snap.exists()) return [];
      const data = snap.data();
      const ownedOpinions = data?.ownedOpinions || [];
      this.updateCache(cacheKey, ownedOpinions);
      return ownedOpinions;
    } catch (err) {
      console.error("Failed to fetch user portfolio", err);
      return [];
    }
  }

  subscribeToUserPortfolio(uid: string, cb: (portfolio: any[]) => void) {
    const id = `portfolio_${uid}`;
    const unsub = onSnapshot(doc(this.collections.userPortfolios, uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const ownedOpinions = data?.ownedOpinions || [];
        this.updateCache(id, ownedOpinions);
        cb(ownedOpinions);
      } else {
        cb([]);
      }
    });
    this.subscriptions.set(id, { id, collection: "user-portfolios", userId: uid, callback: cb, unsubscribe: unsub, isActive: true });
    return id;
  }

  // ---------------------------------------------------------------------------
  // ✍️  Write helpers
  // ---------------------------------------------------------------------------
  async updateUserProfile(uid: string, updates: any) {
    await updateDoc(doc(this.collections.users, uid), { ...updates, updatedAt: serverTimestamp() });
    this.updateCache(`userProfile_${uid}`, { ...(await this.getUserProfile(uid)), ...updates });
  }

  async addOpinion(text: string) {
    if (!this.currentUser) throw new Error("Not signed in");
    const id = btoa(text).replace(/[^a-zA-Z0-9]/g, "");
    await setDoc(doc(this.collections.opinions, id), {
      text,
      createdBy: this.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  }

  async addTransaction(tx: any) {
    if (!this.currentUser) throw new Error("Not signed in");
    await setDoc(doc(this.collections.transactions, tx.id), { ...tx, userId: this.currentUser.uid, timestamp: serverTimestamp() });
  }

  async updateUserPortfolio(uid: string, ownedOpinions: any[]) {
    await setDoc(doc(this.collections.userPortfolios, uid), { userId: uid, ownedOpinions, lastUpdated: serverTimestamp() }, { merge: true });
  }

  // ---------------------------------------------------------------------------
  // 🔄  Subscription management
  // ---------------------------------------------------------------------------
  unsubscribe(id: string) {
    this.subscriptions.get(id)?.unsubscribe?.();
    this.subscriptions.delete(id);
  }

  stopAllSubscriptions() {
    this.subscriptions.forEach((s) => s.unsubscribe?.());
    this.subscriptions.clear();
  }

  private refreshAllSubscriptions() {
    const active = Array.from(this.subscriptions.values());
    this.stopAllSubscriptions();
    active.forEach((s) => {
      if (!s.isActive) return;
      switch (s.collection) {
        case "users":
          if (s.userId) this.subscribeToUserProfile(s.userId, s.callback);
          break;
        case "opinions":
          this.subscribeToOpinions(s.callback);
          break;
        case "market-data":
          this.subscribeToMarketData(s.callback);
          break;
        case "activity-feed":
          this.subscribeToActivityFeed(s.callback);
          break;
        case "transactions":
          if (s.userId) this.subscribeToUserTransactions(s.userId, s.callback);
          break;
        case "user-portfolios":
          if (s.userId) this.subscribeToUserPortfolio(s.userId, s.callback);
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 📦  Cache helpers
  // ---------------------------------------------------------------------------
  private updateCache(key: string, data: any) {
    this.cache[key] = {
      data,
      timestamp: new Date().toISOString(),
      source: "firebase",
      isStale: false,
    };
    setTimeout(() => (this.cache[key].isStale = true), 30_000);
  }

  clearCache() {
    this.cache = {};
  }

  getCacheStatus() {
    const out: any = {};
    Object.entries(this.cache).forEach(([k, v]) => {
      out[k] = { timestamp: v.timestamp, isStale: v.isStale, hasData: !!v.data };
    });
    return out;
  }
}

// Singleton export
export const realtimeDataService = RealtimeDataService.getInstance();
