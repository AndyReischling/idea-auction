/*
 * migrate-bots-to-flat-structure.js
 * ------------------------------------------------------------------
 * Migration script to move bots from subcollections to top-level documents
 * 
 * Usage:
 * 1. Open your app in the browser (make sure you're signed in)
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run the migration
 * 
 * What it does:
 * - Finds all documents in autonomous-bots collection
 * - Looks for 'bots' subcollections within those documents
 * - Migrates bot data to top-level documents
 * - Preserves all bot data and relationships
 */

console.log('🚀 Starting bot migration to flat structure...');

// Import Firebase functions
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  writeBatch,
  query,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../app/lib/firebase.js';

async function migrateBots() {
  try {
    console.log('📋 Step 1: Finding all bots in subcollections...');
    
    // Find all 'bots' subcollections using collectionGroup
    const botsQuery = collectionGroup(db, 'bots');
    const botsSnapshot = await getDocs(botsQuery);
    
    console.log(`📦 Found ${botsSnapshot.size} bots in subcollections`);
    
    if (botsSnapshot.empty) {
      console.log('✅ No bots found in subcollections. Migration not needed.');
      return;
    }
    
    const batch = writeBatch(db);
    const migratedBots = [];
    
    console.log('🔄 Step 2: Migrating bots to top-level documents...');
    
    // Process each bot
    for (const botDoc of botsSnapshot.docs) {
      const botData = botDoc.data();
      const botPath = botDoc.ref.path; // e.g., "autonomous-bots/parentId/bots/0"
      
      console.log(`📝 Processing bot: ${botData.id || botDoc.id}`, botPath);
      
      // Generate a clean document ID
      const newBotId = botData.id || `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create top-level document reference
      const newBotRef = doc(db, 'autonomous-bots', newBotId);
      
      // Prepare the bot data (clean it up)
      const cleanBotData = {
        id: newBotId,
        balance: botData.balance || 10000,
        isActive: botData.isActive !== undefined ? botData.isActive : true,
        joinDate: botData.joinDate || new Date().toISOString().split('T')[0],
        lastActive: botData.lastActive || new Date().toISOString(),
        personality: {
          activityFrequency: botData.personality?.activityFrequency || 150,
          betProbability: botData.personality?.betProbability || 0.1,
          buyProbability: botData.personality?.buyProbability || 0.3,
          description: botData.personality?.description || "Automated trading bot",
          name: botData.personality?.name || `Bot ${newBotId}`
        },
        totalEarnings: botData.totalEarnings || 0,
        totalLosses: botData.totalLosses || 0,
        riskTolerance: botData.riskTolerance || 'moderate',
        tradingStrategy: botData.tradingStrategy || { type: 'balanced' },
        username: botData.username || `Bot_${newBotId.slice(0, 8)}`,
        // Add metadata
        _migrated: true,
        _migratedFrom: botPath,
        _migratedAt: new Date().toISOString()
      };
      
      // Add to batch
      batch.set(newBotRef, cleanBotData);
      
      migratedBots.push({
        oldPath: botPath,
        newId: newBotId,
        data: cleanBotData
      });
    }
    
    console.log('💾 Step 3: Writing migrated bots to Firestore...');
    await batch.commit();
    
    console.log('✅ Migration completed successfully!');
    console.log(`📊 Migration Summary:`);
    console.log(`   • Migrated: ${migratedBots.length} bots`);
    console.log(`   • New top-level documents created in autonomous-bots collection`);
    
    // Show the migrated bots
    console.log('\n📋 Migrated Bots:');
    migratedBots.forEach((bot, index) => {
      console.log(`   ${index + 1}. ${bot.newId} (${bot.data.username})`);
      console.log(`      • Balance: $${bot.data.balance}`);
      console.log(`      • Active: ${bot.data.isActive}`);
      console.log(`      • From: ${bot.oldPath}`);
    });
    
    console.log('\n🎉 Migration complete! Your bots should now appear in the leaderboard.');
    console.log('💡 Refresh your app to see the results.');
    
    // Optional: Clean up old structure
    console.log('\n🧹 Next step: You can now clean up the old subcollection structure.');
    console.log('💡 Run cleanupOldBotStructure() if you want to remove the old data.');
    
    // Store cleanup function globally for optional use
    window.cleanupOldBotStructure = async () => {
      console.log('🧹 Cleaning up old bot subcollections...');
      const cleanupBatch = writeBatch(db);
      
      for (const botDoc of botsSnapshot.docs) {
        cleanupBatch.delete(botDoc.ref);
      }
      
      await cleanupBatch.commit();
      console.log('✅ Old bot structure cleaned up!');
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('🔧 Check your permissions and try again.');
  }
}

// Run the migration
migrateBots(); 