/*
 * unified-system.ts  ‑ Firestore‑native implementation
 * --------------------------------------------------------------
 * All former localStorage access has been removed.  Every read/write now
 * goes straight to Firestore using batched writes where appropriate.
 *
 * Collections in use (per helper conventions):
 *   • market-data           – /opinion price & volume
 *   • transactions          – /user & bot transactions
 *   • activity-feed         – global append‑only log
 */

"use client";

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { firebaseActivityService } from "./firebase-activity";
import { createMarketDataDocId, createTransactionId } from "./document-id-utils";

// ---------------------------------------------------------------------------
// 1.  PRICE CALCULATION (unchanged)
// ---------------------------------------------------------------------------
export const calculateUnifiedPrice = (
  timesPurchased: number,
  timesSold: number,
  basePrice: number = 10.0
): number => {
  const netDemand = timesPurchased - timesSold;
  const priceMultiplier =
    netDemand >= 0
      ? Math.pow(1.001, netDemand)
      : Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
  return Math.round(Math.max(basePrice * 0.5, basePrice * priceMultiplier) * 100) / 100;
};

// ---------------------------------------------------------------------------
// 2.  FIRESTORE‑BACKED MARKET‑DATA MANAGER
// ---------------------------------------------------------------------------
export interface UnifiedOpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  priceHistory: Array<{ price: number; timestamp: string; action: string; quantity?: number }>;
  liquidityScore: number;
  dailyVolume: number;
}

class FSMarketDataManager {
  private static _instance: FSMarketDataManager;
  static get instance() {
    return (this._instance ??= new FSMarketDataManager());
  }

  // Helper → deterministic doc id from opinion text
  private docId(text: string) {
    return createMarketDataDocId(text);
  }

  /** Fetch (or lazily create) an opinion market‑data doc. */
  async get(opinionText: string): Promise<UnifiedOpinionMarketData> {
    const ref = doc(collection(db, "market-data"), this.docId(opinionText));
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as UnifiedOpinionMarketData;

    // Create baseline @ $10 in one atomic transaction.
    const baseline: UnifiedOpinionMarketData = {
      opinionText,
      timesPurchased: 0,
      timesSold: 0,
      currentPrice: 10.0,
      basePrice: 10.0,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.0, timestamp: new Date().toISOString(), action: "create" },
      ],
      liquidityScore: 0,
      dailyVolume: 0,
    };
    await setDoc(ref, baseline);
    return baseline;
  }

  /** Apply a buy/sell and recalculate the price **atomically**. */
  async applyTrade(
    opinionText: string,
    action: "buy" | "sell",
    quantity = 1,
    actorUid?: string | null
  ): Promise<UnifiedOpinionMarketData> {
    const ref = doc(collection(db, "market-data"), this.docId(opinionText));

    const updated = await runTransaction(db, async (trx) => {
      const snap = await trx.get(ref);
      const data = (snap.exists()
        ? snap.data()
        : {
            opinionText,
            timesPurchased: 0,
            timesSold: 0,
            currentPrice: 10.0,
            basePrice: 10.0,
            priceHistory: [],
          }) as UnifiedOpinionMarketData;

      const timesPurchased =
        data.timesPurchased + (action === "buy" ? quantity : 0);
      const timesSold = data.timesSold + (action === "sell" ? quantity : 0);
      const newPrice = calculateUnifiedPrice(timesPurchased, timesSold, 10.0);

      const pricePoint = {
        price: newPrice,
        timestamp: new Date().toISOString(),
        action,
        quantity,
      };

      const updatedDoc: Partial<UnifiedOpinionMarketData> = {
        timesPurchased,
        timesSold,
        currentPrice: newPrice,
        lastUpdated: pricePoint.timestamp,
        priceHistory: [...data.priceHistory.slice(-49), pricePoint],
      };
      trx.set(ref, updatedDoc, { merge: true });
      return { ...data, ...updatedDoc } as UnifiedOpinionMarketData;
    });

    // Mirror to activity‑feed
    firebaseActivityService.addActivity({
      type: action,
      username: actorUid ?? "anon",
      opinionText,
      amount: quantity,
      price: updated.currentPrice,
      metadata: { source: "unified-system" },
    });

    return updated;
  }
}
export const UnifiedMarketDataManager = FSMarketDataManager.instance;

