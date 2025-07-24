/*
 * console-seed.js
 * ------------------------------------------------------------------
 * Copy and paste this script into your browser console (F12) 
 * when logged into your app to seed test data into Firestore.
 * 
 * INSTRUCTIONS:
 * 1. Open your app in the browser: http://localhost:3000
 * 2. Sign in with your account  
 * 3. Open browser console (F12)
 * 4. Copy and paste this ENTIRE script
 * 5. Press Enter and wait for completion
 */

console.log('🌱 Starting Firestore seed script...');

// Check if Firebase is available
if (typeof firebase === 'undefined' && typeof window.db === 'undefined') {
  console.error('❌ Firebase not found. Make sure you are on the app page and logged in.');
  throw new Error('Firebase not available');
}

// Use global Firebase instance (from your app)
const { setDoc, doc, collection, serverTimestamp } = firebase || window.firebase || {};
const db = window.db || firebase.firestore();

// ❌ HARDCODED OPINIONS ELIMINATED: Using clearly marked test placeholders
// WARNING: This is DEVELOPMENT TEST DATA ONLY - DO NOT USE IN PRODUCTION
const testData = {
  opinions: [
    {
      id: 'test-opinion-1',
      text: '[TEST PLACEHOLDER OPINION #1 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser1',
      authorId: 'user-123',
      source: 'user',
      isBot: false
    },
    {
      id: 'test-opinion-2', 
      text: '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser2',
      authorId: 'user-456',
      source: 'user',
      isBot: false
    },
    {
      id: 'test-opinion-3',
      text: '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]',
      author: 'TestBot1',
      authorId: 'bot-789',
      source: 'bot_generated',
      isBot: true
    },
    {
      id: 'test-opinion-4',
      text: '[TEST PLACEHOLDER OPINION #4 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser3',
      authorId: 'user-321',
      source: 'user',
      isBot: false
    },
    {
      id: 'test-opinion-5',
      text: '[TEST PLACEHOLDER OPINION #5 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser4',
      authorId: 'user-654',
      source: 'user',
      isBot: false
    }
  ],

  users: [
    {
      uid: 'user-123',
      username: 'TechVisionary',
      balance: 15000,
      totalEarnings: 5000,
      totalLosses: 1000,
      portfolio: {
        '[TEST PLACEHOLDER OPINION #1 - FOR DEVELOPMENT ONLY]': 50,
        '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]': 25
      }
    },
    {
      uid: 'user-456',
      username: 'GreenFuture', 
      balance: 8500,
      totalEarnings: 2500,
      totalLosses: 500,
      portfolio: {
        '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]': 100,
        '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]': 30
      }
    },
    {
      uid: 'user-321',
      username: 'CryptoEnthusiast',
      balance: 12000,
      totalEarnings: 8000,
      totalLosses: 3000,
      portfolio: {
        '[TEST PLACEHOLDER OPINION #4 - FOR DEVELOPMENT ONLY]': 75,
        '[TEST PLACEHOLDER OPINION #1 - FOR DEVELOPMENT ONLY]': 20
      }
    },
    {
      uid: 'user-654',
      username: 'EduInnovator',
      balance: 9800,
      totalEarnings: 1200,
      totalLosses: 200,
      portfolio: {
        '[TEST PLACEHOLDER OPINION #5 - FOR DEVELOPMENT ONLY]': 60,
        '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]': 15
      }
    }
  ],

  marketData: [
    {
      opinionText: '[TEST PLACEHOLDER OPINION #1 - FOR DEVELOPMENT ONLY]',
      timesPurchased: 95,
      timesSold: 20,
      currentPrice: 18.50,
      basePrice: 10.00,
      priceHistory: [
        { price: 10.00, timestamp: '2024-01-15T10:00:00.000Z', action: 'create', quantity: 1 },
        { price: 12.50, timestamp: '2024-01-16T14:30:00.000Z', action: 'buy', quantity: 10 },
        { price: 15.20, timestamp: '2024-01-20T09:15:00.000Z', action: 'buy', quantity: 25 },
        { price: 13.80, timestamp: '2024-02-01T16:45:00.000Z', action: 'sell', quantity: 5 },
        { price: 16.40, timestamp: '2024-02-15T11:20:00.000Z', action: 'buy', quantity: 30 },
        { price: 18.50, timestamp: '2024-03-01T13:30:00.000Z', action: 'buy', quantity: 25 }
      ],
      liquidityScore: 2.5,
      dailyVolume: 115
    },
    {
      opinionText: '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]',
      timesPurchased: 125,
      timesSold: 15,
      currentPrice: 22.30,
      basePrice: 10.00,
      priceHistory: [
        { price: 10.00, timestamp: '2024-02-01T08:00:00.000Z', action: 'create', quantity: 1 },
        { price: 11.80, timestamp: '2024-02-02T10:15:00.000Z', action: 'buy', quantity: 15 },
        { price: 14.60, timestamp: '2024-02-10T15:30:00.000Z', action: 'buy', quantity: 40 },
        { price: 17.90, timestamp: '2024-02-20T12:45:00.000Z', action: 'buy', quantity: 35 },
        { price: 16.40, timestamp: '2024-02-25T09:20:00.000Z', action: 'sell', quantity: 10 },
        { price: 20.10, timestamp: '2024-03-05T14:15:00.000Z', action: 'buy', quantity: 30 },
        { price: 22.30, timestamp: '2024-03-10T16:30:00.000Z', action: 'buy', quantity: 20 }
      ],
      liquidityScore: 3.2,
      dailyVolume: 140
    },
    {
      opinionText: '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]',
      timesPurchased: 65,
      timesSold: 30,
      currentPrice: 12.80,
      basePrice: 10.00,
      priceHistory: [
        { price: 10.00, timestamp: '2024-02-10T09:00:00.000Z', action: 'create', quantity: 1 },
        { price: 11.20, timestamp: '2024-02-11T11:30:00.000Z', action: 'buy', quantity: 20 },
        { price: 13.50, timestamp: '2024-02-15T14:15:00.000Z', action: 'buy', quantity: 25 },
        { price: 11.90, timestamp: '2024-02-20T10:45:00.000Z', action: 'sell', quantity: 15 },
        { price: 14.20, timestamp: '2024-02-28T16:20:00.000Z', action: 'buy', quantity: 15 },
        { price: 12.80, timestamp: '2024-03-05T13:10:00.000Z', action: 'sell', quantity: 10 }
      ],
      liquidityScore: 1.8,
      dailyVolume: 95
    },
    {
      opinionText: '[TEST PLACEHOLDER OPINION #4 - FOR DEVELOPMENT ONLY]',
      timesPurchased: 80,
      timesSold: 45,
      currentPrice: 11.60,
      basePrice: 10.00,
      priceHistory: [
        { price: 10.00, timestamp: '2024-03-01T08:30:00.000Z', action: 'create', quantity: 1 },
        { price: 12.40, timestamp: '2024-03-02T12:15:00.000Z', action: 'buy', quantity: 25 },
        { price: 10.80, timestamp: '2024-03-05T15:45:00.000Z', action: 'sell', quantity: 20 },
        { price: 13.20, timestamp: '2024-03-08T11:30:00.000Z', action: 'buy', quantity: 30 },
        { price: 11.50, timestamp: '2024-03-12T14:20:00.000Z', action: 'sell', quantity: 15 },
        { price: 11.60, timestamp: '2024-03-15T10:45:00.000Z', action: 'buy', quantity: 10 }
      ],
      liquidityScore: 1.4,
      dailyVolume: 125
    },
    {
      opinionText: '[TEST PLACEHOLDER OPINION #5 - FOR DEVELOPMENT ONLY]',
      timesPurchased: 60,
      timesSold: 10,
      currentPrice: 16.20,
      basePrice: 10.00,
      priceHistory: [
        { price: 10.00, timestamp: '2024-03-15T09:30:00.000Z', action: 'create', quantity: 1 },
        { price: 12.20, timestamp: '2024-03-16T13:15:00.000Z', action: 'buy', quantity: 20 },
        { price: 14.80, timestamp: '2024-03-18T11:45:00.000Z', action: 'buy', quantity: 25 },
        { price: 16.20, timestamp: '2024-03-20T15:30:00.000Z', action: 'buy', quantity: 15 }
      ],
      liquidityScore: 2.1,
      dailyVolume: 70
    }
  ]
};

