// migrate-bots.js

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  collection,
  getDoc,
  setDoc,
  writeBatch,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateBots() {
  const originalDocRef = doc(db, "autonomous-bots", "bot-container-1752273492815", "bots", "0");
  const originalDocSnap = await getDoc(originalDocRef);

  if (!originalDocSnap.exists()) {
    console.error("Original bots document does not exist!");
    return;
  }

  const botData = originalDocSnap.data();
  const botsSubcollectionRef = collection(db, "autonomous-bots", "bot-container-1752273492815", "bots");

  const batch = writeBatch(db);

  Object.entries(botData).forEach(([botId, botDetails]) => {
    const botDocRef = doc(botsSubcollectionRef, botId);
    batch.set(botDocRef, botDetails);
  });

  await batch.commit();

  console.log("Migration completed successfully!");
}

migrateBots().catch(console.error);
