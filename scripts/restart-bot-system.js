// scripts/restart-bot-system.js
// Script to restart the autonomous bot system and verify bot status

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Firebase config (matches the project configuration)
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

async function checkBotStatus() {
  console.log('🔍 Checking bot status in Firestore...');
  
  try {
    // Count total bots
    const botsCol = collection(db, 'autonomous-bots');
    const allBotsSnap = await getDocs(botsCol);
    const totalBots = allBotsSnap.size;
    
    // Count active bots
    const activeBotsQuery = query(botsCol, where('isActive', '==', true));
    const activeBotsSnap = await getDocs(activeBotsQuery);
    const activeBots = activeBotsSnap.size;
    
    // Count bots by risk tolerance
    let conservative = 0, moderate = 0, aggressive = 0;
    allBotsSnap.forEach(doc => {
      const bot = doc.data();
      if (bot.riskTolerance === 'conservative') conservative++;
      else if (bot.riskTolerance === 'moderate') moderate++;
      else if (bot.riskTolerance === 'aggressive') aggressive++;
    });
    
    console.log('\n📊 BOT STATUS REPORT:');
    console.log(`   Total Bots: ${totalBots}`);
    console.log(`   Active Bots: ${activeBots}`);
    console.log(`   Inactive Bots: ${totalBots - activeBots}`);
    console.log('\n🤖 RISK DISTRIBUTION:');
    console.log(`   Conservative: ${conservative}`);
    console.log(`   Moderate: ${moderate}`);
    console.log(`   Aggressive: ${aggressive}`);
    
    // Show recent bot activity
    console.log('\n📈 RECENT BOT ACTIVITY:');
    const recentBots = [];
    allBotsSnap.forEach(doc => {
      const bot = doc.data();
      if (bot.lastActive) {
        recentBots.push({
          username: bot.username,
          lastActive: bot.lastActive,
          balance: bot.balance
        });
      }
    });
    
    // Sort by most recent activity
    recentBots.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    
    // Show top 10 most recent
    recentBots.slice(0, 10).forEach((bot, i) => {
      const timeSince = new Date() - new Date(bot.lastActive);
      const minutesAgo = Math.floor(timeSince / 1000 / 60);
      console.log(`   ${i+1}. ${bot.username} - $${bot.balance.toLocaleString()} (${minutesAgo}min ago)`);
    });
    
    if (totalBots === 0) {
      console.log('\n❌ No bots found! Run create-1000-bots.js first.');
      return false;
    } else if (activeBots === 0) {
      console.log('\n⚠️ Bots exist but none are active!');
      return false;
    } else {
      console.log('\n✅ Bots are configured and ready!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error checking bot status:', error);
    return false;
  }
}

async function restartBotSystem() {
  console.log('🔄 Bot system restart instructions:\n');
  
  console.log('To restart the bot system:');
  console.log('1. Open your app in a browser');
  console.log('2. Open developer console (F12)');
  console.log('3. Run: botSystem.restartSystem()');
  console.log('4. Or run: botSystem.stop() then botSystem.start()');
  console.log('\n💡 The bot system should automatically pick up all 1,000 bots!');
  
  const status = await checkBotStatus();
  
  if (status) {
    console.log('\n🚀 Your bots are ready to trade autonomously!');
    console.log('   They will start making trades once the system is active.');
  }
}

// Run the script
if (require.main === module) {
  restartBotSystem()
    .then(() => {
      console.log('\n🏁 Bot restart check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { checkBotStatus, restartBotSystem }; 