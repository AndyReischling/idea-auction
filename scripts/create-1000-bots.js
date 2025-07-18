const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, setDoc, writeBatch } = require('firebase/firestore');

// Firebase config - replace with your project details if needed
const firebaseConfig = {
  apiKey: "AIzaSyA9_9vbw7jTunztB5almko8YGLvEAFMhBM",
  authDomain: "idea-auction.firebaseapp.com",
  projectId: "idea-auction",
  storageBucket: "idea-auction.firebasestorage.app",
  messagingSenderId: "883026956008",
  appId: "1:883026956008:web:592cb6387b0ca81bf4435d",
  measurementId: "G-78MY9HRLSF"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const personalities = [
  { name: 'Conservative Carl', description: 'Plays it safe with steady investments', activityFrequency: 50, betProbability: 0.05, buyProbability: 0.2 },
  { name: 'Aggressive Alice', description: 'High-risk, high-reward trading style', activityFrequency: 200, betProbability: 0.3, buyProbability: 0.6 },
  { name: 'Moderate Mike', description: 'Balanced approach to trading', activityFrequency: 100, betProbability: 0.15, buyProbability: 0.4 },
  { name: 'Trendy Tina', description: 'Follows market trends and popular opinions', activityFrequency: 150, betProbability: 0.2, buyProbability: 0.5 },
  { name: 'Contrarian Connor', description: 'Goes against the crowd', activityFrequency: 80, betProbability: 0.1, buyProbability: 0.3 }
];

const riskLevels = ['conservative', 'moderate', 'aggressive'];

async function create1000Bots() {
  console.log('🚀 Creating 1000 autonomous bots...');
  const batchSize = 500; // Firestore max writes per batch
  let created = 0;

  for (let i = 0; i < 1000; i += batchSize) {
    const batch = writeBatch(db);
    const batchCount = Math.min(batchSize, 1000 - i);

    for (let j = 0; j < batchCount; j++) {
      const botIndex = i + j;
      const personality = personalities[botIndex % personalities.length];
      const riskTolerance = riskLevels[botIndex % riskLevels.length];

      const botData = {
        id: `bot_${botIndex}`,
        username: `${personality.name.split(' ')[0]}_${botIndex}`,
        balance: 10000 + Math.floor(Math.random() * 50000),
        isActive: true,
        joinDate: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        personality: {
          name: personality.name,
          description: personality.description,
          activityFrequency: personality.activityFrequency,
          betProbability: personality.betProbability,
          buyProbability: personality.buyProbability
        },
        riskTolerance,
        tradingStrategy: {
          type: riskTolerance === 'aggressive' ? 'momentum' : riskTolerance === 'conservative' ? 'value' : 'balanced'
        },
        totalEarnings: Math.floor(Math.random() * 5000),
        totalLosses: Math.floor(Math.random() * 2000),
        metadata: { source: 'bot_system', version: '1.0' }
      };

      const botRef = doc(db, 'autonomous-bots', `bot_${botIndex}`);
      batch.set(botRef, botData);
      created++;
    }

    await batch.commit();
    console.log(`✅ Batch ${(i / batchSize) + 1} committed (${created}/1000)`);
    await new Promise(res => setTimeout(res, 200));
  }

  console.log(`🎉 Finished creating ${created} bots`);
}

if (require.main === module) {
  create1000Bots().catch(err => {
    console.error('❌ Failed to create bots', err);
    process.exit(1);
  });
}

module.exports = { create1000Bots };
