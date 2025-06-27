// autonomous-bots.ts
// Autonomous Bot System for Opinion Trading Platform with Short Betting

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
  shortProbability: number; // 0-1 (NEW: probability of placing short bets)
  preferredBetTypes: ('increase' | 'decrease')[];
  preferredShortTypes: ('aggressive' | 'moderate' | 'conservative')[]; // NEW: short betting styles
  riskMultiplier: number; // 0.5-2.0
  activityFrequency: number; // minutes between actions
}

interface TradingStrategy {
  type: 'contrarian' | 'momentum' | 'value' | 'random' | 'aggressive';
  minPrice: number;
  maxPrice: number;
  maxPositionSize: number;
  portfolioTargetSize: number;
  shortPreferences: { // NEW: short-specific preferences
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
  botId?: string; // NEW: to track which bot placed the short
}

interface OpinionAsset {
  id: string;
  text: string;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  quantity: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'earn' | 'bet' | 'short_place' | 'short_win' | 'short_loss';
  opinionId?: string;
  opinionText?: string;
  shortId?: string;
  amount: number;
  date: string;
}

class AutonomousBotSystem {
  private bots: BotProfile[] = [];
  private isRunning: boolean = false;
  private intervalIds: NodeJS.Timeout[] = [];

  constructor() {
    this.initializeBots();
  }

