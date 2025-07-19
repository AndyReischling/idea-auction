"use client";

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { createMarketDataDocId } from './document-id-utils';

// -----------------------------------------------------------------------------
// 🏷️  Types
// -----------------------------------------------------------------------------
export interface MarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  updatedBy: string;
  priceHistory?: PricePoint[];
}

export interface PricePoint {
  price: number;
  timestamp: string;
  action: 'buy' | 'sell';
}

// -----------------------------------------------------------------------------
// 🔄  Market‑data synchroniser (Firestore‑only)
// -----------------------------------------------------------------------------
/**
 * All former `localStorage` reads/writes have been removed.  Firestore is the
 * single source of truth.  Every helper either *reads from* or *writes to*
 * the `market-data` collection.
 */
export class MarketDataSyncService {
  private static instance: MarketDataSyncService;
  private readonly marketCol = collection(db, 'market-data');
  private realtimeUnsubscribes: Array<() => void> = [];

  // ---------------------------------------------------------------------------
  // 🛠  Singleton – call `MarketDataSyncService.getInstance()`
  // ---------------------------------------------------------------------------
  public static getInstance(): MarketDataSyncService {
    if (!MarketDataSyncService.instance) {
      MarketDataSyncService.instance = new MarketDataSyncService();
    }
    return MarketDataSyncService.instance;
  }

  // ---------------------------------------------------------------------------
  // 📈  Price formula – same logic, but side‑effect‑free
  // ---------------------------------------------------------------------------
  private calculatePrice(purchased: number, sold: number, base = 10): number {
    const net = purchased - sold;
    const multiplier = net >= 0 ? Math.pow(1.001, net) : Math.max(0.1, Math.pow(0.999, Math.abs(net)));
    return Math.round(Math.max(base * 0.5, base * multiplier) * 100) / 100;
  }

  private createDocId(text: string) {
    return createMarketDataDocId(text);
  }

  // ---------------------------------------------------------------------------
  // 🚀  Public helpers
  // ---------------------------------------------------------------------------
  /**
   * Atomically updates an opinion’s market counters in Firestore.  If the doc
   * does not yet exist it is created on‑the‑fly.
   */
  async updateMarketData(opinionText: string, action: 'buy' | 'sell', userId: string): Promise<void> {
    const text = opinionText.trim();
    if (!text) return;

    const docRef = doc(this.marketCol, this.createDocId(text));

    // First try to increment existing counters. If the doc is missing we fall
    // back to a create‑with‑merge so we never throw “not‑found”.
    try {
      await updateDoc(docRef, {
        timesPurchased: action === 'buy' ? increment(1) : increment(0),
        timesSold: action === 'sell' ? increment(1) : increment(0),
        lastUpdated: serverTimestamp(),
        updatedBy: userId,
      });
    } catch (err) {
      const code = (err as FirestoreError).code;
      if (code !== 'not-found') throw err;

      // Doc doesn’t exist – create it with sensible defaults.
      const basePrice = 10;
      const baseDoc: MarketData = {
        opinionText: text,
        timesPurchased: action === 'buy' ? 1 : 0,
        timesSold: action === 'sell' ? 1 : 0,
        basePrice,
        currentPrice: basePrice,
        lastUpdated: new Date().toISOString(),
        updatedBy: userId,
      };
      await setDoc(docRef, baseDoc, { merge: true });
    }

    // Price recalculation happens separately so the increment op can finish.
    await this.recalculatePrice(text);
  }

  /** Fetch a single opinion’s market data (server snapshot). */
  async getMarketData(opinionText: string): Promise<MarketData | null> {
    const ref = doc(this.marketCol, this.createDocId(opinionText.trim()));
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as MarketData) : null;
  }

  /** Fetch **all** market docs – keep an eye on quota for large datasets. */
  async getAllMarketData(): Promise<Record<string, MarketData>> {
    const out: Record<string, MarketData> = {};
    const snaps = await getDocs(this.marketCol);
    snaps.forEach((s) => {
      const d = s.data() as MarketData;
      out[d.opinionText] = d;
    });
    return out;
  }

  /**
   * Live listener – invokes the callback with the *full* map each time a doc
   * changes.  Pass `null` as callback to stop previous listeners.
   */
  startRealtimeSync(cb: (data: Record<string, MarketData>) => void): void {
    this.stopRealtimeSync();
    const unsub = onSnapshot(this.marketCol, (snap) => {
      const map: Record<string, MarketData> = {};
      snap.forEach((d) => {
        const docData = d.data() as MarketData;
        map[docData.opinionText] = docData;
      });
      cb(map);
    });
    this.realtimeUnsubscribes.push(unsub);
  }

  /** Clean up all active Firestore listeners. */
  stopRealtimeSync() {
    this.realtimeUnsubscribes.forEach((u) => u());
    this.realtimeUnsubscribes = [];
  }

  // ---------------------------------------------------------------------------
  // 🔒  Internal helpers
  // ---------------------------------------------------------------------------
  /** Recomputes `currentPrice` using the latest counters. */
  private async recalculatePrice(opinionText: string) {
    const ref = doc(this.marketCol, this.createDocId(opinionText));
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data() as MarketData;
    const newPrice = this.calculatePrice(data.timesPurchased, data.timesSold, data.basePrice);
    if (newPrice !== data.currentPrice) {
      await updateDoc(ref, {
        currentPrice: newPrice,
        lastUpdated: serverTimestamp(),
      });
    }
  }
}

// -----------------------------------------------------------------------------
// 🎉  Export singleton – import { marketDataSyncService } from '...';
// -----------------------------------------------------------------------------
export const marketDataSyncService = MarketDataSyncService.getInstance();
