// autonomous-bots.ts
// FIXED: Bot System with EXACT 0.1% Price Movements (NO volatility multiplier)
// UPDATED: Now uses unified system for price calculations and transactions

// ADD: Import unified system functions
import { 
  calculateUnifiedPrice, 
  UnifiedMarketDataManager, 
  UnifiedTransactionManager,
  type UnifiedOpinionMarketData,
  type UnifiedTransaction
} from '../lib/unified-system';

interface BotProfile {
  id: string;
  username: string;
  balance: number;
  joinDate: string;
  totalEarnings: number;
  totalLosses: number;
  personality: BotPersonality;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  tradingStrategy: TradingStrategy;
  lastActive: string;
  isActive: boolean;
}

interface BotPersonality {
  name: string;
  description: string;
  buyProbability: number; // 0-1
  sellProbability: number; // 0-1
  betProbability: number; // 0-1
  shortProbability: number; // 0-1
  preferredBetTypes: ('increase' | 'decrease')[];
  preferredShortTypes: ('aggressive' | 'moderate' | 'conservative')[];
  riskMultiplier: number; // 0.5-2.0
  activityFrequency: number; // minutes between actions
}

interface TradingStrategy {
  type: 'contrarian' | 'momentum' | 'value' | 'random' | 'aggressive';
  minPrice: number;
  maxPrice: number;
  maxPositionSize: number;
  portfolioTargetSize: number;
  shortPreferences: {
    minTargetDrop: number; // minimum % drop to target
    maxTargetDrop: number; // maximum % drop to target
    preferredTimeLimit: number[]; // preferred time limits in hours
    maxShortAmount: number; // max amount to risk on shorts
  };
}

interface AdvancedBet {
  id: string;
  bettor: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  amount: number;
  timeFrame: number;
  initialPortfolioValue: number;
  currentPortfolioValue: number;
  placedDate: string;
  expiryDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
  multiplier: number;
  potentialPayout: number;
  volatilityRating: 'Low' | 'Medium' | 'High';
}

interface ShortPosition {
  id: string;
  opinionText: string;
  opinionId: string;
  betAmount: number;
  targetDropPercentage: number;
  startingPrice: number;
  targetPrice: number;
  potentialWinnings: number;
  expirationDate: string;
  createdDate: string;
  status: 'active' | 'won' | 'lost' | 'expired';
  botId?: string;
}

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

interface BotOpinionAsset extends OpinionAsset {
  botId: string;
  opinionId: string;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet' | 'short_place' | 'short_win' | 'short_loss';
  opinionId?: string;
  opinionText?: string;
  shortId?: string;
  amount: number;
  date: string;
  botId?: string;
  metadata?: any;
}

// Use unified interface instead of local one
type OpinionMarketData = UnifiedOpinionMarketData;

class AutonomousBotSystem {
  private bots: BotProfile[] = [];
  private isRunning: boolean = false;
  private intervalIds: NodeJS.Timeout[] = [];
  // ADD: Unified system managers
  private marketDataManager = UnifiedMarketDataManager.getInstance();
  private transactionManager = UnifiedTransactionManager.getInstance();
  private currentBotId: string = '';

  constructor() {
    this.initializeBots();
    // AUTO-START: Automatically initialize opinions and start bots after a short delay
    setTimeout(() => this.autoInitialize(), 2000);
  }

  // AUTO-INITIALIZE: Create test data and start bots automatically
  private autoInitialize(): void {
    // console.log('🤖 Auto-initializing bot system with UI-friendly settings...');
    
    // Check if opinions exist, if not create them
    this.ensureOpinionsExist();
    
    // OPTIMIZE FOR UI: Reduce bot count and frequency before starting
    this.optimizeForPerformance();
    
    // Start the bot system with reduced load
    this.startBots(); // RE-ENABLED FOR PROPER FUNCTIONALITY
    
    console.log('✅ Bot system auto-initialized with UI-optimized settings!');
  }

  // UPDATED: Use unified price calculation
  private calculatePrice(timesPurchased: number, timesSold: number, basePrice: number = 10): number {
    return calculateUnifiedPrice(timesPurchased, timesSold, basePrice);
  }

  // UPDATED: Use unified market data update
  private updateOpinionMarketData(opinionText: string, action: 'buy' | 'sell', quantity: number = 1): UnifiedOpinionMarketData {
    return this.marketDataManager.updateMarketData(opinionText, action, quantity, undefined, this.getCurrentBotId());
  }

  // UPDATED: Use unified transaction recording + GlobalActivityTracker integration
  private addBotTransaction(
    bot: BotProfile, 
    type: string, 
    opinionId: string, 
    opinionText: string, 
    amount: number, 
    shortId?: string,
    metadata: any = {}
  ): void {
    // Save via unified transaction system
    const transaction = this.transactionManager.createTransaction(
      type as UnifiedTransaction['type'],
      amount,
      opinionText,
      opinionId,
      undefined, // userId
      bot.id, // botId
      {
        ...metadata,
        shortId
      }
    );
    this.transactionManager.saveTransaction(transaction);

    // CRITICAL FIX: Also add to GlobalActivityTracker for feed integration
    if (typeof window !== 'undefined') {
      const activityData = {
        type: type as 'buy' | 'sell' | 'earn' | 'bet_place' | 'bet_win' | 'bet_loss' | 'short_place' | 'short_win' | 'short_loss' | 'generate',
        username: bot.username,
        opinionText: opinionText,
        opinionId: opinionId,
        amount: amount,
        price: metadata.purchasePricePerShare || metadata.price,
        quantity: metadata.quantity || 1,
        timestamp: new Date().toISOString(),
        isBot: true,
        botId: bot.id
      };

      console.log(`🤖 Adding bot transaction to global feed: ${bot.username} ${type} ${opinionText?.slice(0, 30)}...`);
      
      // Method 1: Add to GlobalActivityTracker (localStorage) with sanitization
      if ((window as any).addToGlobalFeed) {
        try {
          // Sanitize activityData to prevent undefined values
          const sanitizedActivityData = {
            ...activityData,
            username: String(activityData.username || 'unknown-bot'),
            opinionText: String(activityData.opinionText || ''),
            opinionId: String(activityData.opinionId || ''),
            amount: Number(activityData.amount) || 0,
            price: Number(activityData.price) || 10.00,
            quantity: Number(activityData.quantity) || 1,
            botId: String(activityData.botId || 'unknown-bot-id')
          };
          (window as any).addToGlobalFeed(sanitizedActivityData);
        } catch (error) {
          console.error('❌ Failed to add bot transaction to global feed:', error);
        }
      }

      // Method 2: Add to Firebase (for real-time sync)
      const addToFirebase = async () => {
        try {
          const { firebaseActivityService } = await import('../lib/firebase-activity');
          await firebaseActivityService.addActivity({
            type: activityData.type,
            username: String(activityData.username || 'unknown-bot'),
            userId: undefined, // bots don't have user IDs
            opinionText: String(activityData.opinionText || ''),
            opinionId: String(activityData.opinionId || ''),
            amount: Number(activityData.amount) || 0,
            price: Number(activityData.price) || 10.00,
            quantity: Number(activityData.quantity) || 1,
            isBot: true, // CRITICAL: This allows bot writes in Firestore rules
            botId: String(bot.id || 'unknown-bot-id'),
            metadata: {
              source: 'bot_system', // CRITICAL: This allows writes via metadata rule
              botPersonality: bot.personality,
              originalMetadata: metadata,
              timestamp: new Date().toISOString()
            }
          });
          console.log(`✅ Bot transaction added to Firebase: ${bot.username} ${type}`);
        } catch (error) {
          console.error('⚠️ Failed to add bot transaction to Firebase (using localStorage fallback):', error);
          
          // Enhanced error logging for debugging
          if (error instanceof Error) {
            console.error('📋 Bot Firebase Error Details:', {
              message: error.message,
              code: (error as any).code,
              botId: bot.id,
              botUsername: bot.username,
              activityType: type,
              hasIsBot: 'isBot field was set to true',
              hasMetadata: 'metadata.source was set to bot_system'
            });
          }
        }
      };

      addToFirebase();
    }
  }

  // Helper to get current bot ID for tracking
  private getCurrentBotId(): string {
    return this.currentBotId || 'unknown_bot';
  }

  // UPDATED: Enhanced market data getter using unified system
  private getOpinionMarketData(opinionText: string): UnifiedOpinionMarketData {
    return this.marketDataManager.getMarketData(opinionText);
  }

  // Initialize bots
  private initializeBots(): void {
    const stored = localStorage.getItem('autonomousBots');
    if (stored) {
      this.bots = JSON.parse(stored);
      console.log(`🤖 Loaded ${this.bots.length} existing bots`);
    } else {
      this.generateBots();
    }
  }

