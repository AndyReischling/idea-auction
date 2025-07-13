// Simple Bot Migration Script - Copy & Paste into Browser Console
// This will migrate all bots from subcollections to top-level documents

console.log('🚀 Starting simple bot migration...');

// Use your existing Firebase imports from the app
const { collection, collectionGroup, getDocs, writeBatch, doc } = window.firebase.firestore;
const { db } = window.unifiedMarketData || window; // Try to get db from global scope

async function migrateBots() {
  try {
    console.log('📋 Finding all bots in subcollections...');
    
    // Find all bots in subcollections
    const botsQuery = collectionGroup(db, 'bots');
    const botsSnapshot = await getDocs(botsQuery);
    
    console.log(`📦 Found ${botsSnapshot.size} bots to migrate`);
    
    if (botsSnapshot.empty) {
      console.log('✅ No bots found in subcollections');
      return;
    }
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    const totalBots = botsSnapshot.docs.length;
    let processed = 0;
    
    for (let i = 0; i < totalBots; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = botsSnapshot.docs.slice(i, i + batchSize);
      
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalBots/batchSize)} (${batchDocs.length} bots)`);
      
      for (const botDoc of batchDocs) {
        const botData = botDoc.data();
        const newBotId = botData.id || `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create top-level document
        const newBotRef = doc(db, 'autonomous-bots', newBotId);
        
        // Clean bot data
        const cleanBotData = {
          ...botData,
          id: newBotId,
          balance: botData.balance || 10000,
          isActive: botData.isActive !== undefined ? botData.isActive : true,
          joinDate: botData.joinDate || new Date().toISOString().split('T')[0],
          lastActive: botData.lastActive || new Date().toISOString(),
          username: botData.username || `Bot_${newBotId.slice(0, 8)}`,
          _migrated: true,
          _migratedAt: new Date().toISOString()
        };
        
        batch.set(newBotRef, cleanBotData);
        processed++;
      }
      
      // Commit batch
      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${processed}/${totalBots} bots)`);
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Total migrated: ${processed} bots`);
    console.log('💡 Refresh your app to see all bots in the leaderboard');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('🔧 Make sure you\'re signed in and have proper permissions');
  }
}

// Run the migration
migrateBots(); 