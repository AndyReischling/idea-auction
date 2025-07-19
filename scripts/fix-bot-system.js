/**
 * Fix Bot System - Complete diagnosis and restart
 * Run this in browser console when bots aren't working
 */

console.log('🔧 Bot System Diagnostics & Fix');
console.log('=' .repeat(60));

async function fixBotSystem() {
  // Step 1: Check basic availability
  if (typeof botSystem === 'undefined') {
    console.error('❌ botSystem not available');
    console.log('💡 Solution: Refresh the page and ensure you\'re on feed, admin, or another page that loads the bot system');
    return;
  }

  // Step 2: Current status check
  console.log('📊 Current Status:');
  const status = {
    isRunning: botSystem.isSystemRunning(),
    botCount: botSystem.getBotCount(),
    activeBots: botSystem.getActiveBotCount()
  };
  
  console.log(`   Running: ${status.isRunning ? '✅' : '❌'}`);
  console.log(`   Total Bots: ${status.botCount}`);
  console.log(`   Active Bots: ${status.activeBots}`);

  if (status.botCount === 0) {
    console.error('❌ No bots found! You may need to create bots first.');
    console.log('💡 Go to /admin page and use the "Create Bots" feature');
    return;
  }

  // Step 3: Force restart the bot system
  console.log('\n🔄 Restarting bot system...');
  try {
    botSystem.restartSystem();
    console.log('✅ Restart command sent');
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newStatus = {
      isRunning: botSystem.isSystemRunning(),
      activeBots: botSystem.getActiveBotCount()
    };
    
    console.log('📊 Status after restart:');
    console.log(`   Running: ${newStatus.isRunning ? '✅' : '❌'}`);
    console.log(`   Active Bots: ${newStatus.activeBots}`);
    
    if (newStatus.isRunning && newStatus.activeBots > 0) {
      console.log('\n✅ Bot system appears to be working!');
      console.log('👀 Watch for bot activity logs in console:');
      console.log('   🤖 [BotName]: Attempting [activity] (balance: $X.XX)');
      console.log('   🔥 Adding activity to Firebase: [username] [type]');
      
      // Set up monitoring for next few minutes
      console.log('\n🔍 Monitoring for next 30 seconds...');
      let activityCount = 0;
      const originalLog = console.log;
      
      const monitoringLog = (...args) => {
        const message = args.join(' ');
        if (message.includes('🤖') && message.includes('Attempting')) {
          activityCount++;
          console.log(`📈 Bot activity detected (#${activityCount}):`, ...args);
        } else if (message.includes('🔥 Adding activity to Firebase')) {
          console.log('✅ Activity logged to Firebase:', ...args);
        } else {
          originalLog(...args);
        }
      };
      
      console.log = monitoringLog;
      
      setTimeout(() => {
        console.log = originalLog;
        console.log(`\n📈 Monitoring complete. Detected ${activityCount} bot activities.`);
        if (activityCount > 0) {
          console.log('✅ Bot system is working correctly!');
        } else {
          console.log('⚠️ No bot activity detected. Bots may be inactive or having issues.');
          console.log('💡 Try checking the feed page to see if activities appear there.');
        }
      }, 30000);
      
    } else {
      console.error('❌ Bot system still not running properly');
      console.log('🔍 Additional debugging needed...');
      
      // Check for bots data
      if (typeof botSystem.getBots === 'function') {
        const bots = botSystem.getBots();
        console.log(`📋 Bot details: ${bots.length} total bots`);
        bots.slice(0, 3).forEach(bot => {
          console.log(`   • ${bot.username}: ${bot.isActive ? 'Active' : 'Inactive'} (Balance: $${bot.balance})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to restart bot system:', error);
    console.log('💡 Try refreshing the page and running this script again');
  }
}

// Step 4: Provide helpful commands
console.log('\n🛠️  Available Debug Commands:');
console.log('   botSystem.restartSystem() - Force restart');
console.log('   botSystem.isSystemRunning() - Check status'); 
console.log('   getBotStatus() - Detailed status');
console.log('   fixBotSystem() - Run this diagnostic');

// Attach to window for easy access
window.fixBotSystem = fixBotSystem;

// Auto-run the fix
fixBotSystem(); 