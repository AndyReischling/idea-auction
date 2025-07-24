// scripts/migrateBotsToFlatCollection.ts
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collectionGroup,
  doc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { firebaseConfig } from '../app/lib/firebase-config';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function migrate() {
  // 1️⃣ load every /bots/* document, no matter the container
  const botsCG = collectionGroup(db, 'bots');
  const snap   = await getDocs(botsCG);

  if (snap.empty) {
    console.log('Nothing to migrate – no nested bots found.');
    return;
  }

  const batch = writeBatch(db);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    // target = /autonomous-bots/{botId}
    batch.set(doc(db, 'autonomous-bots', docSnap.id), data, { merge: true });
    // optional: clean up old doc
    batch.delete(docSnap.ref);
  });

  await batch.commit();
  console.log(`✅ Migrated ${snap.size} bots to /autonomous-bots`);
}

migrate().catch(console.error);