// ---------------------------------------------------------------------------
// 3.  TRANSACTION MANAGER (Firestore only)
// ---------------------------------------------------------------------------
export interface UnifiedTransaction {
  id: string;
  type: "buy" | "sell" | "bet" | "earn" | "generate" | "short_place" | "short_win" | "short_loss";
  amount: number;
  date: string;
  opinionId?: string;
  opinionText?: string;
  userId?: string;
  botId?: string;
  metadata: Record<string, any>;
}

class FSTransactionManager {
  private static _instance: FSTransactionManager;
  static get instance() {
    return (this._instance ??= new FSTransactionManager());
  }

  private generateId() {
    return createTransactionId();
  }

  create(
    type: UnifiedTransaction["type"],
    amount: number,
    opts: Partial<Omit<UnifiedTransaction, "id" | "type" | "amount" | "date">> = {}
  ): UnifiedTransaction {
    const tx: UnifiedTransaction = {
      id: this.generateId(),
      type,
      amount,
      date: new Date().toISOString(),
      metadata: {},
      ...opts,
    } as UnifiedTransaction;
    return tx;
  }

  async save(tx: UnifiedTransaction) {
    const ref = doc(collection(db, "transactions"), tx.id);
    await setDoc(ref, { ...tx, timestamp: serverTimestamp() });

    // Determine username: prefer metadata username, then look up by botId or userId
    let username = tx.metadata?.username || tx.userId || "anon";
    if (tx.botId && !tx.metadata?.username) {
      // For bot transactions without username in metadata, look up the bot username
      try {
        const botDoc = await getDoc(doc(db, "autonomous-bots", tx.botId));
        if (botDoc.exists()) {
          username = botDoc.data().username || `Bot_${tx.botId}`;
        } else {
          username = `Bot_${tx.botId}`; // Fallback if bot not found
        }
      } catch (error) {
        console.warn(`Failed to lookup bot username for ${tx.botId}:`, error);
        username = `bot_${tx.botId}`; // Fallback
      }
    }

    // Push to global activity feed
    firebaseActivityService.addActivity({
      type: tx.type,
      username: username,
      amount: tx.amount,
      opinionText: tx.opinionText,
      opinionId: tx.opinionId,
      isBot: !!tx.botId,
      botId: tx.botId,
      metadata: { source: "unified-system" },
    });
  }
}
export const UnifiedTransactionManager = FSTransactionManager.instance;

// ---------------------------------------------------------------------------
// 4.  BASIC SYSTEM VALIDATOR (reads Firestore, no localStorage)
// ---------------------------------------------------------------------------
export class SystemValidator {
  /** Validate all prices – recalculate & patch mismatches. */
  async validatePrices(): Promise<{ fixed: number; validated: number }> {
    const col = collection(db, "market-data");
    const snap = await getDocs(col);
    let fixed = 0,
      validated = 0;
    const batch = writeBatch(db);

    snap.docs.forEach((d: any) => {
      const data = d.data() as UnifiedOpinionMarketData;
      const expected = calculateUnifiedPrice(data.timesPurchased, data.timesSold);
      if (Math.abs(expected - data.currentPrice) > 0.01) {
        batch.update(d.ref, { currentPrice: expected });
        fixed += 1;
      } else validated += 1;
    });
    if (fixed) await batch.commit();
    return { fixed, validated };
  }
}

// ---------------------------------------------------------------------------
// 5.  GLOBAL SETUP – attach helpers to window (dev only)
// ---------------------------------------------------------------------------
function setupUnifiedSystem() {
  if (typeof window === "undefined") return;
  (window as any).unifiedMarketData = UnifiedMarketDataManager;
  (window as any).unifiedTransactions = UnifiedTransactionManager;
  (window as any).systemValidator = new SystemValidator();
  console.log("🔧 Unified Firestore system ready – see window.unifiedMarketData / unifiedTransactions");
}

// Export as default for layout.tsx
export default setupUnifiedSystem;
