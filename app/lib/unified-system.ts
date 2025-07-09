// =============================================================================
// UNIFIED SYSTEM INTEGRATION FIXES
// Centralized functions to resolve all code interactions and inconsistencies
// =============================================================================

// 1. CENTRALIZED PRICE CALCULATION
// Single source of truth for all price calculations across the entire system
export const calculateUnifiedPrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
  const netDemand = timesPurchased - timesSold;
  
  let priceMultiplier: number;
  if (netDemand >= 0) {
    // Exactly 0.1% increase per purchase
    priceMultiplier = Math.pow(1.001, netDemand);
  } else {
    // Exactly 0.1% decrease per sale
    priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
  }
  
  const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
  
  // Always return precise 2 decimal places for currency
  return Math.round(calculatedPrice * 100) / 100;
};

// 2. STANDARDIZED MARKET DATA INTERFACE
export interface UnifiedOpinionMarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number; // Always 10.00
  lastUpdated: string;
  priceHistory: Array<{
    price: number;
    timestamp: string;
    action: string;
    quantity?: number;
  }>;
  liquidityScore: number;
  dailyVolume: number;
  manipulation_protection: {
    rapid_trades: number;
    single_trader_percentage: number;
    last_manipulation_check: string;
  };
}

// 3. STANDARDIZED TRANSACTION INTERFACE
export interface UnifiedTransaction {
  id: string;
  type: 'buy' | 'sell' | 'bet' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
  amount: number;
  date: string;
  opinionId?: string;
  opinionText?: string;
  userId?: string;
  botId?: string;
  metadata: {
    purchasePricePerShare?: number;
    quantity?: number;
    totalCost?: number;
    priceBeforeAction?: number;
    priceAfterAction?: number;
    percentageChange?: number;
  };
}

// 4. UNIFIED MARKET DATA MANAGER
export class UnifiedMarketDataManager {
  private static instance: UnifiedMarketDataManager;
  
  public static getInstance(): UnifiedMarketDataManager {
    if (!UnifiedMarketDataManager.instance) {
      UnifiedMarketDataManager.instance = new UnifiedMarketDataManager();
    }
    return UnifiedMarketDataManager.instance;
  }