  // Initialize bot profiles with different personalities including short preferences
  private initializeBots(): void {
    const botPersonalities: BotPersonality[] = [
      {
        name: "The Contrarian",
        description: "Always bets against popular trends and shorts overvalued opinions",
        buyProbability: 0.3,
        sellProbability: 0.7,
        betProbability: 0.8,
        shortProbability: 0.9, // HIGH: loves shorting popular opinions
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
        shortProbability: 0.3, // LOW: prefers going long
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
        shortProbability: 0.6, // MODERATE: strategic shorter
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
        shortProbability: 0.7, // HIGH: loves quick short trades
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
        shortProbability: 0.8, // HIGH: big short positions
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
        shortProbability: 0.85, // VERY HIGH: loves risky shorts
        preferredBetTypes: ['increase', 'decrease'],
        preferredShortTypes: ['aggressive'],
        riskMultiplier: 1.8,
        activityFrequency: 4
      }
    ];

    // Create bots with different strategies including short preferences
    const strategies: TradingStrategy[] = [
      { 
        type: 'contrarian', 
        minPrice: 1, 
        maxPrice: 50, 
        maxPositionSize: 5, 
        portfolioTargetSize: 8,
        shortPreferences: {
          minTargetDrop: 15,
          maxTargetDrop: 50,
          preferredTimeLimit: [6, 12, 24],
          maxShortAmount: 1000
        }
      },
      { 
        type: 'momentum', 
        minPrice: 5, 
        maxPrice: 200, 
        maxPositionSize: 10, 
        portfolioTargetSize: 15,
        shortPreferences: {
          minTargetDrop: 10,
          maxTargetDrop: 30,
          preferredTimeLimit: [1, 6, 12],
          maxShortAmount: 500
        }
      },
      { 
        type: 'value', 
        minPrice: 1, 
        maxPrice: 30, 
        maxPositionSize: 3, 
        portfolioTargetSize: 20,
        shortPreferences: {
          minTargetDrop: 20,
          maxTargetDrop: 40,
          preferredTimeLimit: [24, 48, 72],
          maxShortAmount: 800
        }
      },
      { 
        type: 'aggressive', 
        minPrice: 10, 
        maxPrice: 500, 
        maxPositionSize: 15, 
        portfolioTargetSize: 5,
        shortPreferences: {
          minTargetDrop: 25,
          maxTargetDrop: 60,
          preferredTimeLimit: [1, 6],
          maxShortAmount: 2000
        }
      },
      { 
        type: 'random', 
        minPrice: 1, 
        maxPrice: 100, 
        maxPositionSize: 8, 
        portfolioTargetSize: 12,
        shortPreferences: {
          minTargetDrop: 5,
          maxTargetDrop: 50,
          preferredTimeLimit: [6, 24, 48],
          maxShortAmount: 600
        }
      },
      { 
        type: 'value', 
        minPrice: 5, 
        maxPrice: 75, 
        maxPositionSize: 6, 
        portfolioTargetSize: 18,
        shortPreferences: {
          minTargetDrop: 15,
          maxTargetDrop: 35,
          preferredTimeLimit: [12, 24, 48],
          maxShortAmount: 700
        }
      }
    ];

    this.bots = botPersonalities.map((personality, index) => ({
      id: `bot_${index + 1}`,
      username: `${personality.name.replace(/\s+/g, '')}Bot${Math.floor(Math.random() * 100)}`,
      balance: Math.floor(Math.random() * 50000) + 10000, // 10k-60k starting balance
      joinDate: this.getRandomPastDate(),
      totalEarnings: 0,
      totalLosses: 0,
      personality,
      riskTolerance: this.getRiskTolerance(personality.riskMultiplier),
      tradingStrategy: strategies[index],
      lastActive: new Date().toISOString(),
      isActive: true
    }));

    // Save bots to localStorage
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

  // Start the bot system
  public startBots(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🤖 Starting autonomous bot system with short betting...');

    // Start each bot with its own schedule
    this.bots.forEach(bot => {
      if (bot.isActive) {
        const intervalId = setInterval(() => {
          this.executeBotAction(bot);
        }, bot.personality.activityFrequency * 60 * 1000); // Convert minutes to milliseconds
        
        this.intervalIds.push(intervalId);
      }
    });

    // Also run immediate actions for quicker startup
    setTimeout(() => {
      this.bots.forEach(bot => {
        if (Math.random() < 0.3) { // 30% chance each bot acts immediately
          this.executeBotAction(bot);
        }
      });
    }, 2000);

    // Check and resolve short positions periodically
    const shortCheckInterval = setInterval(() => {
      this.checkAndResolveShorts();
    }, 30000); // Check every 30 seconds
    
    this.intervalIds.push(shortCheckInterval);
  }

  // Stop the bot system
  public stopBots(): void {
    this.isRunning = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    console.log('🛑 Stopped autonomous bot system');
  }

  // Execute a random action for a bot including short betting
  private executeBotAction(bot: BotProfile): void {
    try {
      const actions = ['buy', 'sell', 'bet', 'short', 'generate'];
      const actionWeights = [
        bot.personality.buyProbability,
        bot.personality.sellProbability,
        bot.personality.betProbability,
        bot.personality.shortProbability, // NEW: short probability
        0.1 // 10% chance to generate new opinion
      ];

      const selectedAction = this.weightedRandomChoice(actions, actionWeights);
      
      switch (selectedAction) {
        case 'buy':
          this.botBuyOpinion(bot);
          break;
        case 'sell':
          this.botSellOpinion(bot);
          break;
        case 'bet':
          this.botPlaceBet(bot);
          break;
        case 'short':
          this.botPlaceShort(bot); // NEW: short betting action
          break;
        case 'generate':
          this.botGenerateOpinion(bot);
          break;
      }

      // Update bot's last active time
      bot.lastActive = new Date().toISOString();
      this.saveBots();

    } catch (error) {
      console.error(`Error executing bot action for ${bot.username}:`, error);
    }
  }

  // NEW: Bot places a short bet on an opinion
  private botPlaceShort(bot: BotProfile): void {
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) return;

    // Filter opinions suitable for shorting based on bot strategy
    const shortableOpinions = opinions.filter(opinion => {
      const price = this.getOpinionPrice(opinion.id);
      const isOverpriced = this.isOpinionOverpriced(opinion, bot);
      const hasNoActiveShort = !this.hasActiveBotShort(bot, opinion.id);
      
      // NEW: Check if bot owns any shares of this opinion
      const botOwnsShares = this.botOwnsOpinion(bot, opinion.id);
      
      return price >= bot.tradingStrategy.minPrice && 
             price <= bot.tradingStrategy.maxPrice && 
             isOverpriced && 
             hasNoActiveShort &&
             !botOwnsShares; // NEW: Cannot short if bot owns shares
    });

    if (shortableOpinions.length === 0) return;

    const selectedOpinion = this.selectOpinionForShort(shortableOpinions, bot);
    const currentPrice = this.getOpinionPrice(selectedOpinion.id);
    
    // Calculate short parameters based on bot's strategy and personality
    const shortAmount = this.calculateShortAmount(bot, currentPrice);
    if (shortAmount > bot.balance || shortAmount === 0) return;

    const targetDropPercentage = this.calculateTargetDrop(bot);
    const timeLimit = this.selectTimeLimit(bot);
    const targetPrice = Math.round(currentPrice * (1 - targetDropPercentage / 100));
    const potentialWinnings = this.calculateShortWinnings(shortAmount, targetDropPercentage, timeLimit, bot);

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

    // Execute short bet
    bot.balance -= shortAmount;
    this.addShortPosition(shortPosition);
    this.addBotTransaction(bot, 'short_place', selectedOpinion.id, selectedOpinion.text, -shortAmount, shortPosition.id);

    console.log(`🤖📉 ${bot.username} shorted "${selectedOpinion.text.slice(0, 30)}..." for ${shortAmount} targeting ${targetDropPercentage}% drop in ${timeLimit}h`);
  }

