// autonomous-bots.ts
// FIXED: Bot System with EXACT 0.1% Price Movements (NO volatility multiplier)

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
  priceHistory: { price: number; timestamp: string; action: 'buy' | 'sell' | 'init' | 'create' | 'update' }[];
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
    console.log('🤖 Auto-initializing bot system with UI-friendly settings...');
    
    // Check if opinions exist, if not create them
    this.ensureOpinionsExist();
    
    // OPTIMIZE FOR UI: Reduce bot count and frequency before starting
    this.optimizeForPerformance();
    
    // Start the bot system with reduced load
    this.startBots();
    
    console.log('✅ Bot system auto-initialized with UI-optimized settings!');
    console.log('📊 Active: 50 bots, Intervals: 60-300 seconds, UI-friendly');
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

        // Create market data for each opinion with EXACT price consistency
        const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
        
        testOpinions.forEach(opinion => {
          const volatility = this.calculateVolatility(opinion);
          const basePrice = 10; // All start at $10
          const purchases = Math.floor(Math.random() * 20) + 5;
          const sales = Math.floor(Math.random() * 15) + 2;
          const currentPrice = this.calculatePrice(purchases, sales, basePrice);
          
          marketData[opinion] = {
            opinionText: opinion,
            timesPurchased: purchases,
            timesSold: sales,
            currentPrice: currentPrice,
            basePrice: basePrice,
            volatility: volatility,
            lastUpdated: new Date().toISOString(),
            priceHistory: [
              { price: basePrice, timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'create' },
              { price: currentPrice, timestamp: new Date().toISOString(), action: 'update' }
            ],
            liquidityScore: Math.min((purchases + sales) / 20, 1),
            dailyVolume: purchases + sales,
            manipulation_protection: {
              rapid_trades: 0,
              single_trader_percentage: 0,
              last_manipulation_check: new Date().toISOString()
            }
          };
        });

        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
        console.log(`✅ Created ${testOpinions.length} test opinions with CONSISTENT market data`);
      } else {
        console.log(`✅ Found ${opinions.length} existing opinions`);
      }
    } catch (error) {
      console.error('Error ensuring opinions exist:', error);
    }
  }

  // Initialize bot profiles with realistic trading personalities - NOW WITH 1,000 BOTS
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

  // CRITICAL FIX: Price calculation method that EXACTLY matches opinion page (0.1% movements, NO volatility)
  private calculatePrice(timesPurchased: number, timesSold: number, basePrice: number = 10): number {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // EXACT MATCH: Ultra-micro multiplier: 1.001 (0.1% per purchase) - NO volatility multiplier
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      // EXACT MATCH: Ultra-small decline: 0.999 (0.1% decrease per sale) - NO volatility multiplier
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // EXACT MATCH: Return precise decimal (rounded to 2 decimal places for currency)
    return Math.round(calculatedPrice * 100) / 100;
  }

  // FIXED: Centralized market data update that ensures 0.1% price movements
  private updateOpinionMarketData(opinionText: string, action: 'buy' | 'sell', quantity: number = 1): OpinionMarketData {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const currentData = this.getOpinionMarketData(opinionText);
      
      // CRITICAL: Update purchase/sale counts by exact quantity
      const newTimesPurchased = action === 'buy' ? currentData.timesPurchased + quantity : currentData.timesPurchased;
      const newTimesSold = action === 'sell' ? currentData.timesSold + quantity : currentData.timesSold;
      
      // CRITICAL: Calculate new price using EXACT same method as opinion page (0.1% per purchase, NO volatility)
      const newPrice = this.calculatePrice(newTimesPurchased, newTimesSold, currentData.basePrice);
      
      // DEBUG: Log price changes to verify 0.1% movements
      const priceChange = newPrice - currentData.currentPrice;
      const percentChange = currentData.currentPrice > 0 ? (priceChange / currentData.currentPrice * 100) : 0;
      
      console.log(`💰 PRICE UPDATE: "${opinionText.slice(0, 30)}..." ${action} ${quantity}x`);
      console.log(`   📊 $${currentData.currentPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(3)}%)`);
      console.log(`   📈 Purchases: ${currentData.timesPurchased} → ${newTimesPurchased} | Sales: ${currentData.timesSold} → ${newTimesSold}`);
      
      // Verify this is ~0.1% change for single purchases
      if (quantity === 1 && action === 'buy') {
        const expectedChange = 0.1;
        if (Math.abs(percentChange - expectedChange) > 0.05) {
          console.warn(`⚠️ Price change ${percentChange.toFixed(3)}% doesn't match expected 0.1%!`);
        } else {
          console.log(`✅ Price change ${percentChange.toFixed(3)}% matches expected ~0.1%`);
        }
      }
      
      // Update market data with new values
      const updatedData: OpinionMarketData = {
        ...currentData,
        timesPurchased: newTimesPurchased,
        timesSold: newTimesSold,
        currentPrice: newPrice,
        lastUpdated: new Date().toISOString(),
        priceHistory: [
          ...(currentData.priceHistory || []).slice(-19), // Keep last 19 entries
          { price: newPrice, timestamp: new Date().toISOString(), action }
        ]
      };
      
      // Save to localStorage
      marketData[opinionText] = updatedData;
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      
      // Track this trade for manipulation detection
      this.trackBotTradeActivity(opinionText, action, newPrice, 'system');
      
      return updatedData;
    } catch (error) {
      console.error('Error updating opinion market data:', error);
      return this.getOpinionMarketData(opinionText);
    }
  }

  // FIXED: Get current price with fallback to calculated price
  private getOpinionPrice(opinionId: string): number {
    try {
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      
      if (!opinion) {
        console.warn(`Opinion with ID ${opinionId} not found`);
        return 10; // Base price fallback
      }
      
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      
      if (marketData[opinion.text]) {
        return marketData[opinion.text].currentPrice;
      } else {
        // Initialize market data if it doesn't exist
        const basePrice = 10;
        const volatility = this.calculateVolatility(opinion.text);
        const initialPrice = this.calculatePrice(0, 0, basePrice);
        
        // Create initial market data
        marketData[opinion.text] = {
          opinionText: opinion.text,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: initialPrice,
          basePrice: basePrice,
          volatility: volatility,
          lastUpdated: new Date().toISOString(),
          priceHistory: [{ price: initialPrice, timestamp: new Date().toISOString(), action: 'init' }],
          liquidityScore: 0,
          dailyVolume: 0,
          manipulation_protection: {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
        
        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
        console.log(`📈 Initialized market data for "${opinion.text}" at $${initialPrice}`);
        
        return initialPrice;
      }
    } catch (error) {
      console.error('Error getting opinion price:', error);
      return 10; // Safe fallback
    }
  }

  // FIXED: Enhanced market data getter with proper initialization
  private getOpinionMarketData(opinionText: string): OpinionMarketData {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      
      if (marketData[opinionText]) {
        const data = marketData[opinionText];
        return {
          ...data,
          liquidityScore: Math.min((data.timesPurchased + data.timesSold) / 20, 1),
          dailyVolume: this.calculateDailyVolume(opinionText),
          manipulation_protection: data.manipulation_protection || {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
      } else {
        // Initialize new market data
        const basePrice = 10;
        const volatility = this.calculateVolatility(opinionText);
        const initialPrice = this.calculatePrice(0, 0, basePrice);
        
        const newData: OpinionMarketData = {
          opinionText,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: initialPrice,
          basePrice,
          volatility,
          lastUpdated: new Date().toISOString(),
          priceHistory: [{ price: initialPrice, timestamp: new Date().toISOString(), action: 'init' }],
          liquidityScore: 0,
          dailyVolume: 0,
          manipulation_protection: {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
        
        // Save the new data
        const allMarketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
        allMarketData[opinionText] = newData;
        localStorage.setItem('opinionMarketData', JSON.stringify(allMarketData));
        
        return newData;
      }
    } catch (error) {
      console.error('Error getting opinion market data:', error);
      // Return safe fallback
      return {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10,
        basePrice: 10,
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
    }
  }

  // FIXED: Bot buying with proper 0.1% price updates and ACCURATE transaction recording
  private botBuyOpinion(bot: BotProfile): boolean {
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
      
      // CRITICAL: Update market data with EXACT quantity for precise 0.1% per share price calculation
      const updatedMarketData = this.updateOpinionMarketData(selectedOpinion.text, 'buy', quantity);
      
      // Add to bot's portfolio
      this.addBotOpinion(bot, selectedOpinion, purchasePricePerShare, quantity);
      
      // CRITICAL FIX: Record transaction with ACCURATE price information
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

  // FIXED: Bot selling with proper 0.1% price updates
  private botSellOpinion(bot: BotProfile): boolean {
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

    // CRITICAL: Update market data with EXACT quantity for precise 0.1% per share price calculation
    const updatedMarketData = this.updateOpinionMarketData(selectedOpinion.text, 'sell', quantityToSell);

    // Remove from bot's portfolio
    this.removeBotOpinion(bot, selectedOpinion.opinionId, quantityToSell);
    
    // Record transaction
    this.addBotTransaction(bot, 'sell', selectedOpinion.opinionId, selectedOpinion.text, totalSaleValue);

    const profitMessage = profitLoss > 0 ? `(+$${(profitLoss * quantityToSell).toFixed(2)} profit)` : `(-$${Math.abs(profitLoss * quantityToSell).toFixed(2)} loss)`;
    console.log(`🤖💸 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for $${totalSaleValue.toFixed(2)} ${profitMessage} (market: $${currentPrice} → $${updatedMarketData.currentPrice})`);
    return true;
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
          console.log(`🤖💸 ${bot.username} short expired: "${short.opinionText.slice(0, 30)}..." (lost ${short.betAmount})`);
          return { ...short, status: 'expired' as const };
        }

        if (currentPrice <= short.targetPrice) {
          updated = true;
          
          bot.balance += short.potentialWinnings;
          bot.totalEarnings += short.potentialWinnings;
          
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

  // FIXED: Bot generates opinions WITHOUT earning money (trading-only profits)
  private botGenerateOpinion(bot: BotProfile): void {
    // 70% chance to use curated high-quality opinions, 30% chance to generate new ones
    const useTemplate = Math.random() < 0.3;
    
    let newOpinion: string;
    let category: string;

    if (useTemplate) {
      // TEMPLATE-BASED GENERATION for infinite variety
      newOpinion = this.generateTemplateOpinion();
      category = 'generated';
    } else {
      // CURATED HIGH-QUALITY opinions for guaranteed engagement
      const curatedOpinions = this.getCuratedOpinions();
      const categories = Object.keys(curatedOpinions);
      category = categories[Math.floor(Math.random() * categories.length)];
      const categoryOpinions = curatedOpinions[category as keyof typeof curatedOpinions];
      newOpinion = categoryOpinions[Math.floor(Math.random() * categoryOpinions.length)];
    }

    // FIXED: Enhanced opinion creation with proper market data initialization
    this.addNewOpinion(newOpinion, 10); // Always start at $10
    
    // NO EARNINGS FOR GENERATING - Bots only make money through trading!
    // Record the generation without any monetary reward
    this.addBotTransaction(bot, 'earn', undefined, newOpinion, 0); // $0 for generation

    console.log(`🤖💡 ${bot.username} generated ${category} opinion: "${newOpinion}" (no earnings - trading only)`);
    
    // OPTIONAL: After generating, bot might immediately buy their own opinion (25% chance)
    if (Math.random() < 0.25) {
      console.log(`🤖📈 ${bot.username} is interested in their own opinion - attempting to buy...`);
      setTimeout(() => {
        // Find the opinion they just created
        const opinions = this.getAvailableOpinions();
        const theirOpinion = opinions.find(op => op.text === newOpinion);
        if (theirOpinion) {
          const price = this.getOpinionPrice(theirOpinion.id);
          if (price <= bot.balance) {
            this.botBuySpecificOpinion(bot, theirOpinion);
          }
        }
      }, 1000); // Buy 1 second after generating
    }
  }

  // FIXED: Enhanced opinion creation with proper market data initialization and proper event dispatch
  private addNewOpinion(text: string, price: number = 10): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      
      // Check if opinion already exists
      if (!opinions.includes(text)) {
        opinions.push(text);
        localStorage.setItem('opinions', JSON.stringify(opinions));

        // CRITICAL FIX: Dispatch events to update Sidebar immediately
        if (typeof window !== 'undefined') {
          // Dispatch storage event for cross-tab updates
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'opinions',
            newValue: JSON.stringify(opinions),
            oldValue: JSON.stringify(opinions.slice(0, -1)),
            url: window.location.href,
            storageArea: localStorage
          }));
          
          // Dispatch custom event for same-tab updates
          window.dispatchEvent(new CustomEvent('botActivityUpdate', { 
            detail: { type: 'newOpinion', text, price, timestamp: Date.now() } 
          }));
          
          console.log('🚀 Dispatched events for new opinion: storage + botActivityUpdate');
        }

        // FIXED: Initialize market data with proper structure and volatility
        const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
        const volatility = this.calculateVolatility(text);
        const basePrice = 10; // Always start at $10
        const initialPrice = this.calculatePrice(0, 0, basePrice); // Should be $10.00
        
        marketData[text] = {
          opinionText: text,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: initialPrice,
          basePrice: basePrice,
          volatility: volatility,
          lastUpdated: new Date().toISOString(),
          priceHistory: [{ price: initialPrice, timestamp: new Date().toISOString(), action: 'create' }],
          liquidityScore: 0,
          dailyVolume: 0,
          manipulation_protection: {
            rapid_trades: 0,
            single_trader_percentage: 0,
            last_manipulation_check: new Date().toISOString()
          }
        };
        localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
        
        console.log(`✅ Added new opinion: "${text}" at ${initialPrice} (volatility: ${volatility.toFixed(2)})`);
      }
    } catch (error) {
      console.error('Error adding new opinion:', error);
    }
  }

  // NEW: Bot buys a specific opinion (for buying their own generated opinions)
  private botBuySpecificOpinion(bot: BotProfile, targetOpinion: any): boolean {
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
      
      // FIXED: Update market data with proper 0.1% price calculation
      const updatedMarketData = this.updateOpinionMarketData(targetOpinion.text, 'buy', quantity);
      
      this.addBotTransaction(bot, 'buy', targetOpinion.id, targetOpinion.text, -totalCost);
      this.addBotOpinion(bot, targetOpinion, price, quantity);
      
      console.log(`🤖💰 ${bot.username} bought ${quantity}x their own opinion "${targetOpinion.text.slice(0, 30)}..." for ${totalCost} (price: ${price} → ${updatedMarketData.currentPrice})`);
      return true;
    }
    
    return false;
  }

  // NEW: Calculate volatility based on content (same as opinion page)
  private calculateVolatility(opinionText: string): number {
    const text = opinionText.toLowerCase();
    let volatility = 1.0;
    
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('stock')) volatility += 0.5;
    if (text.includes('controversial') || text.includes('hot take') || text.includes('unpopular')) volatility += 0.3;
    if (text.includes('prediction') || text.includes('will') || text.includes('future')) volatility += 0.2;
    if (text.includes('politics') || text.includes('election')) volatility += 0.4;
    
    if (text.includes('safe') || text.includes('boring') || text.includes('obvious')) volatility -= 0.2;
    if (text.includes('traditional') || text.includes('conservative')) volatility -= 0.1;
    
    return Math.max(0.5, Math.min(2.0, volatility));
  }

  // Calculate daily trading volume
  private calculateDailyVolume(opinionText: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const data = marketData[opinionText];
      
      if (!data || !data.priceHistory) return 0;
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentTrades = data.priceHistory.filter((trade: any) => 
        new Date(trade.timestamp).getTime() > oneDayAgo
      );
      
      return recentTrades.length;
    } catch {
      return 0;
    }
  }

  // INFINITE VARIETY: Template-based opinion generation
  private generateTemplateOpinion(): string {
    const templates = [
      // Technology predictions
      "{technology} will {action} {target} by {year}",
      "{technology} will make {industry} {outcome} within {timeframe}",
      "The future of {field} depends on {technology}",
      "{technology} will {change} how we {activity}",
      
      // Economic/social predictions
      "{concept} will become {status} by {year}",
      "{industry} will be {outcome} due to {cause}",
      "Most {group} will {action} {target} by {year}",
      "{trend} is the {superlative} {change} in {field}",
      
      // Impact predictions
      "{cause} will {effect} {target} {timeframe}",
      "The rise of {technology} means {outcome}",
      "{field} will never be the same after {innovation}",
      "By {year}, {prediction} will be {status}",
      
      // Comparative predictions
      "{newThing} will be more {quality} than {oldThing}",
      "{technology} will replace {traditional} completely",
      "People will prefer {newWay} over {oldWay}",
      "{innovation} will outperform {traditional} by {metric}",

      // Controversial predictions
      "{technology} will be {banned/regulated} due to {concern}",
      "{activity} will become {illegal/mandatory} for {reason}",
      "Society will {reject/embrace} {concept} because of {factor}",
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

  // CURATED HIGH-QUALITY opinions for guaranteed engagement
  private getCuratedOpinions() {
    return {
      technology: [
        "AI will replace most creative jobs by 2028",
        "Quantum computing will break all current encryption by 2027",
        "Brain-computer interfaces will be mainstream by 2030",
        "Deepfakes will destroy trust in video evidence",
        "Neural networks will develop consciousness within 10 years",
        "5G will cause significant health problems",
        "Smart contact lenses will replace smartphones",
        "Digital twins will predict most system failures",
        "Swarm robotics will reshape manufacturing",
        "Photonic computing will replace silicon chips"
      ],
      economy: [
        "Universal Basic Income will be implemented globally by 2030",
        "Cryptocurrency will replace traditional banking completely",
        "The 4-day work week will become standard worldwide",
        "Gig economy workers will outnumber traditional employees",
        "Automation will create more jobs than it destroys",
        "Digital nomadism will become the dominant lifestyle",
        "Algorithmic trading will cause market instability",
        "Social credit systems will spread globally",
        "Space mining will crash precious metal prices",
        "Basic goods will become free due to automation"
      ],
      environment: [
        "Climate change will be reversed by 2040 through technology",
        "Lab-grown meat will completely replace animal agriculture",
        "Vertical farming will feed most of the world's population",
        "Fusion power will make energy essentially free",
        "Weather modification will become routine by 2030",
        "Genetically modified trees will absorb 10x more CO2",
        "Solar paint will make every surface an energy generator",
        "Floating cities will house climate refugees",
        "Bioengineered coral will restore dead reefs",
        "Space-based solar power will solve energy crisis"
      ],
      social: [
        "Social media will be regulated like tobacco companies",
        "Virtual reality will cause widespread social isolation",
        "Cancel culture will be replaced by restorative justice",
        "Influencer marketing will be classified as gambling",
        "Metaverse relationships will be as common as real ones",
        "Digital wellness will become a human right",
        "Social media addiction will be treated like substance abuse",
        "Digital citizenship will require formal education",
        "Virtual reality dating will become the norm",
        "Parasocial relationships will replace real friendships"
      ],
      health: [
        "Gene therapy will cure most cancers by 2030",
        "Brain uploading will achieve digital immortality",
        "3D printed organs will eliminate transplant waiting lists",
        "Longevity escape velocity will be reached by 2035",
        "Precision nutrition will be tailored to individual genetics",
        "Robotic caregivers will assist most elderly people",
        "Psychedelic therapy will treat most mental illnesses",
        "Neural stimulation will cure depression permanently",
        "Artificial wombs will revolutionize pregnancy",
        "Preventive medicine will make most hospitals obsolete"
      ],
      culture: [
        "NFTs will become the primary way artists monetize work",
        "AI-generated content will dominate entertainment",
        "Traditional sports will be overshadowed by esports",
        "Virtual concerts will replace live music performances",
        "Literature will be written collaboratively by AI and humans",
        "Digital fashion will become more valuable than physical",
        "Virtual tourism will reduce physical travel",
        "Interactive storytelling will replace passive entertainment",
        "Community-created content will surpass professional media",
        "Algorithmic curation will shape all cultural consumption"
      ]
    };
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
        const realisticSellPrice = Math.round(currentPrice * 0.95 * 100) / 100; // 95% like opinion page
        return total + (realisticSellPrice * opinion.quantity);
      }, 0);
    } catch {
      return 0;
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

  // ENHANCED: Bot transaction recording with comprehensive fixes
  private addBotTransaction(bot: BotProfile, type: string, opinionId?: string, opinionText?: string, amount?: number, shortId?: string, metadata?: any): void {
    // Generate truly unique ID with microsecond precision and better randomness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 12);
    const microIncrement = Math.floor(Math.random() * 1000);
    const sequenceId = Math.floor(Math.random() * 10000);
    
    // Ensure absolutely unique ID
    const uniqueId = `bot_${bot.id}_${timestamp}_${microIncrement}_${sequenceId}_${randomSuffix}`;

    // Create standardized transaction with all required fields
    const transaction = {
      id: uniqueId,
      type: type,
      opinionId: opinionId || null,
      opinionText: opinionText || null,
      shortId: shortId || null,
      amount: amount || 0,
      date: new Date().toISOString(), // Always use ISO format
      botId: bot.id,
      botUsername: bot.username, // Add bot username for easier processing
      timestamp: timestamp + microIncrement, // Unique timestamp for sorting
      metadata: metadata || {}, // Always include metadata object
      processed: false, // Flag to track if this has been processed by feed
      feedReady: true // Flag to indicate this is ready for feed display
    };

    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      
      // Check for duplicates before adding (extra safety)
      const isDuplicate = transactions.some((t: any) => 
        t.id === transaction.id || 
        (t.botId === bot.id && 
         t.type === type && 
         t.amount === amount && 
         Math.abs(new Date(t.date).getTime() - timestamp) < 100)
      );
      
      if (isDuplicate) {
        console.warn(`⚠️ Prevented duplicate transaction for ${bot.username}: ${type} ${amount}`);
        return;
      }
      
      transactions.push(transaction);
      
      // Keep only last 2000 transactions to prevent memory issues
      const maxTransactions = 2000;
      if (transactions.length > maxTransactions) {
        const removedCount = transactions.length - maxTransactions;
        transactions.splice(0, removedCount);
        console.log(`🗑️ Removed ${removedCount} old bot transactions to maintain performance`);
      }
      
      localStorage.setItem('botTransactions', JSON.stringify(transactions));
      
      // Dispatch event to notify feed of new transaction
      if (typeof window !== 'undefined') {
        // Dispatch custom event for immediate feed updates
        window.dispatchEvent(new CustomEvent('botTransactionAdded', { 
          detail: { 
            transaction: transaction,
            botUsername: bot.username,
            type: type,
            amount: amount,
            timestamp: Date.now()
          } 
        }));
        
        // Also dispatch storage event for cross-tab updates
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'botTransactions',
          newValue: JSON.stringify(transactions),
          oldValue: JSON.stringify(transactions.slice(0, -1)),
          url: window.location.href,
          storageArea: localStorage
        }));
      }
      
      // Log successful transaction for debugging
      console.log(`💾 Recorded bot transaction: ${bot.username} - ${type} - ${amount} (ID: ${uniqueId.slice(-8)})`);
      
    } catch (error) {
      console.error(`❌ Error recording bot transaction for ${bot.username}:`, error);
      
      // Fallback: try to save just this transaction
      try {
        const fallbackTransactions = [transaction];
        localStorage.setItem('botTransactions_fallback', JSON.stringify(fallbackTransactions));
        console.log(`🚨 Saved transaction to fallback storage: ${bot.username} - ${type}`);
      } catch (fallbackError) {
        console.error(`❌ Fallback transaction save failed:`, fallbackError);
      }
    }
  }

  // Enhanced method to fix any existing transaction issues
  public fixBotTransactions(): void {
    console.log('🔧 FIXING BOT TRANSACTIONS...');
    
    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      const fixedTransactions: any[] = [];
      let fixedCount = 0;
      let removedCount = 0;
      
      const botMap = this.getBots().reduce((map, bot) => {
        map[bot.id] = bot.username;
        return map;
      }, {} as Record<string, string>);
      
      transactions.forEach((transaction: any, index: number) => {
        // Skip completely invalid transactions
        if (!transaction || typeof transaction !== 'object') {
          removedCount++;
          return;
        }
        
        let needsFix = false;
        const fixedTransaction = { ...transaction };
        
        // Fix missing or invalid ID
        if (!fixedTransaction.id || typeof fixedTransaction.id !== 'string') {
          fixedTransaction.id = `fixed_${fixedTransaction.botId || 'unknown'}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
          needsFix = true;
        }
        
        // Fix missing bot username
        if (!fixedTransaction.botUsername && fixedTransaction.botId && botMap[fixedTransaction.botId]) {
          fixedTransaction.botUsername = botMap[fixedTransaction.botId];
          needsFix = true;
        }
        
        // Fix missing or invalid timestamp
        if (!fixedTransaction.timestamp || typeof fixedTransaction.timestamp !== 'number') {
          if (fixedTransaction.date) {
            try {
              fixedTransaction.timestamp = new Date(fixedTransaction.date).getTime();
            } catch {
              fixedTransaction.timestamp = Date.now() - (transactions.length - index) * 1000;
            }
          } else {
            fixedTransaction.timestamp = Date.now() - (transactions.length - index) * 1000;
          }
          needsFix = true;
        }
        
        // Fix missing or invalid date (ensure ISO format)
        if (!fixedTransaction.date || typeof fixedTransaction.date !== 'string') {
          fixedTransaction.date = new Date(fixedTransaction.timestamp || Date.now()).toISOString();
          needsFix = true;
        } else {
          // Ensure date is in ISO format
          try {
            const parsedDate = new Date(fixedTransaction.date);
            if (isNaN(parsedDate.getTime())) {
              fixedTransaction.date = new Date().toISOString();
              needsFix = true;
            } else {
              fixedTransaction.date = parsedDate.toISOString();
            }
          } catch {
            fixedTransaction.date = new Date().toISOString();
            needsFix = true;
          }
        }
        
        // Fix missing metadata
        if (!fixedTransaction.metadata || typeof fixedTransaction.metadata !== 'object') {
          fixedTransaction.metadata = {};
          needsFix = true;
        }
        
        // Add feed flags
        if (fixedTransaction.feedReady === undefined) {
          fixedTransaction.feedReady = true;
          needsFix = true;
        }
        
        if (fixedTransaction.processed === undefined) {
          fixedTransaction.processed = false;
          needsFix = true;
        }
        
        // Fix amount to be a number
        if (typeof fixedTransaction.amount !== 'number') {
          fixedTransaction.amount = parseFloat(fixedTransaction.amount) || 0;
          needsFix = true;
        }
        
        if (needsFix) {
          fixedCount++;
        }
        
        fixedTransactions.push(fixedTransaction);
      });
      
      // Remove duplicates
      const uniqueTransactions = fixedTransactions.filter((transaction, index, self) => {
        return index === self.findIndex(t => t.id === transaction.id);
      });
      
      const duplicatesRemoved = fixedTransactions.length - uniqueTransactions.length;
      
      // Sort by timestamp
      uniqueTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Save fixed transactions
      localStorage.setItem('botTransactions', JSON.stringify(uniqueTransactions));
      
      console.log(`✅ BOT TRANSACTIONS FIXED:`);
      console.log(`   📊 Total processed: ${transactions.length}`);
      console.log(`   🔧 Fixed: ${fixedCount}`);
      console.log(`   🗑️ Removed invalid: ${removedCount}`);
      console.log(`   🔗 Removed duplicates: ${duplicatesRemoved}`);
      console.log(`   📈 Final count: ${uniqueTransactions.length}`);
      
      // Dispatch event to update feed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('botTransactionsFixed', { 
          detail: { 
            count: uniqueTransactions.length,
            fixed: fixedCount,
            removed: removedCount + duplicatesRemoved
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
    console.log('   4. Run: forceRefreshFeed()');
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

  // NEW: Price validation method to catch inconsistencies
  public validatePriceConsistency(): void {
    console.log('🔍 VALIDATING PRICE CONSISTENCY ACROSS SYSTEM:');
    console.log('================================================');
    
    const opinions = this.getAvailableOpinions();
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    
    let inconsistencies = 0;
    
    opinions.forEach(opinion => {
      const data = marketData[opinion.text];
      if (data) {
        const expectedPrice = this.calculatePrice(data.timesPurchased, data.timesSold, data.basePrice);
        const actualPrice = data.currentPrice;
        const difference = Math.abs(expectedPrice - actualPrice);
        
        if (difference > 0.01) { // More than 1 cent difference
          console.log(`❌ INCONSISTENCY: "${opinion.text.slice(0, 40)}..."`);
          console.log(`   Expected: ${expectedPrice} | Actual: ${actualPrice} | Diff: ${difference.toFixed(4)}`);
          console.log(`   Purchases: ${data.timesPurchased} | Sales: ${data.timesSold} | Net: ${data.timesPurchased - data.timesSold}`);
          inconsistencies++;
          
          // Auto-fix the inconsistency
          data.currentPrice = expectedPrice;
          console.log(`   🔧 FIXED: Updated to ${expectedPrice}`);
        } else {
          console.log(`✅ CONSISTENT: "${opinion.text.slice(0, 40)}..." - ${actualPrice}`);
        }
      }
    });
    
    if (inconsistencies > 0) {
      console.log(`🔧 Fixed ${inconsistencies} price inconsistencies`);
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
    } else {
      console.log(`✅ All ${opinions.length} opinions have consistent pricing`);
    }
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
    console.log(`🚀 Forcing ${count} bot actions for UI testing...`);
    console.log('🔍 FORCING DIVERSE ACTIONS WITH UI-FRIENDLY TIMING:');
    
    const activeBots = this.bots.filter(b => b.isActive).slice(0, count);
    const actions = ['buy', 'sell', 'bet', 'generate'];
    
    activeBots.forEach((bot, index) => {
      // MUCH SLOWER STAGGERING: 5 seconds apart so UI can keep up
      setTimeout(() => {
        // Force specific action types to test
        const forcedAction = actions[index % actions.length];
        console.log(`🎯 FORCING ${bot.username} to: ${forcedAction.toUpperCase()}`);
        
        let actionSucceeded = false;
        
        switch (forcedAction) {
          case 'buy':
            actionSucceeded = this.botBuyOpinion(bot);
            if (!actionSucceeded) {
              console.log(`❌ ${bot.username} buy failed - generating opinion instead`);
              this.botGenerateOpinion(bot);
              actionSucceeded = true;
            }
            break;
          case 'sell':
            actionSucceeded = this.botSellOpinion(bot);
            if (!actionSucceeded) {
              console.log(`❌ ${bot.username} sell failed - buying opinion instead`);
              actionSucceeded = this.botBuyOpinion(bot);
            }
            break;
          case 'bet':
            actionSucceeded = this.botPlaceBet(bot);
            if (!actionSucceeded) {
              console.log(`❌ ${bot.username} bet failed - buying opinion instead`);
              actionSucceeded = this.botBuyOpinion(bot);
            }
            break;
          case 'generate':
            this.botGenerateOpinion(bot);
            actionSucceeded = true;
            break;
        }
        
        bot.lastActive = new Date().toISOString();
      }, index * 5000); // 5 seconds apart for UI stability
    });
    
    console.log(`✅ Scheduled ${activeBots.length} DIVERSE bot actions with 5-second intervals for UI stability`);
  }

  // NEW: Debug method specifically for opinion creation and pricing issues
  public debugOpinionCreation(): void {
    console.log('🔍 DEBUGGING OPINION CREATION AND PRICING:');
    console.log('==========================================');
    
    const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
    
    console.log(`📊 Total opinions: ${opinions.length}`);
    console.log(`📊 Market data entries: ${Object.keys(marketData).length}`);
    console.log(`📊 Bot transactions: ${botTransactions.length}`);
    
    // Check last 5 opinions for pricing issues
    const recentOpinions = opinions.slice(-5);
    console.log('\n📋 RECENT OPINIONS ANALYSIS:');
    
    recentOpinions.forEach((opinionText: string, index: number) => {
      const actualIndex = opinions.indexOf(opinionText);
      const data = marketData[opinionText];
      
      console.log(`\n--- Opinion ${actualIndex}: "${opinionText.slice(0, 40)}..." ---`);
      
      if (data) {
        console.log(`💰 Current Price: ${data.currentPrice} (Base: ${data.basePrice})`);
        console.log(`📈 Purchases: ${data.timesPurchased} | Sales: ${data.timesSold}`);
        console.log(`📊 Net Demand: ${data.timesPurchased - data.timesSold}`);
        console.log(`🔄 Volatility: ${data.volatility}`);
        console.log(`⏰ Last Updated: ${data.lastUpdated}`);
        
        // Check if price should be $10
        const expectedPrice = this.calculatePrice(data.timesPurchased, data.timesSold, data.basePrice);
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
    const testPrice = this.calculatePrice(0, 0, 10);
    console.log(`📊 New opinion with 0 purchases, 0 sales should be: ${testPrice}`);
    
    if (testPrice !== 10) {
      console.log(`❌ ERROR: New opinions should start at exactly $10.00!`);
    } else {
      console.log(`✅ New opinion pricing is correct: $10.00`);
    }
  }

  // NEW: Test price calculation method
  public testPriceCalculation(): void {
    console.log('🧪 TESTING PRICE CALCULATION (Bot System):');
    console.log('==========================================');
    
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
  
  // AUTO-START LOGGING
  console.log('🤖 FIXED Bot System loaded - 0.1% price movements + $10 starting prices + NO VOLATILITY MULTIPLIER!');
  console.log('📱 Available commands:');
  console.log('  - debugBots() - Check system status');
  console.log('  - forceBotActivity(10) - Force bot actions');
  console.log('  - forceOpinionGeneration(5) - Force opinion generation specifically');
  console.log('  - restartBots() - Restart with optimization');
  console.log('  - manualStartBots() - Manual troubleshooting start');
  console.log('  - validatePrices() - Check price consistency');
  console.log('  - testPriceCalc() - Test 0.1% price calculation');
  console.log('  - debugOpinionCreation() - Debug opinion creation and pricing issues');
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
console.log('🚀 FIXED Bot system will auto-start in 2 seconds...');
console.log('💡 Price movements are now EXACTLY 0.1% per purchase/sale');
console.log('💡 NO MORE VOLATILITY MULTIPLIER - all opinions behave consistently');
console.log('💡 If you don\'t see bot activity, run: manualStartBots() in console');