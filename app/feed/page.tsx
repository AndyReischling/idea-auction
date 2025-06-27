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

  // Fix hydration by ensuring client-side only rendering for time-sensitive content
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Function to add activity to global feed
  const addToGlobalFeed = (activity: Omit<ActivityFeedItem, 'id' | 'relativeTime'>) => {
    const newActivity: ActivityFeedItem = {
      ...activity,
      id: `${Date.now()}_${Math.random()}`,
      relativeTime: getRelativeTime(activity.timestamp)
    };

    // Get existing global feed
    const existingFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
    
    // Add new activity to beginning and keep last 200 items
    const updatedFeed = [newActivity, ...existingFeed].slice(0, 200);
    
    // Save back to localStorage
    localStorage.setItem('globalActivityFeed', JSON.stringify(updatedFeed));
    
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

  // Get current price for an opinion
  const getCurrentPrice = (opinionText: string): number => {
    try {
      const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
      if (marketData[opinionText]) {
        return marketData[opinionText].currentPrice;
      }
      return 10; // Default base price
    } catch (error) {
      return 10;
    }
  };

  // Get bot usernames for identification
  const getBotUsernames = (): string[] => {
    try {
      const bots = JSON.parse(localStorage.getItem('autonomousBots') || '[]');
      return bots.map((bot: any) => bot.username);
    } catch {
      return [];
    }
  };

  // Check if username is a bot
  const isBot = (username: string): boolean => {
    const botUsernames = getBotUsernames();
    return botUsernames.includes(username) || 
           username.includes('AI_') || 
           username.includes('Bot') || 
           username.includes('bot_');
  };

  // Handle username click - navigate to users page with user filter
  const handleUsernameClick = (username: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Store the selected user in localStorage so the users page can highlight them
    localStorage.setItem('selectedUserFromFeed', username);
    
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
          const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
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
          const shorts = JSON.parse(localStorage.getItem('shortPositions') || '[]');
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
        const buyQuantity = quantity || Math.max(1, Math.floor(Math.abs(amount) / (price || 50)));
        const buyPrice = price || Math.floor(Math.abs(amount) / buyQuantity);
        return `${userPrefix} ${username} purchased ${buyQuantity} ${buyQuantity === 1 ? 'share' : 'shares'} of the opinion "${opinionText}" at $${buyPrice} per share, spending a total of $${Math.abs(amount)}.`;
      
      case 'sell':
        const sellQuantity = quantity || Math.max(1, Math.floor(amount / (price || 50)));
        const sellPrice = price || Math.floor(amount / sellQuantity);
        return `${userPrefix} ${username} sold ${sellQuantity} ${sellQuantity === 1 ? 'share' : 'shares'} of the opinion "${opinionText}" at $${sellPrice} per share, receiving a total of $${amount}.`;
      
      case 'short_place':
        if (shortDetails) {
          return `${userPrefix} ${username} placed a $${Math.abs(amount)} short bet on opinion #${opinionId}. They are betting that the price will drop ${shortDetails.targetDropPercentage}% from $${shortDetails.startingPrice} to $${shortDetails.targetPrice} within ${shortDetails.timeLimit} hours, with potential winnings of $${shortDetails.potentialWinnings}.`;
        }
        return `${userPrefix} ${username} placed a short bet of $${Math.abs(amount)} on the opinion "${opinionText}".`;
      
      case 'short_win':
        return `${userPrefix} ${username} won $${amount} from a successful short bet on the opinion "${opinionText}"! The price dropped to their target level.`;
      
      case 'short_loss':
        return `${userPrefix} ${username} lost $${Math.abs(amount)} on a short bet for the opinion "${opinionText}". The price did not reach their target drop within the time limit.`;
      
      case 'bet_place':
        return `${userPrefix} ${username} placed a $${Math.abs(amount)} bet on ${targetUser}'s portfolio. They are betting that the portfolio will ${betType} by ${targetPercentage}% within ${timeframe} days.`;
      
      case 'bet_win':
        return `${userPrefix} ${username} won $${amount} from a successful portfolio bet on ${targetUser}! Their prediction about the portfolio performance was correct.`;
      
      case 'bet_loss':
        return `${userPrefix} ${username} lost $${Math.abs(amount)} on a portfolio bet against ${targetUser}. Their prediction about the portfolio performance was incorrect.`;
      
      case 'earn':
      case 'generate':
        return `${userPrefix} ${username} generated a new opinion: "${opinionText}" and earned $${amount} as a reward for contributing content to the platform.`;
      
      default:
        return `${userPrefix} ${username} performed a ${type} transaction involving $${Math.abs(amount)}.`;
    }
  };

  // Load all real activity from various sources
  const loadRealActivity = (): ActivityFeedItem[] => {
    const activities: ActivityFeedItem[] = [];

    try {
      // 1. Load real bot transactions
      const botTransactions = JSON.parse(localStorage.getItem('botTransactions') || '[]');
      console.log(`📊 Loading ${botTransactions.length} bot transactions`);
      
      botTransactions.forEach((transaction: any) => {
        const botName = getBotUsernames().find(name => 
          transaction.botId && transaction.botId.includes(name.replace(/[^a-zA-Z0-9]/g, ''))
        ) || `Bot_${transaction.botId?.slice(-3) || 'Unknown'}`;

        let activityType = transaction.type;
        let amount = transaction.amount || 0;
        let opinionText = transaction.opinionText;

        // Convert transaction types to feed types
        if (transaction.type === 'bet') {
          activityType = 'bet_place';
          amount = -Math.abs(amount); // Bets are expenses
        }

        activities.push({
          id: transaction.id || `bot_${Date.now()}_${Math.random()}`,
          type: activityType,
          username: botName,
          opinionText: opinionText,
          amount: amount,
          timestamp: new Date(transaction.date || Date.now()).toISOString(),
          relativeTime: getRelativeTime(new Date(transaction.date || Date.now()).toISOString()),
          isBot: true
        });
      });

      // 2. Load short positions and their transactions
      const shortPositions = JSON.parse(localStorage.getItem('shortPositions') || '[]');
      console.log(`📉 Loading ${shortPositions.length} short positions`);
      
      shortPositions.forEach((short: any) => {
        // Add short placement activity
        const placementExists = activities.some(a => a.id === `short_place_${short.id}`);
        if (!placementExists) {
          activities.push({
            id: `short_place_${short.id}`,
            type: 'short_place',
            username: currentUser.username, // Assuming user placed the short
            opinionText: short.opinionText,
            opinionId: short.opinionId,
            amount: -short.betAmount,
            shortDetails: {
              targetDropPercentage: short.targetDropPercentage,
              startingPrice: short.startingPrice,
              targetPrice: short.targetPrice,
              potentialWinnings: short.potentialWinnings,
              timeLimit: Math.ceil((new Date(short.expirationDate).getTime() - new Date(short.createdDate).getTime()) / (1000 * 60 * 60))
            },
            timestamp: new Date(short.createdDate).toISOString(),
            relativeTime: getRelativeTime(new Date(short.createdDate).toISOString()),
            isBot: false
          });
        }

        // Add short result if resolved
        if (short.status === 'won' || short.status === 'lost') {
          const resultExists = activities.some(a => a.id === `short_result_${short.id}`);
          if (!resultExists) {
            activities.push({
              id: `short_result_${short.id}`,
              type: short.status === 'won' ? 'short_win' : 'short_loss',
              username: currentUser.username,
              opinionText: short.opinionText,
              opinionId: short.opinionId,
              amount: short.status === 'won' ? short.potentialWinnings : -short.betAmount,
              shortDetails: {
                targetDropPercentage: short.targetDropPercentage,
                startingPrice: short.startingPrice,
                targetPrice: short.targetPrice,
                potentialWinnings: short.potentialWinnings,
                timeLimit: Math.ceil((new Date(short.expirationDate).getTime() - new Date(short.createdDate).getTime()) / (1000 * 60 * 60))
              },
              timestamp: new Date().toISOString(),
              relativeTime: getRelativeTime(new Date().toISOString()),
              isBot: false
            });
          }
        }
      });

      // 3. Load from global activity feed (manual entries)
      const globalFeed = JSON.parse(localStorage.getItem('globalActivityFeed') || '[]');
      globalFeed.forEach((activity: any) => {
        // Only add if not already added from bot transactions or shorts
        const exists = activities.some(a => a.id === activity.id);
        if (!exists) {
          activities.push({
            ...activity,
            isBot: isBot(activity.username),
            relativeTime: getRelativeTime(activity.timestamp)
          });
        }
      });

      // 4. Load user's personal transactions (including short transactions)
      const userTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      userTransactions.forEach((t: any) => {
        // Only add if not already in activities
        const exists = activities.some(a => a.id === t.id);
        if (!exists) {
          activities.push({
            id: t.id || `user_${Date.now()}_${Math.random()}`,
            type: t.type,
            username: currentUser.username,
            opinionText: t.opinionText || t.description?.replace(/^(Bought|Sold|Generated) /, ''),
            amount: t.amount,
            timestamp: new Date(t.date || Date.now()).toISOString(),
            relativeTime: getRelativeTime(new Date(t.date || Date.now()).toISOString()),
            isBot: false
          });
        }
      });

      // 5. Load betting activity from advancedBets
      const bets = JSON.parse(localStorage.getItem('advancedBets') || '[]');
      bets.forEach((bet: any) => {
        // Add bet placement activity
        const placeBetExists = activities.some(a => a.id === `bet_place_${bet.id}`);
        if (!placeBetExists) {
          activities.push({
            id: `bet_place_${bet.id}`,
            type: 'bet_place',
            username: bet.bettor,
            amount: -bet.amount,
            targetUser: bet.targetUser,
            betType: bet.betType,
            targetPercentage: bet.targetPercentage,
            timeframe: bet.timeFrame,
            timestamp: new Date(bet.placedDate).toISOString(),
            relativeTime: getRelativeTime(new Date(bet.placedDate).toISOString()),
            isBot: isBot(bet.bettor)
          });
        }

        // Add bet result activity if resolved
        if (bet.status === 'won' || bet.status === 'lost') {
          const resultExists = activities.some(a => a.id === `bet_result_${bet.id}`);
          if (!resultExists) {
            activities.push({
              id: `bet_result_${bet.id}`,
              type: bet.status === 'won' ? 'bet_win' : 'bet_loss',
              username: bet.bettor,
              amount: bet.status === 'won' ? bet.potentialPayout : -bet.amount,
              targetUser: bet.targetUser,
              timestamp: new Date().toISOString(),
              relativeTime: getRelativeTime(new Date().toISOString()),
              isBot: isBot(bet.bettor)
            });
          }
        }
      });

      // 6. If still no activity, show some demo data
      if (activities.length === 0) {
        console.log('📝 No real activity found, generating demo data');
        const demoBot = 'DemoBot_Alpha';
        const now = new Date();
        
        for (let i = 0; i < 5; i++) {
          const timestamp = new Date(now.getTime() - (i * 10 * 60 * 1000)).toISOString(); // 10 min intervals
          const opinionIndex = Math.floor(Math.random() * opinions.length);
          const opinion = opinions[opinionIndex];
          
          if (opinion) {
            activities.push({
              id: `demo_${i}`,
              type: Math.random() > 0.5 ? 'buy' : 'sell',
              username: demoBot,
              opinionText: opinion.text,
              amount: Math.random() > 0.5 ? -150 : 200,
              timestamp,
              relativeTime: getRelativeTime(timestamp),
              isBot: true
            });
          }
        }
      }

    } catch (error) {
      console.error('Error loading activity:', error);
    }

    // Sort by timestamp (newest first) and remove duplicates
    const uniqueActivities = activities
      .filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100); // Keep only last 100 activities

    console.log(`📈 Loaded ${uniqueActivities.length} unique activities (${uniqueActivities.filter(a => a.isBot).length} bot activities, ${uniqueActivities.filter(a => a.type.includes('short')).length} short activities)`);
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

  // Format activity description with clickable username
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
        const buyQuantity = quantity || Math.max(1, Math.floor(Math.abs(amount) / (price || 50)));
        const buyPrice = price || Math.floor(Math.abs(amount) / buyQuantity);
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> bought {buyQuantity} {buyQuantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${buyPrice}</strong> each
          </span>
        );
      case 'sell':
        const sellQuantity = quantity || Math.max(1, Math.floor(amount / (price || 50)));
        const sellPrice = price || Math.floor(amount / sellQuantity);
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> sold {sellQuantity} {sellQuantity === 1 ? 'share' : 'shares'} of{' '}
            <em>"{opinionText?.slice(0, 40)}..."</em> for <strong>${sellPrice}</strong> each
          </span>
        );
      case 'short_place':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> placed <strong>${Math.abs(amount)}</strong> short bet on{' '}
            <em>Opinion #{opinionId}</em> targeting {shortDetails?.targetDropPercentage}% drop{' '}
            {shortDetails?.timeLimit && `in ${shortDetails.timeLimit}h`}
          </span>
        );
      case 'short_win':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> won <strong>${amount}</strong> from short bet on{' '}
            <em>Opinion #{opinionId}</em>! Price hit target 📉
          </span>
        );
      case 'short_loss':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> lost <strong>${Math.abs(amount)}</strong> on short bet{' '}
            <em>Opinion #{opinionId}</em> - target not reached
          </span>
        );
      case 'bet_place':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> bet <strong>${Math.abs(amount)}</strong> that{' '}
            <UsernameLink username={targetUser || 'Unknown'} /> portfolio will {betType} by {targetPercentage}% in {timeframe} days
          </span>
        );
      case 'bet_win':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> won <strong>${amount}</strong> from a portfolio bet on{' '}
            <UsernameLink username={targetUser || 'Unknown'} />! 🎉
          </span>
        );
      case 'bet_loss':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> lost <strong>${Math.abs(amount)}</strong> on a portfolio bet
          </span>
        );
      case 'earn':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> generated opinion: <em>"{opinionText?.slice(0, 40)}..."</em> and earned <strong>${amount}</strong>
          </span>
        );
      case 'generate':
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> generated a new opinion and earned <strong>${amount}</strong>
          </span>
        );
      default:
        return (
          <span>
            {userPrefix}<UsernameLink username={username} isBot={isBot} /> performed an action for <strong>${Math.abs(amount)}</strong>
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

  // Force refresh activity feed
  const forceRefreshFeed = () => {
    console.log('🔄 Force refreshing activity feed...');
    const newActivity = loadRealActivity();
    setActivityFeed(newActivity);
    setLastRefresh(Date.now());
  };

  // Make addToGlobalFeed available globally for other components to use
  useEffect(() => {
    (window as any).addToGlobalFeed = addToGlobalFeed;
    (window as any).forceRefreshFeed = forceRefreshFeed;
    
    return () => {
      delete (window as any).addToGlobalFeed;
      delete (window as any).forceRefreshFeed;
    };
  }, []);

  useEffect(() => {
    // Load opinions for sidebar
    const stored = localStorage.getItem('opinions');
    if (stored) {
      const parsed = JSON.parse(stored);
      const validOpinions = parsed.filter((op: any) => op && typeof op === 'string' && op.trim().length > 0);
      setOpinions(validOpinions.map((text: string, i: number) => ({ id: i.toString(), text })));
    }

    // Load current user
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      setCurrentUser(JSON.parse(storedProfile));
    }
  }, []);

  useEffect(() => {
    // Load real activity
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

    // Refresh activity every 5 seconds to pick up new bot activity
    const refreshInterval = setInterval(() => {
      const newActivity = loadRealActivity();
      if (newActivity.length !== activityFeed.length) {
        console.log(`🔄 Activity update: ${newActivity.length} activities (was ${activityFeed.length})`);
        setActivityFeed(newActivity);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [opinions, currentUser]);

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
            {/* Refresh Button */}
            <button 
              onClick={forceRefreshFeed}
              className="nav-button"
              style={{ backgroundColor: '#8b5cf6' }}
            >
              🔄 Refresh
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
          {/* Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.liveIndicator}></div>
            LIVE • {filteredActivities.length} Recent Activities • Last refresh: {isClient ? new Date(lastRefresh).toLocaleTimeString() : '--:--:--'}
          </div>

          {/* Feed Content */}
          <div className={styles.feedContent}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyFeed}>
                <p>📭</p>
                <p>No activity found matching your filter.</p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  🤖 Enable bots from the admin panel to see automated trading activity
                </p>
                <button 
                  onClick={forceRefreshFeed}
                  style={{
                    marginTop: '15px',
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Force Refresh Feed
                </button>
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
                            {activity.amount >= 0 ? '+' : ''}${Math.abs(activity.amount).toLocaleString()}
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

        {/* Transaction Details Modal */}
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
                      {selectedTransaction.amount >= 0 ? '+' : ''}${Math.abs(selectedTransaction.amount).toLocaleString()}
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
                    <span>{isClient ? new Date(selectedTransaction.timestamp).toLocaleString() : 'Loading...'}</span>
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

                  {selectedTransaction.quantity && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Quantity:</span>
                      <span>{selectedTransaction.quantity} {selectedTransaction.quantity === 1 ? 'share' : 'shares'}</span>
                    </div>
                  )}

                  {selectedTransaction.price && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Price per Share:</span>
                      <span>${selectedTransaction.price}</span>
                    </div>
                  )}

                  {selectedTransaction.targetUser && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Target User:</span>
                      <span 
                        className={styles.clickableUsername}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUsernameClick(selectedTransaction.targetUser!, e);
                          setShowTransactionModal(false);
                        }}
                        style={{ 
                          color: '#3b82f6', 
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {selectedTransaction.targetUser}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.betType && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Bet Direction:</span>
                      <span>
                        {selectedTransaction.betType === 'increase' ? '📈 Increase' : '📉 Decrease'} by {selectedTransaction.targetPercentage}%
                      </span>
                    </div>
                  )}

                  {selectedTransaction.timeframe && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Timeframe:</span>
                      <span>{selectedTransaction.timeframe} days</span>
                    </div>
                  )}

                  {/* Short-specific details */}
                  {selectedTransaction.shortDetails && (
                    <>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Target Drop:</span>
                        <span>{selectedTransaction.shortDetails.targetDropPercentage}%</span>
                      </div>

                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Starting Price:</span>
                        <span>${selectedTransaction.shortDetails.startingPrice}</span>
                      </div>

                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Target Price:</span>
                        <span>${selectedTransaction.shortDetails.targetPrice}</span>
                      </div>

                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Time Limit:</span>
                        <span>{selectedTransaction.shortDetails.timeLimit} hours</span>
                      </div>

                      {selectedTransaction.additionalDetails?.shortProgress !== undefined && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Progress:</span>
                          <span>
                            {selectedTransaction.additionalDetails.shortProgress.toFixed(1)}% towards target
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Additional Bet Details */}
                  {selectedTransaction.additionalDetails && (
                    <>
                      {selectedTransaction.additionalDetails.multiplier && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Multiplier:</span>
                          <span>{selectedTransaction.additionalDetails.multiplier}x</span>
                        </div>
                      )}

                      {selectedTransaction.additionalDetails.potentialPayout && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Potential Payout:</span>
                          <span className={styles.positive}>${selectedTransaction.additionalDetails.potentialPayout.toLocaleString()}</span>
                        </div>
                      )}

                      {selectedTransaction.additionalDetails.volatilityRating && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Volatility:</span>
                          <span className={`${styles.volatility} ${styles[selectedTransaction.additionalDetails.volatilityRating.toLowerCase()]}`}>
                            {selectedTransaction.additionalDetails.volatilityRating}
                          </span>
                        </div>
                      )}

                      {selectedTransaction.additionalDetails.expiryDate && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Expires:</span>
                          <span>{isClient ? new Date(selectedTransaction.additionalDetails.expiryDate).toLocaleString() : 'Loading...'}</span>
                        </div>
                      )}

                      {selectedTransaction.additionalDetails.betStatus && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Status:</span>
                          <span className={`${styles.status} ${styles[selectedTransaction.additionalDetails.betStatus]}`}>
                            {selectedTransaction.additionalDetails.betStatus.toUpperCase()}
                          </span>
                        </div>
                      )}
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
              ${activityFeed.reduce((sum, a) => sum + Math.abs(a.amount), 0).toLocaleString()}
            </div>
            <div className={styles.statLabel}>Total Volume</div>
          </div>
        </div>

        {/* Activity Status */}
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f0f9ff', 
          border: '1px solid #e0f2fe', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#0369a1' }}>
            🤖 <strong>{botActivityCount}</strong> bot activities • 
            👥 <strong>{humanActivityCount}</strong> human activities • 
            📉 <strong>{shortActivityCount}</strong> short positions
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Live feed updates automatically every 5 seconds
          </p>
        </div>
      </main>

      {/* Add custom styles for the new features */}
      <style jsx>{`
        .clickableUsername:hover {
          opacity: 0.8;
          text-decoration: underline !important;
        }

        .shortBadge {
          background: #fef3c7;
          color: #92400e;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 8px;
        }

        .shortActivity {
          border-left: 4px solid #f59e0b !important;
        }

        .shortTag {
          padding: 2px 8px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .transactionModal {
          background: white;
          border-radius: 16px;
          padding: 0;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modalHeader {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          border-radius: 16px 16px 0 0;
        }

        .modalHeader h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }

        .closeButton {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .closeButton:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .modalContent {
          padding: 24px;
        }

        .transactionHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .transactionType {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .typeTag {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .typeTag.buy { background: #dcfce7; color: #166534; }
        .typeTag.sell { background: #fef3c7; color: #92400e; }
        .typeTag.bet_place { background: #ddd6fe; color: #6b21a8; }
        .typeTag.bet_win { background: #dcfce7; color: #166534; }
        .typeTag.bet_loss { background: #fecaca; color: #991b1b; }
        .typeTag.short_place { background: #fef3c7; color: #92400e; }
        .typeTag.short_win { background: #dcfce7; color: #166534; }
        .typeTag.short_loss { background: #fecaca; color: #991b1b; }
        .typeTag.earn, .typeTag.generate { background: #e0f2fe; color: #0c4a6e; }

        .botTag {
          padding: 2px 8px;
          background: #f0f9ff;
          color: #0369a1;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .transactionAmount {
          font-size: 24px;
          font-weight: 700;
        }

        .transactionDescription {
          margin-bottom: 20px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }

        .transactionDescription p {
          margin: 0;
          line-height: 1.6;
          color: #374151;
        }

        .transactionDetails {
          display: grid;
          gap: 12px;
          margin-bottom: 24px;
        }

        .detailRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .detailRow:last-child {
          border-bottom: none;
        }

        .detailLabel {
          font-weight: 500;
          color: #6b7280;
          min-width: 120px;
        }

        .opinionText {
          font-style: italic;
          color: #374151;
          max-width: 300px;
          text-align: right;
        }

        .volatility.high { color: #dc2626; }
        .volatility.medium { color: #ea580c; }
        .volatility.low { color: #16a34a; }

        .status.active { color: #3b82f6; }
        .status.won { color: #16a34a; }
        .status.lost { color: #dc2626; }
        .status.expired { color: #6b7280; }

        .modalActions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }

        .viewUserButton, .viewOpinionButton {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        .viewUserButton:hover, .viewOpinionButton:hover {
          background: #2563eb;
        }

        .closeModalButton {
          padding: 8px 16px;
          background: #6b7280;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        .closeModalButton:hover {
          background: #4b5563;
        }

        .modalOverlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
      `}</style>
    </div>
  );
}