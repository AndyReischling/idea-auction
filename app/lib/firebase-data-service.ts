import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit, 
  getDocs, 
  writeBatch, 
  serverTimestamp, 
  onSnapshot, 
  Timestamp,
  DocumentData,
  QueryConstraint,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';

// Type definitions
export interface UserProfile {
  uid: string;
  username: string;
  balance: number;
  totalEarnings: number;
  totalLosses: number;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Opinion {
  id: string;
  text: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketData {
  id: string;
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  volatility?: number;
  lastUpdated: Date;
  priceHistory?: { price: number; timestamp: Date; action: 'buy' | 'sell' | 'create' }[];
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'buy' | 'sell' | 'earn' | 'bet' | 'short';
  opinionText: string;
  amount: number;
  price: number;
  quantity: number;
  timestamp: Date;
  date: Date;
}

export interface BotTransaction {
  id: string;
  userId: string;
  botId: string;
  type: 'buy' | 'sell' | 'earn' | 'bet' | 'short';
  opinionText: string;
  amount: number;
  price: number;
  quantity: number;
  timestamp: Date;
  date: Date;
}

export interface AdvancedBet {
  id: string;
  userId: string;
  targetUser: string;
  betType: 'gain' | 'loss';
  targetPercentage: number;
  betAmount: number;
  potentialWinnings: number;
  placedDate: Date;
  expiryDate: Date;
  status: 'active' | 'won' | 'lost';
}

export interface ShortPosition {
  id: string;
  userId: string;
  opinionId: string;
  opinionText: string;
  betAmount: number;
  targetDropPercentage: number;
  potentialWinnings: number;
  startingPrice: number;
  targetPrice: number;
  createdDate: Date;
  expirationDate: Date;
  status: 'active' | 'won' | 'lost';
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  type: string;
  username: string;
  opinionText?: string;
  targetUser?: string;
  betType?: string;
  targetPercentage?: number;
  amount?: number;
  quantity?: number;
  timestamp: Date;
  isBot?: boolean;
}

export interface UserSettings {
  userId: string;
  botsAutoStart: boolean;
  botsInitialized: boolean;
  updatedAt: Date;
}

export interface AutonomousBot {
  id: string;
  userId: string;
  name: string;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

export class FirebaseDataService {
  private static instance: FirebaseDataService;
  private subscribers: Map<string, () => void> = new Map();

  private constructor() {}

  public static getInstance(): FirebaseDataService {
    if (!FirebaseDataService.instance) {
      FirebaseDataService.instance = new FirebaseDataService();
    }
    return FirebaseDataService.instance;
  }

  // Utility function to safely convert various date formats to Date objects
  private safeToDate(value: any): Date {
    if (!value) return new Date();
    
    // If it's already a Date object
    if (value instanceof Date) {
      return value;
    }
    
    // If it's a Firebase Timestamp with toDate() method
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    
    // If it's a string or number that can be parsed as a date
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    
    // If it's an object with seconds (Firebase Timestamp-like)
    if (value && typeof value === 'object' && value.seconds) {
      return new Date(value.seconds * 1000);
    }
    
    // Default fallback
    return new Date();
  }

  // USER PROFILE OPERATIONS
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid: userId,
          username: data.username || 'User',
          balance: data.balance || 10000,
          totalEarnings: data.totalEarnings || 0,
          totalLosses: data.totalLosses || 0,
          joinDate: this.safeToDate(data.joinDate),
          createdAt: this.safeToDate(data.createdAt),
          updatedAt: this.safeToDate(data.updatedAt)
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      // Convert Date objects to Timestamps
      if (updates.joinDate) {
        updateData.joinDate = Timestamp.fromDate(updates.joinDate);
      }
      
      await updateDoc(userDocRef, updateData);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async createUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const newProfile: any = {
        uid: userId,
        username: profileData.username || 'User',
        balance: profileData.balance || 10000,
        totalEarnings: profileData.totalEarnings || 0,
        totalLosses: profileData.totalLosses || 0,
        joinDate: profileData.joinDate ? Timestamp.fromDate(profileData.joinDate) : serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userDocRef, newProfile);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  // OPINION OPERATIONS
  async getOpinions(limitCount?: number): Promise<Opinion[]> {
    try {
      const constraints: QueryConstraint[] = [];
      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }
      
      const q = query(collection(db, 'opinions'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const opinions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        authorId: doc.data().authorId,
        createdAt: this.safeToDate(doc.data().createdAt),
        updatedAt: this.safeToDate(doc.data().updatedAt)
      }));
      
      // Sort manually by createdAt (newest first)
      return opinions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting opinions:', error);
      throw error;
    }
  }

  async getUserOpinions(userId: string): Promise<Opinion[]> {
    try {
      // Simplified query to avoid composite index requirement during migration
      const q = query(
        collection(db, 'opinions'),
        where('authorId', '==', userId)
        // Temporarily removed orderBy to avoid composite index requirement
        // orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const opinions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        authorId: doc.data().authorId,
        createdAt: this.safeToDate(doc.data().createdAt),
        updatedAt: this.safeToDate(doc.data().updatedAt)
      }));
      
      // Sort manually to avoid composite index requirement
      return opinions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting user opinions:', error);
      throw error;
    }
  }

  async createOpinion(authorId: string, text: string): Promise<string> {
    try {
      const opinionRef = doc(collection(db, 'opinions'));
      const opinionData = {
        text,
        authorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(opinionRef, opinionData);
      return opinionRef.id;
    } catch (error) {
      console.error('Error creating opinion:', error);
      throw error;
    }
  }

  // MARKET DATA OPERATIONS
  async getMarketData(opinionText?: string): Promise<MarketData[]> {
    try {
      let q;
      if (opinionText) {
        q = query(
          collection(db, 'market-data'),
          where('opinionText', '==', opinionText)
        );
      } else {
        q = query(collection(db, 'market-data'));
      }
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        opinionText: doc.data().opinionText,
        timesPurchased: doc.data().timesPurchased || 0,
        timesSold: doc.data().timesSold || 0,
        currentPrice: doc.data().currentPrice || 10.0,
        basePrice: doc.data().basePrice || 10.0,
        volatility: doc.data().volatility || 1.0,
        lastUpdated: doc.data().lastUpdated?.toDate() || new Date(),
        priceHistory: doc.data().priceHistory || []
      }));
    } catch (error) {
      console.error('Error getting market data:', error);
      throw error;
    }
  }

  async updateMarketData(opinionText: string, updates: Partial<MarketData>): Promise<void> {
    try {
      const marketId = `market_${opinionText.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`;
      const marketDocRef = doc(db, 'market-data', marketId);
      
      const updateData = {
        ...updates,
        opinionText,
        lastUpdated: serverTimestamp()
      };
      
      await setDoc(marketDocRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating market data:', error);
      throw error;
    }
  }

  // TRANSACTION OPERATIONS
  async getUserTransactions(userId: string, limitCount?: number): Promise<Transaction[]> {
    try {
      // Simplified query to avoid composite index requirement during migration
      const constraints: QueryConstraint[] = [
        where('userId', '==', userId)
        // Temporarily removed orderBy to avoid composite index requirement
        // orderBy('timestamp', 'desc')
      ];
      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }
      
      const q = query(collection(db, 'transactions'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const transactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        type: doc.data().type,
        opinionText: doc.data().opinionText,
        amount: doc.data().amount,
        price: doc.data().price,
        quantity: doc.data().quantity || 1,
        timestamp: this.safeToDate(doc.data().timestamp),
        date: this.safeToDate(doc.data().date)
      }));
      
      // Sort manually to avoid composite index requirement
      return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error getting user transactions:', error);
      throw error;
    }
  }

  async createTransaction(transactionData: Omit<Transaction, 'id'>): Promise<string> {
    try {
      const transactionRef = doc(collection(db, 'transactions'));
      const newTransaction = {
        ...transactionData,
        timestamp: serverTimestamp(),
        date: serverTimestamp()
      };
      
      await setDoc(transactionRef, newTransaction);
      return transactionRef.id;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // BOT TRANSACTION OPERATIONS
  async getBotTransactions(userId: string, limitCount?: number): Promise<BotTransaction[]> {
    try {
      // Simplified query to avoid composite index requirement during migration
      const constraints: QueryConstraint[] = [
        where('userId', '==', userId)
        // Temporarily removed orderBy to avoid composite index requirement
        // orderBy('timestamp', 'desc')
      ];
      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }
      
      const q = query(collection(db, 'bot-transactions'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const transactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        botId: doc.data().botId,
        type: doc.data().type,
        opinionText: doc.data().opinionText,
        amount: doc.data().amount,
        price: doc.data().price,
        quantity: doc.data().quantity || 1,
        timestamp: this.safeToDate(doc.data().timestamp),
        date: this.safeToDate(doc.data().date)
      }));
      
      // Sort manually to avoid composite index requirement
      return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error getting bot transactions:', error);
      throw error;
    }
  }

  async createBotTransaction(transactionData: Omit<BotTransaction, 'id'>): Promise<string> {
    try {
      const transactionRef = doc(collection(db, 'bot-transactions'));
      const data = {
        ...transactionData,
        timestamp: serverTimestamp(),
        date: serverTimestamp()
      };
      
      await setDoc(transactionRef, data);
      return transactionRef.id;
    } catch (error) {
      console.error('Error creating bot transaction:', error);
      throw error;
    }
  }

  // ADVANCED BETS OPERATIONS
  async getUserAdvancedBets(userId: string): Promise<AdvancedBet[]> {
    try {
      // Simplified query to avoid composite index requirement
      const q = query(
        collection(db, 'advanced-bets'),
        where('userId', '==', userId)
        // Temporarily removed orderBy to avoid composite index requirement
        // orderBy('placedDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const advancedBets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        targetUser: doc.data().targetUser,
        betType: doc.data().betType,
        targetPercentage: doc.data().targetPercentage,
        betAmount: doc.data().betAmount,
        potentialWinnings: doc.data().potentialWinnings,
        placedDate: this.safeToDate(doc.data().placedDate),
        expiryDate: this.safeToDate(doc.data().expiryDate),
        status: doc.data().status
      }));
      
      // Sort manually to avoid composite index requirement
      return advancedBets.sort((a, b) => b.placedDate.getTime() - a.placedDate.getTime());
    } catch (error) {
      console.error('Error getting user advanced bets:', error);
      throw error;
    }
  }

  async createAdvancedBet(betData: Omit<AdvancedBet, 'id'>): Promise<string> {
    try {
      const betRef = doc(collection(db, 'advanced-bets'));
      const data = {
        ...betData,
        placedDate: serverTimestamp(),
        expiryDate: Timestamp.fromDate(betData.expiryDate)
      };
      
      await setDoc(betRef, data);
      return betRef.id;
    } catch (error) {
      console.error('Error creating advanced bet:', error);
      throw error;
    }
  }

  async updateAdvancedBet(betId: string, updates: Partial<AdvancedBet>): Promise<void> {
    try {
      const betDocRef = doc(db, 'advanced-bets', betId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      if (updates.expiryDate) {
        updateData.expiryDate = updates.expiryDate;
      }
      
      await updateDoc(betDocRef, updateData);
    } catch (error) {
      console.error('Error updating advanced bet:', error);
      throw error;
    }
  }

  // SHORT POSITIONS OPERATIONS
  async getUserShortPositions(userId: string): Promise<ShortPosition[]> {
    try {
      // Simplified query to avoid composite index requirement
      const q = query(
        collection(db, 'short-positions'),
        where('userId', '==', userId)
        // Temporarily removed orderBy to avoid composite index requirement
        // orderBy('createdDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const shortPositions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        opinionId: doc.data().opinionId,
        opinionText: doc.data().opinionText,
        betAmount: doc.data().betAmount,
        targetDropPercentage: doc.data().targetDropPercentage,
        potentialWinnings: doc.data().potentialWinnings,
        startingPrice: doc.data().startingPrice,
        targetPrice: doc.data().targetPrice,
        createdDate: this.safeToDate(doc.data().createdDate),
        expirationDate: this.safeToDate(doc.data().expirationDate),
        status: doc.data().status
      }));
      
      // Sort manually to avoid composite index requirement
      return shortPositions.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
    } catch (error) {
      console.error('Error getting user short positions:', error);
      throw error;
    }
  }

  async createShortPosition(shortData: Omit<ShortPosition, 'id'>): Promise<string> {
    try {
      const shortRef = doc(collection(db, 'short-positions'));
      const data = {
        ...shortData,
        createdDate: new Date(),
        expirationDate: shortData.expirationDate
      };
      
      await setDoc(shortRef, data);
      return shortRef.id;
    } catch (error) {
      console.error('Error creating short position:', error);
      throw error;
    }
  }

  async updateShortPosition(shortId: string, updates: Partial<ShortPosition>): Promise<void> {
    try {
      const shortDocRef = doc(db, 'short-positions', shortId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      if (updates.expirationDate) {
        updateData.expirationDate = updates.expirationDate;
      }
      
      await updateDoc(shortDocRef, updateData);
    } catch (error) {
      console.error('Error updating short position:', error);
      throw error;
    }
  }

  // ACTIVITY FEED OPERATIONS
  async getGlobalActivityFeed(limitCount?: number): Promise<ActivityFeedItem[]> {
    try {
      const constraints: QueryConstraint[] = [];
      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }
      
      const q = query(collection(db, 'global-activity-feed'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const activities = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        type: doc.data().type,
        username: doc.data().username,
        opinionText: doc.data().opinionText,
        targetUser: doc.data().targetUser,
        betType: doc.data().betType,
        targetPercentage: doc.data().targetPercentage,
        amount: doc.data().amount,
        quantity: doc.data().quantity,
        timestamp: this.safeToDate(doc.data().timestamp),
        isBot: doc.data().isBot || false
      }));
      
      // Sort manually by timestamp (newest first)
      return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error getting global activity feed:', error);
      throw error;
    }
  }

  async getUserActivityFeed(userId: string, limitCount?: number): Promise<ActivityFeedItem[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('userId', '==', userId)
      ];
      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }
      
      const q = query(collection(db, 'user-activity-feeds'), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const activities = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        type: doc.data().type,
        username: doc.data().username,
        opinionText: doc.data().opinionText,
        targetUser: doc.data().targetUser,
        betType: doc.data().betType,
        targetPercentage: doc.data().targetPercentage,
        amount: doc.data().amount,
        quantity: doc.data().quantity,
        timestamp: this.safeToDate(doc.data().timestamp),
        isBot: doc.data().isBot || false
      }));
      
      // Sort manually by timestamp (newest first)
      return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error getting user activity feed:', error);
      throw error;
    }
  }

  async addActivityFeedItem(activityData: Omit<ActivityFeedItem, 'id'>): Promise<string> {
    try {
      const batch = writeBatch(db);
      
      // Add to global activity feed
      const globalActivityRef = doc(collection(db, 'global-activity-feed'));
      batch.set(globalActivityRef, {
        ...activityData,
        timestamp: serverTimestamp()
      });
      
      // Add to user activity feed
      const userActivityRef = doc(collection(db, 'user-activity-feeds'));
      batch.set(userActivityRef, {
        ...activityData,
        timestamp: serverTimestamp()
      });
      
      await batch.commit();
      return globalActivityRef.id;
    } catch (error) {
      console.error('Error adding activity feed item:', error);
      throw error;
    }
  }

  // USER SETTINGS OPERATIONS
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const settingsDoc = await getDoc(doc(db, 'user-settings', userId));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        return {
          userId,
          botsAutoStart: data.botsAutoStart || false,
          botsInitialized: data.botsInitialized || false,
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    try {
      const settingsDocRef = doc(db, 'user-settings', userId);
      const updateData = {
        userId,
        ...settings,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(settingsDocRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  // AUTONOMOUS BOTS OPERATIONS
  async getUserAutonomousBots(userId: string): Promise<AutonomousBot[]> {
    try {
      const q = query(
        collection(db, 'autonomous-bots'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      const bots = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        name: doc.data().name,
        config: doc.data().config,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      }));
      
      // Sort manually by createdAt (newest first)
      return bots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error getting user autonomous bots:', error);
      throw error;
    }
  }

  async createAutonomousBot(botData: Omit<AutonomousBot, 'id'>): Promise<string> {
    try {
      const botRef = doc(collection(db, 'autonomous-bots'));
      const data = {
        ...botData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(botRef, data);
      return botRef.id;
    } catch (error) {
      console.error('Error creating autonomous bot:', error);
      throw error;
    }
  }

  async updateAutonomousBot(botId: string, updates: Partial<AutonomousBot>): Promise<void> {
    try {
      const botDocRef = doc(db, 'autonomous-bots', botId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(botDocRef, updateData);
    } catch (error) {
      console.error('Error updating autonomous bot:', error);
      throw error;
    }
  }

  // PORTFOLIO OPERATIONS
  async getUserPortfolio(userId: string): Promise<any> {
    try {
      const portfolioDoc = await getDoc(doc(db, 'user-portfolios', userId));
      if (portfolioDoc.exists()) {
        return portfolioDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user portfolio:', error);
      throw error;
    }
  }

  async updateUserPortfolio(userId: string, portfolioData: any): Promise<void> {
    try {
      const portfolioDocRef = doc(db, 'user-portfolios', userId);
      const updateData = {
        userId,
        ...portfolioData,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(portfolioDocRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating user portfolio:', error);
      throw error;
    }
  }

  // PORTFOLIO SNAPSHOTS OPERATIONS
  async getUserPortfolioSnapshots(userId: string): Promise<any[]> {
    try {
      const snapshotsDoc = await getDoc(doc(db, 'portfolio-snapshots', userId));
      if (snapshotsDoc.exists()) {
        return snapshotsDoc.data()?.snapshots || [];
      }
      return [];
    } catch (error) {
      console.error('Error getting user portfolio snapshots:', error);
      throw error;
    }
  }

  async updateUserPortfolioSnapshots(userId: string, snapshots: any[]): Promise<void> {
    try {
      const snapshotsDocRef = doc(db, 'portfolio-snapshots', userId);
      const updateData = {
        userId,
        snapshots,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(snapshotsDocRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating user portfolio snapshots:', error);
      throw error;
    }
  }

  // REAL-TIME SUBSCRIPTIONS
  subscribeToUserProfile(userId: string, callback: (profile: UserProfile | null) => void): string {
    const subscriptionId = `user-profile-${userId}-${Date.now()}`;
    
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const profile: UserProfile = {
            uid: userId,
            username: data.username || 'User',
            balance: data.balance || 10000,
            totalEarnings: data.totalEarnings || 0,
            totalLosses: data.totalLosses || 0,
            joinDate: data.joinDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
          callback(profile);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error in user profile subscription:', error);
        callback(null);
      }
    );
    
    this.subscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  subscribeToGlobalActivityFeed(callback: (activities: ActivityFeedItem[]) => void, limitCount: number = 50): string {
    try {
      const constraints: QueryConstraint[] = [
        firestoreLimit(limitCount)
      ];
      
      const q = query(collection(db, 'global-activity-feed'), ...constraints);
      
      const subscriptionId = `global-activity-${Date.now()}`;
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const activities = querySnapshot.docs.map(doc => ({
          id: doc.id,
          userId: doc.data().userId,
          type: doc.data().type,
          username: doc.data().username,
          opinionText: doc.data().opinionText,
          targetUser: doc.data().targetUser,
          betType: doc.data().betType,
          targetPercentage: doc.data().targetPercentage,
          amount: doc.data().amount,
          quantity: doc.data().quantity,
          timestamp: this.safeToDate(doc.data().timestamp),
          isBot: doc.data().isBot || false
        }));
        
        // Sort manually by timestamp (newest first)
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        callback(activities);
      });
      
      this.subscribers.set(subscriptionId, unsubscribe);
      return subscriptionId;
    } catch (error) {
      console.error('Error subscribing to global activity feed:', error);
      throw error;
    }
  }

  subscribeToMarketData(callback: (marketData: MarketData[]) => void): string {
    const subscriptionId = `market-data-${Date.now()}`;
    
    const unsubscribe = onSnapshot(
      collection(db, 'market-data'),
      (snapshot) => {
        const marketData = snapshot.docs.map(doc => ({
          id: doc.id,
          opinionText: doc.data().opinionText,
          timesPurchased: doc.data().timesPurchased || 0,
          timesSold: doc.data().timesSold || 0,
          currentPrice: doc.data().currentPrice || 10.0,
          basePrice: doc.data().basePrice || 10.0,
          volatility: doc.data().volatility || 1.0,
          lastUpdated: doc.data().lastUpdated?.toDate() || new Date(),
          priceHistory: doc.data().priceHistory || []
        }));
        callback(marketData);
      },
      (error) => {
        console.error('Error in market data subscription:', error);
        callback([]);
      }
    );
    
    this.subscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // SUBSCRIPTION MANAGEMENT
  unsubscribe(subscriptionId: string): void {
    const unsubscribe = this.subscribers.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.subscribers.delete(subscriptionId);
    }
  }

  unsubscribeAll(): void {
    this.subscribers.forEach((unsubscribe) => unsubscribe());
    this.subscribers.clear();
  }

  // UTILITY METHODS
  async batchWrite(operations: Array<{ collection: string; id: string; data: any; operation: 'set' | 'update' | 'delete' }>): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      operations.forEach(({ collection: collectionName, id, data, operation }) => {
        const docRef = doc(db, collectionName, id);
        
        switch (operation) {
          case 'set':
            batch.set(docRef, data);
            break;
          case 'update':
            batch.update(docRef, data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }

  // BALANCE OPERATIONS
  async updateUserBalance(userId: string, newBalance: number): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  }

  async incrementUserBalance(userId: string, amount: number): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        balance: increment(amount),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error incrementing user balance:', error);
      throw error;
    }
  }

  async updateUserEarnings(userId: string, earnings: number, losses: number): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        totalEarnings: earnings,
        totalLosses: losses,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user earnings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseDataService = FirebaseDataService.getInstance(); 