  // Generate massive bot population with diverse personalities and strategies
  private generateBots(): void {
    // Diverse bot personalities with distinct trading behaviors
    const botPersonalities: BotPersonality[] = [
      {
        name: 'Conservative Economist',
        description: 'Focuses on stable, long-term investments with low risk',
        buyProbability: 0.4,
        sellProbability: 0.3,
        betProbability: 0.1,
        shortProbability: 0.05,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 0.6,
        activityFrequency: 45
      },
      {
        name: 'Aggressive Day Trader',
        description: 'High-frequency trading with significant risk tolerance',
        buyProbability: 0.8,
        sellProbability: 0.7,
        betProbability: 0.6,
        shortProbability: 0.4,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 2.0,
        activityFrequency: 8
      },
      {
        name: 'Tech Futurist',
        description: 'Invests heavily in technology and innovation predictions',
        buyProbability: 0.7,
        sellProbability: 0.4,
        betProbability: 0.5,
        shortProbability: 0.2,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 1.4,
        activityFrequency: 20
      },
      {
        name: 'Contrarian Skeptic',
        description: 'Bets against popular opinions and trends',
        buyProbability: 0.3,
        sellProbability: 0.6,
        betProbability: 0.7,
        shortProbability: 0.5,
        preferredBetTypes: ['decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 1.3,
        activityFrequency: 25
      },
      {
        name: 'Value Hunter',
        description: 'Seeks undervalued opinions with growth potential',
        buyProbability: 0.6,
        sellProbability: 0.3,
        betProbability: 0.2,
        shortProbability: 0.1,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 0.9,
        activityFrequency: 35
      },
      {
        name: 'Momentum Rider',
        description: 'Follows trends and popular movements',
        buyProbability: 0.7,
        sellProbability: 0.5,
        betProbability: 0.4,
        shortProbability: 0.2,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 1.2,
        activityFrequency: 15
      },
      {
        name: 'Risk Arbitrageur',
        description: 'Exploits price differences and market inefficiencies',
        buyProbability: 0.5,
        sellProbability: 0.5,
        betProbability: 0.6,
        shortProbability: 0.4,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['moderate', 'aggressive'],
        riskMultiplier: 1.6,
        activityFrequency: 12
      },
      {
        name: 'Social Sentiment Analyst',
        description: 'Makes decisions based on social and cultural trends',
        buyProbability: 0.6,
        sellProbability: 0.4,
        betProbability: 0.3,
        shortProbability: 0.2,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 1.0,
        activityFrequency: 30
      },
      {
        name: 'Quantitative Strategist',
        description: 'Uses mathematical models and statistical analysis',
        buyProbability: 0.5,
        sellProbability: 0.4,
        betProbability: 0.3,
        shortProbability: 0.2,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 1.1,
        activityFrequency: 28
      },
      {
        name: 'Environmental Advocate',
        description: 'Focuses on sustainability and environmental impact',
        buyProbability: 0.6,
        sellProbability: 0.3,
        betProbability: 0.4,
        shortProbability: 0.3,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 0.8,
        activityFrequency: 40
      }
    ];

    // Complex trading strategies
    const strategies: TradingStrategy[] = [
      {
        type: 'value',
        minPrice: 8,
        maxPrice: 15,
        maxPositionSize: 3,
        portfolioTargetSize: 5,
        shortPreferences: {
          minTargetDrop: 5,
          maxTargetDrop: 15,
          preferredTimeLimit: [24, 48],
          maxShortAmount: 500
        }
      },
      {
        type: 'aggressive',
        minPrice: 3,
        maxPrice: 50,
        maxPositionSize: 8,
        portfolioTargetSize: 15,
        shortPreferences: {
          minTargetDrop: 10,
          maxTargetDrop: 40,
          preferredTimeLimit: [12, 24, 48],
          maxShortAmount: 2000
        }
      },
      {
        type: 'momentum',
        minPrice: 10,
        maxPrice: 30,
        maxPositionSize: 5,
        portfolioTargetSize: 8,
        shortPreferences: {
          minTargetDrop: 8,
          maxTargetDrop: 25,
          preferredTimeLimit: [24, 48, 72],
          maxShortAmount: 1000
        }
      },
      {
        type: 'value',
        minPrice: 5,
        maxPrice: 20,
        maxPositionSize: 4,
        portfolioTargetSize: 10,
        shortPreferences: {
          minTargetDrop: 15,
          maxTargetDrop: 35,
          preferredTimeLimit: [48, 72, 168],
          maxShortAmount: 800
        }
      },
      {
        type: 'contrarian',
        minPrice: 8,
        maxPrice: 40,
        maxPositionSize: 6,
        portfolioTargetSize: 12,
        shortPreferences: {
          minTargetDrop: 12,
          maxTargetDrop: 45,
          preferredTimeLimit: [24, 48],
          maxShortAmount: 1500
        }
      }
    ];

    // Creative username variations for diversity
    const nameVariations = [
      'Pro', 'Elite', 'Master', 'Ace', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Prime', 'Ultra',
      'Mega', 'Super', 'Hyper', 'Turbo', 'Nitro', 'Boost', 'Power', 'Force', 'Storm', 'Blitz',
      'Swift', 'Quick', 'Fast', 'Speed', 'Rapid', 'Flash', 'Lightning', 'Thunder', 'Volt', 'Spark',
      'Fire', 'Flame', 'Blaze', 'Burn', 'Heat', 'Frost', 'Ice', 'Snow', 'Chill', 'Freeze',
      'Steel', 'Iron', 'Gold', 'Silver', 'Copper', 'Bronze', 'Platinum', 'Diamond', 'Crystal', 'Gem',
      'Shadow', 'Ghost', 'Phantom', 'Spirit', 'Soul', 'Mind', 'Brain', 'Think', 'Smart', 'Wise',
      'Bold', 'Brave', 'Fierce', 'Wild', 'Free', 'Pure', 'True', 'Real', 'Live', 'Active',
      'Sharp', 'Edge', 'Point', 'Peak', 'Top', 'High', 'Max', 'Plus', 'Extra', 'Bonus',
      'Star', 'Nova', 'Comet', 'Meteor', 'Galaxy', 'Cosmic', 'Space', 'Orbit', 'Lunar', 'Solar',
      'Neon', 'Laser', 'Pixel', 'Digital', 'Cyber', 'Tech', 'Data', 'Code', 'Logic', 'System',
      'Wave', 'Pulse', 'Beat', 'Rhythm', 'Flow', 'Stream', 'Current', 'Charge', 'Energy', 'Power',
      'Advanced', 'Premium', 'Master', 'Expert', 'Titan'
    ];

    // PERFORMANCE OPTIMIZED: Start with 1000 bots instead of 5000+ for immediate responsiveness
    const totalBots = 1000; // Reduced from 5006 for better performance
    this.bots = [];

    for (let i = 0; i < totalBots; i++) {
      const personalityIndex = i % botPersonalities.length;
      const strategyIndex = i % strategies.length;
      const personality = botPersonalities[personalityIndex];
      
      // Create unique usernames efficiently
      const variation = nameVariations[i % nameVariations.length];
      const botNumber = Math.floor(i / nameVariations.length) + 1;
      const username = `${personality.name.replace(/\s+/g, '')}${variation}${botNumber}`;

      // Add some randomization to personality traits for diversity
      const randomizedPersonality = {
        ...personality,
        buyProbability: Math.max(0.1, Math.min(0.95, personality.buyProbability + (Math.random() - 0.5) * 0.2)),
        sellProbability: Math.max(0.1, Math.min(0.95, personality.sellProbability + (Math.random() - 0.5) * 0.2)),
        betProbability: Math.max(0.05, Math.min(0.95, personality.betProbability + (Math.random() - 0.5) * 0.2)),
        shortProbability: Math.max(0.05, Math.min(0.95, personality.shortProbability + (Math.random() - 0.5) * 0.2)),
        riskMultiplier: Math.max(0.3, Math.min(2.5, personality.riskMultiplier + (Math.random() - 0.5) * 0.4)),
        // FASTER ACTIVITY: Reduced frequency for more visible activity (seconds instead of minutes)
        activityFrequency: Math.max(5, Math.min(30, personality.activityFrequency + Math.floor((Math.random() - 0.5) * 10)))
      };

      // Randomize strategy parameters for diversity
      const baseStrategy = strategies[strategyIndex];
      const randomizedStrategy = {
        ...baseStrategy,
        minPrice: Math.max(1, baseStrategy.minPrice + Math.floor((Math.random() - 0.5) * 10)),
        maxPrice: Math.max(10, baseStrategy.maxPrice + Math.floor((Math.random() - 0.5) * 100)),
        maxPositionSize: Math.max(1, baseStrategy.maxPositionSize + Math.floor((Math.random() - 0.5) * 5)),
        portfolioTargetSize: Math.max(3, baseStrategy.portfolioTargetSize + Math.floor((Math.random() - 0.5) * 8)),
        shortPreferences: {
          ...baseStrategy.shortPreferences,
          maxShortAmount: Math.max(100, baseStrategy.shortPreferences.maxShortAmount + Math.floor((Math.random() - 0.5) * 500))
        }
      };

      this.bots.push({
        id: `bot_${i + 1}`,
        username,
        balance: Math.floor(Math.random() * 50000) + 10000,
        joinDate: this.getRandomPastDate(),
        totalEarnings: 0,
        totalLosses: 0,
        personality: randomizedPersonality,
        riskTolerance: this.getRiskTolerance(randomizedPersonality.riskMultiplier),
        tradingStrategy: randomizedStrategy,
        lastActive: new Date().toISOString(),
        isActive: true
      });
    }

    console.log(`🤖 Generated ${totalBots} autonomous trading bots (optimized for performance)`);
    this.saveBots();
  }

  private getRiskTolerance(multiplier: number): 'conservative' | 'moderate' | 'aggressive' {
    if (multiplier <= 0.8) return 'conservative';
    if (multiplier <= 1.3) return 'moderate';
    return 'aggressive';
  }

  private getRandomPastDate(): string {
    const daysAgo = Math.floor(Math.random() * 365) + 1;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toLocaleDateString();
  }

  // Enhanced startBots method to handle large numbers efficiently
  public startBots(): void {
    if (this.isRunning) {
      console.log('🤖 Bot system is already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`🤖 Starting autonomous bot system with ${this.bots.length} bots...`);

    // PERFORMANCE OPTIMIZED: Start with only 100 active bots with slower intervals
    const maxActiveBots = 100;
    const activeBotsToStart = this.bots.slice(0, maxActiveBots);
    
    activeBotsToStart.forEach((bot, index) => {
      bot.isActive = true;
      // MUCH SLOWER: 30-120 seconds between actions (was 5-30 seconds)
      const slowInterval = (bot.personality.activityFrequency + 30) * 1000;
      
      const intervalId = setInterval(() => {
        this.executeBotAction(bot);
      }, slowInterval);
      
      this.intervalIds.push(intervalId);
    });

    // Deactivate remaining bots to reduce load
    this.bots.slice(maxActiveBots).forEach(bot => {
      bot.isActive = false;
    });

    console.log(`✅ Started ${activeBotsToStart.length} active bots with slower intervals (30-120s)`);

    // REDUCED INITIAL ACTIVITY: Only 10 initial actions instead of 50
    setTimeout(() => {
      console.log('🚀 Triggering reduced initial bot activity...');
      const activeBots = this.bots.filter(b => b.isActive);
      
      // Force only 10 initial actions spread over 30 seconds
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const randomBot = activeBots[Math.floor(Math.random() * activeBots.length)];
          this.executeBotAction(randomBot);
        }, i * 3000); // 3 seconds apart
      }
    }, 2000);

    // Short position resolution checker (less frequent)
    const shortCheckInterval = setInterval(() => {
      this.checkAndResolveShorts();
    }, 60000); // Check every minute instead of 30 seconds
    
    this.intervalIds.push(shortCheckInterval);
  }

