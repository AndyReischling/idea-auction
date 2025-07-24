// app/lib/public-leaderboard.ts
// Service to manage public leaderboard collection for unauthorized users

import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';

export interface PublicLeaderboardEntry {
  uid: string;
  username: string;
  portfolioValue: number;
  rank: number;
  topHoldings: Array<{
    text: string;
    value: number;
    currentPrice: number;
    quantity: number;
  }>;
  isBot: boolean;
  lastUpdated: any; // serverTimestamp
}

export class PublicLeaderboardService {
  private static instance: PublicLeaderboardService;
  
  static getInstance(): PublicLeaderboardService {
    if (!PublicLeaderboardService.instance) {
      PublicLeaderboardService.instance = new PublicLeaderboardService();
    }
    return PublicLeaderboardService.instance;
  }

  /**
   * Update the public leaderboard with the top traders (up to 5)
   */
  async updatePublicLeaderboard(
    topTraders: Array<{
      uid: string;
      username: string;
      portfolioValue: number;
      topHoldings: Array<{
        text: string;
        value: number;
        currentPrice: number;
        quantity: number;
      }>;
      isBot: boolean;
    }>
  ): Promise<void> {
    try {
      // Take up to 5 traders (or as many as available)
      const topN = topTraders.slice(0, Math.min(5, topTraders.length));
      
      // Update each trader's record in the public leaderboard
      const updatePromises = topN.map(async (trader, index) => {
        const publicEntry: PublicLeaderboardEntry = {
          uid: trader.uid,
          username: trader.username,
          portfolioValue: trader.portfolioValue,
          rank: index + 1,
          topHoldings: trader.topHoldings.slice(0, 2), // Only show top 2 holdings
          isBot: trader.isBot,
          lastUpdated: serverTimestamp()
        };
        
        await setDoc(
          doc(collection(db, 'public-leaderboard'), trader.uid),
          publicEntry
        );
      });
      
      await Promise.all(updatePromises);
      console.log(`✅ Public leaderboard updated with top ${topN.length} traders`);
    } catch (error) {
      console.error('❌ Error updating public leaderboard:', error);
    }
  }

  /**
   * Get the public leaderboard (top 5 traders)
   */
  async getPublicLeaderboard(): Promise<PublicLeaderboardEntry[]> {
    try {
      const publicLeaderboardRef = collection(db, 'public-leaderboard');
      const q = query(publicLeaderboardRef, orderBy('rank', 'asc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as PublicLeaderboardEntry[];
    } catch (error) {
      console.error('❌ Error fetching public leaderboard:', error);
      return [];
    }
  }

  /**
   * Subscribe to public leaderboard changes
   */
  subscribeToPublicLeaderboard(callback: (leaderboard: PublicLeaderboardEntry[]) => void): Unsubscribe {
    const publicLeaderboardRef = collection(db, 'public-leaderboard');
    const q = query(publicLeaderboardRef, orderBy('rank', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const leaderboard = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as PublicLeaderboardEntry[];
      
      callback(leaderboard);
    });
  }
}

export const publicLeaderboardService = PublicLeaderboardService.getInstance(); 