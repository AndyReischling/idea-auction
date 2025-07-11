/*
 * firebase-migration.ts
 * ---------------------------------------------------------------
 * 🔄  Firestore‑native import/export utilities (no localStorage).
 * Replaces the **entire** legacy LocalStorage→Firestore migration code.
 *
 * ➡️  **What changed?**
 *   • All `localStorage` reads/writes are gone.
 *   • The file is now a *thin* wrapper around the `importDataToFirestore`
 *     helper found in `app/lib/firestore-import.ts`.
 *   • Callers must pass the data to import – this util no longer attempts
 *     to *discover* anything inside the browser.
 *
 * Typical usage:
 * ```ts
 * import { runMigration } from '@/lib/firebase-migration';
 * import { extractBrowserData } from '@/lib/firestore-import'; // optional
 *
 * const raw = await fetch('/my‑dataset.json').then(r => r.json());
 * const uid = firebase.auth().currentUser!.uid;
 * const res = await runMigration(uid, raw, {
 *   onProgress: p => console.log(p.message)
 * });
 * console.table(res.summary);
 * ```
 */

// Note: Import functions are embedded in page component, not exported
// TODO: Extract utility functions to separate module
// import {
//   importDataToFirestore,
//   type ImportOptions,
//   type ImportResult,
//   clearUserCollections as _clearUserCollections,
// } from '../fire-store-import/page';

/**
 * Run a one‑shot bulk import into Firestore.
 *
 * @param userUid – owner of the new documents (added to `__importMeta`)
 * @param data    – array of serialisable JS objects (see README for schemas)
 * @param opts    – optional progress / dry‑run flags
 */
export async function runMigration(
  userUid: string,
  data: any[],
  opts: any = {}
): Promise<any> {
  if (!Array.isArray(data)) {
    throw new Error('⚠️  `data` must be an array of serialisable objects');
  }

  // TODO: Implement or extract importDataToFirestore function
  throw new Error('Migration functions need to be extracted from page component');
}

/**
 * Dev helper – **dangerous** 💥
 * Deletes all known user‑owned collections so tests start from a clean slate.
 * Never call this in production.
 */
export async function clearUserData(userUid: string) {
  // TODO: Implement or extract clearUserCollections function
  throw new Error('Clear functions need to be extracted from page component');
}
