'use client';

/**
 * Reconciliation‑test page – Firestore‑only edition.
 * --------------------------------------------------
 * All helper buttons now talk directly to the remote database.
 * Nothing reads from or writes to browser localStorage anymore.
 */

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { dataReconciliationService } from '../lib/data-reconciliation';
import { marketDataSyncService } from '../lib/market-data-sync';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  limit,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ReconciliationTestPage() {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (msg: string) =>
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);

  const clearResults = () => setTestResults([]);

  // ---------------------------------------------------------------------------
  // 🔄 1. End‑to‑end reconciliation (delegates to shared service)
  // ---------------------------------------------------------------------------
  const testReconciliation = async () => {
    if (!user) return addResult('❌  User not authenticated');

    setLoading(true);
    addResult('🔄  Starting complete reconciliation …');
    try {
      const res = await dataReconciliationService.completeReconciliation(user.uid);
      addResult('✅  Reconciliation completed');
      addResult(`📊  Activities   : ${res.activities.migrated} migrated / ${res.activities.skipped} skipped`);
      addResult(`👤  Profile      : ${res.profile.updated ? 'updated' : 'unchanged'}`);
      addResult(`💰  Market‑data  : ${res.marketData.migrated} opinions migrated`);

      const conflicts = [
        ...res.activities.conflicts,
        ...res.profile.conflicts,
        ...res.marketData.conflicts,
      ];
      addResult(`⚠️  Conflicts    : ${conflicts.length}`);
      conflicts.forEach((c) => addResult(`  • ${c}`));
    } catch (err: any) {
      addResult(`❌  Reconciliation failed – ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 🔍 2. Quick status check (reads /migration‑status/{uid})
  // ---------------------------------------------------------------------------
  const testReconciliationStatus = async () => {
    if (!user) return addResult('❌  User not authenticated');
    setLoading(true);
    addResult('🔄  Fetching reconciliation status …');

    try {
      const status = await dataReconciliationService.getReconciliationSummary(user.uid);
      if (!status) return addResult('❌  No status document found');

      addResult('✅  Status retrieved');
      addResult(`📅  Last run        : ${status.lastReconciliation || 'never'}`);
      addResult(`🔄  Needs run      : ${status.needsReconciliation ? 'yes' : 'no'}`);
      addResult(`⚠️  Total conflicts: ${status.totalConflicts}`);
      status.dataTypes.forEach((d) =>
        addResult(
          `  • ${d.dataType.padEnd(18)} ${d.status} (${d.migratedCount}/${d.itemCount})`,
        ),
      );
    } catch (err: any) {
      addResult(`❌  Status check failed – ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 📶 3. Market‑data sync test (delegates to dedicated service)
  // ---------------------------------------------------------------------------
  const testMarketDataSync = async () => {
    if (!user) return addResult('❌  User not authenticated');
    setLoading(true);
    addResult('🔄  Testing market‑data sync …');

    try {
      // Push local cache → Firestore (the service handles diffing)
      const { synced, failed } = await marketDataSyncService.syncAllMarketDataToFirebase(user.uid);
      addResult(`📤  Upstream sync   : ${synced} ok / ${failed} failed`);

      // Pull Firestore → memory cache
      await marketDataSyncService.mergeMarketData(user.uid);
      addResult('📥  Downstream merge complete');

      const all = marketDataSyncService.getAllMarketData();
      addResult(`📊  Total opinions : ${Object.keys(all).length}`);
      Object.entries(all)
        .slice(0, 3)
        .forEach(([text, d]: any) =>
          addResult(
            `   • ${text.slice(0, 40).padEnd(40)}  $${d.currentPrice}  (${d.timesPurchased}/${d.timesSold})`,
          ),
        );
    } catch (err: any) {
      addResult(`❌  Market‑data sync failed – ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 🔎 4. Inspect Firestore for expected collections / doc counts
  // ---------------------------------------------------------------------------
  const inspectFirestore = async () => {
    if (!user) return addResult('❌  User not authenticated');
    setLoading(true);
    addResult('🔄  Inspecting Firestore data …');

    const collections = [
      { key: 'users',               q: () => getDocs(query(collection(db, 'users'), limit(1))) },
      { key: 'opinions',            q: () => getDocs(query(collection(db, 'opinions'), limit(1))) },
      { key: 'transactions',        q: () => getDocs(query(collection(db, 'transactions'), limit(1))) },
      { key: 'market-data',         q: () => getDocs(query(collection(db, 'market-data'), limit(1))) },
      { key: 'activity-feed',       q: () => getDocs(query(collection(db, 'activity-feed'), limit(1))) },
    ];

    for (const c of collections) {
      try {
        const snap = await c.q();
        addResult(`✅  ${c.key.padEnd(15)} : ${snap.size} docs (sample id→ ${snap.docs[0]?.id || '—'})`);
      } catch (e) {
        addResult(`❌  ${c.key.padEnd(15)} : error – ${(e as any).message}`);
      }
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // 🧪 5. Create fake docs directly in Firestore (dev helper)
  // ---------------------------------------------------------------------------
  const simulateActivity = async () => {
    if (!user) return addResult('❌  User not authenticated');
    addResult('🛠️  Seeding example docs …');

    try {
      // 1) Transaction
      const txRef = doc(collection(db, 'transactions'));
      await setDoc(txRef, {
        userId: user.uid,
        type: 'buy',
        opinionText: '[TEST RECONCILIATION - DEVELOPMENT ONLY]',
        amount: 100,
        price: 10.5,
        quantity: 1,
        timestamp: serverTimestamp(),
      });
      addResult(`💸  Transaction written → ${txRef.id}`);

      // 2) Market‑data (merge)
      const mdRef = doc(collection(db, 'market-data'), 'test-opinion');
      await setDoc(
        mdRef,
        {
          opinionText: '[TEST RECONCILIATION - DEVELOPMENT ONLY]',
          timesPurchased: 1,
          timesSold: 0,
          currentPrice: 10.5,
          basePrice: 10,
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );
      addResult('📈  Market‑data written');
    } catch (err: any) {
      addResult(`❌  Failed to seed – ${err.message || err}`);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Reconciliation Test</h1>
        <p className="text-red-600">Please sign in to run the tests.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 🖥️  UI
  // ---------------------------------------------------------------------------
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Reconciliation / diagnostics</h1>
      <p className="text-gray-600 mb-6">Signed in as {user.email}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button onClick={testReconciliation} disabled={loading} className="btn-primary">
          {loading ? 'Working…' : 'Run full reconciliation'}
        </button>
        <button onClick={testReconciliationStatus} disabled={loading} className="btn-secondary">
          {loading ? 'Working…' : 'Check reconciliation status'}
        </button>
        <button onClick={testMarketDataSync} disabled={loading} className="btn-secondary">
          {loading ? 'Working…' : 'Test market‑data sync'}
        </button>
        <button onClick={inspectFirestore} disabled={loading} className="btn-secondary">
          Inspect Firestore collections
        </button>
        <button onClick={simulateActivity} disabled={loading} className="btn-warning">
          Seed sample activity (dev)
        </button>
        <button onClick={clearResults} disabled={loading} className="btn-neutral">
          Clear results log
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Log</h2>
        <div className="max-h-96 overflow-y-auto font-mono text-sm">
          {testResults.length === 0 ? (
            <p className="text-gray-500">Nothing yet … run a test above.</p>
          ) : (
            testResults.map((r, i) => <div key={i}>{r}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