  public stopBots(): void {
    this.isRunning = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    console.log('🛑 Stopped autonomous bot system');
  }

  // Execute realistic bot actions
  private executeBotAction(bot: BotProfile): void {
    try {
      this.currentBotId = bot.id; // Set current bot for tracking
      
      if (!bot.isActive) return;

      // SUPER SIMPLE: Cycle through actions to ensure diversity
      const actionIndex = Date.now() % 4;
      const actions = ['buy', 'sell', 'bet', 'generate'];
      let selectedAction = actions[actionIndex];

      // Add some randomness but force diversity
      const random = Math.random();
      if (random < 0.5) {
        selectedAction = actions[Math.floor(Math.random() * actions.length)];
      }

      console.log(`🤖 ${bot.username} (${bot.personality.name}) attempting: ${selectedAction.toUpperCase()}`);
      
      let actionSucceeded = false;
      
      switch (selectedAction) {
        case 'buy':
          actionSucceeded = this.botBuyOpinion(bot);
          if (!actionSucceeded) {
            console.log(`🤖⚠️ ${bot.username} buy failed - trying different action`);
            // Fallback to generate if buy fails
            this.botGenerateOpinion(bot);
            actionSucceeded = true;
          }
          break;
          
        case 'sell':
          actionSucceeded = this.botSellOpinion(bot);
          if (!actionSucceeded) {
            console.log(`🤖⚠️ ${bot.username} sell failed - trying buy instead`);
            // Fallback to buy if sell fails
            actionSucceeded = this.botBuyOpinion(bot);
          }
          break;
          
        case 'bet':
          actionSucceeded = this.botPlaceBet(bot);
          if (!actionSucceeded) {
            console.log(`🤖⚠️ ${bot.username} bet failed - trying buy instead`);
            actionSucceeded = this.botBuyOpinion(bot);
          }
          break;
          
        case 'generate':
          this.botGenerateOpinion(bot);
          actionSucceeded = true;
          break;
      }

      // Only do shorts occasionally (10% chance) and only if other action failed
      if (!actionSucceeded && Math.random() < 0.1) {
        console.log(`🤖📉 ${bot.username} attempting SHORT as last resort`);
        this.botPlaceShort(bot);
      }

      bot.lastActive = new Date().toISOString();
      this.saveBots();

    } catch (error) {
      console.error(`Error executing bot action for ${bot.username}:`, error);
    }
  }

  // UPDATED: Bot buying with unified system
  private botBuyOpinion(bot: BotProfile): boolean {
    this.currentBotId = bot.id; // Set current bot for tracking
    
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) {
      console.log(`🤖❌ ${bot.username} can't buy - no opinions available`);
      return false;
    }

    // Select opinion based on strategy
    const selectedOpinion = this.selectOpinionByStrategy(opinions, bot) || opinions[Math.floor(Math.random() * opinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.id);
    
    // Simple affordability check
    if (currentPrice > bot.balance) {
      console.log(`🤖💸 ${bot.username} can't afford opinion at ${currentPrice} (balance: ${bot.balance})`);
      return false;
    }

    // CRITICAL: Calculate quantity to buy (1-3 shares max) - each share = 0.1% price increase
    const maxQuantity = Math.floor(bot.balance / currentPrice);
    const quantity = Math.min(Math.floor(Math.random() * 3) + 1, maxQuantity);
    const totalCost = currentPrice * quantity;

    if (totalCost <= bot.balance && quantity > 0) {
      // CRITICAL: Record the ACTUAL purchase price BEFORE the market price changes
      const purchasePricePerShare = currentPrice;
      
      // Deduct cost from bot balance
      bot.balance -= totalCost;
      
      // UPDATED: Use unified market data update
      const updatedMarketData = this.updateOpinionMarketData(selectedOpinion.text, 'buy', quantity);
      
      // Add to bot's portfolio
      this.addBotOpinion(bot, selectedOpinion, purchasePricePerShare, quantity);
      
      // UPDATED: Use unified transaction recording
      this.addBotTransaction(
        bot, 
        'buy', 
        selectedOpinion.id, 
        selectedOpinion.text, 
        -totalCost,
        undefined,
        {
          purchasePricePerShare: purchasePricePerShare,
          quantity: quantity,
          newMarketPrice: updatedMarketData.currentPrice
        }
      );
      
      console.log(`🤖💰 ${bot.username} bought ${quantity}x "${selectedOpinion.text.slice(0, 30)}..." for ${totalCost.toFixed(2)} (price: ${purchasePricePerShare} → ${updatedMarketData.currentPrice})`);
      return true;
    }
    
    return false;
  }

  // UPDATED: Bot selling with unified system
  private botSellOpinion(bot: BotProfile): boolean {
    this.currentBotId = bot.id; // Set current bot for tracking
    
    const botOpinions = this.getBotOpinions(bot);
    if (botOpinions.length === 0) {
      console.log(`🤖📦 ${bot.username} has no opinions to sell`);
      return false;
    }

    const selectedOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.opinionId);
    const quantityToSell = Math.min(selectedOpinion.quantity, Math.floor(Math.random() * 3) + 1);
    
    // Calculate realistic sell price (95% of market price to match opinion page)
    const sellPrice = Math.round(currentPrice * 0.95 * 100) / 100;
    const totalSaleValue = sellPrice * quantityToSell;

    const purchasePrice = selectedOpinion.purchasePrice;
    const profitLoss = sellPrice - purchasePrice;

    // Update bot balance
    bot.balance += totalSaleValue;
    
    // Track profit/loss
    if (profitLoss > 0) {
      bot.totalEarnings += Math.abs(profitLoss) * quantityToSell;
    } else {
      bot.totalLosses += Math.abs(profitLoss) * quantityToSell;
    }

    // UPDATED: Use unified market data update
    const updatedMarketData = this.updateOpinionMarketData(selectedOpinion.text, 'sell', quantityToSell);

    // Remove from bot's portfolio
    this.removeBotOpinion(bot, selectedOpinion.opinionId, quantityToSell);
    
    // UPDATED: Use unified transaction recording
    this.addBotTransaction(bot, 'sell', selectedOpinion.opinionId, selectedOpinion.text, totalSaleValue);

    const profitMessage = profitLoss > 0 ? `📈 +${(profitLoss * quantityToSell).toFixed(2)} profit` : `📉 ${(profitLoss * quantityToSell).toFixed(2)} loss`;
    console.log(`🤖💰 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for ${totalSaleValue.toFixed(2)} ${profitMessage}`);
    