  // Safe localStorage operations
  private safeGetFromStorage(key: string, defaultValue: any = {}): any {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
      // Try to clear some space and retry
      this.cleanupOldData();
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (retryError) {
        console.error(`Failed to save ${key} even after cleanup:`, retryError);
      }
    }
  }

  // Get market data with automatic initialization
  public getMarketData(opinionText: string): UnifiedOpinionMarketData {
    const allMarketData = this.safeGetFromStorage('opinionMarketData', {});
    
    if (allMarketData[opinionText]) {
      const data = allMarketData[opinionText];
      
      // Validate and fix price consistency
      const expectedPrice = calculateUnifiedPrice(data.timesPurchased, data.timesSold, 10.00);
      if (Math.abs(expectedPrice - data.currentPrice) > 0.01) {
        console.warn(`🔧 FIXING price inconsistency for "${opinionText}": ${data.currentPrice} → ${expectedPrice}`);
        data.currentPrice = expectedPrice;
        this.saveMarketData(opinionText, data);
      }
      
      // Ensure base price is always 10.00
      if (data.basePrice !== 10.00) {
        console.warn(`🔧 FIXING base price for "${opinionText}": ${data.basePrice} → 10.00`);
        data.basePrice = 10.00;
        this.saveMarketData(opinionText, data);
      }
      
      return this.normalizeMarketData(data);
    } else {
      // Create new market data starting at exactly $10.00
      const newData: UnifiedOpinionMarketData = {
        opinionText,
        timesPurchased: 0,
        timesSold: 0,
        currentPrice: 10.00,
        basePrice: 10.00,
        lastUpdated: new Date().toISOString(),
        priceHistory: [{ 
          price: 10.00, 
          timestamp: new Date().toISOString(), 
          action: 'create' 
        }],
        liquidityScore: 0,
        dailyVolume: 0,
        manipulation_protection: {
          rapid_trades: 0,
          single_trader_percentage: 0,
          last_manipulation_check: new Date().toISOString()
        }
      };
      
      this.saveMarketData(opinionText, newData);
      console.log(`✅ Created market data for "${opinionText}" at exactly $10.00`);
      
      return newData;
    }
  }

  // Update market data with unified logic
  public updateMarketData(
    opinionText: string, 
    action: 'buy' | 'sell', 
    quantity: number = 1,
    userId?: string,
    botId?: string
  ): UnifiedOpinionMarketData {
    const currentData = this.getMarketData(opinionText);
    const priceBeforeAction = currentData.currentPrice;
    
    // Update purchase/sale counts
    const newTimesPurchased = action === 'buy' ? 
      currentData.timesPurchased + quantity : currentData.timesPurchased;
    const newTimesSold = action === 'sell' ? 
      currentData.timesSold + quantity : currentData.timesSold;
    
    // Calculate new price using unified method
    const newPrice = calculateUnifiedPrice(newTimesPurchased, newTimesSold, 10.00);
    const priceChange = newPrice - priceBeforeAction;
    const percentageChange = priceBeforeAction > 0 ? 
      ((priceChange / priceBeforeAction) * 100) : 0;
    
    // Update market data
    const updatedData: UnifiedOpinionMarketData = {
      ...currentData,
      timesPurchased: newTimesPurchased,
      timesSold: newTimesSold,
      currentPrice: newPrice,
      lastUpdated: new Date().toISOString(),
      priceHistory: [
        ...currentData.priceHistory,
        {
          price: newPrice,
          timestamp: new Date().toISOString(),
          action,
          quantity
        }
      ].slice(-50), // Keep only last 50 entries
      liquidityScore: Math.min((newTimesPurchased + newTimesSold) / 20, 1),
      dailyVolume: this.calculateDailyVolume(opinionText)
    };
    
    this.saveMarketData(opinionText, updatedData);
    
    // Log the change for debugging
    console.log(`📈 ${action.toUpperCase()} ${quantity}x "${opinionText.slice(0, 30)}...": $${priceBeforeAction.toFixed(2)} → $${newPrice.toFixed(2)} (${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(3)}%)`);
    
    return updatedData;
  }

  // Save market data safely
  private saveMarketData(opinionText: string, data: UnifiedOpinionMarketData): void {
    const allMarketData = this.safeGetFromStorage('opinionMarketData', {});
    allMarketData[opinionText] = data;
    this.safeSetToStorage('opinionMarketData', allMarketData);
  }

  // Normalize market data to ensure consistency and prevent undefined values
  private normalizeMarketData(data: any): UnifiedOpinionMarketData {
    return {
      opinionText: String(data.opinionText || ''),
      timesPurchased: Number(data.timesPurchased) || 0,
      timesSold: Number(data.timesSold) || 0,
      currentPrice: Number(data.currentPrice) || 10.00,
      basePrice: 10.00, // Always enforce 10.00
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      priceHistory: Array.isArray(data.priceHistory) ? data.priceHistory : [],
      liquidityScore: Number(data.liquidityScore) || 0,
      dailyVolume: Number(data.dailyVolume) || 0,
      manipulation_protection: data.manipulation_protection ? {
        rapid_trades: Number(data.manipulation_protection.rapid_trades) || 0,
        single_trader_percentage: Number(data.manipulation_protection.single_trader_percentage) || 0,
        last_manipulation_check: data.manipulation_protection.last_manipulation_check || new Date().toISOString()
      } : {
        rapid_trades: 0,
        single_trader_percentage: 0,
        last_manipulation_check: new Date().toISOString()
      }
    };
  }

  // Calculate daily volume
  private calculateDailyVolume(opinionText: string): number {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const transactions = this.safeGetFromStorage('botTransactions', [])
      .concat(this.safeGetFromStorage('transactions', []))
      .filter((tx: any) => 
        tx.opinionText === opinionText && 
        new Date(tx.date) > oneDayAgo &&
        (tx.type === 'buy' || tx.type === 'sell')
      );
    
    return transactions.reduce((volume: number, tx: any) => 
      volume + (tx.metadata?.quantity || 1), 0);
  }

  // Clean up old data to prevent localStorage overflow
  private cleanupOldData(): void {
    try {
      // Clean up old portfolio snapshots
      const snapshots = this.safeGetFromStorage('portfolioSnapshots', []);
      if (snapshots.length > 50) {
        this.safeSetToStorage('portfolioSnapshots', snapshots.slice(-50));
      }
      
      // Clean up old transactions
      const botTransactions = this.safeGetFromStorage('botTransactions', []);
      if (botTransactions.length > 1000) {
        this.safeSetToStorage('botTransactions', botTransactions.slice(-1000));
      }
      
      console.log('🧹 Cleaned up old data to free localStorage space');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// 5. UNIFIED TRANSACTION MANAGER
export class UnifiedTransactionManager {
  private static instance: UnifiedTransactionManager;
  
  public static getInstance(): UnifiedTransactionManager {
    if (!UnifiedTransactionManager.instance) {
      UnifiedTransactionManager.instance = new UnifiedTransactionManager();
    }
    return UnifiedTransactionManager.instance;
  }

  // Create standardized transaction
  public createTransaction(
    type: UnifiedTransaction['type'],
    amount: number,
    opinionText?: string,
    opinionId?: string,
    userId?: string,
    botId?: string,
    metadata: UnifiedTransaction['metadata'] = {}
  ): UnifiedTransaction {
    // Ensure unique timestamps by adding microseconds
    const timestamp = new Date();
    // Add small random offset to prevent exact timestamp collisions
    timestamp.setMilliseconds(timestamp.getMilliseconds() + Math.random() * 0.999);
    
    return {
      id: this.generateTransactionId(),
      type,
      amount,
      date: timestamp.toISOString(),
      opinionId,
      opinionText,
      userId,
      botId,
      metadata
    };
  }

  // Save transaction to appropriate storage
  public saveTransaction(transaction: UnifiedTransaction): void {
    const storageKey = transaction.botId ? 'botTransactions' : 'transactions';
    const transactions = this.safeGetFromStorage(storageKey, []);
    transactions.push(transaction);
    this.safeSetToStorage(storageKey, transactions);
    
    // Also add to global activity feed
    this.addToActivityFeed(transaction);
  }

  // Add transaction to global activity feed
  private addToActivityFeed(transaction: UnifiedTransaction): void {
    const feed = this.safeGetFromStorage('globalActivityFeed', []);
    
    const feedItem = {
      id: transaction.id,
      type: this.mapTransactionTypeToFeedType(transaction.type),
      username: transaction.botId ? `Bot_${transaction.botId.slice(-4)}` : 'User',
      amount: transaction.amount,
      opinionText: transaction.opinionText,
      timestamp: transaction.date,
      metadata: transaction.metadata
    };
    
    feed.unshift(feedItem);
    
    // Keep only last 500 feed items
    this.safeSetToStorage('globalActivityFeed', feed.slice(0, 500));
  }

  // Map transaction types to feed types
  private mapTransactionTypeToFeedType(type: string): string {
    const mapping: Record<string, string> = {
      'buy': 'buy',
      'sell': 'sell',
      'bet': 'bet_place',
      'earn': 'earn',
      'generate': 'earn',
      'short_place': 'short_place',
      'short_win': 'short_win',
      'short_loss': 'short_loss'
    };
    return mapping[type] || type;
  }

  // Generate unique transaction ID
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Safe localStorage operations
  private safeGetFromStorage(key: string, defaultValue: any = []): any {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }
}

// 6. SYSTEM VALIDATION AND REPAIR
export class SystemValidator {
  private marketDataManager = UnifiedMarketDataManager.getInstance();
  private transactionManager = UnifiedTransactionManager.getInstance();

  // Validate and fix all price inconsistencies
  public validateAndFixAllPrices(): { fixed: number; validated: number } {
    console.log('🔍 VALIDATING ALL PRICE CONSISTENCIES...');
    
    const opinions = this.getAllOpinions();
    let fixedCount = 0;
    let validatedCount = 0;

    opinions.forEach(opinion => {
      const marketData = this.marketDataManager.getMarketData(opinion.text);
      const expectedPrice = calculateUnifiedPrice(
        marketData.timesPurchased, 
        marketData.timesSold, 
        10.00
      );
      
      if (Math.abs(expectedPrice - marketData.currentPrice) > 0.01) {
        console.log(`🔧 FIXING: "${opinion.text.slice(0, 30)}..." ${marketData.currentPrice} → ${expectedPrice}`);
        this.marketDataManager.updateMarketData(opinion.text, 'buy', 0); // Update with 0 quantity to recalculate
        fixedCount++;
      } else {
        validatedCount++;
      }
    });

    console.log(`✅ Price validation complete: ${fixedCount} fixed, ${validatedCount} validated`);
    return { fixed: fixedCount, validated: validatedCount };
  }

  // Fix all transaction inconsistencies
  public validateAndFixTransactions(): { fixed: number; removed: number } {
    console.log('🔍 VALIDATING TRANSACTION INTEGRITY...');
    
    let fixedCount = 0;
    let removedCount = 0;

    // Fix bot transactions
    const botTransactions = this.safeGetFromStorage('botTransactions', []);
    const validBotTransactions = botTransactions.filter((tx: any, index: number) => {
      if (!tx.id || !tx.type || !tx.date || typeof tx.amount !== 'number') {
        console.log(`❌ Removing invalid bot transaction at index ${index}`);
        removedCount++;
        return false;
      }
      
      // Fix missing metadata
      if (!tx.metadata) {
        tx.metadata = {};
        fixedCount++;
      }
      
      return true;
    });

    // Remove duplicates by ID
    const uniqueBotTransactions = validBotTransactions.filter((tx: any, index: number, arr: any[]) => {
      const firstIndex = arr.findIndex(t => t.id === tx.id);
      if (firstIndex !== index) {
        removedCount++;
        return false;
      }
      return true;
    });

    this.safeSetToStorage('botTransactions', uniqueBotTransactions);

    // Fix user transactions
    const userTransactions = this.safeGetFromStorage('transactions', []);
    const validUserTransactions = userTransactions.filter((tx: any) => {
      if (!tx.id || !tx.type || !tx.date) {
        removedCount++;
        return false;
      }
      if (!tx.metadata) {
        tx.metadata = {};
        fixedCount++;
      }
      return true;
    });

    this.safeSetToStorage('transactions', validUserTransactions);

    console.log(`✅ Transaction validation complete: ${fixedCount} fixed, ${removedCount} removed`);
    return { fixed: fixedCount, removed: removedCount };
  }

  // Get all opinions from storage
  private getAllOpinions(): Array<{ text: string; id: string }> {
    const opinions = this.safeGetFromStorage('opinions', []);
    return Array.isArray(opinions) ? opinions.map((text: string, index: number) => ({
      text,
      id: index.toString()
    })) : [];
  }

  private safeGetFromStorage(key: string, defaultValue: any): any {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }
}

// 7. GLOBAL INTEGRATION SETUP
export default function setupUnifiedSystem() {
  if (typeof window !== 'undefined') {
    // Make unified functions globally available
    (window as any).unifiedMarketData = UnifiedMarketDataManager.getInstance();
    (window as any).unifiedTransactions = UnifiedTransactionManager.getInstance();
    (window as any).systemValidator = new SystemValidator();
    
    // Global utility functions
    (window as any).validateAllPrices = () => {
      const validator = new SystemValidator();
      return validator.validateAndFixAllPrices();
    };
    
    (window as any).fixAllTransactions = () => {
      const validator = new SystemValidator();
      return validator.validateAndFixTransactions();
    };
    
    (window as any).getUnifiedPrice = (timesPurchased: number, timesSold: number) => {
      return calculateUnifiedPrice(timesPurchased, timesSold, 10.00);
    };
    
    console.log('🔧 UNIFIED SYSTEM INTEGRATION LOADED');
    console.log('📋 Available global functions:');
    console.log('  - validateAllPrices() - Fix all price inconsistencies');
    console.log('  - fixAllTransactions() - Fix all transaction issues');
    console.log('  - getUnifiedPrice(purchases, sales) - Test price calculation');
    console.log('  - unifiedMarketData.getMarketData(opinionText) - Get market data');
    console.log('  - systemValidator.validateAndFixAllPrices() - Comprehensive validation');
  }
}

// Auto-setup when loaded
setupUnifiedSystem();