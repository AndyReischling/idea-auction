// =============================================================================
// Portfolio Utilities - Better data structure for user portfolios
// =============================================================================

import { doc, writeBatch, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { createMarketDataDocId } from './document-id-utils';

// Portfolio item structure
export interface PortfolioItem {
  opinionId: string;
  opinionText: string;
  quantity: number;
  totalCost: number;
  averagePrice: number;
  lastUpdated: string;
  transactions: string[]; // Array of transaction IDs for this opinion
}

// Portfolio structure
export interface Portfolio {
  items: PortfolioItem[];
  totalValue: number;
  totalCost: number;
  lastUpdated: string;
}

// Helper to get user's portfolio
export async function getUserPortfolio(userId: string): Promise<Portfolio> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    return userData.portfolioV2 || {
      items: [],
      totalValue: 0,
      totalCost: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  
  return {
    items: [],
    totalValue: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString()
  };
}

// Helper to update user's portfolio
export async function updateUserPortfolio(
  userId: string,
  opinionId: string,
  opinionText: string,
  quantityChange: number,
  pricePerShare: number,
  transactionId: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const batch = writeBatch(db);
  
  // Get current portfolio
  const portfolio = await getUserPortfolio(userId);
  
  // Find existing item or create new one
  const existingItemIndex = portfolio.items.findIndex(item => item.opinionId === opinionId);
  
  if (existingItemIndex !== -1) {
    // Update existing item
    const existingItem = portfolio.items[existingItemIndex];
    const newQuantity = existingItem.quantity + quantityChange;
    
    if (newQuantity <= 0) {
      // Remove item if quantity becomes 0 or negative
      portfolio.items.splice(existingItemIndex, 1);
    } else {
      // Update existing item
      const newTotalCost = existingItem.totalCost + (quantityChange * pricePerShare);
      existingItem.quantity = newQuantity;
      existingItem.totalCost = newTotalCost;
      existingItem.averagePrice = newTotalCost / newQuantity;
      existingItem.lastUpdated = new Date().toISOString();
      existingItem.transactions.push(transactionId);
    }
  } else if (quantityChange > 0) {
    // Add new item
    const newItem: PortfolioItem = {
      opinionId,
      opinionText,
      quantity: quantityChange,
      totalCost: quantityChange * pricePerShare,
      averagePrice: pricePerShare,
      lastUpdated: new Date().toISOString(),
      transactions: [transactionId]
    };
    portfolio.items.push(newItem);
  }
  
  // Update portfolio metadata
  portfolio.totalCost = portfolio.items.reduce((sum, item) => sum + item.totalCost, 0);
  portfolio.lastUpdated = new Date().toISOString();
  
  // Update user document
  batch.update(userRef, {
    portfolioV2: portfolio,
    updatedAt: new Date().toISOString()
  });
  
  await batch.commit();
}

// Helper to get user's position in a specific opinion
export async function getUserPositionInOpinion(userId: string, opinionId: string): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  const item = portfolio.items.find(item => item.opinionId === opinionId);
  return item ? item.quantity : 0;
}

// Helper to calculate portfolio value with current market prices
export async function calculatePortfolioValue(userId: string, marketData: Record<string, any>): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  
  return portfolio.items.reduce((totalValue, item) => {
    const currentPrice = marketData[item.opinionText]?.currentPrice || item.averagePrice;
    return totalValue + (item.quantity * currentPrice);
  }, 0);
}

// Migration helper: Convert old portfolio format to new format
export async function migrateUserPortfolio(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data();
  const oldPortfolio = userData.portfolio;
  
  // Skip if already migrated or no old portfolio
  if (!oldPortfolio || userData.portfolioV2) return;
  
  console.log(`🔄 Migrating portfolio for user: ${userData.username || userId}`);
  
  const newPortfolio: Portfolio = {
    items: [],
    totalValue: 0,
    totalCost: 0,
    lastUpdated: new Date().toISOString()
  };
  
  // Convert old format to new format
  for (const [key, quantity] of Object.entries(oldPortfolio)) {
    if (typeof quantity === 'number' && quantity > 0) {
      // Try to find the original opinion text
      let opinionText = key;
      
      // If key contains underscores, it might be sanitized
      if (key.includes('_')) {
        // Try to reverse the sanitization by querying opinions
                 try {
           const opinionsSnap = await getDocs(collection(db, 'opinions'));
           const matchingOpinion = opinionsSnap.docs.find((docSnapshot) => {
             const sanitized = docSnapshot.data().text?.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
             return sanitized === key;
           });
           
           if (matchingOpinion) {
             opinionText = matchingOpinion.data().text;
           }
         } catch (error) {
           console.warn('Failed to find original opinion text for:', key);
         }
      }
      
      // Create portfolio item
      const item: PortfolioItem = {
        opinionId: createMarketDataDocId(opinionText),
        opinionText,
        quantity,
        totalCost: quantity * 10, // Assume $10 base price for migrated items
        averagePrice: 10,
        lastUpdated: new Date().toISOString(),
        transactions: [] // No transaction history for migrated items
      };
      
      newPortfolio.items.push(item);
    }
  }
  
  // Update portfolio metadata
  newPortfolio.totalCost = newPortfolio.items.reduce((sum, item) => sum + item.totalCost, 0);
  
  // Save new portfolio and mark as migrated
  await updateDoc(userRef, {
    portfolioV2: newPortfolio,
    portfolioMigratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  console.log(`✅ Successfully migrated portfolio for ${userData.username || userId}`);
}

// Helper to get all users that need migration
export async function getUsersNeedingMigration(): Promise<string[]> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const usersToMigrate: string[] = [];
  
  usersSnap.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    if (data.portfolio && !data.portfolioV2) {
      usersToMigrate.push(docSnapshot.id);
    }
  });
  
  return usersToMigrate;
} 