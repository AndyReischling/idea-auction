// scripts/create-100-bots.js
// Creates 100 autonomous bots that can be pulled from Firestore

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, writeBatch } = require('firebase/firestore');

// Firebase config (make sure this matches your project)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Bot personalities and strategies
const personalities = [
  { 
    name: 'Conservative Carl', 
    description: 'Plays it safe with steady investments', 
    activityFrequency: 50, 
    betProbability: 0.05, 
    buyProbability: 0.2 
  },
  { 
    name: 'Aggressive Alice', 
    description: 'High-risk, high-reward trading style', 
    activityFrequency: 200, 
    betProbability: 0.3, 
    buyProbability: 0.6 
  },
  { 
    name: 'Moderate Mike', 
    description: 'Balanced approach to trading', 
    activityFrequency: 100, 
    betProbability: 0.15, 
    buyProbability: 0.4 
  },
  { 
    name: 'Trendy Tina', 
    description: 'Follows market trends and popular opinions', 
    activityFrequency: 150, 
    betProbability: 0.2, 
    buyProbability: 0.5 
  },
  { 
    name: 'Contrarian Connor', 
    description: 'Goes against the crowd', 
    activityFrequency: 80, 
    betProbability: 0.1, 
    buyProbability: 0.3 
  }
];

const riskLevels = ['conservative', 'moderate', 'aggressive'];

async function create100Bots() {
  console.log('🚀 Starting creation of 100 bots...');
  
  try {
    // Create parent container
    const parentDocId = 'bot-container-' + Date.now();
    
    // Create bots in batches of 25
    const batchSize = 25;
    let created = 0;
    
    for (let i = 0; i < 100; i += batchSize) {
      const batch = writeBatch(db);
      const batchCount = Math.min(batchSize, 100 - i);
      
      console.log(`🔄 Creating batch ${Math.floor(i/batchSize) + 1}/4 (${batchCount} bots)`);
      
      for (let j = 0; j < batchCount; j++) {
        const botIndex = i + j;
        const personality = personalities[botIndex % personalities.length];
        const riskTolerance = riskLevels[botIndex % riskLevels.length];
        
        const botData = {
          id: `bot_${botIndex}`,
          username: `${personality.name.split(' ')[0]}_${botIndex}`,
          balance: 10000 + Math.floor(Math.random() * 50000), // 10k-60k starting balance
          isActive: true,
          joinDate: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString(),
          personality: {
            name: personality.name,
            description: personality.description,
            activityFrequency: personality.activityFrequency + Math.floor(Math.random() * 50 - 25),
            betProbability: personality.betProbability,
            buyProbability: personality.buyProbability
          },
          riskTolerance: riskTolerance,
          tradingStrategy: {
            type: riskTolerance === 'aggressive' ? 'momentum' : 
                  riskTolerance === 'conservative' ? 'value' : 'balanced'
          },
          totalEarnings: Math.floor(Math.random() * 5000),
          totalLosses: Math.floor(Math.random() * 2000),
          createdAt: new Date().toISOString(),
          metadata: {
            source: 'bot_system',
            version: '1.0'
          }
        };
        
        // Add to subcollection: /autonomous-bots/{parentDocId}/bots/{botIndex}
        const botRef = doc(db, 'autonomous-bots', parentDocId, 'bots', botIndex.toString());
        batch.set(botRef, botData);
        created++;
      }
      
      // Commit batch
      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${created}/100 bots)`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Create parent container document
    const parentRef = doc(db, 'autonomous-bots', parentDocId);
    await setDoc(parentRef, {
      type: 'bot-container',
      totalBots: created,
      createdAt: new Date().toISOString(),
      description: '100 autonomous trading bots',
      status: 'active'
    });
    
    console.log(`🎉 Successfully created ${created} bots!`);
    console.log(`📍 Container ID: ${parentDocId}`);
    console.log(`📊 Bots can be queried from: /autonomous-bots/{parentDocId}/bots/`);
    
  } catch (error) {
    console.error('❌ Error creating bots:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  create100Bots()
    .then(() => {
      console.log('🏁 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { create100Bots }; 