#!/usr/bin/env node

/*
 * push-to-firestore.js (v2)
 * ------------------------------------------------------------------
 * A tiny CLI helper to batch‑upload JSON payloads into Cloud Firestore
 * using the Admin SDK. All former "localStorage" concepts have been
 * purged – this utility now deals 100 % with proper Firestore data.
 *
 * Usage examples:
 *   node scripts/push-to-firestore.js push-json ./seed-data.json
 *   node scripts/push-to-firestore.js list-collections
 *
 * ‼️  Requires a service‑account key. Either place the file at
 *     ./firebase-service-account.json or set
 *     FIREBASE_SERVICE_ACCOUNT_PATH=/path/key.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// 🔧  CLI argument parsing
// -----------------------------------------------------------------------------
const [command, ...rest] = process.argv.slice(2);

function printUsage() {
  console.log(`\nUsage: node push-to-firestore.js <command> [options]\n\nCommands:\n  push-json <file>         Batch‑upload JSON file          → Firestore\n  list-collections         List all collections            ← Firestore\n  help                     Print this message\n\nEnvironment variables:\n  FIREBASE_SERVICE_ACCOUNT_PATH   Path to service‑account key (JSON)\n  FIREBASE_PROJECT_ID            (optional) overrides detected project\n`);
}

// Only commands that actually hit Firestore need the Admin SDK.
const requiresFirebase = ['push-json', 'list-collections'];
let db;

if (requiresFirebase.includes(command)) {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  if (!fs.existsSync(keyPath)) {
    console.error('❌  Service‑account key file missing:\n   ', keyPath);
    process.exit(1);
  }

  const creds = require(path.resolve(keyPath));
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    databaseURL: `https://${creds.project_id}.firebaseio.com`,
  });

  db = admin.firestore();
  console.log('✅  Firebase Admin SDK initialised');
}

// -----------------------------------------------------------------------------
// 📤  push‑json – main uploader
// -----------------------------------------------------------------------------
async function pushJsonToFirestore(file, collection = 'imports') {
  if (!fs.existsSync(file)) throw new Error(`File not found → ${file}`);

  const raw = fs.readFileSync(file, 'utf8');
  const payload = JSON.parse(raw);
  const batch = db.batch();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  const items = Array.isArray(payload) ? payload : [payload];
  console.log(`🏷️  Target collection  : ${collection}`);
  console.log(`📦  Documents to write: ${items.length}`);

  for (const item of items) {
    const ref = db.collection(collection).doc();
    batch.set(ref, { ...item, __importedAt: ts });
  }

  await batch.commit();
  console.log('🎉  Upload complete');
}

// -----------------------------------------------------------------------------
// 📋  list‑collections – enumerate top‑level collections
// -----------------------------------------------------------------------------
async function listCollections() {
  const cols = await db.listCollections();
  console.log('\n🏷️  Collections in project:');
  cols.forEach(c => console.log(`  • ${c.id}`));
}

// -----------------------------------------------------------------------------
// 🚀  Command router
// -----------------------------------------------------------------------------
(async () => {
  try {
    switch (command) {
      case 'push-json':
        if (!rest[0]) {
          console.error('❌  Missing <file> argument');
          return printUsage();
        }
        await pushJsonToFirestore(rest[0]);
        break;

      case 'list-collections':
        await listCollections();
        break;

      case 'help':
      case undefined:
        printUsage();
        break;

      default:
        console.error(`❌  Unknown command: ${command}`);
        printUsage();
    }
  } catch (err) {
    console.error('💥  Operation failed:', err.message || err);
    process.exit(1);
  }
})();