  // Add new helper method to check if bot owns the opinion
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

  // Calculate short amount based on bot's risk tolerance and strategy
  private calculateShortAmount(bot: BotProfile, currentPrice: number): number {
    const maxAmount = Math.min(
      bot.balance * (bot.personality.riskMultiplier * 0.1), // 5-20% of balance based on risk
      bot.tradingStrategy.shortPreferences.maxShortAmount
    );
    
    const baseAmount = Math.max(50, maxAmount * 0.3); // Minimum $50, up to 30% of max
    const finalAmount = Math.floor(Math.random() * (maxAmount - baseAmount) + baseAmount);
    
    return Math.min(finalAmount, bot.balance);
  }

  // Calculate target drop percentage based on bot preferences
  private calculateTargetDrop(bot: BotProfile): number {
    const { minTargetDrop, maxTargetDrop } = bot.tradingStrategy.shortPreferences;
    const range = maxTargetDrop - minTargetDrop;
    
    // Adjust based on bot personality
    let targetDrop = minTargetDrop + (Math.random() * range);
    
    // Aggressive bots target higher drops
    if (bot.personality.preferredShortTypes.includes('aggressive')) {
      targetDrop *= 1.2;
    }
    
    return Math.min(maxTargetDrop, Math.max(minTargetDrop, Math.round(targetDrop)));
  }

  // Select time limit based on bot preferences
  private selectTimeLimit(bot: BotProfile): number {
    const preferredLimits = bot.tradingStrategy.shortPreferences.preferredTimeLimit;
    return preferredLimits[Math.floor(Math.random() * preferredLimits.length)];
  }

  // Calculate potential winnings for short bet
  private calculateShortWinnings(betAmount: number, targetDropPercentage: number, timeLimit: number, bot: BotProfile): number {
    // Base multiplier based on drop percentage
    const dropMultiplier = 1 + (targetDropPercentage / 100) * 2;
    
    // Time multiplier (shorter time = higher risk = higher reward)
    const timeMultiplier = timeLimit <= 6 ? 2.5 : timeLimit <= 12 ? 2.0 : timeLimit <= 24 ? 1.5 : 1.0;
    
    // Bot risk multiplier
    const riskMultiplier = bot.personality.riskMultiplier;
    
    const totalMultiplier = dropMultiplier * timeMultiplier * riskMultiplier;
    
    return Math.round(betAmount * totalMultiplier);
  }

