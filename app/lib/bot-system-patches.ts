/**
 * Bot System Patches - Apply these changes to fix Firebase version conflicts
 * 
 * INSTRUCTIONS:
 * 1. Apply these patches to app/components/autonomous-bots.ts
 * 2. Import botConflictResolver at the top
 * 3. Replace the problematic methods with these conflict-safe versions
 */

import { botConflictResolver } from './bot-conflict-resolver';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// ====================================================================
// PATCH 1: Fix bot balance updates (lines ~640, ~740, ~840)
// ====================================================================

/**
 * REPLACE the bot balance update pattern:
 * 
 * OLD CODE (causes conflicts):
 * ```
 * bot.balance -= amount;
 * await updateDoc(doc(colBots, bot.id), { balance: bot.balance });
 * await setDoc(doc(db, 'users', bot.id), { ...data }, { merge: true });
 * ```
 * 
 * NEW CODE (conflict-safe):
 */
async function updateBotBalanceSafely(bot: any, amountChange: number, botId: string): Promise<void> {
  const operations = [
    () => botConflictResolver.safeUpdateDoc(
      doc(db, 'autonomous-bots', botId),
      { 
        balance: bot.balance + amountChange,
        lastActive: new Date().toISOString()
      },
      `bot-balance-${botId}`
    ),
    () => botConflictResolver.safeSetDoc(
      doc(db, 'users', botId),
      {
        username: bot.username || `Bot_${botId}`,
        balance: bot.balance + amountChange,
        joinDate: bot.joinDate || new Date().toISOString(),
        totalEarnings: bot.totalEarnings || 0,
        totalLosses: bot.totalLosses || 0,
        isBot: true,
        botId: botId,
        lastActive: new Date().toISOString()
      },
      { merge: true },
      `user-sync-${botId}`
    )
  ];

  // Stagger operations to reduce conflicts
  await botConflictResolver.staggeredBatchOperations(operations, 100);
  
  // Update local state only after successful writes
  bot.balance += amountChange;
}

// ====================================================================
// PATCH 2: Fix market data updates (used in buy/sell operations)
// ====================================================================

/**
 * REPLACE market data updates with this conflict-safe version:
 */
async function updateMarketDataSafely(
  opinionText: string, 
  incrementBuys: number = 0, 
  incrementSells: number = 0
): Promise<void> {
  const marketDocId = opinionText.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const marketRef = doc(db, 'market-data', marketDocId);

  try {
    await botConflictResolver.safeTransaction(async (transaction) => {
      const marketSnap = await transaction.get(marketRef);
      
      let currentData;
      if (marketSnap.exists()) {
        currentData = marketSnap.data();
      } else {
        // Initialize new market data
        currentData = {
          opinionText,
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: 1.0,
          basePrice: 1.0,
          lastUpdated: new Date().toISOString()
        };
      }

      const newPurchases = (currentData.timesPurchased || 0) + incrementBuys;
      const newSales = (currentData.timesSold || 0) + incrementSells;
      
      // Recalculate price based on new numbers
      const newPrice = calculatePrice(newPurchases, newSales, currentData.basePrice);

      const updatedData = {
        ...currentData,
        timesPurchased: newPurchases,
        timesSold: newSales,
        currentPrice: newPrice,
        lastUpdated: new Date().toISOString()
      };

      transaction.set(marketRef, updatedData);
    }, `market-update-${marketDocId}`);
  } catch (error) {
    console.error(`Failed to update market data for "${opinionText.substring(0, 30)}...":`, error);
    throw error;
  }
}

// Price calculation helper (should match your existing logic)
function calculatePrice(purchases: number, sales: number, basePrice: number = 1.0): number {
  const netDemand = purchases - sales;
  const volatility = Math.sqrt(purchases + sales) * 0.1;
  return Math.max(0.1, basePrice + (netDemand * 0.05) + volatility);
}

// ====================================================================
// PATCH 3: Fix bot startup conflicts (line ~150)
// ====================================================================

