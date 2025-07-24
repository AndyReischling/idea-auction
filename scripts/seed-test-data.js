#!/usr/bin/env node

/*
 * seed-test-data.js
 * ------------------------------------------------------------------
 * Creates sample data for testing the trading interface:
 * - Test users
 * - Sample opinions
 * - Market data for each opinion
 * - Some transaction history
 */

// Check if we're in the correct directory
const fs = require('fs');
const path = require('path');

// Simple browser-compatible version using fetch
if (typeof window !== 'undefined') {
  console.log('Run this script in Node.js, not the browser');
  process.exit(1);
}

// We'll use the Firebase Admin SDK for this
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.log('Installing firebase-admin...');
  require('child_process').execSync('npm install firebase-admin', { stdio: 'inherit' });
  admin = require('firebase-admin');
}

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "idea-auction",
  "private_key_id": "your-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@idea-auction.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
};

// For now, let's create a browser-based approach since we don't have service account
console.log('🔄 Creating test data using client-side approach...');

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
      isBot: false,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'test-opinion-2', 
      text: '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser2',
      authorId: 'user-456',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01')
    },
    {
      id: 'test-opinion-3',
      text: '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]',
      author: 'TestBot1',
      authorId: 'bot-789',
      source: 'bot_generated',
      isBot: true,
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10')
    },
    {
      id: 'test-opinion-4',
      text: '[TEST PLACEHOLDER OPINION #4 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser3',
      authorId: 'user-321',
      source: 'user',
      isBot: false,
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01')
    },
    {
      id: 'test-opinion-5',
      text: '[TEST PLACEHOLDER OPINION #5 - FOR DEVELOPMENT ONLY]',
      author: 'TestUser4',
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
      joinDate: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-03-01'),
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
      joinDate: new Date('2023-11-15'),
      createdAt: new Date('2023-11-15'),
      updatedAt: new Date('2024-03-01'),
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
      joinDate: new Date('2024-02-01'),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-01'),
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
      opinionText: '[TEST PLACEHOLDER OPINION #2 - FOR DEVELOPMENT ONLY]',
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
      opinionText: '[TEST PLACEHOLDER OPINION #3 - FOR DEVELOPMENT ONLY]',
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
      opinionText: '[TEST PLACEHOLDER OPINION #4 - FOR DEVELOPMENT ONLY]',
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
      opinionText: '[TEST PLACEHOLDER OPINION #5 - FOR DEVELOPMENT ONLY]',
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

// Export the data structure
module.exports = testData;

// If run directly, print the data
if (require.main === module) {
  console.log('📋 Test data structure created');
  console.log(`📝 ${testData.opinions.length} opinions`);
  console.log(`👥 ${testData.users.length} users`);
  console.log(`📊 ${testData.marketData.length} market data entries`);
  console.log('\n🔗 Copy this data to Firebase Console or use the browser import script');
  
  // Write to JSON file for easy import
  fs.writeFileSync('test-data.json', JSON.stringify(testData, null, 2));
  console.log('✅ Written to test-data.json');
} 