/*
 * Conflict‑Resolution Service (Firestore‑only)
 * ---------------------------------------------------------------------------
 * All remnants of browser localStorage have been removed.  The helper now
 * compares cached (client) snapshots versus fresh server snapshots pulled
 * from Firestore, merges intelligently and writes the winning payload back
 * to the canonical location in Firestore.  It never *reads from* nor *writes
 * to* localStorage.
 *
 * How it works
 * ------------
 * 1. For each data‑type the service fetches **two** versions:
 *    – `cache`  • `getDocFromCache` / `getDocsFromCache`
 *    – `server` • `getDocFromServer` / `getDocsFromServer`
 * 2. If both exist, they are diffed → a `DataConflict` object describes the
 *    mismatch.  If only one exists we auto‑resolve by taking that copy.
 * 3. Auto‑resolvable conflicts are merged using the strategy table below.
 * 4. The resolved payload is *persisted back to Firestore* (single source of
 *    truth) – clients listening via `onSnapshot` get the update instantly.
 */

'use client';

import {
  doc,
  getDocFromCache,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocsFromCache,
  getDocsFromServer,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// -----------------------------------------------------------------------------
// 🔖 Types
// -----------------------------------------------------------------------------
type ConflictResolutionStrategy =
  | 'firestore_wins'         // Always prefer the server copy
  | 'latest_timestamp_wins'  // Prefer doc with newest `updatedAt`/`timestamp`
  | 'merge_intelligent'      // Field‑aware merge (see below)
  | 'user_choice'            // Ask the user (UI not implemented here)
  | 'automatic_smart';       // Heuristic

interface DataConflict {
  id: string;
  dataType: string;
  conflictType: 'value_mismatch' | 'missing_data' | 'structure_mismatch';
  cacheData: any;      // Data from Firestore *cache*
  serverData: any;     // Data from Firestore *server*
  cacheTimestamp?: string;
  serverTimestamp?: string;
  autoResolvable: boolean;
  resolution?: ConflictResolutionStrategy;
  resolvedData?: any;
  resolvedAt?: string;
}

interface ConflictResolutionResult {
  conflicts: DataConflict[];
  resolved: number;
  failed: number;
}

// -----------------------------------------------------------------------------
// 🧠 Conflict‑Resolution Singleton
// -----------------------------------------------------------------------------
export class ConflictResolutionService {
  private static instance: ConflictResolutionService;
  private strategyMap = new Map<string, ConflictResolutionStrategy>();

  private constructor() {
    // default strategies per data‑type
    this.strategyMap.set('userProfile', 'merge_intelligent');
    this.strategyMap.set('transactions', 'merge_intelligent');
    this.strategyMap.set('opinionMarketData', 'merge_intelligent');
    this.strategyMap.set('activityFeed', 'merge_intelligent');
  }

  static getInstance() {
    if (!this.instance) this.instance = new ConflictResolutionService();
    return this.instance;
  }

  // ---------------------------------------------------------------------------
  // 🚀 Public API
  // ---------------------------------------------------------------------------
  async resolveAll(userId: string): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      conflicts: [],
      resolved: 0,
      failed: 0,
    };

    // --- User profile --------------------------------------------------------
    const profileConflict = await this.compareDocs(
      `users/${userId}`,
      'userProfile',
    );
    if (profileConflict) result.conflicts.push(profileConflict);

    // --- Transactions --------------------------------------------------------
    const txConflict = await this.compareCollections(
      'transactions',
      'transactions',
      where('userId', '==', userId),
    );
    if (txConflict) result.conflicts.push(txConflict);

    // resolve auto‑resolvable -------------------------------------------------
    for (const c of result.conflicts) {
      if (!c.autoResolvable) continue;
      try {
        const resolved = await this.resolveConflict(c, userId);
        if (resolved) result.resolved += 1; else result.failed += 1;
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // 🔍 Low‑level helpers
  // ---------------------------------------------------------------------------
  private async compareDocs(path: string, dataType: string): Promise<DataConflict | null> {
    const ref = doc(db, path);
    const [cacheSnap, serverSnap] = await Promise.all([
      getDocFromCache(ref).catch(() => undefined),
      getDocFromServer(ref).catch(() => undefined),
    ]);

    const cacheData = cacheSnap?.exists() ? cacheSnap.data() : null;
    const serverData = serverSnap?.exists() ? serverSnap.data() : null;

    if (!cacheData && !serverData) return null; // nothing to compare
    if (JSON.stringify(cacheData) === JSON.stringify(serverData)) return null; // identical

    return {
      id: `${dataType}_${Date.now()}`,
      dataType,
      conflictType: 'value_mismatch',
      cacheData,
      serverData,
      cacheTimestamp: cacheData?.updatedAt || cacheData?.timestamp,
      serverTimestamp: serverData?.updatedAt || serverData?.timestamp,
      autoResolvable: true,
      resolution: this.strategyMap.get(dataType) || 'latest_timestamp_wins',
    };
  }

  private async compareCollections(
    colPath: string,
    dataType: string,
    ...q: any[]
  ): Promise<DataConflict | null> {
    const base = collection(db, colPath);
    const qObj = query(base, ...q);
    const [cacheSnap, serverSnap] = await Promise.all([
      getDocsFromCache(qObj).catch(() => undefined),
      getDocsFromServer(qObj).catch(() => undefined),
    ]);

    const cacheDocs = cacheSnap?.docs.map(d => d.data()) || [];
    const serverDocs = serverSnap?.docs.map(d => d.data()) || [];

    // quick structural compare
    if (cacheDocs.length === serverDocs.length &&
        JSON.stringify(cacheDocs) === JSON.stringify(serverDocs)) return null;

    return {
      id: `${dataType}_${Date.now()}`,
      dataType,
      conflictType: 'value_mismatch',
      cacheData: cacheDocs,
      serverData: serverDocs,
      autoResolvable: true,
      resolution: this.strategyMap.get(dataType) || 'merge_intelligent',
    };
  }

  // ---------------------------------------------------------------------------
  // 🔧 Conflict merge / resolve
  // ---------------------------------------------------------------------------
  private async resolveConflict(c: DataConflict, userId: string) {
    let payload: any;
    switch (c.resolution) {
      case 'firestore_wins':
        payload = c.serverData ?? c.cacheData;
        break;
      case 'latest_timestamp_wins':
        payload = this.pickLatest(c.cacheData, c.serverData);
        break;
      case 'merge_intelligent':
      case 'automatic_smart':
        payload = this.merge(c);
        break;
      default:
        throw new Error('Unsupported resolution');
    }

    await this.persist(c.dataType, payload, userId);
    c.resolvedData = payload;
    c.resolvedAt = new Date().toISOString();
    return true;
  }

  private pickLatest(a: any, b: any) {
    const tA = a?.updatedAt ?? a?.timestamp ?? 0;
    const tB = b?.updatedAt ?? b?.timestamp ?? 0;
    return tA > tB ? a : b;
  }

  private merge(c: DataConflict) {
    // extremely naive merge – data‑type specific below
    switch (c.dataType) {
      case 'userProfile':
        return {
          ...c.serverData,
          balance: c.cacheData?.balance ?? c.serverData?.balance,
          totalEarnings: Math.max(
            c.cacheData?.totalEarnings || 0,
            c.serverData?.totalEarnings || 0,
          ),
          totalLosses: Math.max(
            c.cacheData?.totalLosses || 0,
            c.serverData?.totalLosses || 0,
          ),
          updatedAt: serverTimestamp(),
        };
      case 'transactions':
      case 'activityFeed': {
        const combined = [
          ...(Array.isArray(c.cacheData) ? c.cacheData : []),
          ...(Array.isArray(c.serverData) ? c.serverData : []),
        ];
        const seen = new Set<string>();
        return combined.filter((t: any) => {
          const id = t.id || `${t.timestamp}_${t.type}`;
          if (seen.has(id)) return false; seen.add(id); return true;
        });
      }
      default:
        return this.pickLatest(c.cacheData, c.serverData);
    }
  }

  // ---------------------------------------------------------------------------
  // 💾 Persist winner back to Firestore
  // ---------------------------------------------------------------------------
  private async persist(type: string, data: any, uid: string) {
    switch (type) {
      case 'userProfile':
        return setDoc(doc(db, 'users', uid), data, { merge: true });
      case 'transactions': {
        const batch = writeBatch(db);
        for (const tx of data) {
          const ref = doc(db, 'transactions', tx.id);
          batch.set(ref, tx, { merge: true });
        }
        return batch.commit();
      }
      case 'activityFeed': {
        const batch = writeBatch(db);
        for (const act of data) {
          const ref = doc(db, 'activity-feed', act.id);
          batch.set(ref, { ...act, reconciledAt: Timestamp.now() }, { merge: true });
        }
        return batch.commit();
      }
      case 'opinionMarketData': {
        const batch = writeBatch(db);
        Object.entries(data).forEach(([k, v]: [string, any]) => {
          const ref = doc(db, 'market-data', k);
          batch.set(ref, v, { merge: true });
        });
        return batch.commit();
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 🌟 Export singleton
// -----------------------------------------------------------------------------
export const conflictResolutionService = ConflictResolutionService.getInstance();