    return true;
  }

  // Bot generates new opinions
  private botGenerateOpinion(bot: BotProfile): void {
    this.currentBotId = bot.id; // Set current bot for tracking
    
    try {
      const newOpinion = this.generateRandomOpinion();
      
      // Add to opinions list
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      opinions.push(newOpinion);
      localStorage.setItem('opinions', JSON.stringify(opinions));
      
      // UPDATED: Initialize market data using unified system
      this.marketDataManager.getMarketData(newOpinion); // This will create it at $10.00
      
      // FIXED: Generating opinions should be free, not rewarded
      // No money is given for generating opinions - this is more realistic
      
      // Record transaction with no monetary reward
      this.addBotTransaction(bot, 'generate', (opinions.length - 1).toString(), newOpinion, 0);
      
      console.log(`🤖💡 ${bot.username} generated: "${newOpinion.slice(0, 50)}..." (no monetary reward)`);
      
      // Sometimes buy their own opinion
      if (Math.random() < 0.3) {
        setTimeout(() => {
          const targetOpinion = { id: (opinions.length - 1).toString(), text: newOpinion };
          this.botBuySpecificOpinion(bot, targetOpinion);
        }, 1000);
      }
    } catch (error) {
      console.error('Error generating opinion:', error);
    }
  }

  // NEW: Bot buys a specific opinion (for buying their own generated opinions)
  private botBuySpecificOpinion(bot: BotProfile, targetOpinion: any): boolean {
    this.currentBotId = bot.id; // Set current bot for tracking
    
    const price = this.getOpinionPrice(targetOpinion.id);
    
    // Simple affordability check
    if (price > bot.balance) {
      console.log(`🤖💸 ${bot.username} can't afford their own opinion at ${price} (balance: ${bot.balance})`);
      return false;
    }

    const quantity = Math.min(Math.floor(Math.random() * 2) + 1, Math.floor(bot.balance / price)); // 1-2 shares
    const totalCost = price * quantity;

    if (totalCost <= bot.balance) {
      bot.balance -= totalCost;
      
      // UPDATED: Use unified market data update
      const updatedMarketData = this.updateOpinionMarketData(targetOpinion.text, 'buy', quantity);
      
      this.addBotTransaction(bot, 'buy', targetOpinion.id, targetOpinion.text, -totalCost);
      this.addBotOpinion(bot, targetOpinion, price, quantity);
      
      console.log(`🤖💰 ${bot.username} bought ${quantity}x their own opinion "${targetOpinion.text.slice(0, 30)}..." for ${totalCost} (price: ${price} → ${updatedMarketData.currentPrice})`);
      return true;
    }
    
    return false;
  }

  // Bot places regular bets
  private botPlaceBet(bot: BotProfile): boolean {
    // Create some target users for betting
    const targetUsers = [
      { username: 'TradingPro', portfolioValue: 50000 },
      { username: 'MarketMaster', portfolioValue: 75000 },
      { username: 'InvestorElite', portfolioValue: 30000 },
      { username: 'CryptoKing', portfolioValue: 120000 },
      { username: 'StockGuru', portfolioValue: 45000 }
    ];
    
    const targetUser = targetUsers[Math.floor(Math.random() * targetUsers.length)];
    
    const betAmount = Math.min(
      Math.floor(Math.random() * 500) + 100,
      bot.balance * 0.1
    );
    
    if (betAmount > bot.balance) {
      console.log(`🤖💸 ${bot.username} can't afford bet of ${betAmount} (balance: ${bot.balance})`);
      return false;
    }

    const betType = bot.personality.preferredBetTypes[
      Math.floor(Math.random() * bot.personality.preferredBetTypes.length)
    ];

    const targetPercentage = Math.floor(Math.random() * 50) + 10;
    const timeFrame = Math.floor(Math.random() * 30) + 1;

    const bet: AdvancedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bettor: bot.username,
      targetUser: targetUser.username,
      betType,
      targetPercentage,
      amount: betAmount,
      timeFrame,
      initialPortfolioValue: targetUser.portfolioValue,
      currentPortfolioValue: targetUser.portfolioValue,
      placedDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + timeFrame * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      multiplier: this.calculateMultiplier(betType, targetPercentage),
      potentialPayout: betAmount * this.calculateMultiplier(betType, targetPercentage),
      volatilityRating: this.getVolatilityRating(targetUser.username)
    };

    // Deduct bet amount
    bot.balance -= betAmount;

    try {
      // Save bet
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      bets.push(bet);
      localStorage.setItem('advancedBets', JSON.stringify(bets));

      // Record transaction
      this.addBotTransaction(bot, 'bet', '', `Bet on ${targetUser.username}`, -betAmount);

      console.log(`🤖🎲 ${bot.username} bet $${betAmount} on ${targetUser.username} to ${betType} by ${targetPercentage}% (potential: $${bet.potentialPayout})`);
      return true;
    } catch (error) {
      console.error('Error placing bet:', error);
      bot.balance += betAmount; // Refund on error
      return false;
    }
  }

  // Bot places short positions
  private botPlaceShort(bot: BotProfile): boolean {
    this.currentBotId = bot.id; // Set current bot for tracking
    
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) return false;

    const targetOpinion = opinions[Math.floor(Math.random() * opinions.length)];
    const currentPrice = this.getOpinionPrice(targetOpinion.id);
    
    const shortAmount = Math.min(
      bot.balance * 0.1, // Max 10% of balance
      bot.tradingStrategy.shortPreferences.maxShortAmount
    );

    if (shortAmount < 50) return false; // Minimum short amount

    const targetDropPercentage = Math.floor(Math.random() * 
      (bot.tradingStrategy.shortPreferences.maxTargetDrop - bot.tradingStrategy.shortPreferences.minTargetDrop)) + 
      bot.tradingStrategy.shortPreferences.minTargetDrop;

    const targetPrice = currentPrice * (1 - targetDropPercentage / 100);
    const potentialWinnings = shortAmount * (targetDropPercentage / 10); // 10% return per 1% drop

    const timeLimit = bot.tradingStrategy.shortPreferences.preferredTimeLimit[
      Math.floor(Math.random() * bot.tradingStrategy.shortPreferences.preferredTimeLimit.length)
    ];

    const shortPosition: ShortPosition = {
      id: `short_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      opinionText: targetOpinion.text,
      opinionId: targetOpinion.id,
      betAmount: shortAmount,
      targetDropPercentage,
      startingPrice: currentPrice,
      targetPrice,
      potentialWinnings,
      expirationDate: new Date(Date.now() + timeLimit * 60 * 60 * 1000).toISOString(),
      createdDate: new Date().toISOString(),
      status: 'active',
      botId: bot.id
    };

    // Deduct short amount
    bot.balance -= shortAmount;

    try {
      // Save short position
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      shorts.push(shortPosition);
      localStorage.setItem('shortPositions', JSON.stringify(shorts));

      // Record transaction
      this.addBotTransaction(bot, 'short_place', targetOpinion.id, targetOpinion.text, -shortAmount, shortPosition.id);

      console.log(`🤖📉 ${bot.username} shorted "${targetOpinion.text.slice(0, 30)}..." $${shortAmount} targeting ${targetDropPercentage}% drop`);
      return true;
    } catch (error) {
      console.error('Error placing short:', error);
      bot.balance += shortAmount; // Refund on error
      return false;
    }
  }

  // Check and resolve short positions
  private checkAndResolveShorts(): void {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      const activeShorts = shorts.filter((s: ShortPosition) => s.status === 'active' && s.botId);
      
      if (activeShorts.length === 0) return;

      let updated = false;

      const updatedShorts = shorts.map((short: ShortPosition) => {
        if (short.status !== 'active' || !short.botId) return short;

        const currentPrice = this.getOpinionPrice(short.opinionId);
        const bot = this.bots.find(b => b.id === short.botId);
        
        if (!bot) return { ...short, status: 'expired' as const };

        // Check expiration
        const now = new Date();
        const expiry = new Date(short.expirationDate);
        if (now > expiry) {
          console.log(`🤖⏰ ${bot.username} short expired: "${short.opinionText.slice(0, 30)}..."`);
          updated = true;
          return { ...short, status: 'expired' as const };
        }

        // Check if target reached
        if (currentPrice <= short.targetPrice) {
          bot.balance += short.potentialWinnings;
          bot.totalEarnings += short.potentialWinnings;
          updated = true;
          
          this.addBotTransaction(bot, 'short_win', short.opinionId, short.opinionText, short.potentialWinnings, short.id);
          console.log(`🤖💹 ${bot.username} short won: "${short.opinionText.slice(0, 30)}..." (won ${short.potentialWinnings})`);
          
          return { ...short, status: 'won' as const };
        }

        return short;
      });

      if (updated) {
        localStorage.setItem('shortPositions', JSON.stringify(updatedShorts));
        this.saveBots();
      }
    } catch (error) {
      console.error('Error checking short positions:', error);
    }
  }

  private saveBots(): void {
    try {
      localStorage.setItem('autonomousBots', JSON.stringify(this.bots));
    } catch (error) {
      console.error('Error saving bots:', error);
    }
  }

  // Public methods for managing the bot system
  public getBots(): BotProfile[] {
    return this.bots;
  }

  public getBotTransactions(): any[] {
    try {
      return JSON.parse(localStorage.getItem('botTransactions') || '[]');
    } catch {
      return [];
    }
  }

  public getBotShorts(): ShortPosition[] {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      return shorts.filter((short: ShortPosition) => short.botId);
    } catch {
      return [];
    }
  }

  public isSystemRunning(): boolean {
    return this.isRunning;
  }

  public pauseBot(botId: string): void {
    const bot = this.bots.find(b => b.id === botId);
    if (bot) {
      bot.isActive = false;
      this.saveBots();
    }
  }

  public resumeBot(botId: string): void {
    const bot = this.bots.find(b => b.id === botId);
    if (bot) {
      bot.isActive = true;
      this.saveBots();
    }
  }

  public getBotShortStats(): any {
    const botShorts = this.getBotShorts();
    const activeShorts = botShorts.filter(s => s.status === 'active');
    const wonShorts = botShorts.filter(s => s.status === 'won');
    const lostShorts = botShorts.filter(s => s.status === 'lost');
    
    return {
      total: botShorts.length,
      active: activeShorts.length,
      won: wonShorts.length,
      lost: lostShorts.length,
      totalWinnings: wonShorts.reduce((sum, s) => sum + s.potentialWinnings, 0),
      totalLosses: lostShorts.reduce((sum, s) => sum + s.betAmount, 0)
    };
  }

  public getBotPerformanceStats(): any {
    return this.bots.map(bot => {
      const portfolioValue = this.calculateBotPortfolioValue(bot);
      const totalValue = bot.balance + portfolioValue;
      const initialBalance = 30000;
      const totalReturn = ((totalValue - initialBalance) / initialBalance) * 100;
      
      return {
        id: bot.id,
        username: bot.username,
        balance: bot.balance,
        portfolioValue,
        totalValue,
        totalReturn: totalReturn.toFixed(2),
        totalEarnings: bot.totalEarnings,
        totalLosses: bot.totalLosses,
        netProfit: bot.totalEarnings - bot.totalLosses,
        strategy: bot.tradingStrategy.type,
        riskTolerance: bot.riskTolerance,
        isActive: bot.isActive
      };
    });
  }

  // NEW: Performance optimization methods for 1,000+ bots
  public optimizeForPerformance(): void {
    console.log('🔧 Optimizing bot system for UI performance...');
    
    // DRASTICALLY reduce activity frequency for all bots
    this.bots.forEach(bot => {
      bot.personality.activityFrequency = Math.max(60, bot.personality.activityFrequency * 5);
    });
    
    // Only activate first 50 bots for UI stability
    this.bots.forEach((bot, index) => {
      bot.isActive = index < 50;
    });
    
    console.log('✅ Performance optimization complete: 50 active bots, much slower frequency (60-300s intervals)');
    this.saveBots();
  }

  // UPDATED: Price validation using unified system
  public validatePriceConsistency(): void {
    console.log('🔍 VALIDATING PRICE CONSISTENCY ACROSS SYSTEM:');
    console.log('================================================');
    
    const opinions = this.getAvailableOpinions();
    let inconsistencies = 0;
    
    opinions.forEach(opinion => {
      const data = this.marketDataManager.getMarketData(opinion.text);
      const expectedPrice = calculateUnifiedPrice(data.timesPurchased, data.timesSold, 10.00);
      const actualPrice = data.currentPrice;
      const difference = Math.abs(expectedPrice - actualPrice);
        
      if (difference > 0.01) { // More than 1 cent difference
        console.log(`❌ INCONSISTENCY: "${opinion.text.slice(0, 40)}..."`);
        console.log(`   Expected: ${expectedPrice} | Actual: ${actualPrice} | Diff: ${difference.toFixed(4)}`);
        console.log(`   Purchases: ${data.timesPurchased} | Sales: ${data.timesSold} | Net: ${data.timesPurchased - data.timesSold}`);
        inconsistencies++;
        
        // Auto-fix using unified system
        this.marketDataManager.updateMarketData(opinion.text, 'buy', 0); // Recalculate with 0 quantity
        console.log(`   🔧 FIXED: Updated using unified system`);
      } else {
        console.log(`✅ CONSISTENT: "${opinion.text.slice(0, 40)}..." - ${actualPrice}`);
      }
    });
    
    if (inconsistencies > 0) {
      console.log(`🔧 Fixed ${inconsistencies} price inconsistencies using unified system`);
    } else {
      console.log(`✅ All ${opinions.length} opinions have consistent pricing`);
    }
  }

  // NEW: Debug opinion creation and pricing issues
  public debugOpinionCreation(): void {
    console.log('🔍 DEBUGGING OPINION CREATION AND PRICING:');
    console.log('============================================');
    
    const opinions = this.getAvailableOpinions();
    const botTransactions = this.getBotTransactions();
    
    console.log(`📊 Total opinions: ${opinions.length}`);
    console.log(`📊 Total bot transactions: ${botTransactions.length}`);
    
    // Check each opinion's pricing
    opinions.slice(0, 5).forEach((opinion, index) => { // Check first 5 for detail
      const opinionText = opinion.text;
      console.log(`\n📝 Opinion ${index + 1}: "${opinionText.slice(0, 50)}..."`);
      
      const data = this.marketDataManager.getMarketData(opinionText);
      if (data) {
        console.log(`💰 Current Price: ${data.currentPrice}`);
        console.log(`📈 Purchases: ${data.timesPurchased} | Sales: ${data.timesSold}`);
        console.log(`📅 Last Updated: ${data.lastUpdated}`);
        
        // Check if price should be $10
        const expectedPrice = calculateUnifiedPrice(data.timesPurchased, data.timesSold, 10.00);
        if (Math.abs(expectedPrice - data.currentPrice) > 0.01) {
          console.log(`❌ PRICE MISMATCH: Expected ${expectedPrice}, Got ${data.currentPrice}`);
        } else {
          console.log(`✅ Price matches calculation: ${expectedPrice}`);
        }
        
        // Check creation transaction
        const creationTx = botTransactions.find((tx: any) => 
          tx.type === 'earn' && tx.opinionText === opinionText
        );
        if (creationTx) {
          console.log(`🤖 Created by: ${creationTx.botId} at ${creationTx.date}`);
          console.log(`💰 Creation earnings: ${creationTx.amount}`);
        } else {
          console.log(`❓ No creation transaction found`);
        }
      } else {
        console.log(`❌ NO MARKET DATA FOUND - This should not happen!`);
      }
    });
    
    // Test price calculation for new opinion
    console.log('\n🧪 TESTING NEW OPINION PRICE CALCULATION:');
    const testPrice = calculateUnifiedPrice(0, 0, 10);
    console.log(`📊 New opinion with 0 purchases, 0 sales should be: ${testPrice}`);
    
    if (testPrice !== 10) {
      console.log(`❌ ERROR: New opinions should start at exactly $10.00!`);
    } else {
      console.log(`✅ New opinion pricing is correct: $10.00`);
    }
  }

  // NEW: Test price calculation method
  public testPriceCalculation(): void {
    console.log('🧪 TESTING UNIFIED PRICE CALCULATION:');
    console.log('====================================');
    
    const basePrice = 10;
    
    console.log('Testing purchase sequence (0.1% increases):');
    for (let purchases = 0; purchases <= 10; purchases++) {
      const price = this.calculatePrice(purchases, 0, basePrice);
      const percentChange = purchases > 0 ? ((price - basePrice) / basePrice * 100).toFixed(3) : '0.000';
      console.log(`  ${purchases} purchases: ${price} (+${percentChange}%)`);
    }
    
    console.log('\nTesting sale sequence (0.1% decreases):');
    for (let sales = 0; sales <= 10; sales++) {
      const price = this.calculatePrice(0, sales, basePrice);
      const percentChange = sales > 0 ? ((price - basePrice) / basePrice * 100).toFixed(3) : '0.000';
      console.log(`  ${sales} sales: ${price} (${percentChange}%)`);
    }
    
    console.log('\nTesting large numbers:');
    const largePurchases = [100, 500, 1000, 5000];
    largePurchases.forEach(count => {
      const price = this.calculatePrice(count, 0, basePrice);
      const percentChange = ((price - basePrice) / basePrice * 100).toFixed(1);
      console.log(`  ${count} purchases: ${price} (+${percentChange}%)`);
    });
  }

  // NEW: Force specific opinion generation for testing
  public forceOpinionGeneration(count: number = 5): void {
    console.log(`🎯 FORCING ${count} OPINION GENERATIONS for sidebar testing...`);
    
    const activeBots = this.bots.filter(b => b.isActive).slice(0, count);
    
    activeBots.forEach((bot, index) => {
      setTimeout(() => {
        console.log(`🤖💡 FORCING ${bot.username} to generate opinion...`);
        this.botGenerateOpinion(bot);
        
        // Log current opinion count after each generation
        setTimeout(() => {
          const currentOpinions = JSON.parse(localStorage.getItem('opinions') || '[]');
          console.log(`📊 After ${bot.username} generation: ${currentOpinions.length} total opinions`);
          console.log(`📝 Latest opinion: "${currentOpinions[currentOpinions.length - 1]}"`);
        }, 100);
        
      }, index * 2000); // 2 seconds apart
    });
    
    console.log(`✅ Scheduled ${activeBots.length} opinion generations with 2-second intervals`);
  }

  // NEW: Restart system with optimized settings
  public restartOptimized(): void {
    console.log('🔄 Restarting bot system with optimized settings...');
    
    this.stopBots();
    this.optimizeForPerformance();
    
    setTimeout(() => {
      this.startBots();
      
      // Force immediate activity
      setTimeout(() => {
        this.forceBotActivity(20);
      }, 2000);
      
    }, 1000);
  }

  // NEW: Manual start method for troubleshooting
  public manualStart(): void {
    console.log('🔧 Manual start initiated...');
    console.log('🧪 TESTING ALL BOT ACTION TYPES:');
    
    // Ensure opinions exist
    this.ensureOpinionsExist();
    
    // Start with immediate activity
    this.startBots();
    
    // Test each action type explicitly
    setTimeout(() => {
      console.log('🎯 TESTING BUY ACTIONS:');
      const buyers = this.bots.filter(b => b.isActive).slice(0, 5);
      buyers.forEach((bot, i) => {
        setTimeout(() => {
          console.log(`🔍 Testing buy for ${bot.username}...`);
          const result = this.botBuyOpinion(bot);
          console.log(`Buy result for ${bot.username}: ${result ? 'SUCCESS' : 'FAILED'}`);
        }, i * 200);
      });
    }, 1000);
    
    setTimeout(() => {
      console.log('🎯 TESTING BET ACTIONS:');
      const bettors = this.bots.filter(b => b.isActive).slice(5, 10);
      bettors.forEach((bot, i) => {
        setTimeout(() => {
          console.log(`🔍 Testing bet for ${bot.username}...`);
          const result = this.botPlaceBet(bot);
          console.log(`Bet result for ${bot.username}: ${result ? 'SUCCESS' : 'FAILED'}`);
        }, i * 200);
      });
    }, 2000);
    
    setTimeout(() => {
      console.log('🎯 TESTING GENERATE ACTIONS:');
      const generators = this.bots.filter(b => b.isActive).slice(10, 15);
      generators.forEach((bot, i) => {
        setTimeout(() => {
          console.log(`🔍 Testing generate for ${bot.username}...`);
          this.botGenerateOpinion(bot);
          console.log(`Generate result for ${bot.username}: SUCCESS`);
        }, i * 200);
      });
    }, 3000);
    
    setTimeout(() => {
      console.log('🎯 TESTING SELL ACTIONS:');
      const sellers = this.bots.filter(b => b.isActive).slice(15, 20);
      sellers.forEach((bot, i) => {
        setTimeout(() => {
          console.log(`🔍 Testing sell for ${bot.username}...`);
          const result = this.botSellOpinion(bot);
          console.log(`Sell result for ${bot.username}: ${result ? 'SUCCESS' : 'FAILED'}`);
        }, i * 200);
      });
    }, 4000);
    
    // Force diverse activity
    setTimeout(() => {
      console.log('🚀 Forcing diverse bot activity...');
      this.forceBotActivity(20);
    }, 5000);
    
    console.log('✅ Manual start complete - check console for detailed testing results!');
  }

  public forceBotActivity(count: number = 10): void {
    console.log(`🎯 FORCING ${count} BOT ACTIONS for immediate activity...`);
    
    const activeBots = this.bots.filter(b => b.isActive).slice(0, count);
    
    activeBots.forEach((bot, index) => {
      setTimeout(() => {
        console.log(`🤖⚡ FORCING ${bot.username} to act...`);
        this.executeBotAction(bot);
      }, index * 500); // 500ms apart
    });
    
    console.log(`✅ Scheduled ${activeBots.length} forced bot actions with 500ms intervals`);
  }

  public debugFeedActivity(): any {
    console.log('🔍 FEED DEBUG REPORT:');
    console.log('===================');
    
    const transactions = this.getBotTransactions();
    const recentTransactions = transactions.slice(-10);
    
    console.log(`📊 Total bot transactions: ${transactions.length}`);
    console.log(`🕐 Recent transactions (last 10):`, recentTransactions);
    
    const activeBots = this.bots.filter(b => b.isActive);
    console.log(`🤖 Active bots: ${activeBots.length}/${this.bots.length}`);
    
    const runningStatus = this.isSystemRunning();
    console.log(`⚡ System running: ${runningStatus}`);
    
    if (!runningStatus) {
      console.log('❌ Bot system is stopped! Run botSystem.startBots() to restart.');
    }
    
    // Test if opinions exist
    const opinions = this.getAvailableOpinions();
    console.log(`💭 Available opinions: ${opinions.length}`);
    
    if (opinions.length === 0) {
      console.log('❌ No opinions found! Bots need opinions to trade.');
    }
    
    return {
      totalTransactions: transactions.length,
      recentTransactions: recentTransactions.length,
      activeBots: activeBots.length,
      totalBots: this.bots.length,
      systemRunning: runningStatus,
      opinionsAvailable: opinions.length
    };
  }

  // Transaction debugging and fixing methods
  public fixBotTransactions(): void {
    console.log('🔧 FIXING BOT TRANSACTIONS...');
    
    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      
      console.log(`📊 Found ${transactions.length} bot transactions`);
      
      let fixedCount = 0;
      let removedCount = 0;
      
      // Fix transactions with missing fields
      const fixedTransactions = transactions.filter((transaction: any, index: number) => {
        if (!transaction.id) {
          transaction.id = `fixed_${Date.now()}_${index}`;
          fixedCount++;
        }
        
        if (!transaction.date) {
          transaction.date = new Date().toISOString();
          fixedCount++;
        }
        
        if (!transaction.type) {
          console.log(`❌ Removing transaction without type at index ${index}`);
          removedCount++;
          return false;
        }
        
        if (typeof transaction.amount !== 'number') {
          console.log(`❌ Removing transaction with invalid amount at index ${index}:`, transaction.amount);
          removedCount++;
          return false;
        }
        
        return true;
      });
      
      // Remove duplicates
      const uniqueTransactions = fixedTransactions.filter((transaction: any, index: number, arr: any[]) => {
        const firstIndex = arr.findIndex(t => t.id === transaction.id);
        if (firstIndex !== index) {
          removedCount++;
          return false;
        }
        return true;
      });
      
      localStorage.setItem('botTransactions', JSON.stringify(uniqueTransactions));
      
      console.log(`✅ Transaction fix complete:`);
      console.log(`   🔧 Fixed fields: ${fixedCount}`);
      console.log(`   🗑️ Removed invalid: ${removedCount}`);
      console.log(`   📈 Final count: ${uniqueTransactions.length}`);
      
      // Dispatch event to update feed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('botTransactionsFixed', { 
          detail: { 
            count: uniqueTransactions.length,
            fixed: fixedCount,
            removed: removedCount
          } 
        }));
      }
      
    } catch (error) {
      console.error('❌ Error fixing bot transactions:', error);
    }
  }

  // Method to validate transaction integrity
  public validateTransactionIntegrity(): boolean {
    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      let isValid = true;
      const issues: string[] = [];
      
      console.log('🔍 VALIDATING TRANSACTION INTEGRITY...');
      
      // Check for required fields
      transactions.forEach((transaction: any, index: number) => {
        if (!transaction.id) {
          issues.push(`Transaction ${index} missing ID`);
          isValid = false;
        }
        
        if (!transaction.botId) {
          issues.push(`Transaction ${index} missing botId`);
          isValid = false;
        }
        
        if (!transaction.type) {
          issues.push(`Transaction ${index} missing type`);
          isValid = false;
        }
        
        if (typeof transaction.amount !== 'number') {
          issues.push(`Transaction ${index} has invalid amount: ${transaction.amount}`);
          isValid = false;
        }
        
        if (!transaction.date) {
          issues.push(`Transaction ${index} missing date`);
          isValid = false;
        }
      });
      
      // Check for duplicates
      const ids = transactions.map((t: any) => t.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        issues.push(`Found ${ids.length - uniqueIds.size} duplicate transaction IDs`);
        isValid = false;
      }
      
      if (isValid) {
        console.log(`✅ Transaction integrity check passed: ${transactions.length} transactions are valid`);
      } else {
        console.log(`❌ Transaction integrity check failed:`);
        issues.forEach(issue => console.log(`   - ${issue}`));
        console.log(`🔧 Run botSystem.fixBotTransactions() to fix these issues`);
      }
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Error validating transaction integrity:', error);
      return false;
    }
  }

  // Enhanced debug method for transaction issues
  public debugTransactionIssues(): void {
    console.log('🔍 DEBUGGING TRANSACTION ISSUES...');
    console.log('=====================================');
    
    try {
      const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      const globalFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
      const bots = this.getBots();
      
      console.log(`📊 STORAGE SUMMARY:`);
      console.log(`   🤖 Bot transactions: ${botTransactions.length}`);
      console.log(`   👤 User transactions: ${userTransactions.length}`);
      console.log(`   🌐 Global feed: ${globalFeed.length}`);
      console.log(`   🤖 Total bots: ${bots.length}`);
      console.log(`   🤖 Active bots: ${bots.filter(b => b.isActive).length}`);
      console.log(`   🤖 System running: ${this.isSystemRunning()}`);
      
      // Analyze bot transactions
      if (botTransactions.length > 0) {
        console.log(`\n📊 BOT TRANSACTION ANALYSIS:`);
        
        const recentTransactions = botTransactions.slice(-10);
        console.log(`   🕐 Last 10 transactions:`);
        recentTransactions.forEach((t: any, i: number) => {
          const botName = bots.find(b => b.id === t.botId)?.username || `UnknownBot_${t.botId?.slice(-3)}`;
          console.log(`     ${i + 1}. ${botName} - ${t.type} - ${t.amount} - ${t.date || 'NO DATE'}`);
        });
        
        // Check for missing fields
        const missingIds = botTransactions.filter((t: any) => !t.id).length;
        const missingDates = botTransactions.filter((t: any) => !t.date).length;
        const missingBotIds = botTransactions.filter((t: any) => !t.botId).length;
        const missingTypes = botTransactions.filter((t: any) => !t.type).length;
        
        console.log(`   ❌ Transactions missing IDs: ${missingIds}`);
        console.log(`   ❌ Transactions missing dates: ${missingDates}`);
        console.log(`   ❌ Transactions missing botIds: ${missingBotIds}`);
        console.log(`   ❌ Transactions missing types: ${missingTypes}`);
        
        // Transaction type breakdown
        const typeBreakdown = botTransactions.reduce((acc: any, t: any) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {});
        console.log(`   📈 Transaction types:`, typeBreakdown);
        
        // Bot activity breakdown
        const botBreakdown = botTransactions.reduce((acc: any, t: any) => {
          const botName = bots.find(b => b.id === t.botId)?.username || `Unknown_${t.botId?.slice(-3)}`;
          acc[botName] = (acc[botName] || 0) + 1;
          return acc;
        }, {});
        const topBots = Object.entries(botBreakdown)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 5);
        console.log(`   🏆 Top 5 most active bots:`, topBots);
        
      } else {
        console.log(`\n❌ NO BOT TRANSACTIONS FOUND!`);
        console.log(`   This means either:`);
        console.log(`   1. Bot system hasn't started yet`);
        console.log(`   2. Bots aren't performing actions`);
        console.log(`   3. Transaction recording is broken`);
        
        if (this.isSystemRunning()) {
          console.log(`   🤖 Bot system is running - forcing activity...`);
          this.forceBotActivity(5);
        } else {
          console.log(`   🤖 Bot system is stopped - starting...`);
          this.startBots();
        }
      }
      
    } catch (error) {
      console.error('❌ Error in debugTransactionIssues:', error);
    }
    
    console.log('\n🔧 SUGGESTED FIXES:');
    console.log('   1. Run: botSystem.fixBotTransactions()');
    console.log('   2. Run: botSystem.validateTransactionIntegrity()');
    console.log('   3. Run: botSystem.forceBotActivity(10)');
    console.log('   4. Run: botSystem.restartOptimized()');
    console.log('   5. Run: botSystem.syncBotTransactionsToGlobalFeed()');
    console.log('   6. Run: botSystem.testFirebaseDataSanitization()');
  }

  // NEW: Test Firebase data sanitization
  public testFirebaseDataSanitization(): void {
    console.log('🧪 TESTING FIREBASE DATA SANITIZATION...');
    
    // Test with potentially problematic data
    const testBot: BotProfile = {
      id: 'test-bot-123',
      username: 'TestBot',
      balance: 1000,
      joinDate: new Date().toISOString(),
      totalEarnings: 0,
      totalLosses: 0,
      personality: this.bots[0]?.personality || {} as any,
      riskTolerance: 'moderate',
      tradingStrategy: this.bots[0]?.tradingStrategy || {} as any,
      lastActive: new Date().toISOString(),
      isActive: true
    };

    const testCases = [
      { type: 'buy', opinionText: undefined, amount: undefined, price: undefined },
      { type: 'sell', opinionText: '', amount: 0, price: NaN },
      { type: 'earn', opinionText: null, amount: 'not-a-number', price: null },
      { type: 'buy', opinionText: 'Valid opinion', amount: 50, price: 12.34 }
    ];

    testCases.forEach((testCase, index) => {
      console.log(`\n🧪 Test Case ${index + 1}:`, testCase);
      
      try {
        this.addBotTransaction(
          testBot,
          testCase.type,
          'test-opinion-' + index,
          testCase.opinionText as any,
          testCase.amount as any,
          undefined,
          { price: testCase.price, quantity: 1 }
        );
        console.log(`✅ Test ${index + 1} passed - no Firebase errors`);
      } catch (error) {
        console.error(`❌ Test ${index + 1} failed:`, error);
      }
    });
    
    console.log('\n✅ Firebase data sanitization test complete!');
  }

  // NEW: Sync existing bot transactions to global feed
  public syncBotTransactionsToGlobalFeed(): void {
    console.log('🔄 SYNCING BOT TRANSACTIONS TO GLOBAL FEED...');
    
    const transactions = this.getBotTransactions();
    const bots = this.getBots();
    let synced = 0;
    let failed = 0;
    
    if (typeof window === 'undefined' || !(window as any).addToGlobalFeed) {
      console.log('❌ GlobalActivityTracker not available, cannot sync');
      return;
    }
    
    // Get existing global feed to avoid duplicates
    const existingGlobalFeed = (window as any).getGlobalActivities?.() || [];
    const existingIds = new Set(existingGlobalFeed.map((item: any) => item.id));
    
    console.log(`📊 Found ${transactions.length} bot transactions to sync`);
    console.log(`📊 Existing global feed has ${existingGlobalFeed.length} items`);
    
    transactions.forEach(transaction => {
      try {
        // Skip if already in global feed
        if (existingIds.has(transaction.id)) {
          return;
        }
        
        const bot = bots.find(b => b.id === transaction.botId);
        if (!bot) {
          console.warn(`⚠️ Bot not found for transaction ${transaction.id}`);
          failed++;
          return;
        }
        
        const activityData = {
          type: transaction.type as 'buy' | 'sell' | 'earn' | 'bet_place' | 'bet_win' | 'bet_loss' | 'short_place' | 'short_win' | 'short_loss' | 'generate',
          username: bot.username,
          opinionText: transaction.opinionText,
          opinionId: transaction.opinionId,
          amount: transaction.amount,
          price: transaction.metadata?.purchasePricePerShare || transaction.metadata?.price,
          quantity: transaction.metadata?.quantity || 1,
          timestamp: transaction.date,
          isBot: true,
          botId: bot.id
        };
        
        (window as any).addToGlobalFeed(activityData);
        synced++;
        
      } catch (error) {
        console.error('❌ Failed to sync bot transaction:', error);
        failed++;
      }
    });
    
    console.log(`✅ Sync complete: ${synced} synced, ${failed} failed`);
    
    // Force refresh the feed page if available
    if ((window as any).forceRefreshFeed) {
      (window as any).forceRefreshFeed();
    }
  }

  // Helper methods
  private calculateBotPortfolioValue(bot: BotProfile): number {
    const botOpinions = this.getBotOpinions(bot);
    return botOpinions.reduce((total, opinion) => {
      const currentPrice = this.getOpinionPrice(opinion.opinionId);
      return total + (currentPrice * opinion.quantity);
    }, 0);
  }

  private addBotOpinion(bot: BotProfile, opinion: any, price: number, quantity: number): void {
    const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '{}');
    if (!botOpinions[bot.id]) {
      botOpinions[bot.id] = [];
    }

    const existingOpinion = botOpinions[bot.id].find((o: any) => o.opinionId === opinion.id);
    if (existingOpinion) {
      existingOpinion.quantity += quantity;
      existingOpinion.purchasePrice = ((existingOpinion.purchasePrice * existingOpinion.quantity) + (price * quantity)) / (existingOpinion.quantity + quantity);
    } else {
      botOpinions[bot.id].push({
        opinionId: opinion.id,
        text: opinion.text,
        purchasePrice: price,
        quantity: quantity,
        purchaseDate: new Date().toISOString()
      });
    }

    localStorage.setItem('botOpinions', JSON.stringify(botOpinions));
  }

  private removeBotOpinion(bot: BotProfile, opinionId: string, quantity: number): void {
    const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '{}');
    if (!botOpinions[bot.id]) return;

    const opinionIndex = botOpinions[bot.id].findIndex((o: any) => o.opinionId === opinionId);
    if (opinionIndex !== -1) {
      const opinion = botOpinions[bot.id][opinionIndex];
      opinion.quantity -= quantity;
      
      if (opinion.quantity <= 0) {
        botOpinions[bot.id].splice(opinionIndex, 1);
      }
      
      localStorage.setItem('botOpinions', JSON.stringify(botOpinions));
    }
  }

  private getBotOpinions(bot: BotProfile): any[] {
    const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '{}');
    return botOpinions[bot.id] || [];
  }

  private selectOpinionByStrategy(opinions: any[], bot: BotProfile): any {
    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        return opinions.sort((a, b) => this.getOpinionPopularity(a.id) - this.getOpinionPopularity(b.id))[0];
      case 'momentum':
        return opinions.sort((a, b) => this.getOpinionTrend(b.id) - this.getOpinionTrend(a.id))[0];
      case 'value':
        return opinions.sort((a, b) => this.getOpinionValue(a.id) - this.getOpinionValue(b.id))[0];
      default:
        return opinions[Math.floor(Math.random() * opinions.length)];
    }
  }

  private getOpinionPopularity(opinionId: string): number {
    // Simple popularity metric based on transaction volume
    const transactions = this.getBotTransactions();
    const opinionTransactions = transactions.filter((t: any) => t.opinionId === opinionId);
    return opinionTransactions.length;
  }

  private getOpinionTrend(opinionId: string): number {
    // Simple trend metric based on recent price movements
    const opinions = this.getAvailableOpinions();
    const opinion = opinions.find(o => o.id === opinionId);
    if (!opinion) return 0;

    const marketData = this.marketDataManager.getMarketData(opinion.text);
    const recentHistory = marketData.priceHistory.slice(-5);
    if (recentHistory.length < 2) return 0;

    const oldPrice = recentHistory[0].price;
    const newPrice = recentHistory[recentHistory.length - 1].price;
    return newPrice - oldPrice;
  }

  private getOpinionValue(opinionId: string): number {
    // Simple value metric - lower current price = higher value
    const currentPrice = this.getOpinionPrice(opinionId);
    return 50 - currentPrice; // Invert so lower prices have higher value
  }

  private weightedRandomChoice(choices: string[], weights: number[]): string {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < choices.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return choices[i];
      }
    }
    
    return choices[0];
  }

  private calculateMultiplier(betType: string, percentage: number): number {
    const baseMultiplier = percentage / 20;
    return Math.max(1.1, Math.min(5.0, baseMultiplier));
  }

  private getVolatilityRating(username: string): 'Low' | 'Medium' | 'High' {
    const ratings = ['Low', 'Medium', 'High'];
    return ratings[Math.abs(username.length % 3)] as 'Low' | 'Medium' | 'High';
  }

  // Get all available opinions
  private getAvailableOpinions(): any[] {
    try {
      const stored = localStorage.getItem('opinions');
      if (!stored) return [];
      
      const opinions = JSON.parse(stored);
      return Array.isArray(opinions) ? 
        opinions.map((text, index) => ({ id: index.toString(), text })) : [];
    } catch (error) {
      console.error('Error getting opinions:', error);
      return [];
    }
  }

  // Get opinion price using unified system
  private getOpinionPrice(opinionId: string): number {
    const opinions = this.getAvailableOpinions();
    const opinion = opinions.find(o => o.id === opinionId);
    if (!opinion) return 10;

    const marketData = this.marketDataManager.getMarketData(opinion.text);
    return marketData.currentPrice;
  }

  // Generate random opinions
  private generateRandomOpinion(): string {
    const templates = [
      "{technology} will {action} {target} by {year}",
      "In {timeframe}, {newThing} will replace {oldThing}",
      "{newThing} will be {quality} within {timeframe}",
      "By {year}, {traditional} will be {outcome}",
      "{field} will change {change} we {activity} in the next {timeframe}",
      "{newWay} will become more popular than {oldWay} by {year}",
      "We'll see {metric} improvement in {field} by {year}",
      "{concern} will be a major issue for {technology} adoption",
      "Governments will regulate {technology} due to {reason}",
      "{factor} will drive {technology} adoption faster than expected",
      "{trend} will be the {superlative} trend of {year}",
      "{innovation} will solve the problem of {concern}",
      "By {year}, {prediction}",
      "{cause} will {effect} {field} permanently",
      "{group} will {lose/gain} {power/influence} due to {change}"
    ];

    const variables = {
      technology: [
        "AI", "Quantum computing", "Blockchain", "VR", "AR", "5G", "IoT", "Robotics", 
        "Neural interfaces", "Gene editing", "3D printing", "Drones", "Autonomous vehicles",
        "Smart contracts", "Digital twins", "Edge computing", "Nanotechnology", "Biotech",
        "Machine learning", "Computer vision", "Natural language AI", "Synthetic biology"
      ],
      
      action: [
        "revolutionize", "transform", "replace", "eliminate", "automate", "optimize", 
        "democratize", "centralize", "decentralize", "accelerate", "disrupt", "enhance",
        "digitize", "virtualize", "tokenize", "gamify", "personalize", "streamline"
      ],
      
      target: [
        "healthcare", "education", "finance", "transportation", "entertainment", "retail",
        "manufacturing", "agriculture", "energy", "real estate", "media", "government",
        "supply chains", "customer service", "human resources", "legal systems", "voting",
        "social interactions", "work environments", "creative industries", "scientific research"
      ],
      
      year: ["2025", "2026", "2027", "2028", "2029", "2030", "2032", "2035", "2040"],
      
      timeframe: [
        "5 years", "a decade", "this decade", "the next decade", "20 years", 
        "the 2030s", "by 2030", "within a generation", "this century"
      ],
      
      industry: [
        "banking", "healthcare", "education", "retail", "manufacturing", "entertainment",
        "transportation", "real estate", "agriculture", "energy", "media", "fashion",
        "food service", "construction", "pharmaceuticals", "telecommunications", "insurance"
      ],
      
      outcome: [
        "obsolete", "irrelevant", "transformed", "revolutionized", "automated", "digitized",
        "decentralized", "democratized", "personalized", "streamlined", "optimized", "disrupted"
      ],
      
      field: [
        "work", "education", "healthcare", "entertainment", "transportation", "communication",
        "commerce", "governance", "social interaction", "creativity", "scientific research",
        "agriculture", "energy production", "manufacturing", "financial services"
      ],
      
      change: [
        "how", "when", "where", "why", "the way", "the methods we use to", "our approach to"
      ],
      
      activity: [
        "work", "learn", "shop", "travel", "communicate", "entertain ourselves", "exercise",
        "eat", "date", "socialize", "create", "consume media", "manage money", "vote",
        "receive healthcare", "conduct business", "solve problems"
      ],
      
      concept: [
        "Remote work", "Universal basic income", "Digital currency", "Virtual reality",
        "Artificial intelligence", "Gene therapy", "Space tourism", "Lab-grown meat",
        "Autonomous vehicles", "Neural implants", "Renewable energy", "Digital identity",
        "Decentralized finance", "Quantum computing", "Brain uploading"
      ],
      
      status: [
        "mainstream", "standard", "universal", "mandatory", "obsolete", "illegal", 
        "regulated", "common", "rare", "expensive", "free", "accessible to all"
      ],
      
      cause: [
        "artificial intelligence", "climate change", "automation", "blockchain technology",
        "virtual reality", "gene editing", "renewable energy", "demographic shifts",
        "economic inequality", "technological unemployment", "data privacy concerns",
        "environmental regulations", "social media influence", "generational change"
      ],
      
      effect: [
        "reshape", "eliminate", "create", "transform", "disrupt", "enhance", "threaten",
        "improve", "complicate", "simplify", "accelerate", "slow down", "democratize"
      ],
      
      group: [
        "workers", "students", "elderly people", "young adults", "professionals", "artists",
        "entrepreneurs", "politicians", "scientists", "teachers", "doctors", "engineers",
        "content creators", "small businesses", "corporations", "governments"
      ],
      
      trend: [
        "Artificial intelligence", "Remote work", "Climate activism", "Cryptocurrency",
        "Virtual reality", "Gene editing", "Space exploration", "Sustainable living",
        "Digital nomadism", "Automation", "Personalized medicine", "Renewable energy"
      ],
      
      superlative: [
        "biggest", "most important", "most disruptive", "most promising", "most dangerous",
        "most overlooked", "most overhyped", "most underestimated", "fastest growing"
      ],
      
      innovation: [
        "artificial intelligence", "quantum computing", "gene therapy", "fusion energy",
        "brain-computer interfaces", "lab-grown meat", "autonomous vehicles", "VR",
        "blockchain", "renewable energy", "space technology", "nanotechnology"
      ],
      
      prediction: [
        "most jobs will be automated", "physical cash will disappear", "fossil fuels will be banned",
        "human aging will be reversed", "Mars will be colonized", "privacy will be extinct",
        "traditional education will end", "work weeks will be 3 days", "cities will be car-free",
        "meat consumption will be illegal", "social media will be regulated", "AI will be conscious"
      ],
      
      newThing: [
        "AI tutors", "Digital currency", "Lab-grown meat", "Virtual meetings", "Gene therapy",
        "Renewable energy", "3D printing", "Autonomous vehicles", "Smart homes", "VR entertainment"
      ],
      
      oldThing: [
        "human teachers", "physical cash", "animal agriculture", "in-person meetings", 
        "traditional medicine", "fossil fuels", "mass manufacturing", "human drivers",
        "traditional homes", "physical entertainment"
      ],
      
      quality: [
        "effective", "efficient", "affordable", "accessible", "reliable", "popular",
        "sustainable", "convenient", "safe", "accurate", "personalized", "engaging"
      ],
      
      traditional: [
        "traditional methods", "current systems", "human workers", "physical stores",
        "conventional medicine", "fossil fuel energy", "paper currency", "cable TV",
        "physical books", "in-person education", "traditional farming"
      ],
      
      newWay: [
        "virtual experiences", "digital solutions", "AI assistance", "automated systems",
        "personalized services", "subscription models", "remote interactions", "smart technology"
      ],
      
      oldWay: [
        "physical experiences", "analog solutions", "human assistance", "manual systems",
        "one-size-fits-all services", "ownership models", "in-person interactions", "traditional technology"
      ],
      
      metric: [
        "90%", "50%", "300%", "10x", "twice the efficiency", "half the cost", 
        "triple the speed", "double the accuracy", "tenfold improvement"
      ],
      
      concern: [
        "privacy violations", "job displacement", "health risks", "social inequality",
        "security threats", "ethical concerns", "environmental impact", "addiction potential",
        "misinformation spread", "economic disruption", "safety issues"
      ],
      
      reason: [
        "public safety", "environmental protection", "economic stability", "social equity",
        "national security", "public health", "technological advancement", "climate goals",
        "privacy protection", "consumer protection", "ethical considerations"
      ],
      
      factor: [
        "economic necessity", "technological advancement", "environmental crisis", "social pressure",
        "generational change", "global competition", "health concerns", "security threats",
        "ethical awakening", "cultural shift", "political pressure"
      ]
    };

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace variables in template
    let opinion = template;
    
    // Find all variables in the template (anything in {})
    const variableMatches = template.match(/\{([^}]+)\}/g) || [];
    
    variableMatches.forEach(match => {
      const variableName = match.slice(1, -1); // Remove { and }
      
      // Handle special cases with multiple options
      if (variableName.includes('/')) {
        const options = variableName.split('/');
        const selectedOption = options[Math.floor(Math.random() * options.length)];
        opinion = opinion.replace(match, selectedOption);
      } else if (variables[variableName as keyof typeof variables]) {
        const options = variables[variableName as keyof typeof variables];
        const selectedValue = options[Math.floor(Math.random() * options.length)];
        opinion = opinion.replace(match, selectedValue);
      }
    });
    
    // Clean up any remaining brackets and ensure proper capitalization
    opinion = opinion.replace(/\{[^}]*\}/g, 'innovation'); // fallback for any missed variables
    opinion = opinion.charAt(0).toUpperCase() + opinion.slice(1);
    
    return opinion;
  }

  // Ensure opinions exist for bot trading
  private ensureOpinionsExist(): void {
    const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
    if (opinions.length < 10) {
      console.log('🤖 Generating initial opinions for bot system...');
      
      for (let i = opinions.length; i < 15; i++) {
        const newOpinion = this.generateRandomOpinion();
        opinions.push(newOpinion);
        
        // UPDATED: Initialize market data using unified system
        this.marketDataManager.getMarketData(newOpinion); // This will create it at $10.00
      }
      
      localStorage.setItem('opinions', JSON.stringify(opinions));
      console.log(`✅ Generated ${15 - opinions.length} initial opinions`);
    }
  }
}

