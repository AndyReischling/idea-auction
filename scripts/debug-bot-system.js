/**
 * Debug Bot System - Check status and restart bots if needed
 * Run this in browser console to debug bot activity issues
 */

console.log('🔧 Bot System Debug Tool');
console.log('=' .repeat(50));

// Check if bot system is available
if (typeof botSystem === 'undefined') {
  console.error('❌ botSystem not available. Try refreshing the page.');
  console.log('💡 Make sure you\'re on a page that loads the bot system (feed, admin, etc.)');
} else {
  // Check system status
  const status = {
    isRunning: botSystem.isSystemRunning(),
    botCount: botSystem.getBotCount(),
    activeBots: botSystem.getActiveBotCount()
  };
  
  console.log('📊 Current Status:');
  console.log(`   Running: ${status.isRunning ? '✅' : '❌'}`);
  console.log(`   Total Bots: ${status.botCount}`);
  console.log(`   Active Bots: ${status.activeBots}`);
  
  // If not running, try to restart
  if (!status.isRunning) {
    console.log('');
    console.log('🔄 Bot system not running. Attempting restart...');
    try {
      botSystem.restartSystem();
      console.log('✅ Restart command sent');
      console.log('⏱️  Wait 5-10 seconds and check for bot activity');
    } catch (error) {
      console.error('❌ Failed to restart:', error);
    }
  } else {
    console.log('');
    console.log('✅ Bot system appears to be running');
    console.log('👀 Watch the console for bot activity logs like:');
    console.log('   🤖 [BotName]: Attempting [activity] (balance: $X.XX)');
  }
  
  // Provide useful commands
  console.log('');
  console.log('🛠️  Available Commands:');
  console.log('   botSystem.restartSystem() - Restart the bot system');
  console.log('   botSystem.isSystemRunning() - Check if running');
  console.log('   botSystem.getBotCount() - Get total bot count');
  console.log('   getBotStatus() - Get detailed status');
  
  // Check recent transactions
  try {
    const transactions = botSystem.getBotTransactions();
    console.log('');
    console.log(`📋 Recent Transactions: ${transactions.length}`);
    if (transactions.length > 0) {
      const recent = transactions.slice(-3);
      recent.forEach(tx => {
        console.log(`   ${tx.type}: $${tx.amount} (${tx.date})`);
      });
    } else {
      console.log('   ⚠️  No recent transactions found');
      console.log('   This could indicate bots aren\'t performing activities');
    }
  } catch (error) {
    console.log('   ❌ Could not fetch transaction history');
  }
} 