  // Determine if an opinion is overpriced for shorting
  private isOpinionOverpriced(opinion: any, bot: BotProfile): boolean {
    const price = this.getOpinionPrice(opinion.id);
    const popularity = this.getOpinionPopularity(opinion.id);
    const trend = this.getOpinionTrend(opinion.id);
    
    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        // Short popular, expensive opinions
        return popularity > 70 && price > 30;
      
      case 'momentum':
        // Short opinions with negative trend
        return trend < -20;
      
      case 'value':
        // Short opinions that are overvalued
        return price > (opinion.text.length * 0.5) + 20; // Simple valuation
      
      case 'aggressive':
        // Short any high-priced opinion
        return price > 50;
      
      default:
        return Math.random() > 0.6; // 40% chance to consider overpriced
    }
  }

  // Select opinion for shorting based on strategy
  private selectOpinionForShort(opinions: any[], bot: BotProfile): any {
    switch (bot.tradingStrategy.type) {
      case 'contrarian':
        // Short most popular opinions
        return opinions.sort((a, b) => this.getOpinionPopularity(b.id) - this.getOpinionPopularity(a.id))[0];
      
      case 'momentum':
        // Short declining opinions
        return opinions.sort((a, b) => this.getOpinionTrend(a.id) - this.getOpinionTrend(b.id))[0];
      
      case 'value':
        // Short most overvalued opinions
        return opinions.sort((a, b) => this.getOpinionPrice(b.id) - this.getOpinionPrice(a.id))[0];
      
      default:
        return opinions[Math.floor(Math.random() * opinions.length)];
    }
  }

  // Check if bot already has an active short on this opinion
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

        // Check if expired
        if (currentTime > expirationTime) {
          updated = true;
          this.addBotTransaction(bot, 'short_loss', short.opinionId, short.opinionText, -short.betAmount, short.id);
          console.log(`🤖💸 ${bot.username} short expired: "${short.opinionText.slice(0, 30)}..." (lost ${short.betAmount})`);
          return { ...short, status: 'expired' as const };
        }

        // Check if target reached (price dropped enough)
        if (currentPrice <= short.targetPrice) {
          updated = true;
          
          // Bot wins the short bet
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

  // Add short position to storage
  private addShortPosition(shortPosition: ShortPosition): void {
    try {
      const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      shorts.push(shortPosition);
      localStorage.setItem('shortPositions', JSON.stringify(shorts));
    } catch (error) {
      console.error('Error adding short position:', error);
    }
  }

  // Bot buys an opinion
  private botBuyOpinion(bot: BotProfile): void {
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) return;

    // Filter opinions based on bot's strategy
    const suitableOpinions = opinions.filter(opinion => {
      const price = this.getOpinionPrice(opinion.id);
      return price >= bot.tradingStrategy.minPrice && price <= bot.tradingStrategy.maxPrice;
    });

    if (suitableOpinions.length === 0) return;

    const selectedOpinion = this.selectOpinionByStrategy(suitableOpinions, bot);
    const price = this.getOpinionPrice(selectedOpinion.id);
    const maxQuantity = Math.floor(bot.balance / price);
    
    if (maxQuantity === 0) return;

    const quantity = Math.min(
      Math.floor(Math.random() * bot.tradingStrategy.maxPositionSize) + 1,
      maxQuantity
    );

    const totalCost = price * quantity;

    if (totalCost <= bot.balance) {
      // Execute purchase
      bot.balance -= totalCost;
      this.addBotTransaction(bot, 'buy', selectedOpinion.id, selectedOpinion.text, -totalCost);
      this.addBotOpinion(bot, selectedOpinion, price, quantity);
      this.increaseOpinionPrice(selectedOpinion.id, quantity);
      
      console.log(`🤖 ${bot.username} bought ${quantity}x "${selectedOpinion.text.slice(0, 30)}..." for ${totalCost}`);
    }
  }

  // Bot sells an opinion
  private botSellOpinion(bot: BotProfile): void {
    const botOpinions = this.getBotOpinions(bot);
    if (botOpinions.length === 0) return;

    const selectedOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.id);
    const quantityToSell = Math.floor(Math.random() * selectedOpinion.quantity) + 1;
    const saleValue = currentPrice * quantityToSell;

