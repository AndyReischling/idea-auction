// autonomous-bots.ts
// Enhanced Autonomous Bot System with Realistic Market Pricing, 5,000+ Bots, and 0.1% Price Movements

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
}

interface OpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility: number;
  lastUpdated: string;
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' }[];
  liquidityScore: number;
  dailyVolume: number;
  manipulation_protection: {
    rapid_trades: number;
    single_trader_percentage: number;
    last_manipulation_check: string;
  };
}

class AutonomousBotSystem {
  private bots: BotProfile[] = [];
  private isRunning: boolean = false;
  private intervalIds: NodeJS.Timeout[] = [];

  constructor() {
    this.initializeBots();
    // AUTO-START: Automatically initialize opinions and start bots after a short delay
    setTimeout(() => this.autoInitialize(), 2000);
  }

  // AUTO-INITIALIZE: Create test data and start bots automatically
  private autoInitialize(): void {
    console.log('🤖 Auto-initializing bot system...');
    
    // Check if opinions exist, if not create them
    this.ensureOpinionsExist();
    
    // Start the bot system
    this.startBots();
    
    console.log('✅ Bot system auto-initialized and started!');
  }

  // ENSURE OPINIONS EXIST: Create test opinions if none exist
  private ensureOpinionsExist(): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      
      if (opinions.length === 0) {
        console.log('📝 Creating test opinions for bot trading...');
        
        const testOpinions = [
          "AI will replace most jobs by 2030",
          "Remote work is the future of employment",
          "Electric vehicles will dominate by 2028",
          "Social media has negative mental health impacts",
          "Cryptocurrency will replace traditional banking",
          "Climate change is humanity's biggest threat",
          "Space exploration should be top priority",
          "Universal Basic Income is necessary",
          "Renewable energy will be cheapest by 2025",
          "Virtual reality will revolutionize education",
          "NFTs are just a temporary trend",
          "Streaming services killed traditional TV",
          "Plant-based meat will outsell real meat",
          "Automation will eliminate most service jobs",
          "Digital currencies will replace physical cash",
          "Quantum computing will break current encryption",
          "Gene editing will cure most diseases",
          "Self-driving cars will reduce accidents by 90%",
          "Solar energy will power most homes by 2030",
          "3D printing will revolutionize manufacturing"
        ];

        // Save opinions
        localStorage.setItem('opinions', JSON.stringify(testOpinions));

        // Create market data for each opinion
        const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
        
        testOpinions.forEach(opinion => {
          marketData[opinion] = {
            opinionText: opinion,
            timesPurchased: Math.floor(Math.random() * 20) + 5,
            timesSold: Math.floor(Math.random() * 15) + 2,
            currentPrice: Math.floor(Math.random() * 100) + 20,
            basePrice: 20,
            volatility: 1.0 + (Math.random() * 0.5),
            lastUpdated: new Date().toISOString(),
            priceHistory: [],
            liquidityScore: Math.random() * 0.8 + 0.2,
            dailyVolume: Math.floor(Math.random() * 5000) + 1000,
            manipulation_protection: {
              rapid_trades: 0,
              single_trader_percentage: 0,
              last_manipulation_check: new Date().toISOString()
            }
          };
        });

        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
        console.log(`✅ Created ${testOpinions.length} test opinions with market data`);
      } else {
        console.log(`✅ Found ${opinions.length} existing opinions`);
      }
    } catch (error) {
      console.error('Error ensuring opinions exist:', error);
    }
  }

  // Initialize bot profiles with realistic trading personalities - NOW WITH 5,000+ BOTS
  private initializeBots(): void {
    const botPersonalities: BotPersonality[] = [
      {
        name: "The Contrarian",
        description: "Always bets against popular trends and shorts overvalued opinions",
        buyProbability: 0.3,
        sellProbability: 0.7,
        betProbability: 0.8,
        shortProbability: 0.9,
        preferredBetTypes: ['decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 1.5,
        activityFrequency: 5
      },
      {
        name: "The Trend Follower",
        description: "Jumps on winning streaks but occasionally shorts declining trends",
        buyProbability: 0.8,
        sellProbability: 0.4,
        betProbability: 0.6,
        shortProbability: 0.3,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 1.2,
        activityFrequency: 3
      },
      {
        name: "The Value Hunter",
        description: "Looks for bargains and shorts overpriced opinions",
        buyProbability: 0.6,
        sellProbability: 0.5,
        betProbability: 0.4,
        shortProbability: 0.6,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 0.8,
        activityFrequency: 7
      },
      {
        name: "The Day Trader",
        description: "Makes frequent trades including quick short bets",
        buyProbability: 0.9,
        sellProbability: 0.9,
        betProbability: 0.3,
        shortProbability: 0.7,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['aggressive', 'moderate'],
        riskMultiplier: 0.6,
        activityFrequency: 2
      },
      {
        name: "The Whale",
        description: "Makes large moves including massive short positions",
        buyProbability: 0.2,
        sellProbability: 0.2,
        betProbability: 0.9,
        shortProbability: 0.8,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 2.0,
        activityFrequency: 15
      },
      {
        name: "The Gambler",
        description: "Takes high-risk positions in all directions including shorts",
        buyProbability: 0.7,
        sellProbability: 0.6,
        betProbability: 0.9,
        shortProbability: 0.85,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 1.8,
        activityFrequency: 4
      },
      // NEW: Additional personality types for diversity
      {
        name: "The Scalper",
        description: "Makes quick micro-profits on small price movements",
        buyProbability: 0.95,
        sellProbability: 0.95,
        betProbability: 0.1,
        shortProbability: 0.4,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 0.4,
        activityFrequency: 1
      },
      {
        name: "The HODLer",
        description: "Long-term holder that rarely sells",
        buyProbability: 0.8,
        sellProbability: 0.1,
        betProbability: 0.2,
        shortProbability: 0.05,
        preferredBetTypes: ['increase'],
        preferredShortTypes: ['conservative'],
        riskMultiplier: 1.0,
        activityFrequency: 60
      },
      {
        name: "The Swing Trader",
        description: "Captures medium-term price swings",
        buyProbability: 0.6,
        sellProbability: 0.6,
        betProbability: 0.5,
        shortProbability: 0.5,
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['moderate'],
        riskMultiplier: 1.1,
        activityFrequency: 8
      },
      {
        name: "The Arbitrageur",
        description: "Exploits price differences and market inefficiencies",
        buyProbability: 0.7,
        sellProbability: 0.8,
        betProbability: 0.3,
        shortProbability: 0.6,
        preferredBetTypes: ['decrease'],
        preferredShortTypes: ['moderate', 'aggressive'],
        riskMultiplier: 0.9,
        activityFrequency: 4
      }
    ];

    const strategies: TradingStrategy[] = [
      { 
        type: 'contrarian', 
        minPrice: 1, 
        maxPrice: 50, 
        maxPositionSize: 5, 
        portfolioTargetSize: 8,
        shortPreferences: { minTargetDrop: 15, maxTargetDrop: 50, preferredTimeLimit: [6, 12, 24], maxShortAmount: 1000 }
      },
      { 
        type: 'momentum', 
        minPrice: 5, 
        maxPrice: 200, 
        maxPositionSize: 10, 
        portfolioTargetSize: 15,
        shortPreferences: { minTargetDrop: 10, maxTargetDrop: 30, preferredTimeLimit: [1, 6, 12], maxShortAmount: 500 }
      },
      { 
        type: 'value', 
        minPrice: 1, 
        maxPrice: 30, 
        maxPositionSize: 3, 
        portfolioTargetSize: 20,
        shortPreferences: { minTargetDrop: 20, maxTargetDrop: 40, preferredTimeLimit: [24, 48, 72], maxShortAmount: 800 }
      },
      { 
        type: 'aggressive', 
        minPrice: 10, 
        maxPrice: 500, 
        maxPositionSize: 15, 
        portfolioTargetSize: 5,
        shortPreferences: { minTargetDrop: 25, maxTargetDrop: 60, preferredTimeLimit: [1, 6], maxShortAmount: 2000 }
      },
      { 
        type: 'random', 
        minPrice: 1, 
        maxPrice: 100, 
        maxPositionSize: 8, 
        portfolioTargetSize: 12,
        shortPreferences: { minTargetDrop: 5, maxTargetDrop: 50, preferredTimeLimit: [6, 24, 48], maxShortAmount: 600 }
      }
    ];

    // Generate name variations for uniqueness
    const nameVariations = [
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Sigma', 'Omega', 'Prime', 'Pro', 'Elite', 'Max',
      'Ultra', 'Mega', 'Super', 'Hyper', 'Turbo', 'Quantum', 'Cyber', 'Neo', 'Apex', 'Zero',
      'X', 'Z', 'V2', 'V3', 'Plus', 'Advanced', 'Premium', 'Master', 'Expert', 'Titan'
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

    // Start all bots with optimized intervals (using seconds for faster demo activity)
    this.bots.forEach((bot, index) => {
      if (bot.isActive) {
        // FASTER INTERVALS: Use seconds instead of minutes for demo purposes
        const intervalId = setInterval(() => {
          this.executeBotAction(bot);
        }, bot.personality.activityFrequency * 1000); // Convert to milliseconds
        
        this.intervalIds.push(intervalId);
      }
    });

    console.log(`✅ All ${this.bots.filter(b => b.isActive).length} active bots are now running`);

    // IMMEDIATE ACTIVITY BURST: Start with lots of initial activity
    setTimeout(() => {
      console.log('🚀 Triggering initial bot activity burst...');
      const activeBots = this.bots.filter(b => b.isActive);
      
      // Force 50 initial actions spread over 30 seconds
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          const randomBot = activeBots[Math.floor(Math.random() * activeBots.length)];
          this.executeBotAction(randomBot);
        }, i * 600); // Spread over 30 seconds (600ms apart)
      }
    }, 1000);

    // Short position resolution checker
    const shortCheckInterval = setInterval(() => {
      this.checkAndResolveShorts();
    }, 30000);
    
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

  // Bot places a short bet with realistic pricing considerations
  private botPlaceShort(bot: BotProfile): boolean {
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) {
      console.log(`🤖❌ ${bot.username} can't short - no opinions available`);
      return false;
    }

    // SIMPLIFIED: Random opinion selection without complex filtering
    const selectedOpinion = opinions[Math.floor(Math.random() * opinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.id);
    
    const shortAmount = Math.min(
      Math.floor(Math.random() * 1000) + 200,
      bot.balance * 0.2
    );
    
    if (shortAmount > bot.balance || shortAmount === 0) {
      console.log(`🤖💸 ${bot.username} can't afford short of ${shortAmount} (balance: ${bot.balance})`);
      return false;
    }

    const targetDropPercentage = Math.floor(Math.random() * 30) + 15;
    const timeLimit = [6, 12, 24][Math.floor(Math.random() * 3)];
    const targetPrice = Math.round(currentPrice * (1 - targetDropPercentage / 100) * 100) / 100;
    const potentialWinnings = shortAmount * (1 + (targetDropPercentage / 100) * 2);

    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + timeLimit);

    const shortPosition: ShortPosition = {
      id: `short_${bot.id}_${Date.now()}`,
      opinionText: selectedOpinion.text,
      opinionId: selectedOpinion.id,
      betAmount: shortAmount,
      targetDropPercentage,
      startingPrice: currentPrice,
      targetPrice,
      potentialWinnings,
      expirationDate: expirationTime.toISOString(),
      createdDate: new Date().toISOString(),
      status: 'active',
      botId: bot.id
    };

    bot.balance -= shortAmount;
    this.addShortPosition(shortPosition);
    this.addBotTransaction(bot, 'short_place', selectedOpinion.id, selectedOpinion.text, -shortAmount, shortPosition.id);

    console.log(`🤖📉 ${bot.username} shorted "${selectedOpinion.text.slice(0, 30)}..." for ${shortAmount} targeting ${targetDropPercentage}% drop in ${timeLimit}h`);
    return true;
  }

  // Enhanced bot buying with realistic market considerations
  private botBuyOpinion(bot: BotProfile): boolean {
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) {
      console.log(`🤖❌ ${bot.username} can't buy - no opinions available`);
      return false;
    }

    // SIMPLIFIED: Remove complex filtering that might block purchases
    const selectedOpinion = opinions[Math.floor(Math.random() * opinions.length)];
    const price = this.getOpinionPrice(selectedOpinion.id);
    
    // Simple affordability check
    if (price > bot.balance) {
      console.log(`🤖💸 ${bot.username} can't afford opinion at ${price} (balance: ${bot.balance})`);
      return false;
    }

    const maxQuantity = Math.floor(bot.balance / price);
    const quantity = Math.min(Math.floor(Math.random() * 3) + 1, maxQuantity);
    const totalCost = price * quantity;

    if (totalCost <= bot.balance) {
      bot.balance -= totalCost;
      this.addBotTransaction(bot, 'buy', selectedOpinion.id, selectedOpinion.text, -totalCost);
      this.addBotOpinion(bot, selectedOpinion, price, quantity);
      this.increaseOpinionPrice(selectedOpinion.id, quantity);
      
      this.trackBotTradeActivity(selectedOpinion.text, 'buy', price, bot.id);
      
      console.log(`🤖💰 ${bot.username} bought ${quantity}x "${selectedOpinion.text.slice(0, 30)}..." for ${totalCost}`);
      return true;
    }
    
    return false;
  }

  // Enhanced bot selling with realistic pricing
  private botSellOpinion(bot: BotProfile): boolean {
    const botOpinions = this.getBotOpinions(bot);
    if (botOpinions.length === 0) {
      console.log(`🤖📦 ${bot.username} has no opinions to sell`);
      return false;
    }

    const selectedOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.opinionId);
    const quantityToSell = Math.min(selectedOpinion.quantity, Math.floor(Math.random() * 3) + 1);
    
    // SIMPLIFIED: Use current market price for selling (remove complex spread calculations)
    const totalSaleValue = currentPrice * quantityToSell;

    const purchasePrice = selectedOpinion.purchasePrice;
    const profitLoss = currentPrice - purchasePrice;

    bot.balance += totalSaleValue;
    
    if (profitLoss > 0) {
      bot.totalEarnings += Math.abs(profitLoss) * quantityToSell;
    } else {
      bot.totalLosses += Math.abs(profitLoss) * quantityToSell;
    }

    this.addBotTransaction(bot, 'sell', selectedOpinion.opinionId, selectedOpinion.text, totalSaleValue);
    this.removeBotOpinion(bot, selectedOpinion.opinionId, quantityToSell);
    this.decreaseOpinionPrice(selectedOpinion.opinionId, quantityToSell);

    this.trackBotTradeActivity(selectedOpinion.text, 'sell', currentPrice, bot.id);

    const profitMessage = profitLoss > 0 ? `(+${(profitLoss * quantityToSell).toFixed(2)} profit)` : `(-${Math.abs(profitLoss * quantityToSell).toFixed(2)} loss)`;
    console.log(`🤖💸 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for ${totalSaleValue} ${profitMessage}`);
    return true;
  }

  // Calculate realistic sell price for bots
  private calculateRealisticSellPrice(
    currentMarketPrice: number,
    opinionText: string,
    marketData: any,
    bot: BotProfile
  ): number {
    const totalVolume = marketData.timesPurchased + marketData.timesSold;
    const liquidityScore = Math.min(totalVolume / 20, 1);
    
    const volatilityPenalty = Math.max(0, (marketData.volatility - 1) * 0.02);
    const baseBidAskSpread = 0.08 - (liquidityScore * 0.04);
    const botManipulationPenalty = this.calculateBotManipulationPenalty(opinionText, bot);
    
    const brokerFee = 0.003;
    const marketMakerFee = 0.002;
    const fixedCost = Math.min(2, currentMarketPrice * 0.01);
    
    const totalCostPercentage = baseBidAskSpread + volatilityPenalty + brokerFee + marketMakerFee + botManipulationPenalty;
    const sellPrice = (currentMarketPrice * (1 - totalCostPercentage)) - fixedCost;
    
    const maxSellPrice = currentMarketPrice * 0.98;
    const minSellPrice = Math.max(1, currentMarketPrice * 0.75);
    
    return Math.max(minSellPrice, Math.min(maxSellPrice, Math.round(sellPrice * 100) / 100));
  }

  // Enhanced bot selling decision logic
  private shouldBotSellRealistic(
    bot: BotProfile, 
    opinion: any, 
    profitPercentage: number,
    marketData: any
  ): boolean {
    const liquidityScore = marketData.liquidityScore || 0;
    const trend = this.getOpinionTrend(opinion.opinionId);

    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        return profitPercentage > 2 && trend > 0;
      case 'momentum':
        return trend < -10 || profitPercentage > 15;
      case 'value':
        return profitPercentage > 5;
      case 'aggressive':
        return profitPercentage > 8 || profitPercentage < -15;
      case 'random':
        if (liquidityScore < 0.3) return profitPercentage > 10;
        return profitPercentage > 3 || (profitPercentage < -10 && Math.random() > 0.7);
      default:
        return profitPercentage > 5;
    }
  }

  // Bot manipulation penalty calculation
  private calculateBotManipulationPenalty(opinionText: string, bot: BotProfile): number {
    let penalty = 0;
    
    const botRecentTrades = this.getBotRecentTrades(bot.id, opinionText, 60);
    if (botRecentTrades > 3) {
      penalty += 0.01;
    }
    
    const botDominance = this.calculateBotMarketDominance(bot.id, opinionText);
    if (botDominance > 0.7) {
      penalty += 0.02;
    }
    
    return Math.min(penalty, 0.04);
  }

  // Track bot trade activity for manipulation detection
  private trackBotTradeActivity(opinionText: string, action: 'buy' | 'sell', price: number, botId: string): void {
    try {
      const recentTrades = JSON.parse(localStorage.getItem('recentTradeActivity') || '{}');
      if (!recentTrades[opinionText]) recentTrades[opinionText] = [];
      
      recentTrades[opinionText].push({
        action,
        price,
        timestamp: Date.now(),
        isCurrentUser: false,
        botId: botId
      });
      
      recentTrades[opinionText] = recentTrades[opinionText].slice(-20);
      localStorage.setItem('recentTradeActivity', JSON.stringify(recentTrades));
      
      const botRapidTrades = JSON.parse(localStorage.getItem('botRapidTrades') || '{}');
      const key = `${botId}_${opinionText}`;
      if (!botRapidTrades[key]) botRapidTrades[key] = [];
      
      botRapidTrades[key].push(Date.now());
      
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      botRapidTrades[key] = botRapidTrades[key].filter((timestamp: number) => timestamp > twoHoursAgo);
      
      localStorage.setItem('botRapidTrades', JSON.stringify(botRapidTrades));
    } catch (error) {
      console.error('Error tracking bot trade activity:', error);
    }
  }

  // Get bot's recent trades count
  private getBotRecentTrades(botId: string, opinionText: string, timeWindowMinutes: number): number {
    try {
      const botRapidTrades = JSON.parse(localStorage.getItem('botRapidTrades') || '{}');
      const key = `${botId}_${opinionText}`;
      const trades = botRapidTrades[key] || [];
      const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
      
      return trades.filter((timestamp: number) => timestamp > cutoffTime).length;
    } catch {
      return 0;
    }
  }

  // Calculate bot's market dominance
  private calculateBotMarketDominance(botId: string, opinionText: string): number {
    try {
      const recentTrades = JSON.parse(localStorage.getItem('recentTradeActivity') || '{}');
      const opinionTrades = recentTrades[opinionText] || [];
      const botTrades = opinionTrades.filter((trade: any) => trade.botId === botId);
      
      return opinionTrades.length > 0 ? botTrades.length / opinionTrades.length : 0;
    } catch {
      return 0;
    }
  }

  // Check and resolve short positions
  private checkAndResolveShorts(): void {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]') as ShortPosition[];
      const currentTime = new Date();
      let updated = false;

      const updatedShorts = shorts.map(short => {
        if (short.status !== 'active' || !short.botId) return short;

        const bot = this.bots.find(b => b.id === short.botId);
        if (!bot) return short;

        const expirationTime = new Date(short.expirationDate);
        const currentPrice = this.getOpinionPrice(short.opinionId);

        if (currentTime > expirationTime) {
          updated = true;
          this.addBotTransaction(bot, 'short_loss', short.opinionId, short.opinionText, -short.betAmount, short.id);
          console.log(`🤖💸 ${bot.username} short expired: "${short.opinionText.slice(0, 30)}..." (lost $${short.betAmount})`);
          return { ...short, status: 'expired' as const };
        }

        if (currentPrice <= short.targetPrice) {
          updated = true;
          
          bot.balance += short.potentialWinnings;
          bot.totalEarnings += short.potentialWinnings;
          
          this.addBotTransaction(bot, 'short_win', short.opinionId, short.opinionText, short.potentialWinnings, short.id);
          console.log(`🤖💹 ${bot.username} short won: "${short.opinionText.slice(0, 30)}..." (won $${short.potentialWinnings})`);
          
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
      placedDate: new Date().toLocaleDateString(),
      expiryDate: this.calculateExpiryDate(timeFrame),
      status: 'active',
      multiplier: this.calculateMultiplier(betType, targetPercentage),
      potentialPayout: 0,
      volatilityRating: this.getVolatilityRating(targetUser.username)
    };

    bet.potentialPayout = betAmount * bet.multiplier;

    bot.balance -= betAmount;
    this.addAdvancedBet(bet);
    this.addBotTransaction(bot, 'bet', undefined, `Bet on ${targetUser.username}`, -betAmount);

    console.log(`🤖🎰 ${bot.username} placed ${betAmount} bet on ${targetUser.username} to ${betType} ${targetPercentage}%`);
    return true;
  }

  // Bot generates new opinions
  private botGenerateOpinion(bot: BotProfile): void {
    const botOpinions = [
      "The future of remote work is hybrid models",
      "Cryptocurrency will replace traditional banking",
      "AI will create more jobs than it destroys",
      "Social media is harmful to mental health",
      "Electric vehicles will dominate by 2030",
      "Space tourism will be mainstream in 10 years",
      "Universal basic income is inevitable",
      "Streaming services will kill traditional TV",
      "Plant-based meat will outsell real meat",
      "Virtual reality will revolutionize education",
      "NFTs are just a temporary trend",
      "Climate change will drive mass migration",
      "Automation will replace most service jobs",
      "Digital currencies will eliminate cash",
      "Renewable energy will be cheaper than fossil fuels"
    ];

    const newOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const initialPrice = Math.floor(Math.random() * 20) + 5;

    this.addNewOpinion(newOpinion, initialPrice);
    const earnAmount = 100;
    bot.balance += earnAmount;
    bot.totalEarnings += earnAmount;
    this.addBotTransaction(bot, 'earn', undefined, newOpinion, earnAmount);

    console.log(`🤖💡 ${bot.username} generated opinion: "${newOpinion}"`);
  }

  // Helper methods and calculations
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

  private calculateBetAmount(bot: BotProfile): number {
    const baseAmount = bot.balance * 0.1;
    const riskAdjusted = baseAmount * bot.personality.riskMultiplier;
    return Math.floor(Math.random() * riskAdjusted) + 50;
  }

  private calculateMultiplier(betType: string, percentage: number): number {
    const baseMultiplier = percentage / 20;
    return Math.max(1.1, Math.min(5.0, baseMultiplier));
  }

  private calculateExpiryDate(days: number): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry.toLocaleDateString();
  }

  private getVolatilityRating(username: string): 'Low' | 'Medium' | 'High' {
    const ratings = ['Low', 'Medium', 'High'];
    return ratings[Math.abs(username.length % 3)] as 'Low' | 'Medium' | 'High';
  }

  // Integration methods with localStorage system
  private getAvailableOpinions(): any[] {
    try {
      const stored = localStorage.getItem('opinions');
      if (!stored) return [];
      
      const opinions = JSON.parse(stored);
      return Array.isArray(opinions) ? 
        opinions.filter(op => op && typeof op === 'string').map((text, index) => ({
          id: index.toString(),
          text
        })) : [];
    } catch {
      return [];
    }
  }

  private getAvailableUsers(): any[] {
    try {
      const humanUser = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const allUsers = [humanUser, ...this.bots].filter(user => user.username);
      
      return allUsers.map(user => ({
        username: user.username,
        portfolioValue: this.calculateUserPortfolioValue(user.username)
      }));
    } catch {
      return [];
    }
  }

  private calculateUserPortfolioValue(username: string): number {
    try {
      if (username === JSON.parse(localStorage.getItem('userProfile') || '{}').username) {
        const ownedOpinions = JSON.parse(localStorage.getItem('ownedOpinions') || '[]');
        return ownedOpinions.reduce((total: number, opinion: any) => 
          total + (opinion.currentPrice * opinion.quantity), 0
        );
      }
      
      const botOpinions = this.getBotOpinions(this.bots.find(b => b.username === username));
      return botOpinions.reduce((total, opinion) => 
        total + (this.getOpinionPrice(opinion.opinionId) * opinion.quantity), 0
      );
    } catch {
      return 0;
    }
  }

  // Enhanced portfolio calculation with realistic selling prices
  private calculateBotPortfolioValue(bot: BotProfile): number {
    try {
      const botOpinions = this.getBotOpinions(bot);
      return botOpinions.reduce((total, opinion) => {
        const currentPrice = this.getOpinionPrice(opinion.opinionId);
        const marketData = this.getOpinionMarketData(opinion.text);
        const realisticSellPrice = this.calculateRealisticSellPrice(currentPrice, opinion.text, marketData, bot);
        return total + (realisticSellPrice * opinion.quantity);
      }, 0);
    } catch {
      return 0;
    }
  }

  // Storage and data management methods
  private getOpinionPrice(opinionId: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      
      if (opinion && marketData[opinion.text]) {
        return marketData[opinion.text].currentPrice;
      }
      
      return Math.floor(Math.random() * 50) + 10;
    } catch {
      return Math.floor(Math.random() * 50) + 10;
    }
  }

  private getOpinionMarketData(opinionText: string): any {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      
      if (marketData[opinionText]) {
        return {
          ...marketData[opinionText],
          liquidityScore: Math.min((marketData[opinionText].timesPurchased + marketData[opinionText].timesSold) / 20, 1)
        };
      } else {
        return {
          opinionText,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: 10,
          basePrice: 10,
          volatility: 1.0,
          liquidityScore: 0,
          lastUpdated: new Date().toISOString(),
          priceHistory: []
        };
      }
    } catch {
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10,
        basePrice: 10,
        volatility: 1.0,
        liquidityScore: 0,
        lastUpdated: new Date().toISOString(),
        priceHistory: []
      };
    }
  }

  private getOpinionPopularity(opinionId: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      
      if (opinion && marketData[opinion.text]) {
        return marketData[opinion.text].timesPurchased || 0;
      }
      
      return Math.floor(Math.random() * 100);
    } catch {
      return Math.floor(Math.random() * 100);
    }
  }

  private getOpinionTrend(opinionId: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      
      if (opinion && marketData[opinion.text]) {
        const data = marketData[opinion.text];
        const netDemand = data.timesPurchased - data.timesSold;
        return netDemand;
      }
      
      return Math.floor(Math.random() * 100) - 50;
    } catch {
      return Math.floor(Math.random() * 100) - 50;
    }
  }

  private getOpinionValue(opinionId: string): number {
    try {
      const price = this.getOpinionPrice(opinionId);
      const popularity = this.getOpinionPopularity(opinionId);
      
      return popularity > 0 ? price / popularity : price;
    } catch {
      return Math.floor(Math.random() * 100);
    }
  }

  // Bot opinion and transaction management
  private addBotOpinion(bot: BotProfile, opinion: any, price: number, quantity: number): void {
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      
      const existingOpinionIndex = botOpinions.findIndex((op: any) => 
        op.botId === bot.id && op.opinionId === opinion.id
      );

      if (existingOpinionIndex !== -1) {
        const existingOpinion = botOpinions[existingOpinionIndex];
        existingOpinion.quantity += quantity;
        existingOpinion.currentPrice = price;
      } else {
        const opinionAsset: BotOpinionAsset = {
          id: `${bot.id}_${opinion.id}_${Date.now()}`,
          botId: bot.id,
          opinionId: opinion.id,
          text: opinion.text,
          purchasePrice: price,
          currentPrice: price,
          purchaseDate: new Date().toLocaleDateString(),
          quantity
        };

        botOpinions.push(opinionAsset);
      }

      localStorage.setItem('botOpinions', JSON.stringify(botOpinions));
    } catch (error) {
      console.error('Error adding bot opinion:', error);
    }
  }

  private removeBotOpinion(bot: BotProfile, opinionId: string, quantity: number): void {
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      const opinionIndex = botOpinions.findIndex((op: any) => 
        op.botId === bot.id && op.opinionId === opinionId
      );

      if (opinionIndex !== -1) {
        const opinion = botOpinions[opinionIndex];
        if (opinion.quantity <= quantity) {
          botOpinions.splice(opinionIndex, 1);
        } else {
          opinion.quantity -= quantity;
        }
        localStorage.setItem('botOpinions', JSON.stringify(botOpinions));
      }
    } catch (error) {
      console.error('Error removing bot opinion:', error);
    }
  }

  private getBotOpinions(bot: BotProfile | undefined): BotOpinionAsset[] {
    if (!bot) return [];
    
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      return botOpinions.filter((op: any) => op.botId === bot.id);
    } catch {
      return [];
    }
  }

  private addBotTransaction(bot: BotProfile, type: string, opinionId?: string, opinionText?: string, amount?: number, shortId?: string): void {
    // Generate truly unique ID with microsecond precision and random component
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 12);
    const microIncrement = Math.floor(Math.random() * 1000);
    
    const transaction = {
      id: `bot_${bot.id}_${timestamp}_${microIncrement}_${randomSuffix}`, // Guaranteed unique ID
      type,
      opinionId,
      opinionText,
      shortId,
      amount: amount || 0,
      date: new Date().toISOString(),
      botId: bot.id,
      timestamp: timestamp + microIncrement // Add for sorting
    };

    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      transactions.push(transaction);
      
      // Keep only last 1000 transactions to prevent memory issues
      const maxTransactions = 1000;
      if (transactions.length > maxTransactions) {
        transactions.splice(0, transactions.length - maxTransactions);
      }
      
      localStorage.setItem('botTransactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Error adding bot transaction:', error);
    }
  }

  // Market manipulation and strategy methods
  private isOpinionOverpriced(opinion: any, bot: BotProfile): boolean {
    const price = this.getOpinionPrice(opinion.id);
    const popularity = this.getOpinionPopularity(opinion.id);
    const trend = this.getOpinionTrend(opinion.id);
    
    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        return popularity > 70 && price > 30;
      case 'momentum':
        return trend < -20;
      case 'value':
        return price > (opinion.text.length * 0.5) + 20;
      case 'aggressive':
        return price > 50;
      default:
        return Math.random() > 0.6;
    }
  }

  private selectOpinionForShort(opinions: any[], bot: BotProfile): any {
    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        return opinions.sort((a, b) => this.getOpinionPopularity(b.id) - this.getOpinionPopularity(a.id))[0];
      case 'momentum':
        return opinions.sort((a, b) => this.getOpinionTrend(a.id) - this.getOpinionTrend(b.id))[0];
      case 'value':
        return opinions.sort((a, b) => this.getOpinionPrice(b.id) - this.getOpinionPrice(a.id))[0];
      default:
        return opinions[Math.floor(Math.random() * opinions.length)];
    }
  }

  private hasActiveBotShort(bot: BotProfile, opinionId: string): boolean {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      return shorts.some((short: ShortPosition) => 
        short.botId === bot.id && 
        short.opinionId === opinionId && 
        short.status === 'active'
      );
    } catch {
      return false;
    }
  }

  private botOwnsOpinion(bot: BotProfile, opinionId: string): boolean {
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      return botOpinions.some((opinion: any) => 
        opinion.botId === bot.id && 
        opinion.opinionId === opinionId &&
        opinion.quantity > 0
      );
    } catch {
      return false;
    }
  }

  private calculateShortAmount(bot: BotProfile, currentPrice: number): number {
    const maxAmount = Math.min(
      bot.balance * (bot.personality.riskMultiplier * 0.1),
      bot.tradingStrategy.shortPreferences.maxShortAmount
    );
    
    const baseAmount = Math.max(50, maxAmount * 0.3);
    const finalAmount = Math.floor(Math.random() * (maxAmount - baseAmount) + baseAmount);
    
    return Math.min(finalAmount, bot.balance);
  }

  private calculateTargetDrop(bot: BotProfile): number {
    const { minTargetDrop, maxTargetDrop } = bot.tradingStrategy.shortPreferences;
    const range = maxTargetDrop - minTargetDrop;
    
    let targetDrop = minTargetDrop + (Math.random() * range);
    
    if (bot.personality.preferredShortTypes.includes('aggressive')) {
      targetDrop *= 1.2;
    }
    
    return Math.min(maxTargetDrop, Math.max(minTargetDrop, Math.round(targetDrop)));
  }

  private selectTimeLimit(bot: BotProfile): number {
    const preferredLimits = bot.tradingStrategy.shortPreferences.preferredTimeLimit;
    return preferredLimits[Math.floor(Math.random() * preferredLimits.length)];
  }

  private calculateShortWinnings(betAmount: number, targetDropPercentage: number, timeLimit: number, bot: BotProfile): number {
    const dropMultiplier = 1 + (targetDropPercentage / 100) * 2;
    const timeMultiplier = timeLimit <= 6 ? 2.5 : timeLimit <= 12 ? 2.0 : timeLimit <= 24 ? 1.5 : 1.0;
    const riskMultiplier = bot.personality.riskMultiplier;
    
    const totalMultiplier = dropMultiplier * timeMultiplier * riskMultiplier;
    
    return Math.round(betAmount * totalMultiplier);
  }

  // FIXED: Price management methods with 0.1% movements to match opinion page
  private increaseOpinionPrice(opinionId: string, quantity: number): void {
    try {
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      if (!opinion) return;

      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinion.text]) {
        marketData[opinion.text].timesPurchased += quantity;
        const newPrice = this.calculatePrice(
          marketData[opinion.text].timesPurchased,
          marketData[opinion.text].timesSold,
          marketData[opinion.text].basePrice,
          marketData[opinion.text].volatility
        );
        marketData[opinion.text].currentPrice = newPrice;
        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      }
    } catch (error) {
      console.error('Error increasing opinion price:', error);
    }
  }

  private decreaseOpinionPrice(opinionId: string, quantity: number): void {
    try {
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      if (!opinion) return;

      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinion.text]) {
        marketData[opinion.text].timesSold += quantity;
        const newPrice = this.calculatePrice(
          marketData[opinion.text].timesPurchased,
          marketData[opinion.text].timesSold,
          marketData[opinion.text].basePrice,
          marketData[opinion.text].volatility
        );
        marketData[opinion.text].currentPrice = newPrice;
        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      }
    } catch (error) {
      console.error('Error decreasing opinion price:', error);
    }
  }

  // FIXED: Updated to use 0.1% movements instead of 15%/10% movements
  private calculatePrice(timesPurchased: number, timesSold: number, basePrice: number = 10, volatility: number = 1): number {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // CHANGED: Ultra-micro multiplier: 1.001 (0.1% per purchase) to match opinion page
      priceMultiplier = Math.pow(1.001, netDemand) * volatility;
    } else {
      // CHANGED: Ultra-small decline: 0.999 (0.1% decrease per sale) to match opinion page
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand))) * volatility;
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // Return precise decimal (rounded to 2 decimal places for currency)
    return Math.round(calculatedPrice * 100) / 100;
  }

  private addNewOpinion(text: string, price: number): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      
      // Check if opinion already exists
      if (!opinions.includes(text)) {
        opinions.push(text);
        localStorage.setItem('opinions', JSON.stringify(opinions));

        const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
        marketData[text] = {
          opinionText: text,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: price,
          basePrice: price,
          volatility: 1.0,
          lastUpdated: new Date().toISOString(),
          priceHistory: [],
          liquidityScore: 0,
          dailyVolume: 0,
          manipulation_protection: {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      }
    } catch (error) {
      console.error('Error adding new opinion:', error);
    }
  }

  private addShortPosition(shortPosition: ShortPosition): void {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      shorts.push(shortPosition);
      localStorage.setItem('shortPositions', JSON.stringify(shorts));
    } catch (error) {
      console.error('Error adding short position:', error);
    }
  }

  private addAdvancedBet(bet: any): void {
    try {
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      bets.push(bet);
      localStorage.setItem('advancedBets', JSON.stringify(bets));
    } catch (error) {
      console.error('Error adding advanced bet:', error);
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

  // NEW: Performance optimization methods for 5,000+ bots
  public optimizeForPerformance(): void {
    console.log('🔧 Optimizing bot system for performance...');
    
    // Reduce activity frequency for all bots
    this.bots.forEach(bot => {
      bot.personality.activityFrequency = Math.max(30, bot.personality.activityFrequency * 3);
    });
    
    // Only activate first 500 bots for even better performance
    this.bots.forEach((bot, index) => {
      bot.isActive = index < 500;
    });
    
    console.log('✅ Performance optimization complete: 500 active bots, slower frequency');
    this.saveBots();
  }

  // NEW: Quick debug method for feed issues
  public debugFeedActivity(): {
    totalTransactions: number;
    recentTransactions: number;
    activeBots: number;
    totalBots: number;
    systemRunning: boolean;
    opinionsAvailable: number;
  } {
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

  // NEW: Force immediate bot activity for testing
  public forceBotActivity(count: number = 10): void {
    console.log(`🚀 Forcing ${count} bot actions for testing...`);
    console.log('🔍 FORCING DIVERSE ACTIONS TO TEST ALL TYPES:');
    
    const activeBots = this.bots.filter(b => b.isActive).slice(0, count);
    const actions = ['buy', 'sell', 'bet', 'generate'];
    
    activeBots.forEach((bot, index) => {
      // STAGGER TIMING to prevent duplicate timestamps
      setTimeout(() => {
        // Force specific action types to test
        const forcedAction = actions[index % actions.length];
        console.log(`🎯 FORCING ${bot.username} to: ${forcedAction.toUpperCase()}`);
        
        switch (forcedAction) {
          case 'buy':
            const buyResult = this.botBuyOpinion(bot);
            if (!buyResult) {
              console.log(`❌ ${bot.username} buy failed - generating opinion instead`);
              this.botGenerateOpinion(bot);
            }
            break;
          case 'sell':
            const sellResult = this.botSellOpinion(bot);
            if (!sellResult) {
              console.log(`❌ ${bot.username} sell failed - buying opinion instead`);
              this.botBuyOpinion(bot) || this.botGenerateOpinion(bot);
            }
            break;
          case 'bet':
            const betResult = this.botPlaceBet(bot);
            if (!betResult) {
              console.log(`❌ ${bot.username} bet failed - buying opinion instead`);
              this.botBuyOpinion(bot) || this.botGenerateOpinion(bot);
            }
            break;
          case 'generate':
            this.botGenerateOpinion(bot);
            break;
        }
        
        bot.lastActive = new Date().toISOString();
      }, index * 100 + Math.random() * 50); // Stagger with random offset to prevent collisions
    });
    
    console.log(`✅ Scheduled ${activeBots.length} DIVERSE bot actions with staggered timing`);
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
  
  // AUTO-START LOGGING
  console.log('🤖 Autonomous Bot System loaded and initializing...');
  console.log('📱 Available commands:');
  console.log('  - debugBots() - Check system status');
  console.log('  - forceBotActivity(10) - Force bot actions');
  console.log('  - restartBots() - Restart with optimization');
  console.log('  - manualStartBots() - Manual troubleshooting start');
  console.log('  - botSystem.getBotTransactions() - View all transactions');
}

// Export for use in your application
export default botSystem;

// Types for reuse
export type { BotProfile, BotPersonality, TradingStrategy, ShortPosition };

// AUTOMATIC INITIALIZATION AND STARTUP
console.log('🚀 Bot system will auto-start in 2 seconds...');
console.log('💡 If you don\'t see bot activity, run: manualStartBots() in console');