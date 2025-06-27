// autonomous-bots.ts
// Autonomous Bot System for Opinion Trading Platform

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
  preferredBetTypes: ('increase' | 'decrease')[];
  riskMultiplier: number; // 0.5-2.0
  activityFrequency: number; // minutes between actions
}

interface TradingStrategy {
  type: 'contrarian' | 'momentum' | 'value' | 'random' | 'aggressive';
  minPrice: number;
  maxPrice: number;
  maxPositionSize: number;
  portfolioTargetSize: number;
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
  type: 'buy' | 'sell' | 'earn' | 'bet';
  opinionId?: string;
  opinionText?: string;
  amount: number;
  date: string;
}

class AutonomousBotSystem {
  private bots: BotProfile[] = [];
  private isRunning: boolean = false;
  private intervalIds: NodeJS.Timeout[] = [];

  constructor() {
    this.loadExistingBots();
  }

  // Load existing bots or initialize new ones
  private loadExistingBots(): void {
    try {
      const stored = localStorage.getItem('autonomousBots');
      if (stored) {
        this.bots = JSON.parse(stored);
        console.log(`📚 Loaded ${this.bots.length} existing bots`);
      } else {
        this.initializeBots();
      }
    } catch (error) {
      console.error('Error loading bots, initializing new ones:', error);
      this.initializeBots();
    }
  }

