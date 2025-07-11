/*
 * browser-seed.js
 * ------------------------------------------------------------------
 * Copy and paste this script into your browser console (F12) 
 * when logged into your app to seed test data into Firestore.
 * 
 * Usage:
 * 1. Open your app in the browser
 * 2. Sign in with your account
 * 3. Open browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Press Enter
 */

console.log('🌱 Starting Firestore seed script...');

// Import Firebase functions we need
import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../app/lib/firebase.ts';

const testData = {
  opinions: [
    {
      id: 'test-opinion-1',
      text: 'AI will replace most software engineers within 5 years',
      author: 'TechVisionary',
      authorId: 'user-123',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'test-opinion-2', 
      text: 'Electric vehicles will dominate the market by 2030',
      author: 'GreenFuture',
      authorId: 'user-456',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01')
    },
    {
      id: 'test-opinion-3',
      text: 'Remote work will become permanent for most tech companies',
      author: 'WorkBot',
      authorId: 'bot-789',
      source: 'bot_generated',
      isBot: true,
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10')
    },
    {
      id: 'test-opinion-4',
      text: 'Cryptocurrency will replace traditional banking within a decade',
      author: 'CryptoEnthusiast',
      authorId: 'user-321',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01')
    },
    {
      id: 'test-opinion-5',
      text: 'Virtual reality will be mainstream for education by 2025',
      author: 'EduInnovator',
      authorId: 'user-654',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-03-15'),
      updatedAt: new Date('2024-03-15')
    }
  ],

  users: [
    {
      uid: 'user-123',
      username: 'TechVisionary',
      balance: 15000,
      totalEarnings: 5000,
      totalLosses: 1000,
      joinDate: new Date('2023-12-01'),
      createdAt: new Date('2023-12-01'),
      updatedAt: new Date('2024-03-01'),
      portfolio: {
        'AI will replace most software engineers within 5 years': 50,
        'Electric vehicles will dominate the market by 2030': 25
      }
    },
    {
      uid: 'user-456',
      username: 'GreenFuture', 
      balance: 8500,
      totalEarnings: 2500,
      totalLosses: 500,
      joinDate: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-03-01'),
      portfolio: {
        'Electric vehicles will dominate the market by 2030': 100,
        'Remote work will become permanent for most tech companies': 30
      }
    },
    {
      uid: 'user-321',
      username: 'CryptoEnthusiast',
      balance: 12000,
      totalEarnings: 8000,
      totalLosses: 3000,
      joinDate: new Date('2023-11-15'),
      createdAt: new Date('2023-11-15'),
      updatedAt: new Date('2024-03-01'),
      portfolio: {
        'Cryptocurrency will replace traditional banking within a decade': 75,
        'AI will replace most software engineers within 5 years': 20
      }
    },
    {
      uid: 'user-654',
      username: 'EduInnovator',
      balance: 9800,
      totalEarnings: 1200,
      totalLosses: 200,
      joinDate: new Date('2024-02-01'),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-01'),
      portfolio: {
        'Virtual reality will be mainstream for education by 2025': 60,
        'Remote work will become permanent for most tech companies': 15
      }
    }
  ],

  marketData: [
    {
      opinionText: 'AI will replace most software engineers within 5 years',
      timesPurchased: 95,
      timesSold: 20,
      currentPrice: 18.50,
      basePrice: 10.00,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.00, timestamp: new Date('2024-01-15').toISOString(), action: 'create', quantity: 1 },
        { price: 12.50, timestamp: new Date('2024-01-16').toISOString(), action: 'buy', quantity: 10 },
        { price: 15.20, timestamp: new Date('2024-01-20').toISOString(), action: 'buy', quantity: 25 },
        { price: 13.80, timestamp: new Date('2024-02-01').toISOString(), action: 'sell', quantity: 5 },
        { price: 16.40, timestamp: new Date('2024-02-15').toISOString(), action: 'buy', quantity: 30 },
        { price: 18.50, timestamp: new Date('2024-03-01').toISOString(), action: 'buy', quantity: 25 }
      ],
      liquidityScore: 2.5,
      dailyVolume: 115
    },
    {
      opinionText: 'Electric vehicles will dominate the market by 2030',
      timesPurchased: 125,
      timesSold: 15,
      currentPrice: 22.30,
      basePrice: 10.00,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.00, timestamp: new Date('2024-02-01').toISOString(), action: 'create', quantity: 1 },
        { price: 11.80, timestamp: new Date('2024-02-02').toISOString(), action: 'buy', quantity: 15 },
        { price: 14.60, timestamp: new Date('2024-02-10').toISOString(), action: 'buy', quantity: 40 },
        { price: 17.90, timestamp: new Date('2024-02-20').toISOString(), action: 'buy', quantity: 35 },
        { price: 16.40, timestamp: new Date('2024-02-25').toISOString(), action: 'sell', quantity: 10 },
        { price: 20.10, timestamp: new Date('2024-03-05').toISOString(), action: 'buy', quantity: 30 },
        { price: 22.30, timestamp: new Date('2024-03-10').toISOString(), action: 'buy', quantity: 20 }
      ],
      liquidityScore: 3.2,
      dailyVolume: 140
    },
    {
      opinionText: 'Remote work will become permanent for most tech companies',
      timesPurchased: 65,
      timesSold: 30,
      currentPrice: 12.80,
      basePrice: 10.00,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.00, timestamp: new Date('2024-02-10').toISOString(), action: 'create', quantity: 1 },
        { price: 11.20, timestamp: new Date('2024-02-11').toISOString(), action: 'buy', quantity: 20 },
        { price: 13.50, timestamp: new Date('2024-02-15').toISOString(), action: 'buy', quantity: 25 },
        { price: 11.90, timestamp: new Date('2024-02-20').toISOString(), action: 'sell', quantity: 15 },
        { price: 14.20, timestamp: new Date('2024-02-28').toISOString(), action: 'buy', quantity: 15 },
        { price: 12.80, timestamp: new Date('2024-03-05').toISOString(), action: 'sell', quantity: 10 }
      ],
      liquidityScore: 1.8,
      dailyVolume: 95
    },
    {
      opinionText: 'Cryptocurrency will replace traditional banking within a decade',
      timesPurchased: 80,
      timesSold: 45,
      currentPrice: 11.60,
      basePrice: 10.00,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.00, timestamp: new Date('2024-03-01').toISOString(), action: 'create', quantity: 1 },
        { price: 12.40, timestamp: new Date('2024-03-02').toISOString(), action: 'buy', quantity: 25 },
        { price: 10.80, timestamp: new Date('2024-03-05').toISOString(), action: 'sell', quantity: 20 },
        { price: 13.20, timestamp: new Date('2024-03-08').toISOString(), action: 'buy', quantity: 30 },
        { price: 11.50, timestamp: new Date('2024-03-12').toISOString(), action: 'sell', quantity: 15 },
        { price: 11.60, timestamp: new Date('2024-03-15').toISOString(), action: 'buy', quantity: 10 }
      ],
      liquidityScore: 1.4,
      dailyVolume: 125
    },
    {
      opinionText: 'Virtual reality will be mainstream for education by 2025',
      timesPurchased: 60,
      timesSold: 10,
      currentPrice: 16.20,
      basePrice: 10.00,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        { price: 10.00, timestamp: new Date('2024-03-15').toISOString(), action: 'create', quantity: 1 },
        { price: 12.20, timestamp: new Date('2024-03-16').toISOString(), action: 'buy', quantity: 20 },
        { price: 14.80, timestamp: new Date('2024-03-18').toISOString(), action: 'buy', quantity: 25 },
        { price: 16.20, timestamp: new Date('2024-03-20').toISOString(), action: 'buy', quantity: 15 }
      ],
      liquidityScore: 2.1,
      dailyVolume: 70
    }
  ]
};

async function seedDatabase() {
  try {
    console.log('📝 Seeding opinions...');
    
    // Create opinions
    for (const opinion of testData.opinions) {
      await setDoc(doc(db, 'opinions', opinion.id), {
        ...opinion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    console.log(`✅ Created ${testData.opinions.length} opinions`);

    console.log('👥 Seeding users...');
    
    // Create users
    for (const user of testData.users) {
      await setDoc(doc(db, 'users', user.uid), {
        ...user,
        joinDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    console.log(`✅ Created ${testData.users.length} users`);

    console.log('📊 Seeding market data...');
    
    // Create market data
    for (const market of testData.marketData) {
      const docId = btoa(market.opinionText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 100);
      await setDoc(doc(db, 'market-data', docId), {
        ...market,
        lastUpdated: serverTimestamp()
      });
    }
    console.log(`✅ Created ${testData.marketData.length} market data entries`);

    console.log('🎉 Database seeding complete!');
    console.log('🔗 You can now navigate to any opinion page:');
    testData.opinions.forEach(opinion => {
      console.log(`   → /opinion/${opinion.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run the seeding function
seedDatabase(); 