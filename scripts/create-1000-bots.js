// scripts/create-1000-bots.js
// Creates 1,000 diverse autonomous bots for the idea auction platform

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, writeBatch } = require('firebase/firestore');

// Firebase config (matches the project configuration)
const firebaseConfig = {
  apiKey: "AIzaSyA9_9vbw7jTunztB5almko8YGLvEAFMhBM",
  authDomain: "idea-auction.firebaseapp.com",
  projectId: "idea-auction",
  storageBucket: "idea-auction.firebasestorage.app",
  messagingSenderId: "883026956008",
  appId: "1:883026956008:web:592cb6387b0ca81bf4435d"
};

// Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Expanded bot personalities with diverse trading behaviors
const personalities = [
  { 
    name: 'Conservative Carl', 
    description: 'Plays it safe with steady, low-risk investments', 
    activityFrequency: 45,
    riskProfile: 'conservative'
  },
  { 
    name: 'Aggressive Alice', 
    description: 'High-risk, high-reward trading with bold moves', 
    activityFrequency: 220,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Moderate Mike', 
    description: 'Balanced approach with calculated risks', 
    activityFrequency: 110,
    riskProfile: 'moderate'
  },
  { 
    name: 'Trendy Tina', 
    description: 'Follows market trends and popular opinions', 
    activityFrequency: 165,
    riskProfile: 'moderate'
  },
  { 
    name: 'Contrarian Connor', 
    description: 'Goes against the crowd and popular sentiment', 
    activityFrequency: 85,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Data-Driven Diana', 
    description: 'Makes decisions based on thorough analysis', 
    activityFrequency: 95,
    riskProfile: 'conservative'
  },
  { 
    name: 'Momentum Max', 
    description: 'Rides market momentum and quick price movements', 
    activityFrequency: 200,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Value-Hunter Vera', 
    description: 'Seeks undervalued opportunities for long-term gains', 
    activityFrequency: 60,
    riskProfile: 'conservative'
  },
  { 
    name: 'Swing-Trader Sam', 
    description: 'Captures medium-term price swings', 
    activityFrequency: 130,
    riskProfile: 'moderate'
  },
  { 
    name: 'Quick-Flip Quinn', 
    description: 'Fast trades for small but frequent profits', 
    activityFrequency: 250,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Patient Paul', 
    description: 'Long-term holder with strategic patience', 
    activityFrequency: 35,
    riskProfile: 'conservative'
  },
  { 
    name: 'Volatile Vivian', 
    description: 'Thrives on market chaos and uncertainty', 
    activityFrequency: 180,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Steady Steve', 
    description: 'Consistent, methodical trading approach', 
    activityFrequency: 75,
    riskProfile: 'moderate'
  },
  { 
    name: 'Speculative Sally', 
    description: 'Takes calculated speculative positions', 
    activityFrequency: 190,
    riskProfile: 'aggressive'
  },
  { 
    name: 'Diversified Dave', 
    description: 'Spreads risk across multiple positions', 
    activityFrequency: 105,
    riskProfile: 'moderate'
  }
];

// Trading strategies mapped to risk tolerance
const tradingStrategies = {
  conservative: ['value', 'dividend', 'buy-and-hold', 'defensive'],
  moderate: ['balanced', 'growth', 'blend', 'tactical'],
  aggressive: ['momentum', 'growth', 'swing', 'speculative', 'contrarian']
};

// Name prefixes and suffixes for variety
const nameAdjectives = [
  'Smart', 'Quick', 'Bold', 'Wise', 'Sharp', 'Fast', 'Cool', 'Hot', 'Wild', 'Calm',
  'Lucky', 'Brave', 'Clever', 'Swift', 'Keen', 'Bright', 'Smooth', 'Royal', 'Elite', 'Prime'
];

const nameNouns = [
  'Trader', 'Investor', 'Player', 'Hunter', 'Scout', 'Agent', 'Pro', 'Master', 'Expert', 'Wizard',
  'Guru', 'Knight', 'Shark', 'Wolf', 'Eagle', 'Lion', 'Tiger', 'Bear', 'Bull', 'Falcon'
];

