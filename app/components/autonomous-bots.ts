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
    this.initializeBots();
  }

  // Initialize bot profiles with different personalities
  private initializeBots(): void {
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
    console.log('🤖 Starting autonomous bot system...');

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
  }

  // Stop the bot system
  public stopBots(): void {
    this.isRunning = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    console.log('🛑 Stopped autonomous bot system');
  }

  // Execute a random action for a bot
  private executeBotAction(bot: BotProfile): void {
    try {
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
          this.botBuyOpinion(bot);
          break;
        case 'sell':
          this.botSellOpinion(bot);
          break;
        case 'bet':
          this.botPlaceBet(bot);
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
      this.addBotTransaction(bot, 'buy', selectedOpinion.id, selectedOpinion.text, totalCost);
      this.addBotOpinion(bot, selectedOpinion, price, quantity);
      this.increaseOpinionPrice(selectedOpinion.id, quantity);
      
      console.log(`🤖 ${bot.username} bought ${quantity}x "${selectedOpinion.text.slice(0, 30)}..." for $${totalCost}`);
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

    console.log(`🤖 ${bot.username} sold ${quantityToSell}x "${selectedOpinion.text.slice(0, 30)}..." for $${saleValue}`);
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

    console.log(`🤖 ${bot.username} placed $${betAmount} bet on ${targetUser.username} to ${betType}`);
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
      "Virtual reality will revolutionize education"
    ];

    const newOpinion = botOpinions[Math.floor(Math.random() * botOpinions.length)];
    const initialPrice = Math.floor(Math.random() * 20) + 5; // $5-$25

    this.addNewOpinion(newOpinion, initialPrice);
    this.addBotTransaction(bot, 'earn', undefined, newOpinion, 100); // Earn $100 for generating

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
    // Simple price calculation - could be enhanced with your actual pricing logic
    return Math.floor(Math.random() * 50) + 10; // $10-$60
  }

  private getOpinionPopularity(opinionId: string): number {
    return Math.floor(Math.random() * 100);
  }

  private getOpinionTrend(opinionId: string): number {
    return Math.floor(Math.random() * 100) - 50; // -50 to +50
  }

  private getOpinionValue(opinionId: string): number {
    return Math.floor(Math.random() * 100);
  }

  private increaseOpinionPrice(opinionId: string, quantity: number): void {
    // Implement price increase logic based on your system
    console.log(`Opinion ${opinionId} price increased due to ${quantity} purchases`);
  }

  private decreaseOpinionPrice(opinionId: string, quantity: number): void {
    // Implement price decrease logic based on your system
    console.log(`Opinion ${opinionId} price decreased due to ${quantity} sales`);
  }

  private addNewOpinion(text: string, price: number): void {
    try {
      const opinions = JSON.parse(localStorage.getItem('opinions') || '[]');
      opinions.push(text);
      localStorage.setItem('opinions', JSON.stringify(opinions));
    } catch (error) {
      console.error('Error adding new opinion:', error);
    }
  }

  private addBotTransaction(bot: BotProfile, type: string, opinionId?: string, opinionText?: string, amount?: number): void {
    const transaction = {
      id: `${bot.id}_${Date.now()}`,
      type,
      opinionId,
      opinionText,
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
}

// Global bot system instance
const botSystem = new AutonomousBotSystem();

// Export for use in your application
export default botSystem;

// Types for reuse
export type { BotProfile, BotPersonality, TradingStrategy };

// Usage example:
/*
// Start the bot system
botSystem.startBots();

// Stop the bot system
botSystem.stopBots();

// Get all bots
const allBots = botSystem.getBots();

// Get bot transaction history
const botTransactions = botSystem.getBotTransactions();

// Check if system is running
const isRunning = botSystem.isSystemRunning();
*/