    // Execute sale
    bot.balance += saleValue;
    this.addBotTransaction(bot, 'sell', selectedOpinion.id, selectedOpinion.text, saleValue);
    this.removeBotOpinion(bot, selectedOpinion.id, quantityToSell);
    this.decreaseOpinionPrice(selectedOpinion.id, quantityToSell);

    console.log(`🤖 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for ${saleValue}`);
  }

  // Bot places a bet on another user
  private botPlaceBet(bot: BotProfile): void {
    const availableUsers = this.getAvailableUsers();
    const targetUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
    
    if (!targetUser) return;

    const betAmount = this.calculateBetAmount(bot);
    if (betAmount > bot.balance) return;

    const betType = bot.personality.preferredBetTypes[
      Math.floor(Math.random() * bot.personality.preferredBetTypes.length)
    ];

    const bet: AdvancedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bettor: bot.username,
      targetUser: targetUser.username,
      betType,
      targetPercentage: Math.floor(Math.random() * 50) + 10, // 10-60%
      amount: betAmount,
      timeFrame: Math.floor(Math.random() * 30) + 1, // 1-30 days
      initialPortfolioValue: targetUser.portfolioValue || 0,
      currentPortfolioValue: targetUser.portfolioValue || 0,
      placedDate: new Date().toLocaleDateString(),
      expiryDate: this.calculateExpiryDate(Math.floor(Math.random() * 30) + 1),
      status: 'active',
      multiplier: this.calculateMultiplier(betType, Math.floor(Math.random() * 50) + 10),
      potentialPayout: 0,
      volatilityRating: this.getVolatilityRating(targetUser.username)
    };

    bet.potentialPayout = betAmount * bet.multiplier;

    // Execute bet
    bot.balance -= betAmount;
    this.addAdvancedBet(bet);
    this.addBotTransaction(bot, 'bet', undefined, `Bet on ${targetUser.username}`, -betAmount);

    console.log(`🤖 ${bot.username} placed ${betAmount} bet on ${targetUser.username} to ${betType}`);
  }

  // Bot generates a new opinion
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
    const initialPrice = Math.floor(Math.random() * 20) + 5; // $5-$25

    this.addNewOpinion(newOpinion, initialPrice);
    const earnAmount = 100;
    bot.balance += earnAmount;
    bot.totalEarnings += earnAmount;
    this.addBotTransaction(bot, 'earn', undefined, newOpinion, earnAmount);

    console.log(`🤖 ${bot.username} generated opinion: "${newOpinion}"`);
  }

  // Helper methods for bot operations
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
        // Buy less popular opinions
        return opinions.sort((a, b) => this.getOpinionPopularity(a.id) - this.getOpinionPopularity(b.id))[0];
      
      case 'momentum':
        // Buy trending opinions
        return opinions.sort((a, b) => this.getOpinionTrend(b.id) - this.getOpinionTrend(a.id))[0];
      
      case 'value':
        // Buy undervalued opinions
        return opinions.sort((a, b) => this.getOpinionValue(a.id) - this.getOpinionValue(b.id))[0];
      
      default:
        return opinions[Math.floor(Math.random() * opinions.length)];
    }
  }

  private calculateBetAmount(bot: BotProfile): number {
    const baseAmount = bot.balance * 0.1; // 10% of balance
    const riskAdjusted = baseAmount * bot.personality.riskMultiplier;
    return Math.floor(Math.random() * riskAdjusted) + 50; // Minimum $50 bet
  }

  private calculateMultiplier(betType: string, percentage: number): number {
    const baseMultiplier = percentage / 20; // Higher percentage = higher multiplier
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

  // Integration methods with existing localStorage system
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
      // Get human users and other bots
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
      
      // For bots, calculate from their stored opinions
      const botOpinions = this.getBotOpinions(this.bots.find(b => b.username === username));
      return botOpinions.reduce((total, opinion) => 
        total + (this.getOpinionPrice(opinion.id) * opinion.quantity), 0
      );
    } catch {
      return 0;
    }
  }

  private getOpinionPrice(opinionId: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      
      if (opinion && marketData[opinion.text]) {
        return marketData[opinion.text].currentPrice;
      }
      
      // Fallback: calculate based on opinion characteristics
      return Math.floor(Math.random() * 50) + 10; // $10-$60
    } catch {
      return Math.floor(Math.random() * 50) + 10;
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
        return netDemand; // Positive = upward trend, negative = downward trend
      }
      
      return Math.floor(Math.random() * 100) - 50; // -50 to +50
    } catch {
      return Math.floor(Math.random() * 100) - 50;
    }
  }

  private getOpinionValue(opinionId: string): number {
    try {
      const price = this.getOpinionPrice(opinionId);
      const popularity = this.getOpinionPopularity(opinionId);
      
      // Simple value calculation: lower price relative to popularity = better value
      return popularity > 0 ? price / popularity : price;
    } catch {
      return Math.floor(Math.random() * 100);
    }
  }

  private increaseOpinionPrice(opinionId: string, quantity: number): void {
    try {
      const opinions = this.getAvailableOpinions();
      const opinion = opinions.find(op => op.id === opinionId);
      if (!opinion) return;

      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinion.text]) {
        marketData[opinion.text].timesPurchased += quantity;
        // Recalculate price based on new demand
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
        // Recalculate price based on new supply
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

  private calculatePrice(timesPurchased: number, timesSold: number, basePrice: number = 10, volatility: number = 1): number {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.15, netDemand) * volatility;
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.9, Math.abs(netDemand))) * volatility;
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    return Math.round(calculatedPrice);
  }

  private addNewOpinion(text: string, price: number): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      opinions.push(text);
      localStorage.setItem('opinions', JSON.stringify(opinions));

      // Initialize market data for new opinion
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      marketData[text] = {
        opinionText: text,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: price,
        basePrice: price,
        volatility: 1.0,
        lastUpdated: new Date().toISOString(),
        priceHistory: []
      };
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
    } catch (error) {
      console.error('Error adding new opinion:', error);
    }
  }

  private addBotTransaction(bot: BotProfile, type: string, opinionId?: string, opinionText?: string, amount?: number, shortId?: string): void {
    const transaction = {
      id: `${bot.id}_${Date.now()}`,
      type,
      opinionId,
      opinionText,
      shortId,
      amount: amount || 0,
      date: new Date().toLocaleDateString(),
      botId: bot.id
    };

    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      transactions.push(transaction);
      localStorage.setItem('botTransactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Error adding bot transaction:', error);
    }
  }

  private addBotOpinion(bot: BotProfile, opinion: any, price: number, quantity: number): void {
    const opinionAsset = {
      id: `${bot.id}_${opinion.id}_${Date.now()}`,
      botId: bot.id,
      opinionId: opinion.id,
      text: opinion.text,
      purchasePrice: price,
      currentPrice: price,
      purchaseDate: new Date().toLocaleDateString(),
      quantity
    };

    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      botOpinions.push(opinionAsset);
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

  private getBotOpinions(bot: BotProfile | undefined): any[] {
    if (!bot) return [];
    
    try {
      const botOpinions = JSON.parse(localStorage.getItem('botOpinions') || '[]');
      return botOpinions.filter((op: any) => op.botId === bot.id);
    } catch {
      return [];
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
}

// Global bot system instance
const botSystem = new AutonomousBotSystem();

// Export for use in your application
export default botSystem;

// Types for reuse
export type { BotProfile, BotPersonality, TradingStrategy, ShortPosition };

// Usage example:
/*
// Start the bot system (now includes short betting)
botSystem.startBots();

// Stop the bot system
botSystem.stopBots();

// Get all bots
const allBots = botSystem.getBots();

// Get bot transaction history (includes short transactions)
const botTransactions = botSystem.getBotTransactions();

// Get bot short positions
const botShorts = botSystem.getBotShorts();

// Get short betting statistics
const shortStats = botSystem.getBotShortStats();

// Check if system is running
const isRunning = botSystem.isSystemRunning();
*/