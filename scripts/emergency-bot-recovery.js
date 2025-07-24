/*
 * Emergency Bot Recovery Script
 * ================================================================
 * Run this in browser console to check for lost bots and recover them
 */

console.log('🚨 Emergency Bot Recovery - Checking for bots...');

async function checkAndRecoverBots() {
  try {
    // Check if bots exist in subcollections
    console.log('📋 Step 1: Checking for bots in subcollections...');
    const { collectionGroup, getDocs } = window.firebase.firestore;
    const { db } = window.unifiedMarketData || window;
    
    const botsQuery = collectionGroup(db, 'bots');
    const botsSnapshot = await getDocs(botsQuery);
    
    console.log(`📦 Found ${botsSnapshot.size} bots in subcollections`);
    
    if (botsSnapshot.size > 0) {
      console.log('✅ Bots found in subcollections! The migration may have worked.');
      console.log('💡 Try refreshing your app - the bots should appear.');
      return;
    }
    
    // Check autonomous-bots collection for any remaining documents
    console.log('📋 Step 2: Checking autonomous-bots collection...');
    const { collection } = window.firebase.firestore;
    const autonomousBotsQuery = collection(db, 'autonomous-bots');
    const autonomousBotsSnapshot = await getDocs(autonomousBotsQuery);
    
    console.log(`📦 Found ${autonomousBotsSnapshot.size} documents in autonomous-bots`);
    
    if (autonomousBotsSnapshot.size === 0) {
      console.log('❌ No bots found anywhere. Starting emergency recreation...');
      await recreateBotsFromScratch();
    } else {
      // Check what type of documents exist
      autonomousBotsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`📄 Document ${doc.id}:`, Object.keys(data));
      });
    }
    
  } catch (error) {
    console.error('❌ Recovery check failed:', error);
  }
}

async function recreateBotsFromScratch() {
  console.log('🔄 Recreating 1000 bots from scratch...');
  
  try {
    const { doc, setDoc, writeBatch } = window.firebase.firestore;
    const { db } = window.unifiedMarketData || window;
    
    // Create parent container
    const parentDocId = 'bot-container-' + Date.now();
    
    // Bot personalities and strategies
    const personalities = [
      { name: 'Conservative Carl', description: 'Plays it safe with steady investments', activityFrequency: 50, betProbability: 0.05, buyProbability: 0.2 },
      { name: 'Aggressive Alice', description: 'High-risk, high-reward trading style', activityFrequency: 200, betProbability: 0.3, buyProbability: 0.6 },
      { name: 'Moderate Mike', description: 'Balanced approach to trading', activityFrequency: 100, betProbability: 0.15, buyProbability: 0.4 },
      { name: 'Trendy Tina', description: 'Follows market trends and popular opinions', activityFrequency: 150, betProbability: 0.2, buyProbability: 0.5 },
      { name: 'Contrarian Connor', description: 'Goes against the crowd', activityFrequency: 80, betProbability: 0.1, buyProbability: 0.3 }
    ];
    
    const riskLevels = ['conservative', 'moderate', 'aggressive'];
    
    // Create bots in batches of 100
    const batchSize = 100;
    let created = 0;
    
    for (let i = 0; i < 1000; i += batchSize) {
      const batch = writeBatch(db);
      const batchCount = Math.min(batchSize, 1000 - i);
      
      console.log(`🔄 Creating batch ${Math.floor(i/batchSize) + 1}/10 (${batchCount} bots)`);
      
      for (let j = 0; j < batchCount; j++) {
        const botIndex = i + j;
        const personality = personalities[botIndex % personalities.length];
        const riskTolerance = riskLevels[botIndex % riskLevels.length];
        
        const botData = {
          id: `bot_${botIndex}`,
          username: `${personality.name.split(' ')[0]}_${botIndex}`,
          balance: 10000 + Math.floor(Math.random() * 50000), // Random starting balance
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
            type: riskTolerance === 'aggressive' ? 'momentum' : riskTolerance === 'conservative' ? 'value' : 'balanced'
          },
          totalEarnings: Math.floor(Math.random() * 5000),
          totalLosses: Math.floor(Math.random() * 2000),
          _recreated: true,
          _recreatedAt: new Date().toISOString()
        };
        
        // Add to subcollection
        const botRef = doc(db, 'autonomous-bots', parentDocId, 'bots', botIndex.toString());
        batch.set(botRef, botData);
        created++;
      }
      
      // Commit batch
      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} completed (${created}/1000 bots)`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Create parent container document
    const parentRef = doc(db, 'autonomous-bots', parentDocId);
    await setDoc(parentRef, {
      type: 'bot-container',
      totalBots: created,
      createdAt: new Date().toISOString(),
      description: 'Emergency recreated bot container'
    });
    
    console.log(`🎉 Emergency recreation completed! Created ${created} bots`);
    console.log('💡 Refresh your app to see the recreated bots');
    
  } catch (error) {
    console.error('❌ Emergency recreation failed:', error);
  }
}

// Run the recovery check
checkAndRecoverBots(); 