  // PUBLIC method to initialize bots (called by admin page)
  public async initializeBots(): Promise<void> {
    console.log('🤖 Initializing bot system...');
    
    const botPersonalities: BotPersonality[] = [
      {
        name: "The Contrarian",
        description: "Always bets against popular trends",
        buyProbability: 0.3,
        sellProbability: 0.7,
        betProbability: 0.8,
        preferredBetTypes: ['decrease'],
        riskMultiplier: 1.5,
        activityFrequency: 5
      },
      {
        name: "The Trend Follower",
        description: "Jumps on winning streaks and popular opinions",
        buyProbability: 0.8,
        sellProbability: 0.4,
        betProbability: 0.6,
        preferredBetTypes: ['increase'],
        riskMultiplier: 1.2,
        activityFrequency: 3
      },
      {
        name: "The Value Hunter",
        description: "Looks for undervalued opinions and bargains",
        buyProbability: 0.6,
        sellProbability: 0.5,
        betProbability: 0.4,
        preferredBetTypes: ['increase', 'decrease'],
        riskMultiplier: 0.8,
        activityFrequency: 7
      },
      {
        name: "The Day Trader",
        description: "Makes frequent small trades for quick profits",
        buyProbability: 0.9,
        sellProbability: 0.9,
        betProbability: 0.3,
        preferredBetTypes: ['increase'],
        riskMultiplier: 0.6,
        activityFrequency: 2
      },
      {
        name: "The Whale",
        description: "Makes large, infrequent moves that shake the market",
        buyProbability: 0.2,
        sellProbability: 0.2,
        betProbability: 0.9,
        preferredBetTypes: ['increase', 'decrease'],
        riskMultiplier: 2.0,
        activityFrequency: 15
      },
      {
        name: "The Gambler",
        description: "Takes high-risk, high-reward positions",
        buyProbability: 0.7,
        sellProbability: 0.6,
        betProbability: 0.9,
        preferredBetTypes: ['increase', 'decrease'],
        riskMultiplier: 1.8,
        activityFrequency: 4
      }
    ];

    // Create bots with different strategies
    const strategies: TradingStrategy[] = [
      { type: 'contrarian', minPrice: 1, maxPrice: 50, maxPositionSize: 5, portfolioTargetSize: 8 },
      { type: 'momentum', minPrice: 5, maxPrice: 200, maxPositionSize: 10, portfolioTargetSize: 15 },
      { type: 'value', minPrice: 1, maxPrice: 30, maxPositionSize: 3, portfolioTargetSize: 20 },
      { type: 'aggressive', minPrice: 10, maxPrice: 500, maxPositionSize: 15, portfolioTargetSize: 5 },
      { type: 'random', minPrice: 1, maxPrice: 100, maxPositionSize: 8, portfolioTargetSize: 12 },
      { type: 'value', minPrice: 5, maxPrice: 75, maxPositionSize: 6, portfolioTargetSize: 18 }
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
    console.log(`✅ Initialized ${this.bots.length} bots`);
  }

  // PUBLIC method to execute bot action (called by admin page)
  public async executeBotAction(botId: string): Promise<void> {
    const bot = this.bots.find(b => b.id === botId);
    if (!bot || !bot.isActive) {
      console.log(`⚠️ Bot ${botId} not found or inactive`);
      return;
    }

    try {
      console.log(`🎯 Executing action for ${bot.username}...`);
      
      const actions = ['buy', 'sell', 'bet', 'generate'];
      const actionWeights = [
        bot.personality.buyProbability,
        bot.personality.sellProbability,
        bot.personality.betProbability,
        0.1 // 10% chance to generate new opinion
      ];

      const selectedAction = this.weightedRandomChoice(actions, actionWeights);
      
      switch (selectedAction) {
        case 'buy':
          await this.botBuyOpinion(bot);
          break;
        case 'sell':
          await this.botSellOpinion(bot);
          break;
        case 'bet':
          await this.botPlaceBet(bot);
          break;
        case 'generate':
          await this.botGenerateOpinion(bot);
          break;
      }

      // Update bot's last active time
      bot.lastActive = new Date().toISOString();
      this.saveBots();

    } catch (error) {
      console.error(`❌ Error executing bot action for ${bot.username}:`, error);
    }
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
    console.log('🚀 Starting autonomous bot system...');

    // Start each bot with its own schedule
    this.bots.forEach(bot => {
      if (bot.isActive) {
        const intervalId = setInterval(async () => {
          await this.executeBotAction(bot.id);
        }, bot.personality.activityFrequency * 60 * 1000); // Convert minutes to milliseconds
        
        this.intervalIds.push(intervalId);
        console.log(`⏰ Started interval for ${bot.username} (every ${bot.personality.activityFrequency}m)`);
      }
    });

    // Also run immediate actions for quicker startup
    setTimeout(() => {
      this.bots.forEach(bot => {
        if (Math.random() < 0.3) { // 30% chance each bot acts immediately
          this.executeBotAction(bot.id);
        }
      });
    }, 2000);
  }

  // Stop the bot system
  public stopBots(): void {
    this.isRunning = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    console.log('🛑 Stopped autonomous bot system');
  }

  // Bot buys an opinion
  private async botBuyOpinion(bot: BotProfile): Promise<void> {
    const opinions = this.getAvailableOpinions();
    if (opinions.length === 0) {
      console.log(`${bot.username}: No opinions available to buy`);
      return;
    }

    // Filter opinions based on bot's strategy
    const suitableOpinions = opinions.filter(opinion => {
      const price = this.getOpinionPrice(opinion.text);
      return price >= bot.tradingStrategy.minPrice && price <= bot.tradingStrategy.maxPrice;
    });

    if (suitableOpinions.length === 0) {
      console.log(`${bot.username}: No suitable opinions in price range`);
      return;
    }

    const selectedOpinion = this.selectOpinionByStrategy(suitableOpinions, bot);
    const price = this.getOpinionPrice(selectedOpinion.text);
    const maxQuantity = Math.floor(bot.balance / price);
    
    if (maxQuantity === 0) {
      console.log(`${bot.username}: Insufficient balance for any quantity`);
      return;
    }

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
      this.increaseOpinionPrice(selectedOpinion.text, quantity);
      
      console.log(`💰 ${bot.username} bought ${quantity}x "${selectedOpinion.text.slice(0, 30)}..." for $${totalCost}`);
    }
  }

