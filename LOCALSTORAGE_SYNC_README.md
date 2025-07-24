Firestore Import Guide (Legacy Browser‑Data Edition)

Why this file changed  ↠  The app no longer reads localStorage.If any user still has legacy data stuck in the browser, follow this guide once to push it into Firestore—after that, nothing ever touches localStorage again.

🚀 Quick Start

1  •  Automatic Import Web UI

Visit /firestore-import inside the app.

Sign in.

Click “Import Data From Browser”.

A progress bar shows each collection as docs are written.

2  •  One‑liner in the Dev Console (fallback)

await importBrowserDataToFirestore();

(The helper lives on window in dev builds only.)

3  •  Manual API (for tests/scripts)

import { extractBrowserData, importDataToFirestore } from '@/lib/firestore-import';

const raw = extractBrowserData();       // reads & parses all known keys
const uid = firebase.auth().currentUser!.uid;
await importDataToFirestore(uid, raw, {
  onProgress: p => console.log(p)
});

📦 What Gets Imported

Browser Key

Firestore Collection

Notes

userProfile

users

1 doc – /users/{uid}

opinions

opinions

batched

transactions

transactions

batched

globalActivityFeed

activity-feed

batched

opinionMarketData

market-data

batched

portfolioData

user-portfolios

merged into /user-portfolios/{uid}

autonomousBots

bots

batched

advancedBets

advanced-bets

batched

shortPositions

short-positions

batched

embeddings

embeddings/{uid}

vector map

everything else

skipped & logged

printed in the result report

After a successful run the helper clears those keys so the import never repeats.

🔧 How It Works

extractBrowserData() – scans localStorage, parses JSON, returns an array of JS objects annotated with the original key.

importDataToFirestore() – generic bulk writer (found in app/lib/firestore-import.ts).

Each object is routed to a collection (detectCollection() logic).

Uses writeBatch (≤ 500 ops) with {merge:true} so re‑imports just update changed fields.

🛠️ Troubleshooting

Error

Fix

“User must be authenticated”

Sign in first. The import aborts if firebase.auth().currentUser is null.

“Missing or insufficient permissions”

Check Firestore rules for the target collection.

“Doc exceeds 1 MiB”

Huge blobs aren’t supported – split or compress before import.

Enable verbose logging:

sessionStorage.setItem('firestore-import-debug', 'true');

🔥 After Import – Remove the UI

Once the user base is fully migrated, you can delete:

pages/firestore-import/page.tsx

components/BrowserImport.tsx

The extractBrowserData() helper

The core importer (firestore-import.ts) remains useful for future CSV/JSON batch uploads.

Quick Dev Commands

await importBrowserDataToFirestore();   // import & wipe browser data
await clearUserCollections(uid);        // danger: deletes current user docs

Migration complete? Great—everything now lives in Firestore. You can forget localStorage ever existed. 🚀