/**
 * REPLACE the bot start method to stagger bot activations:
 * 
 * EXAMPLE - Adapt this pattern to your autonomous-bots.ts class method:
 */
/* 
In your AutonomousBotsService class, replace the start() method with:

async start(): Promise<void> {
  const activeBots = [...this.bots.values()].filter(bot => bot.isActive);
  
  console.log(`🤖 Starting ${activeBots.length} bots with staggered timing...`);
  
  // Stagger bot starts to reduce initial conflicts
  for (let i = 0; i < activeBots.length; i++) {
    const bot = activeBots[i];
    const delay = botConflictResolver.getRandomDelay(1000, 5000); // 1-5 second delay
    
    setTimeout(() => {
      if (!bot.isActive) return;
      
      const tickInterval = 30_000 + Math.random() * 90_000; // 30 seconds to 2 minutes
      this.intervals[bot.id] = setInterval(() => this.tick(bot), tickInterval);
    }, delay);
  }
  
  this.isRunning = true;
}
*/

// ====================================================================
// PATCH 4: Fix activity logging conflicts
// ====================================================================

/**
 * REPLACE activity logging with this conflict-safe version:
 * 
 * EXAMPLE - Replace your existing firebaseActivityService.addActivity calls:
 */
/* 
Replace this pattern in your bot methods:

OLD:
await firebaseActivityService.addActivity(activityData);

NEW:
try {
  await botConflictResolver.retryOperation(
    () => firebaseActivityService.addActivity(activityData),
    `activity-log-${activityData.type}-${activityData.userId}`,
    2 // Lower retry count for activity logs (less critical)
  );
} catch (error) {
  // Don't fail the entire operation if activity logging fails
  console.warn(`Failed to log activity for ${activityData.username}:`, error);
}
*/

// ====================================================================
// PATCH 5: Fix critical section operations (buy/sell)
// ====================================================================

/**
 * REPLACE buy operations with distributed locks for popular opinions:
 * 
 * EXAMPLE - Wrap your buy operations with locks in your class methods:
 */
/* 
In your handleBuyActivity method, replace direct buy calls with:

private async handleBuyActivity(bot: BotProfile) {
  try {
    const opinions = await this.getAvailableOpinions();
    if (!opinions.length) return;

    const opinion = opinions[Math.floor(Math.random() * opinions.length)];
    
    // Use distributed lock for popular opinions to prevent conflicts
    const lockName = `opinion-${opinion.id}-buy`;
    const lockAcquired = await botConflictResolver.createDistributedLock(lockName, bot.id);
    
    if (!lockAcquired) {
      console.log(`🤖 ${bot.username}: Buy lock busy, skipping`);
      return;
    }

    try {
      await this.buyBotPosition(bot, opinion);
    } finally {
      await botConflictResolver.releaseDistributedLock(lockName, bot.id);
    }
    
  } catch (error) {
    console.error(`🤖 ${bot.username} buy error:`, error);
  }
}
*/

// ====================================================================
// HOW TO APPLY THESE PATCHES
// ====================================================================

/**
 * 1. Add this import to the top of autonomous-bots.ts:
 * ```typescript
 * import { botConflictResolver } from '../lib/bot-conflict-resolver';
 * ```
 * 
 * 2. Replace these methods in autonomous-bots.ts:
 * - Update all bot.balance modifications to use updateBotBalanceSafely()
 * - Replace market data updates with updateMarketDataSafely()
 * - Replace start() method with startBotsWithStagger()
 * - Replace activity logging with logActivitySafely()
 * - Add locks to popular opinion operations
 * 
 * 3. Test with a small number of bots first (2-3) to verify fixes work
 * 
 * 4. Monitor console for conflict resolution logs:
 *    ✅ = Success after retry
 *    ⚠️ = Conflict detected, retrying  
 *    ❌ = Failed after all retries
 */

// Export only the working helper functions
export {
  updateBotBalanceSafely,
  updateMarketDataSafely,
  calculatePrice
}; 