'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import '../global.css';
import styles from './page.module.css';

interface ActivityFeedItem {
  id: string;
  type: 'buy' | 'sell' | 'bet_place' | 'bet_win' | 'bet_loss' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
  username: string;
  opinionText?: string;
  opinionId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  shortDetails?: {
    targetDropPercentage: number;
    startingPrice: number;
    targetPrice: number;
    potentialWinnings: number;
    timeLimit: number;
  };
  timestamp: string;
  relativeTime: string;
  isBot?: boolean;
}

interface UserProfile {
  username: string;
  balance: number;
}

interface TransactionDetail {
  id: string;
  type: string;
  username: string;
  opinionText?: string;
  opinionId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  shortDetails?: {
    targetDropPercentage: number;
    startingPrice: number;
    targetPrice: number;
    potentialWinnings: number;
    timeLimit: number;
  };
  timestamp: string;
  isBot?: boolean;
  fullDescription: string;
  additionalDetails?: {
    multiplier?: number;
    potentialPayout?: number;
    volatilityRating?: string;
    expiryDate?: string;
    betStatus?: string;
    shortProgress?: number;
  };
}

export default function FeedPage() {
  const router = useRouter();
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    username: 'OpinionTrader123',
    balance: 10000
  });
  const [filter, setFilter] = useState<'all' | 'trades' | 'bets' | 'generates' | 'shorts'>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // FIXED: Safe localStorage helpers with proper error handling
  const safeGetFromStorage = (key: string, defaultValue: any = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  };

  const safeSetToStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  };

  // Fix hydration by ensuring client-side only rendering for time-sensitive content
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Function to add activity to global feed
  const addToGlobalFeed = (activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) => {
    if (!isClient) return;
    
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: `${Date.now()}_${Math.random()}`,
      relativeTime: getRelativeTime(activity.timestamp)
    };

    // Get existing global feed
    const existingFeed = safeGetFromStorage('globalActivityFeed', []);
    
    // Add new activity to beginning and keep last 200 items
    const updatedFeed = [newActivity, ...existingFeed].slice(0, 200);
    
    // Save back to localStorage
    safeSetToStorage('globalActivityFeed', updatedFeed);
    
    // Update local state
    setActivityFeed(updatedFeed);
  };

  // Get relative time string
  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // FIXED: Get current price for an opinion with proper decimal precision
  const getCurrentPrice = (opinionText: string): number => {
    if (!isClient) return 10.00;
    
    try {
      const marketData = safeGetFromStorage('opinionMarketData', {});
      if (marketData[opinionText]) {
        const price = marketData[opinionText].currentPrice;
        // Ensure proper decimal precision
        return Math.round(price * 100) / 100;
      }
      return 10.00; // Default base price with proper decimals
    } catch (error) {
      console.error('Error getting current price:', error);
      return 10.00;
    }
  };

  // UNIVERSAL PRICE CALCULATION - EXACT 0.1% movements (NO volatility multiplier)
  const calculatePrice = (timesPurchased: number, timesSold: number, basePrice: number = 10.00): number => {
    const netDemand = timesPurchased - timesSold;
    
    let priceMultiplier;
    if (netDemand >= 0) {
      // EXACT: 1.001 = 0.1% increase per purchase (NO volatility multiplier)
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      // EXACT: 0.999 = 0.1% decrease per sale (NO volatility multiplier)
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    
    // CRITICAL: Always return exactly 2 decimal places
    return Math.round(calculatedPrice * 100) / 100;
  };

  // FIXED: Get real bot usernames with better error handling
  const getBotUsernames = (): { [botId: string]: string } => {
    if (!isClient) return {};
    
    try {
      const bots = safeGetFromStorage('autonomousBots', []);
      const botMap: { [botId: string]: string } = {};
      
      bots.forEach((bot: any) => {
        if (bot && bot.id && bot.username) {
          botMap[bot.id] = bot.username;
        }
      });
      
      console.log(`🤖 Loaded ${Object.keys(botMap).length} bot usernames:`, Object.values(botMap).slice(0, 5));
      return botMap;
    } catch (error) {
      console.error('Error loading bot usernames:', error);
      return {};
    }
  };

  // ENHANCED: Better bot detection
  const isBot = (username: string): boolean => {
    const botMap = getBotUsernames();
    const botUsernames = Object.values(botMap);
    
    return botUsernames.includes(username) || 
           username.includes('Bot') || 
           username.includes('Alpha') ||
           username.includes('Beta') ||
           username.includes('Gamma') ||
           username.includes('Delta') ||
           username.includes('Sigma') ||
           username.includes('Prime') ||
           username.includes('The') ||
           username.includes('Contrarian') ||
           username.includes('Trend') ||
           username.includes('Value') ||
           username.includes('Day') ||
           username.includes('Whale') ||
           username.includes('Gambler') ||
           username.includes('Scalper') ||
           username.includes('HODLer') ||
           username.includes('Swing') ||
           username.includes('Arbitrageur');
  };

  // Handle username click - navigate to users page with user filter
  const handleUsernameClick = (username: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Store the selected user in localStorage so the users page can highlight them
    safeSetToStorage('selectedUserFromFeed', username);
    
    // Navigate to users page
    router.push('/users');
  };

  // Handle transaction click - show transaction details modal
  const handleTransactionClick = (activity: ActivityFeedItem) => {
    // Get additional details based on transaction type
    const getAdditionalDetails = () => {
      if (activity.type.includes('bet')) {
        // Try to find the bet in localStorage
        try {
          const bets = safeGetFromStorage('advancedBets', []);
          const bet = bets.find((b: any) => 
            b.bettor === activity.username && 
            b.targetUser === activity.targetUser &&
            Math.abs(b.amount - Math.abs(activity.amount)) < 1
          );
          
          if (bet) {
            return {
              multiplier: bet.multiplier,
              potentialPayout: bet.potentialPayout,
              volatilityRating: bet.volatilityRating,
              expiryDate: bet.expiryDate,
              betStatus: bet.status
            };
          }
        } catch (error) {
          console.error('Error loading bet details:', error);
        }
      } else if (activity.type.includes('short')) {
        // Try to find the short position
        try {
          const shorts = safeGetFromStorage('shortPositions', []);
          const short = shorts.find((s: any) => 
            s.opinionText === activity.opinionText &&
            Math.abs(s.betAmount - Math.abs(activity.amount)) < 1
          );
          
          if (short && activity.shortDetails) {
            const currentPrice = getCurrentPrice(activity.opinionText || '');
            const progress = ((activity.shortDetails.startingPrice - currentPrice) / 
                            (activity.shortDetails.startingPrice - activity.shortDetails.targetPrice)) * 100;
            
            return {
              shortProgress: Math.max(0, Math.min(100, progress)),
              potentialPayout: activity.shortDetails.potentialWinnings,
              expiryDate: short.expirationDate
            };
          }
        } catch (error) {
          console.error('Error loading short details:', error);
        }
      }
      return {};
    };

    const transactionDetail: TransactionDetail = {
      ...activity,
      fullDescription: getFullTransactionDescription(activity),
      additionalDetails: getAdditionalDetails()
    };

    setSelectedTransaction(transactionDetail);
    setShowTransactionModal(true);
  };

  // Get full transaction description for modal
  const getFullTransactionDescription = (activity: ActivityFeedItem): string => {
    const { type, username, opinionText, opinionId, amount, price, quantity, targetUser, betType, targetPercentage, timeframe, shortDetails, isBot } = activity;
    
    const userPrefix = isBot ? '🤖 Bot' : '👤 User';
    
    switch (type) {
      case 'buy':
        // FIXED: Use actual price and quantity from transaction
        const actualBuyPrice = price || (Math.abs(amount) / (quantity || 1));
        const buyQuantity = quantity || 1;
        const totalCost = Math.abs(amount);
        return `${userPrefix} ${username} purchased ${buyQuantity} ${buyQuantity === 1 ? 'share' : 'shares'} of the opinion "${opinionText}" at ${actualBuyPrice.toFixed(2)} per share, spending a total of ${totalCost.toFixed(2)}.`;
      
      case 'sell':
        // FIXED: Use actual price and quantity from transaction
        const actualSellPrice = price || (amount / (quantity || 1));
        const sellQuantity = quantity || 1;
        const totalReceived = amount;
        return `${userPrefix} ${username} sold ${sellQuantity} ${sellQuantity === 1 ? 'share' : 'shares'} of the opinion "${opinionText}" at ${actualSellPrice.toFixed(2)} per share, receiving a total of ${totalReceived.toFixed(2)}.`;
      
      case 'short_place':
        if (shortDetails) {
          return `${userPrefix} ${username} placed a ${Math.abs(amount)} short bet on opinion #${opinionId}. They are betting that the price will drop ${shortDetails.targetDropPercentage}% from ${shortDetails.startingPrice} to ${shortDetails.targetPrice} within ${shortDetails.timeLimit} hours, with potential winnings of ${shortDetails.potentialWinnings}.`;
        }
        return `${userPrefix} ${username} placed a short bet of ${Math.abs(amount)} on the opinion "${opinionText}".`;
      
      case 'short_win':
        return `${userPrefix} ${username} won ${amount} from a successful short bet on the opinion "${opinionText}"! The price dropped to their target level.`;
      
      case 'short_loss':
        return `${userPrefix} ${username} lost ${Math.abs(amount)} on a short bet for the opinion "${opinionText}". The price did not reach their target drop within the time limit.`;
      
      case 'bet_place':
        return `${userPrefix} ${username} placed a ${Math.abs(amount)} bet on ${targetUser}'s portfolio. They are betting that the portfolio will ${betType} by ${targetPercentage}% within ${timeframe} days.`;
      
      case 'bet_win':
        return `${userPrefix} ${username} won ${amount} from a successful portfolio bet on ${targetUser}! Their prediction about the portfolio performance was correct.`;
      
      case 'bet_loss':
        return `${userPrefix} ${username} lost ${Math.abs(amount)} on a portfolio bet against ${targetUser}. Their prediction about the portfolio performance was incorrect.`;
      
      case 'earn':
      case 'generate':
        return `${userPrefix} ${username} generated a new opinion: "${opinionText}" and earned ${amount} as a reward for contributing content to the platform.`;
      
      default:
        return `${userPrefix} ${username} performed a ${type} transaction involving ${Math.abs(amount)}.`;
    }
  };

  // COMPLETELY REWRITTEN: Load all real activity with comprehensive bot transaction processing
  const loadRealActivity = (): ActivityFeedItem[] => {
    if (!isClient) return [];
    
    const activities: ActivityFeedItem[] = [];
    const botMap = getBotUsernames();
    const seenIds = new Set<string>();

    console.log(`🔍 ENHANCED: Loading all activity with comprehensive bot processing...`);
    console.log(`🤖 Bot map loaded: ${Object.keys(botMap).length} bots available`);

    try {
      // 1. ENHANCED: Load ALL bot transactions with better processing
      const botTransactions = safeGetFromStorage('botTransactions', []);
      console.log(`📊 Processing ${botTransactions.length} bot transactions...`);
      
      let botTransactionsProcessed = 0;
      let botTransactionsSkipped = 0;

      botTransactions.forEach((transaction: any, index: number) => {
        try {
          // FIXED: Generate unique ID with better collision prevention
          const uniqueId = transaction.id || `bot_${transaction.botId}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Skip if we've already seen this ID
          if (seenIds.has(uniqueId)) {
            console.log(`⚠️ Duplicate transaction ID skipped: ${uniqueId}`);
            botTransactionsSkipped++;
            return;
          }
          seenIds.add(uniqueId);

          // FIXED: Get actual bot name with fallback
          let botName = 'Unknown Bot';
          if (transaction.botId && botMap[transaction.botId]) {
            botName = botMap[transaction.botId];
          } else if (transaction.botId) {
            botName = `Bot_${transaction.botId.slice(-6)}`;
          }

          // FIXED: Better transaction type mapping
          let activityType = transaction.type;
          let amount = parseFloat(transaction.amount) || 0;
          
          // CRITICAL FIX: Extract actual price and quantity from metadata with better fallbacks
          let actualPrice: number | undefined;
          let actualQuantity: number | undefined;
          
          if (transaction.metadata && typeof transaction.metadata === 'object') {
            actualPrice = transaction.metadata.purchasePricePerShare || transaction.metadata.price;
            actualQuantity = transaction.metadata.quantity;
            
            // Debug log for price extraction
            if (actualPrice) {
              console.log(`💰 Extracted price from metadata: ${botName} - ${actualPrice.toFixed(2)} x ${actualQuantity || 1}`);
            }
          }
          
          // CRITICAL FIX: Calculate proper price if not in metadata - NEVER allow $0.00
          if (!actualPrice && (transaction.type === 'buy' || transaction.type === 'sell')) {
            if (transaction.opinionText) {
              // Get current market price for this opinion
              const marketData = safeGetFromStorage('opinionMarketData', {});
              if (marketData[transaction.opinionText]) {
                actualPrice = marketData[transaction.opinionText].currentPrice;
                if (typeof actualPrice !== 'undefined') {
                  console.log(`💡 Using market price for ${transaction.opinionText}: ${actualPrice.toFixed(2)}`);
                } else {
                  console.log(`💡 Market price for ${transaction.opinionText} is undefined`);
                }
              } else {
                // Calculate price based on purchase history
                const allBotTx = botTransactions.filter((tx: any) => tx.opinionText === transaction.opinionText);
                const purchases = allBotTx.filter((tx: any) => tx.type === 'buy').length;
                const sales = allBotTx.filter((tx: any) => tx.type === 'sell').length;
                actualPrice = calculatePrice(purchases, sales, 10.00);
                console.log(`🔧 Calculated price for ${transaction.opinionText}: ${actualPrice.toFixed(2)} (${purchases} buys, ${sales} sells)`);
              }
              
              // Set quantity if not provided
              if (!actualQuantity) {
                actualQuantity = Math.max(1, Math.round(Math.abs(amount) / (actualPrice ?? 10.00)));
              }
            } else {
              // Ultimate fallback: never allow $0.00
              actualPrice = Math.max(10.00, Math.abs(amount));
              actualQuantity = 1;
              console.log(`⚠️ Fallback pricing for ${botName}: ${actualPrice.toFixed(2)} x 1`);
            }
          }
          
          // CRITICAL: Ensure prices are never $0.00
          if (actualPrice && actualPrice < 0.01) {
            actualPrice = 10.00; // Reset to base price
            console.log(`🔧 Fixed $0.00 price for ${botName} - reset to $10.00`);
          }
          
          // Normalize transaction types to match ActivityFeedItem interface
          switch (transaction.type) {
            case 'bet':
              activityType = 'bet_place';
              amount = -Math.abs(amount); // Bets are expenses
              break;
            case 'buy':
              activityType = 'buy';
              amount = -Math.abs(amount); // Purchases are expenses
              break;
            case 'sell':
              activityType = 'sell';
              amount = Math.abs(amount); // Sales are income
              break;
            case 'earn':
            case 'generate':
              activityType = 'earn';
              amount = Math.abs(amount); // Earnings are income
              break;
            case 'short_place':
              activityType = 'short_place';
              amount = -Math.abs(amount); // Short bets are expenses
              break;
            case 'short_win':
              activityType = 'short_win';
              amount = Math.abs(amount); // Short wins are income
              break;
            case 'short_loss':
              activityType = 'short_loss';
              amount = -Math.abs(amount); // Short losses are expenses
              break;
          }

          // FIXED: Better timestamp parsing with multiple format support
          let timestamp: string;
          if (transaction.date) {
            try {
              let parsedDate: Date;
              
              if (typeof transaction.date === 'string') {
                if (transaction.date.includes('T')) {
                  parsedDate = new Date(transaction.date);
                } else {
                  parsedDate = new Date(transaction.date);
                }
              } else {
                parsedDate = new Date(transaction.date);
              }

              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.toISOString();
              } else {
                timestamp = new Date().toISOString();
                console.log(`⚠️ Invalid date for transaction ${uniqueId}, using current time`);
              }
            } catch (error) {
              timestamp = new Date().toISOString();
              console.log(`⚠️ Date parsing error for transaction ${uniqueId}:`, error);
            }
          } else {
            timestamp = new Date().toISOString();
          }

          const newActivity: ActivityFeedItem = {
            id: uniqueId,
            type: activityType as any,
            username: botName,
            opinionText: transaction.opinionText,
            opinionId: transaction.opinionId,
            amount: amount,
            // CRITICAL: Use actual price and quantity with proper decimals
            price: actualPrice ? Math.round(actualPrice * 100) / 100 : undefined,
            quantity: actualQuantity,
            timestamp: timestamp,
            relativeTime: getRelativeTime(timestamp),
            isBot: true
          };

          activities.push(newActivity);
          botTransactionsProcessed++;

          // DEBUG: Log transactions with pricing info for verification
          if (actualPrice && (transaction.type === 'buy' || transaction.type === 'sell')) {
            console.log(`🤖💰 Processed: ${botName} - ${activityType} - ${actualQuantity}x @ ${actualPrice.toFixed(2)} = ${Math.abs(amount).toFixed(2)}`);
          }

        } catch (error) {
          console.error(`Error processing bot transaction ${index}:`, error, transaction);
          botTransactionsSkipped++;
        }
      });

      console.log(`✅ Bot transactions: ${botTransactionsProcessed} processed, ${botTransactionsSkipped} skipped`);

      // 2. Load USER transactions (YOUR activity) - Enhanced with better error handling
      try {
        const userTransactions = safeGetFromStorage('transactions', []);
        console.log(`👤 Processing ${userTransactions.length} user transactions...`);
        
        let userTransactionsProcessed = 0;

        userTransactions.forEach((t: any, index: number) => {
          try {
            // Generate unique ID for user transactions
            const uniqueId = t.id || `user_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Skip if duplicate
            if (seenIds.has(uniqueId)) {
              return;
            }
            seenIds.add(uniqueId);

            // Parse timestamp
            let timestamp: string;
            try {
              const parsedDate = new Date(t.date || new Date());
              timestamp = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
            } catch {
              timestamp = new Date().toISOString();
            }

            activities.push({
              id: uniqueId,
              type: t.type,
              username: currentUser.username,
              opinionText: t.opinionText || t.description?.replace(/^(Bought|Sold|Generated) /, ''),
              opinionId: t.opinionId,
              amount: parseFloat(t.amount) || 0,
              price: t.price ? Math.round(t.price * 100) / 100 : undefined,
              quantity: t.quantity,
              timestamp: timestamp,
              relativeTime: getRelativeTime(timestamp),
              isBot: false
            });

            userTransactionsProcessed++;
          } catch (error) {
            console.error(`Error processing user transaction ${index}:`, error);
          }
        });

        console.log(`✅ User transactions: ${userTransactionsProcessed} processed`);
      } catch (error) {
        console.error('Error loading user transactions:', error);
      }

      // 3. Load global activity feed (manual entries) - Enhanced
      try {
        const globalFeed = safeGetFromStorage('globalActivityFeed', []);
        console.log(`🌐 Processing ${globalFeed.length} global feed entries...`);
        
        let globalEntriesProcessed = 0;

        globalFeed.forEach((activity: any) => {
          try {
            // Skip if duplicate
            if (seenIds.has(activity.id)) {
              return;
            }
            seenIds.add(activity.id);

            activities.push({
              ...activity,
              isBot: isBot(activity.username),
              relativeTime: getRelativeTime(activity.timestamp),
              // Ensure proper decimal precision for amounts and prices
              amount: typeof activity.amount === 'number' ? Math.round(activity.amount * 100) / 100 : activity.amount,
              price: activity.price ? Math.round(activity.price * 100) / 100 : activity.price
            });

            globalEntriesProcessed++;
          } catch (error) {
            console.error('Error processing global feed entry:', error);
          }
        });

        console.log(`✅ Global feed: ${globalEntriesProcessed} processed`);
      } catch (error) {
        console.error('Error loading global activity feed:', error);
      }

      // 4. ONLY add demo/helpful data if NO real data exists
      if (activities.length === 0) {
        console.log('📝 No real activity found - checking bot system status...');
        
        // Check if bot system is running
        if (typeof window !== 'undefined' && (window as any).botSystem) {
          const botSystem = (window as any).botSystem;
          const isRunning = botSystem.isSystemRunning();
          console.log(`🤖 Bot system status: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
          
          if (!isRunning) {
            console.log('⚠️ Bot system is stopped! Attempting to start...');
            try {
              botSystem.startBots();
              console.log('✅ Bot system start command sent');
            } catch (error) {
              console.error('❌ Failed to start bot system:', error);
            }
          } else {
            // Bot system is running but no transactions - force some activity
            console.log('🤖 Bot system running but no transactions found - forcing activity...');
            try {
              botSystem.forceBotActivity(5);
              console.log('✅ Forced bot activity command sent');
            } catch (error) {
              console.error('❌ Failed to force bot activity:', error);
            }
          }
        } else {
          console.log('❌ Bot system not found in window object');
        }

        // Add helpful system message
        activities.push({
          id: 'system_message',
          type: 'generate',
          username: 'System',
          opinionText: 'Bot system initializing... If this persists, click "Start Bots" above.',
          amount: 0,
          timestamp: new Date().toISOString(),
          relativeTime: 'just now',
          isBot: false
        });
      }

    } catch (error) {
      console.error('❌ Error in loadRealActivity:', error);
    }

    // ENHANCED: Sort and deduplicate with better logic
    const uniqueActivities = activities
      .filter((activity, index, self) => {
        // More sophisticated deduplication
        const isDuplicate = self.findIndex(a => 
          a.id === activity.id || 
          (a.username === activity.username && 
           a.type === activity.type && 
           a.amount === activity.amount && 
           Math.abs(new Date(a.timestamp).getTime() - new Date(activity.timestamp).getTime()) < 1000)
        ) !== index;
        
        return !isDuplicate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 200); // Keep last 200 activities

    // ENHANCED: Detailed logging
    const botActivities = uniqueActivities.filter(a => a.isBot);
    const userActivities = uniqueActivities.filter(a => !a.isBot);
    const activityBreakdown = uniqueActivities.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`📊 FINAL RESULTS:`);
    console.log(`   Total activities: ${uniqueActivities.length}`);
    console.log(`   🤖 Bot activities: ${botActivities.length}`);
    console.log(`   👤 User activities: ${userActivities.length}`);
    console.log(`   📈 Activity breakdown:`, activityBreakdown);
    console.log(`   🔗 Unique bot usernames:`, [...new Set(botActivities.map(a => a.username))].slice(0, 10));
    
    return uniqueActivities;
  };

  // Get activity icon class
  const getActivityIconClass = (type: string) => {
    switch (type) {
      case 'buy': return styles.buy;
      case 'sell': return styles.sell;
      case 'bet_place': return styles.betPlace;
      case 'bet_win': return styles.betWin;
      case 'bet_loss': return styles.betLoss;
      case 'short_place': return styles.shortPlace;
      case 'short_win': return styles.shortWin;
      case 'short_loss': return styles.shortLoss;
      case 'earn':
      case 'generate': return styles.generate;
      default: return styles.buy;
    }
  };

  // Get activity icon emoji
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'buy': return '🛒';
      case 'sell': return '💰';
      case 'bet_place': return '🎲';
      case 'bet_win': return '🎉';
      case 'bet_loss': return '😞';
      case 'short_place': return '📉';
      case 'short_win': return '💹';
      case 'short_loss': return '📈';
      case 'earn':
      case 'generate': return '✨';
      default: return '📊';
    }
  };

  // FIXED: Format activity description with accurate price display
  const formatActivityDescription = (activity: ActivityFeedItem) => {
    const { type, username, opinionText, opinionId, amount, price, quantity, targetUser, betType, targetPercentage, timeframe, shortDetails, isBot } = activity;
    
    const userPrefix = isBot ? '🤖 ' : '';
    const UsernameLink = ({ username, isBot }: { username: string; isBot?: boolean }) => (
      <span 
        className={styles.clickableUsername}
        onClick={(e) => handleUsernameClick(username, e)}
        style={{ 
          color: isBot ? '#10b981' : '#3b82f6', 
          fontWeight: 'bold', 
          cursor: 'pointer',
          textDecoration: 'underline'
        }}
      >
        {username}
      </span>
    );
    
    switch (type) {
      case 'buy':
        // FIXED: Use actual transaction data with proper decimal formatting
        const actualBuyPrice = price || (Math.abs(amount) / (quantity || 1));
        const buyQuantity = quantity || 1;
        
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> bought {buyQuantity} {buyQuantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${actualBuyPrice.toFixed(2)}</strong> each
          </span>
        );
        
      case 'sell':
        // FIXED: Use actual transaction data with proper decimal formatting  
        const actualSellPrice = price || (amount / (quantity || 1));
        const sellQuantity = quantity || 1;
        
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> sold {sellQuantity} {sellQuantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${actualSellPrice.toFixed(2)}</strong> each
          </span>
        );
        
      case 'short_place':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> placed <strong>${Math.abs(amount).toFixed(2)}</strong> short bet on{' '}
            <em>Opinion #{opinionId}</em> targeting {shortDetails?.targetDropPercentage}% drop{' '}
            {shortDetails?.timeLimit && `in ${shortDetails.timeLimit}h`}
          </span>
        );
        
      case 'short_win':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> won <strong>${amount.toFixed(2)}</strong> from short bet on{' '}
            <em>Opinion #{opinionId}</em>! Price hit target 📉
          </span>
        );
        
      case 'short_loss':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> lost <strong>${Math.abs(amount).toFixed(2)}</strong> on short bet{' '}
            <em>Opinion #{opinionId}</em> - target not reached
          </span>
        );
        
      case 'bet_place':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> bet <strong>${Math.abs(amount).toFixed(2)}</strong> that{' '}
            <UsernameLink username={targetUser || 'Unknown'} /> portfolio will {betType} by {targetPercentage}% in {timeframe} days
          </span>
        );
        
      case 'bet_win':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> won <strong>${amount.toFixed(2)}</strong> from a portfolio bet on{' '}
            <UsernameLink username={targetUser || 'Unknown'} />! 🎉
          </span>
        );
        
      case 'bet_loss':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> lost <strong>${Math.abs(amount).toFixed(2)}</strong> on a portfolio bet
          </span>
        );
        
      case 'earn':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> generated opinion: <em>"{opinionText?.slice(0, 40)}..."</em> and earned <strong>${amount.toFixed(2)}</strong>
          </span>
        );
        
      case 'generate':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> generated a new opinion and earned <strong>${amount.toFixed(2)}</strong>
          </span>
        );
        
      default:
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> performed an action for <strong>${Math.abs(amount).toFixed(2)}</strong>
          </span>
        );
    }
  };

  // Filter activities
  const filterActivities = (activities: ActivityFeedItem[]) => {
    switch (filter) {
      case 'trades':
        return activities.filter(a => a.type === 'buy' || a.type === 'sell');
      case 'bets':
        return activities.filter(a => a.type === 'bet_place' || a.type === 'bet_win' || a.type === 'bet_loss');
      case 'shorts':
        return activities.filter(a => a.type === 'short_place' || a.type === 'short_win' || a.type === 'short_loss');
      case 'generates':
        return activities.filter(a => a.type === 'generate' || a.type === 'earn');
      default:
        return activities;
    }
  };

  // Get filter count
  const getFilterCount = (filterType: string) => {
    switch (filterType) {
      case 'all':
        return activityFeed.length;
      case 'trades':
        return activityFeed.filter(a => a.type === 'buy' || a.type === 'sell').length;
      case 'bets':
        return activityFeed.filter(a => a.type.includes('bet')).length;
      case 'shorts':
        return activityFeed.filter(a => a.type.includes('short')).length;
      case 'generates':
        return activityFeed.filter(a => a.type === 'generate' || a.type === 'earn').length;
      default:
        return 0;
    }
  };

  // Get amount class
  const getAmountClass = (amount: number) => {
    return amount >= 0 ? styles.positive : styles.negative;
  };

  // ENHANCED: Force refresh with better diagnostics
  const forceRefreshFeed = () => {
    if (!isClient) return;
    
    console.log('🔄 ENHANCED: Force refreshing activity feed with diagnostics...');
    
    // Pre-refresh diagnostics
    const preRefreshStats = {
      botTransactions: safeGetFromStorage('botTransactions', []).length,
      userTransactions: safeGetFromStorage('transactions', []).length,
      globalFeed: safeGetFromStorage('globalActivityFeed', []).length,
      autonomousBots: safeGetFromStorage('autonomousBots', []).length
    };
    
    console.log('📊 Pre-refresh stats:', preRefreshStats);
    
    // Check bot system status
    if (typeof window !== 'undefined' && (window as any).botSystem) {
      const botSystem = (window as any).botSystem;
      console.log('🤖 Bot system status:', {
        isRunning: botSystem.isSystemRunning(),
        activeBots: botSystem.getBots().filter((b: any) => b.isActive).length,
        totalBots: botSystem.getBots().length
      });
      
      // Force some bot activity
      console.log('🚀 Forcing bot activity...');
      try {
        botSystem.forceBotActivity(8);
        console.log('✅ Bot activity forced');
      } catch (error) {
        console.error('❌ Failed to force bot activity:', error);
      }
    }
    
    // Reload activity feed
    const newActivity = loadRealActivity();
    setActivityFeed(newActivity);
    setLastRefresh(Date.now());
    
    console.log(`✅ Feed refreshed: ${newActivity.length} activities loaded`);
    console.log(`🎯 Bot activities: ${newActivity.filter(a => a.isBot).length}`);
    console.log(`🎯 User activities: ${newActivity.filter(a => !a.isBot).length}`);
  };

  // ENHANCED: Check and start bot system if needed
  const ensureBotsRunning = () => {
    if (!isClient) return;
    
    if (typeof window !== 'undefined') {
      if ((window as any).botSystem) {
        const botSystem = (window as any).botSystem;
        if (!botSystem.isSystemRunning()) {
          console.log('🚀 Starting bot system...');
          botSystem.startBots();
          
          // Force some immediate activity
          setTimeout(() => {
            console.log('🎯 Forcing immediate bot activity...');
            botSystem.forceBotActivity(5);
          }, 3000);
        } else {
          console.log('✅ Bot system is already running');
          // Still force some activity to populate feed
          setTimeout(() => {
            botSystem.forceBotActivity(3);
          }, 1000);
        }
      } else {
        console.log('❌ Bot system not found - may still be loading');
      }
    }
  };

  // Make addToGlobalFeed available globally for other components to use
  useEffect(() => {
    if (!isClient) return;
    
    (window as any).addToGlobalFeed = addToGlobalFeed;
    (window as any).forceRefreshFeed = forceRefreshFeed;
    
    return () => {
      delete (window as any).addToGlobalFeed;
      delete (window as any).forceRefreshFeed;
    };
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    // Load opinions for sidebar
    const stored = safeGetFromStorage('opinions', null);
    if (stored) {
      const parsed = stored;
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setOpinions(validOpinions.map((text: string, i: number) => ({ id: i.toString(), text })));
    }

    // Load current user
    const storedProfile = safeGetFromStorage('userProfile', null);
    if (storedProfile) {
      setCurrentUser(storedProfile);
    }

    // Ensure bots are running
    ensureBotsRunning();
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    // Load real activity immediately
    const realActivity = loadRealActivity();
    setActivityFeed(realActivity);

    // Update relative times every minute
    const interval = setInterval(() => {
      setActivityFeed(prevFeed => 
        prevFeed.map(activity => ({
          ...activity,
          relativeTime: getRelativeTime(activity.timestamp)
        }))
      );
    }, 60000);

    // ENHANCED: More frequent refresh with better change detection
    const refreshInterval = setInterval(() => {
      const currentActivityCount = activityFeed.length;
      const botTransactionCount = safeGetFromStorage('botTransactions', []).length;
      
      // Check if new transactions have been added
      const lastBotTransactionCount = parseInt(safeGetFromStorage('lastBotTransactionCount', '0') || '0');
      
      if (botTransactionCount !== lastBotTransactionCount) {
        console.log(`🔄 New bot transactions detected: ${botTransactionCount} (was ${lastBotTransactionCount})`);
        safeSetToStorage('lastBotTransactionCount', botTransactionCount.toString());
        
        const newActivity = loadRealActivity();
        if (newActivity.length !== currentActivityCount) {
          console.log(`📈 Activity count changed: ${newActivity.length} (was ${currentActivityCount})`);
          setActivityFeed(newActivity);
        }
      }
      
      // Ensure bots stay running
      if (activityFeed.filter(a => a.isBot).length < 3) {
        console.log('⚠️ Low bot activity detected - ensuring bots are running...');
        ensureBotsRunning();
      }
    }, 2000); // Check every 2 seconds

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [opinions, currentUser, isClient]);

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return <div>Loading...</div>;
  }

  const filteredActivities = filterActivities(activityFeed);
  const botActivityCount = activityFeed.filter(a => a.isBot).length;
  const humanActivityCount = activityFeed.filter(a => !a.isBot).length;
  const shortActivityCount = activityFeed.filter(a => a.type.includes('short')).length;

  return (
    <div className="page-container">
      <Sidebar opinions={opinions} />
      
      <main className="main-content">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.headerTitle}>
              📡 Live Trading Feed
            </h1>
            <p className={styles.headerSubtitle}>
              Real-time marketplace activity from all traders & bots ({botActivityCount} bot, {humanActivityCount} human, {shortActivityCount} shorts)
            </p>
          </div>
          
          <div className={styles.headerActions}>
            {/* Enhanced Refresh Button */}
            <button 
              onClick={forceRefreshFeed}
              className="nav-button"
              style={{ backgroundColor: '#8b5cf6' }}
            >
              🔄 Refresh
            </button>

            {/* Enhanced Start Bots Button */}
            <button 
              onClick={() => {
                console.log('🤖 Manual bot start clicked');
                if (typeof window !== 'undefined' && (window as any).restartBots) {
                  console.log('🔄 Restarting bot system...');
                  (window as any).restartBots();
                  setTimeout(forceRefreshFeed, 3000);
                } else if (typeof window !== 'undefined' && (window as any).manualStartBots) {
                  console.log('🔧 Manual start fallback...');
                  (window as any).manualStartBots();
                  setTimeout(forceRefreshFeed, 2000);
                } else {
                  console.log('⚡ Basic ensure bots fallback...');
                  ensureBotsRunning();
                  setTimeout(forceRefreshFeed, 2000);
                }
              }}
              className="nav-button"
              style={{ backgroundColor: '#10b981' }}
            >
              🤖 Start Bots
            </button>

            {/* Debug Button (visible in development) */}
            <button 
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).debugBots) {
                  (window as any).debugBots();
                } else {
                  console.log('📊 MANUAL DEBUG:');
                  console.log('Bot transactions:', safeGetFromStorage('botTransactions', []).length);
                  console.log('User transactions:', safeGetFromStorage('transactions', []).length);
                  console.log('Current feed:', activityFeed.length);
                  console.log('Bot system:', typeof (window as any).botSystem);
                  
                  // Debug recent transactions with price info
                  const recentBotTx = safeGetFromStorage('botTransactions', []).slice(-5);
                  console.log('Recent bot transactions with metadata:');
                  recentBotTx.forEach((tx: any, i: number) => {
                    console.log(`${i+1}. ${tx.type} - Amount: ${tx.amount} - Metadata:`, tx.metadata);
                  });
                }
              }}
              className="nav-button"
              style={{ backgroundColor: '#6b7280', fontSize: '12px', padding: '8px 12px' }}
            >
              🔍 Debug
            </button>

            {/* Generate Opinions Button */}
            <a href="/generate" className="nav-button generate">
              ✨ Generate Opinions
            </a>

            {/* Navigation Buttons */}
            <a href="/users" className="nav-button traders">
              👥 Traders
            </a>
            <a href="/" className="nav-button traders">
              👤 My Wallet
            </a>
          </div>
        </div>

        {/* Filter Controls */}
        <div className={styles.filterControls}>
          <span className={styles.filterLabel}>Filter:</span>
          {(['all', 'trades', 'bets', 'shorts', 'generates'] as const).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`${styles.filterButton} ${filter === filterType ? styles.active : ''}`}
            >
              {filterType === 'all' ? `All Activity (${getFilterCount(filterType)})` :
               filterType === 'trades' ? `Trades (${getFilterCount(filterType)})` :
               filterType === 'bets' ? `Bets (${getFilterCount(filterType)})` :
               filterType === 'shorts' ? `Shorts (${getFilterCount(filterType)})` :
               `Generates (${getFilterCount(filterType)})`}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div className={styles.feedContainer}>
          {/* Enhanced Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.liveIndicator}></div>
            LIVE • {filteredActivities.length} Recent Activities • 
            🤖 {botActivityCount} bots • 👤 {humanActivityCount} users • 
            Last refresh: {new Date(lastRefresh).toLocaleTimeString()}
          </div>

          {/* Feed Content */}
          <div className={styles.feedContent}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyFeed}>
                <p>📭</p>
                <p>No activity found matching your filter.</p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  🤖 Bot system may be starting up. Click "Start Bots" to begin automated trading.
                </p>
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => {
                      ensureBotsRunning();
                      setTimeout(forceRefreshFeed, 2000);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🤖 Start Bot System
                  </button>
                  <button 
                    onClick={forceRefreshFeed}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh Feed
                  </button>
                  {/* Force Bot Activity Button */}
                  <button 
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).forceBotActivity) {
                        (window as any).forceBotActivity(10);
                        setTimeout(forceRefreshFeed, 3000);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    🚀 Force Bot Activity
                  </button>
                </div>
              </div>
            ) : (
              filteredActivities.map((activity, index) => {
                const isUserActivity = activity.username === currentUser.username;
                const isBotActivity = activity.isBot;
                const isShortActivity = activity.type.includes('short');
                
                return (
                  <div 
                    key={activity.id}
                    className={`${styles.activityItem} ${isUserActivity ? styles.userActivity : ''} ${isBotActivity ? styles.botActivity : ''} ${isShortActivity ? styles.shortActivity : ''}`}
                    onClick={() => handleTransactionClick(activity)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.activityLayout}>
                      {/* Activity Icon */}
                      <div className={`${styles.activityIcon} ${getActivityIconClass(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>

                      {/* Activity Content */}
                      <div className={styles.activityContent}>
                        <div className={styles.activityDescription}>
                          {formatActivityDescription(activity)}
                          {isUserActivity && (
                            <span className={styles.userBadge}>
                              YOU
                            </span>
                          )}
                          {isBotActivity && (
                            <span className={styles.botBadge}>
                              BOT
                            </span>
                          )}
                          {isShortActivity && (
                            <span className={styles.shortBadge}>
                              SHORT
                            </span>
                          )}
                        </div>
                        
                        <div className={styles.activityMeta}>
                          <span className={styles.activityTime}>{activity.relativeTime}</span>
                          <span className={`${styles.activityAmount} ${getAmountClass(activity.amount)}`}>
                            {activity.amount >= 0 ? '+' : ''}${Math.abs(activity.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Transaction Details Modal - Keeping original implementation */}
        {showTransactionModal && selectedTransaction && (
          <div 
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTransactionModal(false);
                setSelectedTransaction(null);
              }
            }}
          >
            <div className={styles.transactionModal}>
              <div className={styles.modalHeader}>
                <h2>
                  {getActivityIcon(selectedTransaction.type)} Transaction Details
                </h2>
                <button
                  onClick={() => {
                    setShowTransactionModal(false);
                    setSelectedTransaction(null);
                  }}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <div className={styles.modalContent}>
                {/* Transaction Type & User */}
                <div className={styles.transactionHeader}>
                  <div className={styles.transactionType}>
                    <span className={`${styles.typeTag} ${styles[selectedTransaction.type]}`}>
                      {selectedTransaction.type.toUpperCase().replace('_', ' ')}
                    </span>
                    {selectedTransaction.isBot && (
                      <span className={styles.botTag}>🤖 BOT</span>
                    )}
                    {selectedTransaction.type.includes('short') && (
                      <span className={styles.shortTag}>📉 SHORT</span>
                    )}
                  </div>
                  <div className={styles.transactionAmount}>
                    <span className={getAmountClass(selectedTransaction.amount)}>
                      {selectedTransaction.amount >= 0 ? '+' : ''}${Math.abs(selectedTransaction.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Full Description */}
                <div className={styles.transactionDescription}>
                  <p>{selectedTransaction.fullDescription}</p>
                </div>

                {/* Transaction Details */}
                <div className={styles.transactionDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>User:</span>
                    <span 
                      className={styles.clickableUsername}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUsernameClick(selectedTransaction.username, e);
                        setShowTransactionModal(false);
                      }}
                      style={{ 
                        color: selectedTransaction.isBot ? '#10b981' : '#3b82f6', 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {selectedTransaction.isBot ? '🤖 ' : '👤 '}{selectedTransaction.username}
                    </span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Time:</span>
                    <span>{new Date(selectedTransaction.timestamp).toLocaleString()}</span>
                  </div>

                  {selectedTransaction.opinionText && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Opinion:</span>
                      <span className={styles.opinionText}>"{selectedTransaction.opinionText}"</span>
                    </div>
                  )}

                  {selectedTransaction.opinionId && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Opinion ID:</span>
                      <span>#{selectedTransaction.opinionId}</span>
                    </div>
                  )}

                  {/* ENHANCED: Show price and quantity details for trades */}
                  {(selectedTransaction.type === 'buy' || selectedTransaction.type === 'sell') && selectedTransaction.price && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Price per share:</span>
                        <span>${selectedTransaction.price.toFixed(2)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Quantity:</span>
                        <span>{selectedTransaction.quantity || 1} shares</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Total value:</span>
                        <span>${Math.abs(selectedTransaction.amount).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.modalActions}>
                  {selectedTransaction.username !== currentUser.username && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUsernameClick(selectedTransaction.username, e);
                        setShowTransactionModal(false);
                      }}
                      className={styles.viewUserButton}
                    >
                      👤 View {selectedTransaction.isBot ? 'Bot' : 'User'} Profile
                    </button>
                  )}
                  
                  {selectedTransaction.opinionId && (
                    <button
                      onClick={() => {
                        router.push(`/opinion/${selectedTransaction.opinionId}`);
                        setShowTransactionModal(false);
                      }}
                      className={styles.viewOpinionButton}
                    >
                      💬 View Opinion
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowTransactionModal(false);
                      setSelectedTransaction(null);
                    }}
                    className={styles.closeModalButton}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Market Stats */}
        <div className={styles.marketStats}>
          <div className={`${styles.statCard} ${styles.purchases}`}>
            <div className={`${styles.statNumber} ${styles.purchases}`}>
              {activityFeed.filter(a => a.type === 'buy').length}
            </div>
            <div className={styles.statLabel}>Total Purchases</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.sales}`}>
            <div className={`${styles.statNumber} ${styles.sales}`}>
              {activityFeed.filter(a => a.type === 'sell').length}
            </div>
            <div className={styles.statLabel}>Total Sales</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.bets}`}>
            <div className={`${styles.statNumber} ${styles.bets}`}>
              {activityFeed.filter(a => a.type.includes('bet')).length}
            </div>
            <div className={styles.statLabel}>Portfolio Bets</div>
          </div>

          <div className={`${styles.statCard} ${styles.shorts}`}>
            <div className={`${styles.statNumber} ${styles.shorts}`}>
              {shortActivityCount}
            </div>
            <div className={styles.statLabel}>Short Positions</div>
          </div>
          
          <div className={`${styles.statCard} ${styles.volume}`}>
            <div className={`${styles.statNumber} ${styles.volume}`}>
              ${activityFeed.reduce((sum, a) => sum + Math.abs(a.amount), 0).toFixed(2)}
            </div>
            <div className={styles.statLabel}>Total Volume</div>
          </div>
        </div>

        {/* Enhanced Activity Status with Diagnostics */}
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: botActivityCount > 0 ? '#f0f9ff' : '#fef3c7', 
          border: '1px solid ' + (botActivityCount > 0 ? '#e0f2fe' : '#fde68a'), 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: botActivityCount > 0 ? '#0369a1' : '#92400e' }}>
            🤖 <strong>{botActivityCount}</strong> bot activities • 
            👥 <strong>{humanActivityCount}</strong> human activities • 
            📉 <strong>{shortActivityCount}</strong> short positions •
            📊 <strong>{safeGetFromStorage('botTransactions', []).length}</strong> total bot transactions
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            {botActivityCount > 0 ? 
              'Live feed updates automatically every 2 seconds with consistent 0.1% pricing (NO volatility multiplier)' : 
              'No bot activity detected - click "Start Bots" above to begin trading'
            }
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {botActivityCount === 0 && (
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined' && (window as any).debugBots) {
                    (window as any).debugBots();
                  }
                }}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔍 Debug Bot System
              </button>
            )}
            
            <button 
              onClick={() => {
                console.log('📊 ACTIVITY STATS:');
                console.log('Current feed length:', activityFeed.length);
                console.log('Bot activities:', botActivityCount);
                console.log('Bot transaction storage:', safeGetFromStorage('botTransactions', []).length);
                console.log('Bot system exists:', typeof (window as any).botSystem !== 'undefined');
                if ((window as any).botSystem) {
                  console.log('Bot system running:', (window as any).botSystem.isSystemRunning());
                }
                
                // Show recent transactions with price info
                const recent = safeGetFromStorage('botTransactions', []).slice(-3);
                console.log('Recent transactions with price data:');
                recent.forEach((tx: any, i: number) => {
                  console.log(`${i+1}. ${tx.type} - Amount: ${tx.amount} - Price data:`, {
                    metadata: tx.metadata,
                    calculatedPrice: tx.metadata?.purchasePricePerShare || (Math.abs(tx.amount) / (tx.metadata?.quantity || 1))
                  });
                });
              }}
              style={{
                padding: '4px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              📊 Show Stats
            </button>

            <button 
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).forceBotActivity) {
                  (window as any).forceBotActivity(5);
                  setTimeout(forceRefreshFeed, 3000);
                }
              }}
              style={{
                padding: '4px 12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🚀 Force Activity
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}