  // Bot sells an opinion
  private async botSellOpinion(bot: BotProfile): Promise<void> {
    const botOpinions = this.getBotOpinions(bot);
    if (botOpinions.length === 0) {
      console.log(`${bot.username}: No opinions to sell`);
      return;
    }

    const selectedOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const currentPrice = this.getOpinionPrice(selectedOpinion.text);
    const quantityToSell = Math.floor(Math.random() * selectedOpinion.quantity) + 1;
    const saleValue = currentPrice * quantityToSell;

    // Execute sale
    bot.balance += saleValue;
    this.addBotTransaction(bot, 'sell', selectedOpinion.id, selectedOpinion.text, saleValue);
    this.removeBotOpinion(bot, selectedOpinion.opinionId, quantityToSell);
    this.decreaseOpinionPrice(selectedOpinion.text, quantityToSell);

    console.log(`💸 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for $${saleValue}`);
  }

  // Bot places a bet on another user
  private async botPlaceBet(bot: BotProfile): Promise<void> {
    const availableUsers = this.getAvailableUsers().filter(user => user.username !== bot.username);
    if (availableUsers.length === 0) {
      console.log(`${bot.username}: No users available to bet on`);
      return;
    }
    
    const targetUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
    const betAmount = this.calculateBetAmount(bot);
    
    if (betAmount > bot.balance) {
      console.log(`${bot.username}: Insufficient balance for bet ($${betAmount} > $${bot.balance})`);
      return;
    }

    const betType = bot.personality.preferredBetTypes[
      Math.floor(Math.random() * bot.personality.preferredBetTypes.length)
    ];

    const targetPercentage = Math.floor(Math.random() * 40) + 10; // 10-50%
    const timeFrame = Math.floor(Math.random() * 20) + 5; // 5-25 days

    const bet: AdvancedBet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bettor: bot.username,
      targetUser: targetUser.username,
      betType,
      targetPercentage,
      amount: betAmount,
      timeFrame,
      initialPortfolioValue: targetUser.portfolioValue || 0,
      currentPortfolioValue: targetUser.portfolioValue || 0,
      placedDate: new Date().toLocaleDateString(),
      expiryDate: this.calculateExpiryDate(timeFrame),
      status: 'active',
      multiplier: this.calculateMultiplier(betType, targetPercentage, timeFrame),
      potentialPayout: 0,
      volatilityRating: this.getVolatilityRating(targetUser.username)
    };

    bet.potentialPayout = Math.round(betAmount * bet.multiplier);

    // Execute bet
    bot.balance -= betAmount;
    this.addAdvancedBet(bet);
    this.addBotTransaction(bot, 'bet', undefined, `Bet on ${targetUser.username}: ${betType} ${targetPercentage}%`, -betAmount);

