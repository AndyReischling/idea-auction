// Script to populate public leaderboard with real data from existing users
// This can be run by authenticated users to ensure the public leaderboard is up to date

const { initializeApp, getApps } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  setDoc,
  doc,
  serverTimestamp 
} = require('firebase/firestore');

// Initialize Firebase (use your project's config)
const firebaseConfig = {
  // Add your Firebase config here
  // This should match your app's config
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

async function populatePublicLeaderboard() {
  try {
    console.log('🔄 Fetching users and portfolios...');
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Get all user portfolios
    const portfoliosSnapshot = await getDocs(collection(db, 'user-portfolios'));
    const portfolios = [];
    portfoliosSnapshot.forEach(doc => {
      portfolios.push({
        userId: doc.id,
        ...doc.data()
      });
    });
    
    // Get market data for price calculations
    const marketDataSnapshot = await getDocs(collection(db, 'market-data'));
    const marketData = new Map();
    marketDataSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.opinionText) {
        marketData.set(data.opinionText, data);
      }
    });
    
    // Calculate leaderboard
    const leaderboard = [];
    
    for (const user of users) {
      const portfolio = portfolios.find(p => p.userId === user.id);
      if (!portfolio || !portfolio.ownedOpinions) continue;
      
      // Calculate portfolio value
      const portfolioValue = portfolio.ownedOpinions.reduce((sum, opinion) => {
        const market = marketData.get(opinion.opinionText);
        const currentPrice = market ? market.currentPrice : opinion.purchasePrice;
        return sum + (currentPrice * opinion.quantity);
      }, 0);
      
      // Calculate top holdings
      const topHoldings = portfolio.ownedOpinions
        .sort((a, b) => {
          const aMarket = marketData.get(a.opinionText);
          const bMarket = marketData.get(b.opinionText);
          const aValue = (aMarket ? aMarket.currentPrice : a.purchasePrice) * a.quantity;
          const bValue = (bMarket ? bMarket.currentPrice : b.purchasePrice) * b.quantity;
          return bValue - aValue;
        })
        .slice(0, 2)
        .map(opinion => {
          const market = marketData.get(opinion.opinionText);
          const currentPrice = market ? market.currentPrice : opinion.purchasePrice;
          return {
            text: opinion.opinionText,
            value: currentPrice * opinion.quantity,
            currentPrice,
            quantity: opinion.quantity
          };
        });
      
      leaderboard.push({
        uid: user.id,
        username: user.username,
        portfolioValue,
        topHoldings,
        isBot: false
      });
    }
    
    // Also get bots
    const botsSnapshot = await getDocs(collection(db, 'autonomous-bots'));
    const botPortfoliosSnapshot = await getDocs(collection(db, 'bot-portfolios'));
    const botPortfolios = [];
    
    botPortfoliosSnapshot.forEach(doc => {
      botPortfolios.push({
        botId: doc.id,
        ...doc.data()
      });
    });
    
    // Process bots (simplified)
    for (const botDoc of botsSnapshot.docs) {
      const botData = botDoc.data();
      Object.entries(botData).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && 
            (key.startsWith('bot_') || (value.id && value.balance !== undefined))) {
          
          const bot = value;
          const botPortfolio = botPortfolios.find(p => p.botId === bot.id);
          
          if (botPortfolio && botPortfolio.holdings) {
            const portfolioValue = botPortfolio.holdings.reduce((sum, holding) => {
              const market = marketData.get(holding.opinionText);
              const currentPrice = market ? market.currentPrice : holding.purchasePrice;
              return sum + (currentPrice * holding.quantity);
            }, 0);
            
            const topHoldings = botPortfolio.holdings
              .sort((a, b) => {
                const aMarket = marketData.get(a.opinionText);
                const bMarket = marketData.get(b.opinionText);
                const aValue = (aMarket ? aMarket.currentPrice : a.purchasePrice) * a.quantity;
                const bValue = (bMarket ? bMarket.currentPrice : b.purchasePrice) * b.quantity;
                return bValue - aValue;
              })
              .slice(0, 2)
              .map(holding => {
                const market = marketData.get(holding.opinionText);
                const currentPrice = market ? market.currentPrice : holding.purchasePrice;
                return {
                  text: holding.opinionText,
                  value: currentPrice * holding.quantity,
                  currentPrice,
                  quantity: holding.quantity
                };
              });
            
            leaderboard.push({
              uid: bot.id,
              username: bot.personality?.name || bot.username || `Bot_${bot.id.slice(0, 8)}`,
              portfolioValue,
              topHoldings,
              isBot: true
            });
          }
        }
      });
    }
    
    // Sort by portfolio value and take top 5
    const topTraders = leaderboard
      .sort((a, b) => b.portfolioValue - a.portfolioValue)
      .slice(0, 5);
    
    console.log(`📊 Found ${leaderboard.length} traders, updating top ${topTraders.length}`);
    
    // Update public leaderboard
    for (let i = 0; i < topTraders.length; i++) {
      const trader = topTraders[i];
      const publicEntry = {
        uid: trader.uid,
        username: trader.username,
        portfolioValue: trader.portfolioValue,
        rank: i + 1,
        topHoldings: trader.topHoldings,
        isBot: trader.isBot,
        lastUpdated: serverTimestamp()
      };
      
      await setDoc(doc(collection(db, 'public-leaderboard'), trader.uid), publicEntry);
      console.log(`✅ Updated #${i + 1}: ${trader.username} ($${trader.portfolioValue.toFixed(2)})`);
    }
    
    console.log('🎉 Public leaderboard populated successfully!');
    
  } catch (error) {
    console.error('❌ Error populating public leaderboard:', error);
  }
}

// Run the script
populatePublicLeaderboard(); 