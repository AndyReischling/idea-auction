// app/lib/autonomous-bots.ts (Firestore‑native rewrite)
// -----------------------------------------------------------------------------
// ✅ All browser‑only localStorage calls removed
// ✅ State persisted in Cloud Firestore (and kept in memory for perf)
// -----------------------------------------------------------------------------

import {
  collection,
  doc,
  getFirestore,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

import {
  calculateUnifiedPrice,
  UnifiedMarketDataManager,
  UnifiedTransactionManager,
  type UnifiedOpinionMarketData,
  type UnifiedTransaction,
} from '../lib/unified-system';

import { db } from '../lib/firebase';
import { firebaseActivityService } from '../lib/firebase-activity';

// -----------------------------------------------------------------------------
// 🔥 Firestore helpers
// -----------------------------------------------------------------------------

const colBots = collection(db, 'autonomous-bots');   // ⇢ /autonomous-bots/{botId}
const colBotPortfolios = collection(db, 'bot-portfolios'); // ⇢ /bot-portfolios/{botId}/{holdingId}
const colBotTransactions = collection(db, 'bot-transactions');

// -----------------------------------------------------------------------------
// 🔖 Types (trimmed – keep the ones we actually use below)
// -----------------------------------------------------------------------------
export interface BotProfile {
  id: string;
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  lastActive: string;
  isActive: boolean;
}

interface OpinionRef {
  id: string;
  text: string;
}

// -----------------------------------------------------------------------------
// 🤖  AutonomousBotSystem (Firestore edition)
// -----------------------------------------------------------------------------
class AutonomousBotSystem {
  private bots: Map<string, BotProfile> = new Map();
  private isRunning = false;
  private market = UnifiedMarketDataManager;
  private txMgr = UnifiedTransactionManager;
  private intervals: Record<string, NodeJS.Timeout> = {};

  // ----------------------------------------------------------------------------
  // 🚀 Boot
  // ----------------------------------------------------------------------------
  constructor() {
    // Don't start immediately - let bootstrap complete first
    this.bootstrap().catch(error => {
      console.error('🤖 Bot system bootstrap failed:', error);
    });
  }

  /** bootstrap – initial fetch + live listeners */
  private async bootstrap() {
    console.log('🤖 Loading bots from Firestore...');
    
    // 1️⃣ prime from Firestore once - WAIT for this to complete
    const snap = await getDocs(colBots);
    snap.forEach(d => this.bots.set(d.id, d.data() as BotProfile));

    console.log(`🤖 Loaded ${this.bots.size} bots from Firestore`);
    console.log(`🤖 Active bots: ${this.getActiveBotCount()}`);

    // 2️⃣ Ensure all bots have user entries for profile pages
    await this.ensureBotUserEntries();

    // 3️⃣ live updates – keep local cache fresh
    onSnapshot(colBots, qs => {
      qs.docChanges().forEach(c => {
        if (c.type === 'removed') this.bots.delete(c.doc.id);
        else this.bots.set(c.doc.id, c.doc.data() as BotProfile);
      });
    });

    // 🏃‍♂️ start after cache is warm and we have bots loaded
    if (this.bots.size > 0) {
      this.start();
    } else {
      console.log('🤖 No bots found in database - bot system not started');
    }
  }

  /** Ensure all bots have entries in the users collection for profile pages */
  private async ensureBotUserEntries() {
    console.log('🤖 Ensuring bot user entries exist...');
    const usersCollection = collection(db, 'users');
    
    for (const [botId, bot] of this.bots) {
      try {
        // Check if user entry exists
        const userDoc = await getDoc(doc(usersCollection, botId));
        
        if (!userDoc.exists()) {
          // Create user entry for the bot
          await setDoc(doc(usersCollection, botId), {
            username: bot.username || `Bot_${botId}`,
            balance: bot.balance || 50000,
            joinDate: bot.joinDate || new Date().toISOString(),
            totalEarnings: bot.totalEarnings || 0,
            totalLosses: bot.totalLosses || 0,
            isBot: true,
            botId: botId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log(`🤖 Created user entry for bot: ${bot.username}`);
        }
      } catch (error) {
        console.error(`🤖 Error ensuring user entry for bot ${bot.username}:`, error);
      }
    }
    console.log('✅ Bot user entries verified');
  }

  // ----------------------------------------------------------------------------
  // ▶️  start / ⏹  stop
  // ----------------------------------------------------------------------------
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const activeBots = [...this.bots.values()].filter(bot => bot.isActive);
    console.log(`🤖 Bot system started with ${activeBots.length} active bots`);

    // spin each active bot on its own timer
    // HIGH FREQUENCY: 30 seconds to 2 minute intervals for bot activity
    [...this.bots.values()].forEach(bot => {
      if (!bot.isActive) return;
      const ms = 30_000 + Math.random() * 90_000; // 30 seconds to 2 minutes
      this.intervals[bot.id] = setInterval(() => this.tick(bot), ms);
    });
  }

  public stop() {
    Object.values(this.intervals).forEach(clearInterval);
    this.intervals = {};
    this.isRunning = false;
  }

  // ----------------------------------------------------------------------------
  // 🔍 Status and control methods (used by BotManager)
  // ----------------------------------------------------------------------------
  public isSystemRunning(): boolean {
    return this.isRunning;
  }

  public startBots() {
    // If bots haven't loaded yet, wait for them
    if (this.bots.size === 0) {
      console.log('🤖 Waiting for bots to load before starting...');
      // Set a flag to auto-start once bots are loaded
      // Bootstrap will handle starting once bots are ready
      return;
    }
    
    // If bots are loaded, restart the system to ensure they're active
    if (this.isRunning) {
      console.log('🤖 Restarting bot system with loaded bots...');
      this.stop();
    }
    this.start();
  }

  public getBotCount(): number {
    return this.bots.size;
  }

  public getActiveBotCount(): number {
    return [...this.bots.values()].filter(bot => bot.isActive).length;
  }

  public getBots(): BotProfile[] {
    // Convert Map to array, ensuring each bot has its document ID
    return [...this.bots.entries()].map(([docId, botData]) => ({
      ...botData,
      id: docId  // Ensure the document ID is included in the bot object
    }));
  }

  public getBotTransactions(): any[] {
    // This would need to be implemented to fetch bot transactions from Firestore
    // For now, return empty array to prevent errors
    console.warn('getBotTransactions() not yet implemented - returning empty array');
    return [];
  }

  public restartSystem() {
    console.log('🔄 Restarting bot system...');
    this.stop();
    // Clear current bots and re-bootstrap to pick up new ones
    this.bots.clear();
    this.bootstrap();
  }

  // ----------------------------------------------------------------------------
  // 🕐  tick – one decision loop (enhanced for all activities)
  // ----------------------------------------------------------------------------
  private async tick(bot: BotProfile) {
    try {
      // Determine activity frequency based on bot personality
      const activityChance = this.getBotActivityChance(bot);
      if (Math.random() > activityChance) {
        // Occasional debug logging to show ticks are happening
        if (Math.random() < 0.001) { // Log 0.1% of tick attempts
          console.log(`🤖 ${bot.username}: Tick (no action this time, ${(activityChance * 100).toFixed(0)}% chance)`);
        }
        return;
      }

      // Choose what type of activity to perform
      const activityType = this.chooseActivityType(bot);
      
      // Enhanced logging for debugging - show all attempted activities
      console.log(`🤖 ${bot.username}: Attempting ${activityType} (balance: $${bot.balance.toFixed(2)})`);

      switch (activityType) {
        case 'buy':
          await this.handleBuyActivity(bot);
          break;
        case 'sell':
          await this.handleSellActivity(bot);
          break;
        case 'short':
          await this.handleShortActivity(bot);
          break;
        case 'bet':
          await this.handleBettingActivity(bot);
          break;
        case 'generate':
          await this.handleOpinionGeneration(bot);
          break;
        default:
          await this.handleBuyActivity(bot); // Default to buying
      }
    } catch (error) {
      console.error(`🤖 ${bot.username} tick error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 🎯 Determine bot activity preferences
  // ----------------------------------------------------------------------------
  private getBotActivityChance(bot: BotProfile): number {
    // HIGH ACTIVITY: Much higher chances for frequent bot actions
    if (bot.username.includes('Aggressive') || bot.username.includes('Quick') || bot.username.includes('Wild')) {
      return 0.90; // 90% chance per tick
    } else if (bot.username.includes('Conservative') || bot.username.includes('Patient') || bot.username.includes('Calm')) {
      return 0.70; // 70% chance per tick
    }
    return 0.80; // 80% default chance
  }

  private chooseActivityType(bot: BotProfile): string {
    const activities = ['buy', 'sell', 'short', 'bet', 'generate'];
    const weights: Record<string, number[]> = {
      // [buy, sell, short, bet, generate] weights
      'aggressive': [0.3, 0.2, 0.25, 0.15, 0.1],
      'conservative': [0.4, 0.3, 0.05, 0.05, 0.2],
      'moderate': [0.35, 0.25, 0.15, 0.1, 0.15]
    };

    // Determine bot type from username
    let botType = 'moderate';
    if (bot.username.includes('Conservative') || bot.username.includes('Patient')) {
      botType = 'conservative';
    } else if (bot.username.includes('Aggressive') || bot.username.includes('Quick') || bot.username.includes('Wild')) {
      botType = 'aggressive';
    }

    const botWeights = weights[botType];
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < activities.length; i++) {
      cumulative += botWeights[i];
      if (random <= cumulative) {
        return activities[i];
      }
    }

    return 'buy'; // Fallback
  }

  // ----------------------------------------------------------------------------
  // 📋 Get available opinions from Firestore
  // ----------------------------------------------------------------------------
  private async getAvailableOpinions(): Promise<OpinionRef[]> {
    try {
      const opinionsCol = collection(db, 'opinions');
      const snapshot = await getDocs(opinionsCol);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text || doc.data().opinion || 'Unknown Opinion'
      }));
    } catch (error) {
      console.error('Error fetching opinions:', error);
      return [];
    }
  }

  // ----------------------------------------------------------------------------
  // 💸  makeBotTrade (Fixed for unified system compatibility)
  // ----------------------------------------------------------------------------
  private async makeBotTrade(bot: BotProfile, opinion: OpinionRef, qty: number) {
    try {
      // Get current market data
      const marketData = await this.market.get(opinion.text);
      const price = marketData.currentPrice;
      const total = price * qty;
      
      // Check if bot has enough balance
      if (bot.balance < total) {
        console.log(`🤖 ${bot.username}: Insufficient balance ($${bot.balance}) for trade ($${total})`);
        return;
      }

      // Apply the trade through unified system
      const updatedMarketData = await this.market.applyTrade(opinion.text, 'buy', qty, bot.id);
      
      // Update bot balance in RAM & Firestore
      bot.balance -= total;
      bot.lastActive = new Date().toISOString();
      await updateDoc(doc(colBots, bot.id), {
        balance: bot.balance,
        lastActive: bot.lastActive,
      });

      // SYNC FIX: Also update users collection for unified access
      await setDoc(doc(db, 'users', bot.id), {
        username: bot.username || `Bot_${bot.id}`,
        balance: bot.balance,
        joinDate: bot.joinDate || new Date().toISOString(),
        totalEarnings: bot.totalEarnings || 0,
        totalLosses: bot.totalLosses || 0,
        isBot: true,
        botId: bot.id,
        lastActive: bot.lastActive
      }, { merge: true });

      // Create and save transaction
      const transaction = this.txMgr.create('buy', -total, {
        opinionText: opinion.text,
        opinionId: opinion.id,
        botId: bot.id,
        userId: bot.id, // Add userId to match activity queries
        metadata: { 
          source: 'bot_system', 
          version: '2.0',
          price: price,
          quantity: qty,
          username: bot.username || `Bot_${bot.id}` // Include username
        }
      });
      
      await this.txMgr.save(transaction);

            console.log(`🤖 ${bot.username} bought ${qty}x "${opinion.text.slice(0, 30)}…" ($${total.toFixed(2)}) @ $${price}`);
        
      // Update bot total earnings for leaderboard calculations  
      bot.totalEarnings = (bot.totalEarnings || 0);
      await updateDoc(doc(colBots, bot.id), {
        totalEarnings: bot.totalEarnings
      });
        
      // Log to activity feed for live display - ensure username is valid
      await firebaseActivityService.addActivity({
        type: 'buy',
        username: bot.username || `Bot_${bot.id}`,
        userId: bot.id,
        opinionText: opinion.text,
        opinionId: opinion.id,
        amount: total,
        price: price,
        quantity: qty,
        isBot: true,
        botId: bot.id,
        metadata: {
          source: 'bot_system',
          activityType: 'purchase'
        }
      });
      
      // Update portfolio in bot-portfolios collection
      await setDoc(
        doc(colBotPortfolios, `${bot.id}_${opinion.id}`),
        {
          botId: bot.id,
          opinionId: opinion.id,
          opinionText: opinion.text,
          qty: qty,
          avgPrice: price,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      // Update consolidated bot portfolio
      await this.updateBotPortfolio(bot.id);

    } catch (error) {
      console.error(`🤖 ${bot.username} trade error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 📈 Activity Handlers - All bot behaviors
  // ----------------------------------------------------------------------------
  
  // Buy Activity - Purchase opinions
  private async handleBuyActivity(bot: BotProfile) {
    const opinions = await this.getAvailableOpinions();
    if (!opinions.length) return;

    const opinion = opinions[Math.floor(Math.random() * opinions.length)];
    await this.makeBotTrade(bot, opinion, 1);
  }

  // Sell Activity - Sell owned positions
  private async handleSellActivity(bot: BotProfile) {
    try {
      const portfolio = await this.getBotPortfolio(bot.id);
      if (!portfolio.length) {
        console.log(`🤖 ${bot.username}: No positions to sell`);
        return;
      }

      const position = portfolio[Math.floor(Math.random() * portfolio.length)];
      await this.sellBotPosition(bot, position);
    } catch (error) {
      console.error(`🤖 ${bot.username} sell error:`, error);
    }
  }

  // Short Activity - Create short positions
  private async handleShortActivity(bot: BotProfile) {
    try {
      const opinions = await this.getAvailableOpinions();
      if (!opinions.length) return;

      const opinion = opinions[Math.floor(Math.random() * opinions.length)];
      await this.createShortPosition(bot, opinion);
    } catch (error) {
      console.error(`🤖 ${bot.username} short error:`, error);
    }
  }

  // Betting Activity - Bet on other users' portfolios
  private async handleBettingActivity(bot: BotProfile) {
    try {
      const users = await this.getOtherUsers(bot.id);
      if (!users.length) {
        console.log(`🤖 ${bot.username}: No users to bet on`);
        return;
      }

      const targetUser = users[Math.floor(Math.random() * users.length)];
      await this.placeBet(bot, targetUser);
    } catch (error) {
      console.error(`🤖 ${bot.username} bet error:`, error);
    }
  }

  // Opinion Generation - Create new opinions
  private async handleOpinionGeneration(bot: BotProfile) {
    try {
      await this.generateOpinion(bot);
    } catch (error) {
      console.error(`🤖 ${bot.username} generation error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 💼 Portfolio Management
  // ----------------------------------------------------------------------------
  private async getBotPortfolio(botId: string): Promise<any[]> {
    try {
      const portfolioCol = collection(db, 'bot-portfolios');
      const snapshot = await getDocs(portfolioCol);
      
      return snapshot.docs
        .filter(doc => doc.id.startsWith(botId + '_'))
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(position => (position as any).qty > 0);
    } catch (error) {
      console.error('Error fetching bot portfolio:', error);
      return [];
    }
  }

  private async sellBotPosition(bot: BotProfile, position: any) {
    try {
      // Get current market price
      const marketData = await this.market.get(position.opinionText);
      const sellPrice = marketData.currentPrice;
      const sellValue = sellPrice * position.qty;

      // Apply sell trade through unified system
      await this.market.applyTrade(position.opinionText, 'sell', position.qty, bot.id);

      // Calculate profit/loss for this sale
      const originalCost = position.purchasePrice * position.qty;
      const profit = sellValue - originalCost;
      
      // Update bot balance and earnings
      bot.balance += sellValue;
      bot.lastActive = new Date().toISOString();
      
      if (profit > 0) {
        bot.totalEarnings = (bot.totalEarnings || 0) + profit;
      } else {
        bot.totalLosses = (bot.totalLosses || 0) + Math.abs(profit);
      }
      
      await updateDoc(doc(colBots, bot.id), {
        balance: bot.balance,
        lastActive: bot.lastActive,
        totalEarnings: bot.totalEarnings,
        totalLosses: bot.totalLosses
      });

      // SYNC FIX: Also update users collection for unified access
      await setDoc(doc(db, 'users', bot.id), {
        username: bot.username || `Bot_${bot.id}`,
        balance: bot.balance,
        joinDate: bot.joinDate || new Date().toISOString(),
        totalEarnings: bot.totalEarnings || 0,
        totalLosses: bot.totalLosses || 0,
        isBot: true,
        botId: bot.id,
        lastActive: bot.lastActive
      }, { merge: true });

      // Remove from portfolio
      await updateDoc(doc(colBotPortfolios, position.id), {
        qty: 0,
        soldAt: sellPrice,
        soldDate: new Date().toISOString()
      });

      // Create transaction
      const transaction = this.txMgr.create('sell', sellValue, {
        opinionText: position.opinionText,
        opinionId: position.opinionId,
        botId: bot.id,
        userId: bot.id, // Add userId to match activity queries
        metadata: { 
          source: 'bot_system', 
          sellPrice: sellPrice,
          quantity: position.qty,
          username: bot.username || `Bot_${bot.id}` // Include username
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} sold ${position.qty}x "${position.opinionText.slice(0, 30)}…" for $${sellValue.toFixed(2)}`);
      
      // Update consolidated bot portfolio after sell
      await this.updateBotPortfolio(bot.id);
      
      // Log to activity feed for live display
      await firebaseActivityService.addActivity({
        type: 'sell',
        username: bot.username || `Bot_${bot.id}`,
        userId: bot.id,
        opinionText: position.opinionText,
        opinionId: position.opinionId,
        amount: sellValue,
        price: sellPrice,
        quantity: position.qty,
        isBot: true,
        botId: bot.id,
        metadata: {
          source: 'bot_system',
          activityType: 'sale'
        }
      });
    } catch (error) {
      console.error(`🤖 ${bot.username} sell position error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 📉 Short Positions
  // ----------------------------------------------------------------------------
  private async createShortPosition(bot: BotProfile, opinion: OpinionRef) {
    try {
      const marketData = await this.market.get(opinion.text);
      const currentPrice = marketData.currentPrice;
      const shortAmount = currentPrice * 10; // Short for $100 worth
      
      if (bot.balance < shortAmount) {
        console.log(`🤖 ${bot.username}: Insufficient balance for short position`);
        return;
      }

      // Create short position document
      const shortId = `${bot.id}_short_${Date.now()}`;
      await setDoc(doc(db, 'short-positions', shortId), {
        botId: bot.id,
        opinionId: opinion.id,
        opinionText: opinion.text,
        startPrice: currentPrice,
        targetDropPercentage: 20, // Target 20% drop
        amount: shortAmount,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      // Update bot balance
      bot.balance -= shortAmount;
      await updateDoc(doc(colBots, bot.id), { balance: bot.balance });

      // SYNC FIX: Also update users collection for unified access
      await setDoc(doc(db, 'users', bot.id), {
        username: bot.username || `Bot_${bot.id}`,
        balance: bot.balance,
        joinDate: bot.joinDate || new Date().toISOString(),
        totalEarnings: bot.totalEarnings || 0,
        totalLosses: bot.totalLosses || 0,
        isBot: true,
        botId: bot.id,
        lastActive: new Date().toISOString()
      }, { merge: true });

      // Create transaction
      const transaction = this.txMgr.create('short_place', -shortAmount, {
        opinionText: opinion.text,
        opinionId: opinion.id,
        botId: bot.id,
        userId: bot.id, // Add userId to match activity queries
        metadata: { 
          source: 'bot_system',
          shortId: shortId,
          startPrice: currentPrice,
          username: bot.username || `Bot_${bot.id}` // Include username
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} shorted "${opinion.text.slice(0, 30)}…" for $${shortAmount.toFixed(2)}`);
      
      // SYNC FIX: Update bot portfolio after short position created
      await this.updateBotPortfolio(bot.id);
      
      // Log to activity feed for live display
      await firebaseActivityService.addActivity({
        type: 'short_place',
        username: bot.username || `Bot_${bot.id}`,
        userId: bot.id,
        opinionText: opinion.text,
        opinionId: opinion.id,
        amount: shortAmount,
        price: currentPrice,
        isBot: true,
        botId: bot.id,
        metadata: {
          source: 'bot_system',
          activityType: 'short_position',
          targetDropPercentage: 20
        }
      });
    } catch (error) {
      console.error(`🤖 ${bot.username} short creation error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 🎲 Betting System  
  // ----------------------------------------------------------------------------
  private async getOtherUsers(botId: string): Promise<string[]> {
    try {
      // Get active bots as betting targets
      const botsSnapshot = await getDocs(colBots);
      return botsSnapshot.docs
        .filter(doc => doc.id !== botId && doc.data().isActive)
        .map(doc => doc.data().username)
        .slice(0, 10); // Limit to 10 potential targets
    } catch (error) {
      console.error('Error fetching other users:', error);
      return [];
    }
  }

  private async placeBet(bot: BotProfile, targetUsername: string) {
    try {
      const betAmount = 50 + Math.random() * 200; // $50-$250 bet
      if (bot.balance < betAmount) return;

      const betTypes = ['increase', 'decrease'];
      const betType = betTypes[Math.floor(Math.random() * betTypes.length)];
      const targetPercentage = 5 + Math.random() * 15; // 5-20% change

      // Create bet document
      const betId = `${bot.id}_bet_${Date.now()}`;
      await setDoc(doc(db, 'advanced-bets', betId), {
        botId: bot.id,
        botUsername: bot.username || `Bot_${bot.id}`,
        targetUser: targetUsername,
        betType: betType,
        targetPercentage: Math.round(targetPercentage),
        amount: betAmount,
        timeframe: 7, // 7 days
        status: 'active',
        createdAt: new Date().toISOString()
      });

      // Update bot balance
      bot.balance -= betAmount;
      await updateDoc(doc(colBots, bot.id), { balance: bot.balance });

      // SYNC FIX: Also update users collection for unified access
      await setDoc(doc(db, 'users', bot.id), {
        username: bot.username || `Bot_${bot.id}`,
        balance: bot.balance,
        joinDate: bot.joinDate || new Date().toISOString(),
        totalEarnings: bot.totalEarnings || 0,
        totalLosses: bot.totalLosses || 0,
        isBot: true,
        botId: bot.id,
        lastActive: new Date().toISOString()
      }, { merge: true });

      // Create transaction
      const transaction = this.txMgr.create('bet', -betAmount, {
        botId: bot.id,
        userId: bot.id, // Add userId to match activity queries
        metadata: { 
          source: 'bot_system',
          betId: betId,
          targetUser: targetUsername,
          betType: betType,
          targetPercentage: Math.round(targetPercentage),
          username: bot.username || `Bot_${bot.id}` // Include username
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} bet $${betAmount.toFixed(2)} that ${targetUsername} portfolio will ${betType} by ${Math.round(targetPercentage)}%`);
      
      // SYNC FIX: Update bot portfolio after bet placed (affects balance and exposure)
      await this.updateBotPortfolio(bot.id);
      
      // Log to activity feed for live display
      await firebaseActivityService.addActivity({
        type: 'bet_place',
        username: bot.username || `Bot_${bot.id}`,
        userId: bot.id,
        targetUser: targetUsername,
        betType: betType as 'increase' | 'decrease',
        targetPercentage: Math.round(targetPercentage),
        amount: betAmount,
        timeframe: 7,
        isBot: true,
        botId: bot.id,
        metadata: {
          source: 'bot_system',
          activityType: 'portfolio_bet'
        }
      });
    } catch (error) {
      console.error(`🤖 ${bot.username} betting error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 💭 Opinion Generation
  // ----------------------------------------------------------------------------
  private async generateOpinion(bot: BotProfile) {
    try {
      const opinionTopics = [
        "The future of cryptocurrency markets",
        "Climate change impact on agriculture", 
        "Remote work productivity trends",
        "Electric vehicle adoption rates",
        "Social media influence on politics",
        "Artificial intelligence job displacement",
        "Real estate market predictions",
        "Healthcare technology innovations",
        "Education system reform needs",
        "Energy transition challenges"
      ];

      const opinionStarters = [
        "I believe that",
        "Based on current trends,", 
        "Looking at the data,",
        "From my analysis,",
        "Considering recent developments,",
        "Given the market conditions,",
        "Observing user behavior,",
        "After studying patterns,"
      ];

      const topic = opinionTopics[Math.floor(Math.random() * opinionTopics.length)];
      const starter = opinionStarters[Math.floor(Math.random() * opinionStarters.length)];
      const opinionText = `${starter} ${topic.toLowerCase()} will see significant changes in the next 12 months.`;

      // Create opinion document
      const opinionRef = doc(collection(db, 'opinions'));
      await setDoc(opinionRef, {
        text: opinionText,
        author: bot.username || `Bot_${bot.id}`,
        createdAt: new Date().toISOString(),
        isBot: true,
        source: 'bot_generated' // Fixed: changed from 'bot_generation' to 'bot_generated'
      });

      // Create transaction (no money earned for generation)
      const transaction = this.txMgr.create('generate', 0, {
        opinionText: opinionText,
        opinionId: opinionRef.id,
        botId: bot.id,
        userId: bot.id, // Add userId to match activity queries
        metadata: { 
          source: 'bot_system',
          generated: true,
          username: bot.username || `Bot_${bot.id}` // Include username
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} generated: "${opinionText.slice(0, 50)}..."`);
      
      // SYNC FIX: Update bot portfolio after opinion generation
      await this.updateBotPortfolio(bot.id);
      
      // Log to activity feed for live display
      await firebaseActivityService.addActivity({
        type: 'generate',
        username: bot.username || `Bot_${bot.id}`,
        userId: bot.id,
        opinionText: opinionText,
        opinionId: opinionRef.id,
        amount: 0, // No money involved in generation
        isBot: true,
        botId: bot.id,
        metadata: {
          source: 'bot_system',
          activityType: 'opinion_generation',
          topic: topic
        }
      });
    } catch (error) {
      console.error(`🤖 ${bot.username} opinion generation error:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 💼 Portfolio Management - Add consolidated portfolio updates
  // ----------------------------------------------------------------------------
  private async updateBotPortfolio(botId: string): Promise<void> {
    try {
      // Get all holdings for this bot from individual documents
      const botHoldingsSnapshot = await getDocs(colBotPortfolios);
      const botHoldings = botHoldingsSnapshot.docs
        .filter(doc => doc.id.startsWith(`${botId}_`))
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(holding => (holding as any).qty > 0); // Only include active holdings

      // Create consolidated portfolio document in the expected format for leaderboard
      const consolidatedPortfolio = {
        botId: botId,
        holdings: botHoldings.map(holding => ({
          opinionId: (holding as any).opinionId,
          opinionText: (holding as any).opinionText,
          quantity: (holding as any).qty,
          purchasePrice: (holding as any).avgPrice,
          averagePrice: (holding as any).avgPrice,
          lastUpdated: new Date().toISOString()
        })),
        lastUpdated: new Date().toISOString(),
        totalHoldings: botHoldings.length
      };

      // SYNC FIX: Save to the bot-portfolios collection in the format leaderboard expects
      await setDoc(doc(db, 'bot-portfolios', botId), consolidatedPortfolio, { merge: true });
      
      // Also save to consolidated collection for backup
      await setDoc(doc(db, 'consolidated-bot-portfolios', botId), consolidatedPortfolio);
      
      // SYNC FIX: Also sync to user-portfolios for unified access
      const userPortfolioFormat = {
        userId: botId,
        items: botHoldings.map(holding => ({
          opinionId: (holding as any).opinionId,
          opinionText: (holding as any).opinionText,
          quantity: (holding as any).qty,
          averagePrice: (holding as any).avgPrice,
          lastUpdated: new Date().toISOString()
        })),
        totalValue: consolidatedPortfolio.holdings.reduce((sum, h) => sum + (h.quantity * h.averagePrice), 0),
        totalCost: consolidatedPortfolio.holdings.reduce((sum, h) => sum + (h.quantity * h.averagePrice), 0),
        lastUpdated: new Date().toISOString(),
        isBot: true
      };
      
      await setDoc(doc(db, 'user-portfolios', botId), userPortfolioFormat, { merge: true });
      
      // Update bot earnings and losses based on current portfolio value
      await this.updateBotPerformance(botId, botHoldings);
      
    } catch (error) {
      console.error(`Error updating bot portfolio for ${botId}:`, error);
    }
  }

  private async updateBotPerformance(botId: string, holdings: any[]): Promise<void> {
    try {
      // Calculate current portfolio value vs purchase cost
      let totalCurrentValue = 0;
      let totalPurchaseCost = 0;

      for (const holding of holdings) {
        const marketData = await this.market.get(holding.opinionText);
        const currentPrice = marketData.currentPrice;
        const quantity = holding.qty;
        const purchasePrice = holding.avgPrice;

        totalCurrentValue += currentPrice * quantity;
        totalPurchaseCost += purchasePrice * quantity;
      }

      const unrealizedPnL = totalCurrentValue - totalPurchaseCost;
      
      // Update bot document with performance metrics
      const bot = this.bots.get(botId);
      if (bot) {
        // Only update if we have meaningful performance data
        const botAny = bot as any;
        if (unrealizedPnL > 0) {
          bot.totalEarnings = (bot.totalEarnings || 0) + Math.max(0, unrealizedPnL - (botAny.lastUnrealizedPnL || 0));
        } else if (unrealizedPnL < 0) {
          bot.totalLosses = (bot.totalLosses || 0) + Math.abs(Math.min(0, unrealizedPnL - (botAny.lastUnrealizedPnL || 0)));
        }
        
        // Track last unrealized P&L to avoid double counting
        (bot as any).lastUnrealizedPnL = unrealizedPnL;
        (bot as any).portfolioValue = totalCurrentValue;
        
        // Update in Firestore
        await updateDoc(doc(colBots, botId), {
          totalEarnings: bot.totalEarnings,
          totalLosses: bot.totalLosses,
          lastUnrealizedPnL: unrealizedPnL,
          portfolioValue: totalCurrentValue,
          lastPerformanceUpdate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`Error updating bot performance for ${botId}:`, error);
    }
  }

  // ----------------------------------------------------------------------------
  // 🐛 Debug Methods - Add comprehensive debugging
  // ----------------------------------------------------------------------------
  public async debugBotSystem(): Promise<void> {
    console.log('🔍 === BOT SYSTEM DEBUG REPORT ===');
    console.log(`System running: ${this.isRunning}`);
    console.log(`Loaded bots in memory: ${this.bots.size}`);
    console.log(`Active intervals: ${Object.keys(this.intervals).length}`);
    
    // Check Firestore for actual bot data
    try {
      const botsSnapshot = await getDocs(colBots);
      console.log(`Bots in Firestore: ${botsSnapshot.size}`);
      
      const activeBots: string[] = [];
      const inactiveBots: string[] = [];
      
      botsSnapshot.forEach(doc => {
        const bot = doc.data() as BotProfile;
        if (bot.isActive) {
          activeBots.push(`${bot.username} (${doc.id}) - $${bot.balance}`);
        } else {
          inactiveBots.push(`${bot.username} (${doc.id}) - INACTIVE`);
        }
      });
      
      console.log(`✅ Active bots (${activeBots.length}):`, activeBots);
      console.log(`❌ Inactive bots (${inactiveBots.length}):`, inactiveBots);
      
      // Check recent activity feed
      const recentActivities = await getDocs(query(
        collection(db, 'activity-feed'),
        orderBy('timestamp', 'desc'),
        limit(10)
      ));
      
      console.log(`Recent activities in feed: ${recentActivities.size}`);
      const botActivities: string[] = [];
      recentActivities.forEach(doc => {
        const activity = doc.data();
        if (activity.isBot) {
          botActivities.push(`${activity.username}: ${activity.type} - ${activity.timestamp?.toDate?.()}`);
        }
      });
      console.log(`Recent bot activities:`, botActivities);
      
    } catch (error) {
      console.error('❌ Error checking Firestore:', error);
    }
    
    console.log('🔍 === END DEBUG REPORT ===');
  }

  public async createTestBot(): Promise<string> {
    const testBotId = `test_bot_${Date.now()}`;
    const testBot: BotProfile = {
      id: testBotId,
      username: `TestBot_${Date.now()}`,
      balance: 50000,
      joinDate: new Date().toISOString(),
      totalEarnings: 0,
      totalLosses: 0,
      lastActive: new Date().toISOString(),
      isActive: true
    };
    
    try {
      await setDoc(doc(colBots, testBotId), testBot);
      console.log(`✅ Created test bot: ${testBot.username}`);
      
      // Add to local cache
      this.bots.set(testBotId, testBot);
      
      return testBotId;
    } catch (error) {
      console.error('❌ Error creating test bot:', error);
      throw error;
    }
  }

  public async forceTickTestBot(): Promise<void> {
    const bots = [...this.bots.values()];
    if (bots.length === 0) {
      console.log('❌ No bots available to test');
      return;
    }
    
    const testBot = bots[0];
    console.log(`🧪 Force ticking bot: ${testBot.username}`);
    await this.tick(testBot);
  }
}

// -----------------------------------------------------------------------------
// 🌍 Export singleton (for debug via browser console)
// -----------------------------------------------------------------------------
export const botSystem = new AutonomousBotSystem();
// Expose to global scope for browser console access
if (typeof window !== 'undefined') {
  (window as any).botSystem = botSystem;
  (window as any).AutonomousBotSystem = AutonomousBotSystem;
  
  // Add global helper functions for easy access
  (window as any).startBots = () => botSystem.startBots();
  (window as any).stopBots = () => botSystem.stop();
  (window as any).restartBots = () => botSystem.restartSystem();
  (window as any).getBotStatus = () => ({
    isRunning: botSystem.isSystemRunning(),
    botCount: botSystem.getBotCount(),
    activeBots: botSystem.getActiveBotCount()
  });
  (window as any).debugBots = () => botSystem.debugBotSystem();
  (window as any).createTestBot = () => botSystem.createTestBot();
  (window as any).forceTestTick = () => botSystem.forceTickTestBot();
  
  console.log('🤖 Bot system loaded! Available commands:');
  console.log('  • botSystem.restartSystem()');
  console.log('  • startBots()');
  console.log('  • stopBots()'); 
  console.log('  • restartBots()');
  console.log('  • getBotStatus()');
  console.log('  • debugBots() - comprehensive system debug');
  console.log('  • createTestBot() - create a test bot');
  console.log('  • forceTestTick() - force a bot to act');
}

export default botSystem;
