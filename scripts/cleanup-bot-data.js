#!/usr/bin/env node

/**
 * cleanup-bot-data.js - Fix incorrectly attributed bot data
 * 
 * This script fixes the issue where bot-generated bets and shorts
 * are showing up in user profiles by:
 * 1. Finding all documents that have botId but no isBot flag
 * 2. Adding isBot: true to these documents
 * 3. Ensuring proper data separation between bots and users
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
if (!require('fs').existsSync(serviceAccountPath)) {
  console.error('❌ Service account key file not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

async function cleanupBotData() {
  console.log('🧹 Starting bot data cleanup...');
  
  let totalFixed = 0;
  
  try {
    // 1. Fix advanced-bets collection
    console.log('\n📊 Checking advanced-bets collection...');
    const betsSnapshot = await db.collection('advanced-bets').get();
    console.log(`Found ${betsSnapshot.size} betting documents`);
    
    let betsFixed = 0;
    const batch1 = db.batch();
    let batchCount1 = 0;
    
    for (const doc of betsSnapshot.docs) {
      const data = doc.data();
      
      // If document has botId but no isBot flag, it's bot data
      if (data.botId && !data.hasOwnProperty('isBot')) {
        console.log(`🔧 Fixing bet document: ${doc.id} (botId: ${data.botId})`);
        batch1.update(doc.ref, { 
          isBot: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        betsFixed++;
        batchCount1++;
        
        // Firestore batch limit is 500
        if (batchCount1 >= 500) {
          await batch1.commit();
          console.log(`✅ Committed batch of ${batchCount1} bet updates`);
          batchCount1 = 0;
          // Create new batch
          const newBatch = db.batch();
          Object.setPrototypeOf(batch1, Object.getPrototypeOf(newBatch));
          Object.assign(batch1, newBatch);
        }
      }
    }
    
    if (batchCount1 > 0) {
      await batch1.commit();
      console.log(`✅ Committed final batch of ${batchCount1} bet updates`);
    }
    
    console.log(`✅ Fixed ${betsFixed} betting documents`);
    totalFixed += betsFixed;
    
    // 2. Fix short-positions collection
    console.log('\n📉 Checking short-positions collection...');
    const shortsSnapshot = await db.collection('short-positions').get();
    console.log(`Found ${shortsSnapshot.size} short position documents`);
    
    let shortsFixed = 0;
    const batch2 = db.batch();
    let batchCount2 = 0;
    
    for (const doc of shortsSnapshot.docs) {
      const data = doc.data();
      
      // If document has botId but no isBot flag, it's bot data
      if (data.botId && !data.hasOwnProperty('isBot')) {
        console.log(`🔧 Fixing short document: ${doc.id} (botId: ${data.botId})`);
        batch2.update(doc.ref, { 
          isBot: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        shortsFixed++;
        batchCount2++;
        
        // Firestore batch limit is 500
        if (batchCount2 >= 500) {
          await batch2.commit();
          console.log(`✅ Committed batch of ${batchCount2} short updates`);
          batchCount2 = 0;
          // Create new batch
          const newBatch = db.batch();
          Object.setPrototypeOf(batch2, Object.getPrototypeOf(newBatch));
          Object.assign(batch2, newBatch);
        }
      }
    }
    
    if (batchCount2 > 0) {
      await batch2.commit();
      console.log(`✅ Committed final batch of ${batchCount2} short updates`);
    }
    
    console.log(`✅ Fixed ${shortsFixed} short position documents`);
    totalFixed += shortsFixed;
    
    // 3. Show summary
    console.log('\n🎉 Cleanup Summary:');
    console.log(`   • Fixed ${betsFixed} betting positions`);
    console.log(`   • Fixed ${shortsFixed} short positions`);
    console.log(`   • Total documents fixed: ${totalFixed}`);
    
    if (totalFixed > 0) {
      console.log('\n✅ Bot data cleanup completed successfully!');
      console.log('   Users should no longer see bot-generated positions in their profiles.');
    } else {
      console.log('\n✅ No cleanup needed - all data is already correctly flagged.');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupBotData().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 