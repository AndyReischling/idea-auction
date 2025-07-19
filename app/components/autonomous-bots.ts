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
    this.bootstrap();
  }

  /** bootstrap – initial fetch + live listeners */
  private async bootstrap() {
    // 1️⃣ prime from Firestore once
    const snap = await getDocs(colBots);
    snap.forEach(d => this.bots.set(d.id, d.data() as BotProfile));

    // 2️⃣ live updates – keep local cache fresh
    onSnapshot(colBots, qs => {
      qs.docChanges().forEach(c => {
        if (c.type === 'removed') this.bots.delete(c.doc.id);
        else this.bots.set(c.doc.id, c.doc.data() as BotProfile);
      });
    });

    // 🏃‍♂️ start after cache is warm
    this.start();
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
    // longer intervals keep UI responsive when thousands of bots run
    [...this.bots.values()].forEach(bot => {
      if (!bot.isActive) return;
      const ms = 300_000 + Math.random() * 300_000; // 5‑10 min
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
      if (Math.random() > activityChance) return;

      // Choose what type of activity to perform
      const activityType = this.chooseActivityType(bot);
      
      // Enhanced logging for debugging
      if ((window as any).debugBots || Math.random() < 0.01) { // Log 1% of attempts or when debug enabled
        console.log(`🤖 ${bot.username}: Attempting ${activityType} (balance: $${bot.balance.toFixed(2)})`);
      }

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
    // Base activity chance on username patterns for now
    if (bot.username.includes('Aggressive') || bot.username.includes('Quick') || bot.username.includes('Wild')) {
      return 0.15; // 15% chance per tick
    } else if (bot.username.includes('Conservative') || bot.username.includes('Patient') || bot.username.includes('Calm')) {
      return 0.05; // 5% chance per tick
    }
    return 0.10; // 10% default chance
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

      // Create and save transaction
      const transaction = this.txMgr.create('buy', -total, {
        opinionText: opinion.text,
        opinionId: opinion.id,
        botId: bot.id,
        metadata: { 
          source: 'bot_system', 
          version: '2.0',
          price: price,
          quantity: qty 
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} bought ${qty}x "${opinion.text.slice(0, 30)}…" ($${total.toFixed(2)}) @ $${price}`);
      
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

      // Update bot balance
      bot.balance += sellValue;
      bot.lastActive = new Date().toISOString();
      await updateDoc(doc(colBots, bot.id), {
        balance: bot.balance,
        lastActive: bot.lastActive,
      });

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
        metadata: { 
          source: 'bot_system', 
          sellPrice: sellPrice,
          quantity: position.qty
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} sold ${position.qty}x "${position.opinionText.slice(0, 30)}…" for $${sellValue.toFixed(2)}`);
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

      // Create transaction
      const transaction = this.txMgr.create('short_place', -shortAmount, {
        opinionText: opinion.text,
        opinionId: opinion.id,
        botId: bot.id,
        metadata: { 
          source: 'bot_system',
          shortId: shortId,
          startPrice: currentPrice
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} shorted "${opinion.text.slice(0, 30)}…" for $${shortAmount.toFixed(2)}`);
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
        botUsername: bot.username,
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

      // Create transaction
      const transaction = this.txMgr.create('bet', -betAmount, {
        botId: bot.id,
        metadata: { 
          source: 'bot_system',
          betId: betId,
          targetUser: targetUsername,
          betType: betType,
          targetPercentage: Math.round(targetPercentage)
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} bet $${betAmount.toFixed(2)} that ${targetUsername} portfolio will ${betType} by ${Math.round(targetPercentage)}%`);
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
        author: bot.username,
        createdAt: new Date().toISOString(),
        isBot: true,
        source: 'bot_generation'
      });

      // Create transaction (no money earned for generation)
      const transaction = this.txMgr.create('generate', 0, {
        opinionText: opinionText,
        opinionId: opinionRef.id,
        botId: bot.id,
        metadata: { 
          source: 'bot_system',
          generated: true
        }
      });
      
      await this.txMgr.save(transaction);

      console.log(`🤖 ${bot.username} generated: "${opinionText.slice(0, 50)}..."`);
    } catch (error) {
      console.error(`🤖 ${bot.username} opinion generation error:`, error);
    }
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
  (window as any).startBots = () => botSystem.start();
  (window as any).stopBots = () => botSystem.stop();
  (window as any).restartBots = () => botSystem.restartSystem();
  (window as any).getBotStatus = () => ({
    isRunning: botSystem.isSystemRunning(),
    botCount: botSystem.getBotCount(),
    activeBots: botSystem.getActiveBotCount()
  });
  
  console.log('🤖 Bot system loaded! Available commands:');
  console.log('  • botSystem.restartSystem()');
  console.log('  • startBots()');
  console.log('  • stopBots()'); 
  console.log('  • restartBots()');
  console.log('  • getBotStatus()');
}

export default botSystem;