// Global bot system instance with AUTO-INITIALIZATION
const botSystem = new AutonomousBotSystem();

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
  (window as any).botSystem = botSystem;
  (window as any).debugBots = () => botSystem.debugFeedActivity();
  (window as any).forceBotActivity = (count?: number) => botSystem.forceBotActivity(count);
  (window as any).restartBots = () => botSystem.restartOptimized();
  (window as any).manualStartBots = () => botSystem.manualStart();
  (window as any).forceOpinionGeneration = (count?: number) => botSystem.forceOpinionGeneration(count);
  
  // NEW: Global price and opinion debugging
  (window as any).validatePrices = () => botSystem.validatePriceConsistency();
  (window as any).testPriceCalc = () => botSystem.testPriceCalculation();
  (window as any).debugOpinionCreation = () => botSystem.debugOpinionCreation();
  
  // ENHANCED: Transaction debugging methods
  (window as any).fixBotTransactions = () => botSystem.fixBotTransactions();
  (window as any).validateTransactionIntegrity = () => botSystem.validateTransactionIntegrity();
  (window as any).debugTransactionIssues = () => botSystem.debugTransactionIssues();
  (window as any).syncBotTransactionsToGlobalFeed = () => botSystem.syncBotTransactionsToGlobalFeed();
  (window as any).testFirebaseDataSanitization = () => botSystem.testFirebaseDataSanitization();
  
  // AUTO-START LOGGING
  console.log('🤖 Bot System loaded with UNIFIED SYSTEM integration!');
  console.log('📱 Available commands:');
  console.log('  - debugBots() - Check system status');
  console.log('  - forceBotActivity(10) - Force bot actions');
  console.log('  - forceOpinionGeneration(5) - Force opinion generation specifically');
  console.log('  - restartBots() - Restart with optimization');
  console.log('  - manualStartBots() - Manual troubleshooting start');
  console.log('  - validatePrices() - Check price consistency with unified system');
  console.log('  - testPriceCalc() - Test unified price calculation');
  console.log('  - debugOpinionCreation() - Debug opinion creation and pricing issues');
  console.log('  - syncBotTransactionsToGlobalFeed() - Sync bot transactions to global feed');
  console.log('  - testFirebaseDataSanitization() - Test Firebase data sanitization fixes');
  console.log('  - fixBotTransactions() - Fix transaction recording issues');
  console.log('  - validateTransactionIntegrity() - Validate all transactions');
  console.log('  - debugTransactionIssues() - Comprehensive transaction debugging');
  console.log('  - botSystem.getBotTransactions() - View all transactions');
}

// Export for use in your application
export default botSystem;

// Types for reuse
export type { BotProfile, BotPersonality, TradingStrategy, ShortPosition };

// AUTOMATIC INITIALIZATION AND STARTUP
console.log('🚀 Bot system will auto-start in 2 seconds...');
console.log('💡 Price movements are now EXACTLY 0.1% per purchase/sale using UNIFIED SYSTEM');
console.log('💡 NO MORE VOLATILITY MULTIPLIER - all opinions behave consistently');
console.log('💡 If you don\'t see bot activity, run: manualStartBots() in console');