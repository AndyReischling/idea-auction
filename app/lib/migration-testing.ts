/*
 * Firestore‑only validation suite.
 * --------------------------------------------------------------
 * The previous version compared localStorage and Firestore. Now that
 * the app no longer writes **any** browser keys, those checks were
 * stripped out. All tests below validate live Firestore documents
 * that belong to the signed‑in user.
 *
 * Usage example:
 *   import { firestoreTestingService } from '@/lib/migration-testing';
 *   const report = await firestoreTestingService.runValidation(uid);
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { realtimeDataService } from './realtime-data-service';

// -----------------------------------------------------------------------------
// 🔖  Types
// -----------------------------------------------------------------------------
export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResults: TestResult[];
  dataIntegrityScore: number;
  performanceMetrics: {
    firebaseLatency: number;
    syncLatency: number;
  };
}

// -----------------------------------------------------------------------------
// 🧪  Firestore testing service (singleton)
// -----------------------------------------------------------------------------
class FirestoreTestingService {
  private static instance: FirestoreTestingService;
  private constructor() {}
  static getInstance() {
    if (!FirestoreTestingService.instance) {
      FirestoreTestingService.instance = new FirestoreTestingService();
    }
    return FirestoreTestingService.instance;
  }

  // ----------------------------------------------------------
  // Public – run the whole suite
  // ----------------------------------------------------------
  async runValidation(userId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const tests: TestResult[] = [];

    // 1. Connectivity
    const conn = await this.testFirebaseConnection();
    tests.push(conn);
    if (!conn.passed) errors.push(conn.message);

    // 2. User profile exists & has required fields
    const profile = await this.testUserProfileDoc(userId);
    tests.push(profile);
    if (!profile.passed) errors.push(profile.message);

    // 3. Collection counts sanity check
    const colCounts = await this.testCollectionCounts(userId);
    tests.push(colCounts);
    if (!colCounts.passed) warnings.push(colCounts.message);

    // 4. Real‑time updates (profile)
    const realtime = await this.testRealtimeUpdates(userId);
    tests.push(realtime);
    if (!realtime.passed) warnings.push(realtime.message);

    // 5. Performance
    const perf = await this.testPerformanceMetrics();
    tests.push(perf);
    if (!perf.passed) warnings.push(perf.message);

    const passed = tests.filter(t => t.passed).length;
    const score = Math.round((passed / tests.length) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      testResults: tests,
      dataIntegrityScore: score,
      performanceMetrics: perf.details.metrics,
    };
  }

  // ----------------------------------------------------------
  // Individual tests
  // ----------------------------------------------------------
  private async testFirebaseConnection(): Promise<TestResult> {
    const testName = 'Firestore connection';
    const t0 = performance.now();
    try {
      // simple write‑read‑delete cycle
      const pingRef = doc(collection(db, 'diagnostics'));
      await setDoc(pingRef, { ts: serverTimestamp(), check: 'ping' });
      const snap = await getDoc(pingRef);
      await deleteDoc(pingRef);
      const dt = Math.round(performance.now() - t0);
      if (!snap.exists()) throw new Error('Ping doc not found after write');
      return {
        testName,
        passed: true,
        message: `OK (${dt} ms)`,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        testName,
        passed: false,
        message: err.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async testUserProfileDoc(userId: string): Promise<TestResult> {
    const testName = 'User profile document';
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return {
          testName,
          passed: false,
          message: 'No /users/{uid} document',
          timestamp: new Date().toISOString(),
        };
      }
      const data = snap.data();
      const missing: string[] = [];
      ['username', 'balance', 'joinDate'].forEach(f => {
        if (!(f in data)) missing.push(f);
      });
      return {
        testName,
        passed: missing.length === 0,
        message: missing.length === 0 ? 'Profile looks good' : `Missing fields: ${missing.join(', ')}`,
        details: { data },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        testName,
        passed: false,
        message: err.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async testCollectionCounts(userId: string): Promise<TestResult> {
    const testName = 'Collection counts';
    try {
      const colQueries: Array<[string, Promise<number>]> = [
        ['opinions', this.countDocs('opinions')],
        ['transactions', this.countDocs('transactions', ['userId', '==', userId])],
        ['market-data', this.countDocs('market-data')],
      ];
      const counts: Record<string, number> = {};
      for (const [name, promise] of colQueries) counts[name] = await promise;
      const message = Object.entries(counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
      return {
        testName,
        passed: true,
        message,
        details: counts,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        testName,
        passed: false,
        message: err.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async testRealtimeUpdates(userId: string): Promise<TestResult> {
    const testName = 'Realtime updates (profile)';
    return new Promise<TestResult>(resolve => {
      const ref = doc(db, 'users', userId);
      const unsub = realtimeDataService.onUserProfileChange(userId, async profile => {
        unsub();
        resolve({
          testName,
          passed: !!profile,
          message: profile ? 'Snapshot callback fired' : 'No snapshot payload',
          timestamp: new Date().toISOString(),
        });
      });
      // Timeout after 3 s
      setTimeout(() => {
        unsub();
        resolve({
          testName,
          passed: false,
          message: 'Snapshot listener timed out',
          timestamp: new Date().toISOString(),
        });
      }, 3000);
    });
  }

  private async testPerformanceMetrics(): Promise<TestResult> {
    const testName = 'Performance metrics';
    const metrics: { firebaseLatency: number; syncLatency: number } = {
      firebaseLatency: -1,
      syncLatency: -1,
    };
    // Firebase ping
    const t0 = performance.now();
    await this.countDocs('opinions');
    metrics.firebaseLatency = Math.round(performance.now() - t0);

    // Simple sync fetch via realtimeDataService
    const t1 = performance.now();
    await realtimeDataService.getOpinions();
    metrics.syncLatency = Math.round(performance.now() - t1);

    const issues: string[] = [];
    if (metrics.firebaseLatency > 2500) issues.push('Firestore slow');
    if (metrics.syncLatency > 5000) issues.push('Sync helper slow');

    return {
      testName,
      passed: issues.length === 0,
      message: issues.length === 0 ? 'OK' : issues.join(', '),
      details: { metrics },
      timestamp: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private async countDocs(
    col: string,
    whereClause: [string, any, any] | null = null
  ): Promise<number> {
    const base = collection(db, col);
    const q = whereClause ? query(base, where(...whereClause)) : base;
    const snap = await getDocs(q as any);
    return snap.size;
  }
}

// -----------------------------------------------------------------------------
// 🌟  Export singleton
// -----------------------------------------------------------------------------
export const firestoreTestingService = FirestoreTestingService.getInstance();
