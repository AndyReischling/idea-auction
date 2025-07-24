// scripts/test-permissions-after-deploy.js
// Test Firebase permissions after deploying new rules

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc } = require('firebase/firestore');

// Firebase config
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

async function testBotPermissions() {
  console.log('🧪 Testing bot permissions after Firebase rules deployment...\n');
  
  let passCount = 0;
  let totalTests = 4;

  // Test 1: Bot Settings (should work without auth)
  console.log('1️⃣ Testing bot-settings access...');
  try {
    const settingsDoc = doc(db, 'bot-settings', 'test');
    await setDoc(settingsDoc, {
      test: true,
      source: 'bot_manager',
      timestamp: new Date().toISOString()
    });
    
    const readBack = await getDoc(settingsDoc);
    if (readBack.exists()) {
      console.log('   ✅ bot-settings: READ/WRITE success');
      passCount++;
    } else {
      console.log('   ❌ bot-settings: READ failed');
    }
  } catch (error) {
    console.log('   ❌ bot-settings: FAILED -', error.message);
  }

  // Test 2: Opinion Generation (should work with bot flag)
  console.log('\n2️⃣ Testing opinion generation...');
  try {
    const opinionDoc = doc(collection(db, 'opinions'));
    await setDoc(opinionDoc, {
      text: '[TEST PERMISSION CHECK - DEVELOPMENT ONLY]',
      author: 'TestBot_001',
      isBot: true,
      source: 'bot_generation',
      createdAt: new Date().toISOString()
    });
    console.log('   ✅ opinions: Bot generation success');
    passCount++;
  } catch (error) {
    console.log('   ❌ opinions: FAILED -', error.message);
  }

  // Test 3: Short Position Creation (should work with botId)
  console.log('\n3️⃣ Testing short position creation...');
  try {
    const shortDoc = doc(collection(db, 'short-positions'));
    await setDoc(shortDoc, {
      botId: 'test_bot_123',
      opinionText: '[TEST SHORTING PERMISSION - DEVELOPMENT ONLY]',
      startPrice: 10.0,
      amount: 100,
      status: 'test',
      createdAt: new Date().toISOString()
    });
    console.log('   ✅ short-positions: Bot creation success');
    passCount++;
  } catch (error) {
    console.log('   ❌ short-positions: FAILED -', error.message);
  }

  // Test 4: Betting (should work with botId)
  console.log('\n4️⃣ Testing portfolio betting...');
  try {
    const betDoc = doc(collection(db, 'advanced-bets'));
    await setDoc(betDoc, {
      botId: 'test_bot_123',
      botUsername: 'TestBot_001',
      targetUser: 'SomeUser',
      betType: 'increase',
      amount: 100,
      status: 'test',
      createdAt: new Date().toISOString()
    });
    console.log('   ✅ advanced-bets: Bot betting success');
    passCount++;
  } catch (error) {
    console.log('   ❌ advanced-bets: FAILED -', error.message);
  }

  // Summary
  console.log(`\n📊 TEST RESULTS: ${passCount}/${totalTests} passed`);
  
  if (passCount === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Firebase permissions are correctly configured');
    console.log('🚀 Your bots should now work without permission errors');
    console.log('\n💻 Ready to activate:');
    console.log('   1. Open your app in browser');
    console.log('   2. Press F12 for console');
    console.log('   3. Run: botSystem.restartSystem()');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED!');
    console.log('❌ Firebase rules may not be deployed correctly');
    console.log('🔄 Try:');
    console.log('   1. Check Firebase Console rules deployment');
    console.log('   2. Wait a few more minutes for propagation');
    console.log('   3. Re-run this test script');
  }
  
  return passCount === totalTests;
}

// Run the test
if (require.main === module) {
  testBotPermissions()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test script error:', error);
      process.exit(1);
    });
}

module.exports = { testBotPermissions }; 