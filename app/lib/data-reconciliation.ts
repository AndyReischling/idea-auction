/*
 * Data‑Reconciliation – Firestore‑only edition
 * --------------------------------------------------------------
 * All former localStorage access has been removed.  
 * “Legacy” browser data is expected to already live in **Firestore** –
 * normally under `legacy-imports/{uid}/{collection}` written by the
 * `/firestore-import` flow (see *Firestore Import Guide*).
 *
 * Each reconcile method now reads from that staging area and merges the
 * documents into the canonical collections.
 */

'use client';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
  getFirestore,
} from 'firebase/firestore';
import { firebaseActivityService } from './firebase-activity';
import { db } from './firebase';

// -----------------------------------------------------------------------------
// 🔖  Types
// -----------------------------------------------------------------------------
interface MigrationStatus {
  id: string;
  userId: string;
  dataType:
    | 'activities'
    | 'profiles'
    | 'market-data'
    | 'portfolios'
    | 'bots'
    | 'bets'
    | 'embeddings';
  itemCount: number;
  migratedCount: number;
  lastMigration: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  checksum: string;
  conflicts: string[];
}

// -----------------------------------------------------------------------------
// 🧰  Helpers – generic Firestore utils
// -----------------------------------------------------------------------------
const stagingCol = (uid: string, type: string) =>
  collection(db, 'legacy-imports', uid, type);

/**
 * Pull every doc in a staging sub‑collection and purge it afterwards.
 */
async function drainStaging<T>(uid: string, type: string): Promise<T[]> {
  const qs = await getDocs(stagingCol(uid, type));
  const out: T[] = [];
  const batch = writeBatch(db);
  qs.forEach((snap) => {
    out.push({ id: snap.id, ...snap.data() } as T);
    batch.delete(snap.ref);
  });
  if (out.length) await batch.commit();
  return out;
}

function hashJson(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

// -----------------------------------------------------------------------------
// 📦  Main service
// -----------------------------------------------------------------------------
export class DataReconciliationService {
  private static instance: DataReconciliationService;
  private migrationCollection = collection(db, 'migration_status');

  public static getInstance() {
    return (this.instance ??= new DataReconciliationService());
  }

  // ---------------------------------------------------------------------------
  // 🗂  Activities
  // ---------------------------------------------------------------------------
  async reconcileActivities(uid: string) {
    console.log('🔄 [activities] reconcile start');

    const staged = await drainStaging<any>(uid, 'activities');
    if (!staged.length) {
      console.log('ℹ️  nothing to migrate');
      return { migrated: 0, skipped: 0, conflicts: [] as string[] };
    }

    const existing = await firebaseActivityService.getRecentActivities(1000);
    const existingIds = new Set(existing.map((a) => a.id));

    let migrated = 0;
    const conflicts: string[] = [];

    for (const act of staged) {
      if (existingIds.has(act.id)) {
        conflicts.push(`duplicate‑id:${act.id}`);
        continue;
      }
      try {
        await firebaseActivityService.addActivity({
          ...act,
          metadata: { source: 'legacy-import', migratedAt: Timestamp.now() },
        });
        migrated += 1;
      } catch (err) {
        console.error('❌ activity import failed', err);
        conflicts.push(`error:${act.id}`);
      }
    }

    await this.recordMigration(uid, 'activities', staged.length, migrated, conflicts);
    console.log(`✅ [activities] ${migrated}/${staged.length} migrated`);
    return { migrated, skipped: staged.length - migrated, conflicts };
  }

  // ---------------------------------------------------------------------------
  // 👤  User profile – single doc
  // ---------------------------------------------------------------------------
  async reconcileUserProfile(uid: string) {
    console.log('🔄 [profile] reconcile start');
    const staged = await drainStaging<any>(uid, 'profiles');
    if (!staged.length) return { updated: false, conflicts: ['no staged profile'] };

    const legacy = staged[0];
    const userRef = doc(db, 'users', uid);
    const updates = {
      ...legacy,
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, updates, { merge: true });
    await this.recordMigration(uid, 'profiles', 1, 1, []);
    console.log('✅ [profile] migrated');
    return { updated: true, conflicts: [] as string[] };
  }

  // ---------------------------------------------------------------------------
  // 📈  Market data – many docs
  // ---------------------------------------------------------------------------
  async reconcileMarketData(uid: string) {
    console.log('🔄 [market] reconcile start');
    const staged = await drainStaging<any>(uid, 'market-data');
    if (!staged.length) return { migrated: 0, conflicts: ['no staged market‑data'] };

    const batch = writeBatch(db);
    for (const item of staged) {
      const ref = doc(db, 'market-data', item.id || item.opinionText);
      batch.set(ref, { ...item, importedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    await this.recordMigration(uid, 'market-data', staged.length, staged.length, []);

    console.log(`✅ [market] migrated ${staged.length}`);
    return { migrated: staged.length, conflicts: [] as string[] };
  }

  // ---------------------------------------------------------------------------
  // 🚀  Full pass
  // ---------------------------------------------------------------------------
  async completeReconciliation(uid: string) {
    return {
      activities: await this.reconcileActivities(uid),
      profile: await this.reconcileUserProfile(uid),
      marketData: await this.reconcileMarketData(uid),
    };
  }

  // ---------------------------------------------------------------------------
  // 🗒  Migration‑status bookkeeping
  // ---------------------------------------------------------------------------
  private async recordMigration(
    uid: string,
    dataType: MigrationStatus['dataType'],
    itemCount: number,
    migratedCount: number,
    conflicts: string[],
  ) {
    const docId = `${uid}_${dataType}`;
    const payload: Omit<MigrationStatus, 'id'> = {
      userId: uid,
      dataType,
      itemCount,
      migratedCount,
      lastMigration: new Date().toISOString(),
      status: conflicts.length ? 'failed' : 'completed',
      checksum: hashJson({ itemCount, migratedCount }),
      conflicts,
    } as any;
    await setDoc(doc(this.migrationCollection, docId), payload, { merge: true });
  }
}

// -----------------------------------------------------------------------------
// 🛎️  Singleton export
// -----------------------------------------------------------------------------
export const dataReconciliationService = DataReconciliationService.getInstance();