async function seedDatabase() {
  try {
    console.log('📝 Seeding opinions...');
    
    // Check if we have Firebase v9+ or v8
    let setDocFunc, docFunc, collectionFunc, timestampFunc;
    
    if (window.firebase && window.firebase.firestore) {
      // Firebase v8 style
      const firestore = window.firebase.firestore();
      setDocFunc = (ref, data) => ref.set(data);
      docFunc = (col, id) => firestore.collection(col).doc(id);
      timestampFunc = () => window.firebase.firestore.FieldValue.serverTimestamp();
    } else {
      // Assume v9+ modular SDK is available globally  
      setDocFunc = window.setDoc || setDoc;
      docFunc = window.doc || doc;
      collectionFunc = window.collection || collection;
      timestampFunc = window.serverTimestamp || serverTimestamp;
    }
    
    // Create opinions
    for (const opinion of testData.opinions) {
      const opinionRef = docFunc('opinions', opinion.id);
      await setDocFunc(opinionRef, {
        ...opinion,
        createdAt: timestampFunc(),
        updatedAt: timestampFunc()
      });
    }
    console.log(`✅ Created ${testData.opinions.length} opinions`);

    console.log('👥 Seeding users...');
    
    // Create users
    for (const user of testData.users) {
      const userRef = docFunc('users', user.uid);
      await setDocFunc(userRef, {
        ...user,
        joinDate: timestampFunc(),
        createdAt: timestampFunc(),
        updatedAt: timestampFunc()
      });
    }
    console.log(`✅ Created ${testData.users.length} users`);

    console.log('📊 Seeding market data...');
    
    // Create market data
    for (const market of testData.marketData) {
      const docId = btoa(market.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      const marketRef = docFunc('market-data', docId);
      await setDocFunc(marketRef, {
        ...market,
        lastUpdated: new Date().toISOString()
      });
    }
    console.log(`✅ Created ${testData.marketData.length} market data entries`);

    console.log('🎉 Database seeding complete!');
    console.log('🔗 You can now navigate to any opinion page:');
    testData.opinions.forEach(opinion => {
      const url = `${window.location.origin}/opinion/${opinion.id}`;
      console.log(`   → ${url}`);
    });
    
    console.log('\n📱 Click on any of these URLs to test the trading interface!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    console.log('🔍 Debug info:');
    console.log('- Current URL:', window.location.href);
    console.log('- Firebase available:', typeof window.firebase !== 'undefined');
    console.log('- DB available:', typeof window.db !== 'undefined');
  }
}

// Run the seeding function
seedDatabase(); 