    console.log(`🎲 ${bot.username} placed $${betAmount} bet on ${targetUser.username} to ${betType} ${targetPercentage}% (${bet.multiplier}x)`);
  }

  // Bot generates a new opinion
  private async botGenerateOpinion(bot: BotProfile): Promise<void> {
    const botOpinions = [
      "The future of remote work is hybrid models",
      "Cryptocurrency will replace traditional banking within 5 years",
      "AI will create more jobs than it destroys by 2030",
      "Social media is fundamentally harmful to mental health",
      "Electric vehicles will dominate car sales by 2028",
      "Space tourism will be mainstream within 10 years",
      "Universal basic income is economically inevitable",
      "Streaming services will completely kill traditional TV",
      "Lab-grown meat will outsell traditional meat by 2035",
      "Virtual reality will revolutionize online education",
      "Bitcoin will reach $500,000 within 3 years",
      "Working from home permanently reduces productivity",
      "Self-driving cars will be safer than human drivers",
      "Nuclear energy is the best solution to climate change",
      "The metaverse will replace social media platforms"
    ];

    const newOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    
    // Check if opinion already exists
    const existingOpinions = this.getAvailableOpinions();
    const alreadyExists = existingOpinions.some(op => op.text.toLowerCase() === newOpinion.toLowerCase());
    
    if (alreadyExists) {
      console.log(`${bot.username}: Opinion already exists, skipping generation`);
      return;
    }

    const earnings = 100; // $100 for generating opinion
    bot.balance += earnings;
    bot.totalEarnings += earnings;

    this.addNewOpinion(newOpinion);
    this.addBotTransaction(bot, 'earn', undefined, newOpinion, earnings);

    console.log(`💡 ${bot.username} generated opinion: "${newOpinion}" (+$${earnings})`);
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
        // Buy less popular opinions (lower prices)
        return opinions.sort((a, b) => this.getOpinionPrice(a.text) - this.getOpinionPrice(b.text))[0];
      
      case 'momentum':
        // Buy trending opinions (higher prices, assuming they're rising)
        return opinions.sort((a, b) => this.getOpinionPrice(b.text) - this.getOpinionPrice(a.text))[0];
      
      case 'value':
        // Buy undervalued opinions (medium prices)
        return opinions.sort((a, b) => this.getOpinionValue(a.text) - this.getOpinionValue(b.text))[0];
      
      default:
        return opinions[Math.floor(Math.random() * opinions.length)];
    }
  }

  private calculateBetAmount(bot: BotProfile): number {
    const maxBetPercent = bot.riskTolerance === 'aggressive' ? 0.2 : 
                         bot.riskTolerance === 'moderate' ? 0.1 : 0.05;
    const baseAmount = bot.balance * maxBetPercent;
    const riskAdjusted = baseAmount * bot.personality.riskMultiplier;
    return Math.max(50, Math.floor(Math.random() * riskAdjusted) + 25); // Minimum $50 bet
  }

  private calculateMultiplier(betType: string, percentage: number, timeFrame: number): number {
    // Higher percentage and shorter timeframe = higher multiplier
    const difficultyScore = (percentage / 10) + (30 - timeFrame) / 10;
    const baseMultiplier = 1 + (difficultyScore * 0.3);
    return Math.max(1.1, Math.min(8.0, Number(baseMultiplier.toFixed(2))));
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
      const users = [];
      
      // Add human user if exists
      if (humanUser.username) {
        users.push({
          username: humanUser.username,
          portfolioValue: this.calculateUserPortfolioValue(humanUser.username)
        });
      }
      
      // Add all bots
      this.bots.forEach(bot => {
        users.push({
          username: bot.username,
          portfolioValue: this.calculateUserPortfolioValue(bot.username)
        });
      });
      
      return users.filter(user => user.username);
    } catch {
      return [];
    }
  }

  private calculateUserPortfolioValue(username: string): number {
    try {
      const humanUser = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      if (username === humanUser.username) {
        const ownedOpinions = JSON.parse(localStorage.getItem('ownedOpinions') || '[]');
        return ownedOpinions.reduce((total: number, opinion: any) => 
          total + (this.getOpinionPrice(opinion.text) * opinion.quantity), 0
        );
      }
      
      // For bots, calculate from their stored opinions
      const bot = this.bots.find(b => b.username === username);
      if (bot) {
        const botOpinions = this.getBotOpinions(bot);
        return botOpinions.reduce((total, opinion) => 
          total + (this.getOpinionPrice(opinion.text) * opinion.quantity), 0
        );
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  // FIXED: Use actual market data for pricing
  private getOpinionPrice(opinionText: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      const data = marketData[opinionText];
      
      if (data && data.currentPrice) {
        return data.currentPrice;
      }
      
      // Fallback to random price if no market data
      return Math.floor(Math.random() * 40) + 10; // $10-$50
    } catch {
      return Math.floor(Math.random() * 40) + 10;
    }
  }

  private getOpinionPopularity(opinionText: string): number {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      return marketData[opinionText]?.timesPurchased || 0;
    } catch {
      return 0;
    }
  }

  private getOpinionTrend(opinionText: string): number {
    // Simple trend calculation based on current vs base price
    const currentPrice = this.getOpinionPrice(opinionText);
    const basePrice = 20; // Assume $20 base
    return ((currentPrice - basePrice) / basePrice) * 100;
  }

  private getOpinionValue(opinionText: string): number {
    const price = this.getOpinionPrice(opinionText);
    const popularity = this.getOpinionPopularity(opinionText);
    // Lower score = better value (low price, high potential)
    return price - (popularity * 2);
  }

  private increaseOpinionPrice(opinionText: string, quantity: number): void {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      
      if (!marketData[opinionText]) {
        marketData[opinionText] = { currentPrice: 15, timesPurchased: 0 };
      }
      
      // Increase price based on demand
      const priceIncrease = Math.ceil(quantity * 0.5); // $0.50 per quantity
      marketData[opinionText].currentPrice += priceIncrease;
      marketData[opinionText].timesPurchased += quantity;
      
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      console.log(`📈 Opinion "${opinionText.slice(0, 30)}..." price increased by $${priceIncrease}`);
    } catch (error) {
      console.error('Error increasing opinion price:', error);
    }
  }

  private decreaseOpinionPrice(opinionText: string, quantity: number): void {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      
      if (!marketData[opinionText]) {
        marketData[opinionText] = { currentPrice: 15, timesPurchased: 0 };
      }
      
      // Decrease price based on selling pressure
      const priceDecrease = Math.ceil(quantity * 0.3); // $0.30 per quantity
      marketData[opinionText].currentPrice = Math.max(1, marketData[opinionText].currentPrice - priceDecrease);
      
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
      console.log(`📉 Opinion "${opinionText.slice(0, 30)}..." price decreased by $${priceDecrease}`);
    } catch (error) {
      console.error('Error decreasing opinion price:', error);
    }
  }

  private addNewOpinion(text: string): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      opinions.push(text);
      localStorage.setItem('opinions', JSON.stringify(opinions));
      
      // Initialize market data for new opinion
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      marketData[text] = { 
        currentPrice: Math.floor(Math.random() * 20) + 10, // $10-$30 starting price
        timesPurchased: 0 
      };
      localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
    } catch (error) {
      console.error('Error adding new opinion:', error);
    }
  }

  private addBotTransaction(bot: BotProfile, type: string, opinionId?: string, opinionText?: string, amount?: number): void {
    const transaction = {
      id: `${bot.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      opinionId,
      opinionText,
      amount: amount || 0,
      date: new Date().toISOString(),
      botId: bot.id
    };

    try {
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      transactions.push(transaction);
      // Keep only last 100 transactions per bot to avoid storage bloat
      const recentTransactions = transactions.slice(-500);
      localStorage.setItem('botTransactions', JSON.stringify(recentTransactions));
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

  public isSystemRunning(): boolean {
    return this.isRunning;
  }

  public pauseBot(botId: string): void {
    const bot = this.bots.find(b => b.id === botId);
    if (bot) {
      bot.isActive = false;
      this.saveBots();
      console.log(`⏸️ Paused bot: ${bot.username}`);
    }
  }

  public resumeBot(botId: string): void {
    const bot = this.bots.find(b => b.id === botId);
    if (bot) {
      bot.isActive = true;
      this.saveBots();
      console.log(`▶️ Resumed bot: ${bot.username}`);
    }
  }

  // Force immediate action for testing
  public async forceAction(botId: string): Promise<void> {
    console.log(`🎯 Forcing immediate action for bot ${botId}`);
    await this.executeBotAction(botId);
  }

  // Get bot portfolio for leaderboard integration
  public getBotPortfolio(botId: string): OpinionAsset[] {
    const bot = this.bots.find(b => b.id === botId);
    if (!bot) return [];
    
    return this.getBotOpinions(bot).map(opinion => ({
      id: opinion.id,
      text: opinion.text,
      purchasePrice: opinion.purchasePrice,
      currentPrice: this.getOpinionPrice(opinion.text),
      purchaseDate: opinion.purchaseDate,
      quantity: opinion.quantity
    }));
  }

  // Export bot data for users page
  public getBotsForUsersPage(): any[] {
    return this.bots.map(bot => {
      const portfolio = this.getBotPortfolio(bot.id);
      return {
        username: bot.username,
        portfolio,
        joinDate: bot.joinDate,
        balance: bot.balance,
        isBot: true
      };
    });
  }

  // Clean up old data periodically
  public cleanupOldData(): void {
    try {
      // Clean old transactions (keep last 500)
      const transactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      if (transactions.length > 500) {
        const recentTransactions = transactions.slice(-500);
        localStorage.setItem('botTransactions', JSON.stringify(recentTransactions));
        console.log(`🧹 Cleaned up old transactions, kept ${recentTransactions.length}`);
      }

      // Clean old bets (remove expired ones older than 30 days)
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeBets = bets.filter((bet: any) => {
        const betDate = new Date(bet.placedDate);
        return bet.status === 'active' || betDate > thirtyDaysAgo;
      });

      if (activeBets.length !== bets.length) {
        localStorage.setItem('advancedBets', JSON.stringify(activeBets));
        console.log(`🧹 Cleaned up old bets, removed ${bets.length - activeBets.length}`);
      }
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  // Get system statistics
  public getSystemStats(): any {
    const totalTransactions = this.getBotTransactions().length;
    const activeBots = this.bots.filter(bot => bot.isActive).length;
    const totalBotCapital = this.bots.reduce((sum, bot) => sum + bot.balance, 0);
    const totalBotEarnings = this.bots.reduce((sum, bot) => sum + bot.totalEarnings, 0);

    return {
      totalBots: this.bots.length,
      activeBots,
      totalTransactions,
      totalBotCapital,
      totalBotEarnings,
      isSystemRunning: this.isRunning,
      intervalCount: this.intervalIds.length
    };
  }

  // Debug method to log bot status
  public debugBotStatus(): void {
    console.log('🔍 Bot System Debug Info:');
    console.log(`- System Running: ${this.isRunning}`);
    console.log(`- Active Intervals: ${this.intervalIds.length}`);
    console.log(`- Total Bots: ${this.bots.length}`);
    console.log(`- Active Bots: ${this.bots.filter(b => b.isActive).length}`);
    
    this.bots.forEach(bot => {
      const opinions = this.getBotOpinions(bot);
      console.log(`  🤖 ${bot.username}: ${bot.balance}, ${opinions.length} opinions, last active: ${bot.lastActive}`);
    });
  }
}

// Global bot system instance
const botSystem = new AutonomousBotSystem();

// Auto-start bots if they were previously enabled
const autoStart = localStorage.getItem('botsAutoStart') === 'true';
if (autoStart) {
  console.log('🚀 Auto-starting bot system from localStorage setting...');
  setTimeout(() => {
    botSystem.startBots();
  }, 2000); // Give time for page to load
}

// Export for use in your application
export default botSystem;

// Types for reuse
export type { BotProfile, BotPersonality, TradingStrategy };

// Usage example:
/*
// Initialize bots (call this first)
await botSystem.initializeBots();

// Start the bot system
botSystem.startBots();

// Execute single bot action
await botSystem.executeBotAction('bot_1');

// Stop the bot system
botSystem.stopBots();

// Get all bots
const allBots = botSystem.getBots();

// Get bot transaction history
const botTransactions = botSystem.getBotTransactions();

// Check if system is running
const isRunning = botSystem.isSystemRunning();

// Get bots for users page integration
const botsForUsers = botSystem.getBotsForUsersPage();

// Debug system status
botSystem.debugBotStatus();
*/