function generateBotName(index) {
  const personality = personalities[index % personalities.length];
  const baseName = personality.name.split(' ')[0];
  
  // For variety, sometimes use personality name, sometimes generate new
  if (index < personalities.length) {
    return `${baseName}_${index}`;
  } else {
    const adj = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
    const noun = nameNouns[Math.floor(Math.random() * nameNouns.length)];
    return `${adj}${noun}_${index}`;
  }
}

function generateBotPersonality(index) {
  const personality = personalities[index % personalities.length];
  
  // Add some variation to activity frequency
  const variation = Math.floor(Math.random() * 60 - 30); // ±30
  const activityFrequency = Math.max(20, personality.activityFrequency + variation);
  
  return {
    name: personality.name,
    description: personality.description,
    activityFrequency: activityFrequency
  };
}

function generateRiskTolerance(personalityIndex) {
  const personality = personalities[personalityIndex % personalities.length];
  return personality.riskProfile;
}

function generateTradingStrategy(riskTolerance) {
  const strategies = tradingStrategies[riskTolerance];
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  return { type: strategy };
}

async function create1000Bots() {
  console.log('🚀 Starting creation of 1,000 autonomous bots...');
  
  try {
    // Create bots in batches of 25 to avoid hitting Firestore limits
    const batchSize = 25;
    let created = 0;
    
    for (let i = 0; i < 1000; i += batchSize) {
      const batch = writeBatch(db);
      const batchCount = Math.min(batchSize, 1000 - i);
      
      console.log(`🔄 Creating batch ${Math.floor(i/batchSize) + 1}/40 (${batchCount} bots)`);
      
      for (let j = 0; j < batchCount; j++) {
        const botIndex = i + j;
        const personalityIndex = botIndex % personalities.length;
        const riskTolerance = generateRiskTolerance(personalityIndex);
        
        const botData = {
          id: `bot_${botIndex}`,
          username: generateBotName(botIndex),
          balance: 5000 + Math.floor(Math.random() * 95000), // 5k-100k starting balance
          isActive: true,
          joinDate: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString(),
          personality: generateBotPersonality(botIndex),
          riskTolerance: riskTolerance,
          tradingStrategy: generateTradingStrategy(riskTolerance),
          totalEarnings: Math.floor(Math.random() * 10000),
          totalLosses: Math.floor(Math.random() * 5000),
          createdAt: new Date().toISOString(),
          metadata: {
            source: 'bot_system',
            version: '2.0',
            batchNumber: Math.floor(i/batchSize) + 1
          }
        };
        
        // Store directly in autonomous-bots collection (not subcollection)
        const botRef = doc(db, 'autonomous-bots', botData.id);
        batch.set(botRef, botData);
        created++;
      }
      
      // Commit batch
      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${created}/1000 bots)`);
      
      // Small delay between batches to be nice to Firestore
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    console.log(`🎉 Successfully created ${created} diverse autonomous bots!`);
    console.log(`📊 Bots stored in: /autonomous-bots/{botId}`);
    console.log(`🤖 Bot distribution:`);
    
    // Log distribution stats
    const riskDistribution = { conservative: 0, moderate: 0, aggressive: 0 };
    for (let i = 0; i < 1000; i++) {
      const personalityIndex = i % personalities.length;
      const risk = generateRiskTolerance(personalityIndex);
      riskDistribution[risk]++;
    }
    
    console.log(`   Conservative: ${riskDistribution.conservative}`);
    console.log(`   Moderate: ${riskDistribution.moderate}`);  
    console.log(`   Aggressive: ${riskDistribution.aggressive}`);
    
  } catch (error) {
    console.error('❌ Error creating bots:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  create1000Bots()
    .then(() => {
      console.log('🏁 Script completed successfully!');
      console.log('🚀 Bots are ready to start trading autonomously!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { create1000Bots }; 