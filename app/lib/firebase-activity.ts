'use client';

import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs,
  serverTimestamp,
  Timestamp,
  DocumentData 
} from 'firebase/firestore';
import { db } from './firebase';

export interface FirebaseActivityItem {
  id?: string;
  type: 'buy' | 'sell' | 'bet' | 'bet_place' | 'bet_win' | 'bet_loss' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
  username: string;
  userId?: string;
  opinionText?: string;
  opinionId?: string;
  amount: number;
  price?: number;
  quantity?: number;
  targetUser?: string;
  betType?: 'increase' | 'decrease';
  targetPercentage?: number;
  timeframe?: number;
  timestamp: any; // Firestore timestamp
  isBot?: boolean;
  botId?: string;
  metadata?: any;
}

export interface LocalActivityItem {
  id: string;
  type: 'buy' | 'sell' | 'bet' | 'bet_place' | 'bet_win' | 'bet_loss' | 'earn' | 'generate' | 'short_place' | 'short_win' | 'short_loss';
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
  timestamp: string;
  relativeTime: string;
  isBot?: boolean;
}

export class FirebaseActivityService {
  private static instance: FirebaseActivityService;
  private activityCollection = collection(db, 'activity-feed');

  public static getInstance(): FirebaseActivityService {
    if (!FirebaseActivityService.instance) {
      FirebaseActivityService.instance = new FirebaseActivityService();
    }
    return FirebaseActivityService.instance;
  }

  // Add activity to Firebase
  async addActivity(activity: Omit<FirebaseActivityItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      console.log('🔥 Adding activity to Firebase:', activity.username, activity.type);
      
      // Filter out undefined values that Firebase doesn't accept
      const cleanedActivity: any = {
        type: activity.type,
        username: activity.username,
        amount: Number(activity.amount) || 0,
        timestamp: serverTimestamp(),
      };

      // Only include defined fields (Firebase doesn't accept undefined values)
      if (activity.userId) cleanedActivity.userId = String(activity.userId);
      if (activity.opinionText) cleanedActivity.opinionText = String(activity.opinionText);
      if (activity.opinionId) cleanedActivity.opinionId = String(activity.opinionId);
      if (activity.price && !isNaN(Number(activity.price))) cleanedActivity.price = Number(activity.price);
      if (activity.quantity && !isNaN(Number(activity.quantity))) cleanedActivity.quantity = Number(activity.quantity);
      if (activity.targetUser) cleanedActivity.targetUser = String(activity.targetUser);
      if (activity.betType) cleanedActivity.betType = activity.betType;
      if (activity.targetPercentage && !isNaN(Number(activity.targetPercentage))) cleanedActivity.targetPercentage = Number(activity.targetPercentage);
      if (activity.timeframe && !isNaN(Number(activity.timeframe))) cleanedActivity.timeframe = Number(activity.timeframe);
      if (activity.isBot !== undefined) cleanedActivity.isBot = Boolean(activity.isBot);
      if (activity.botId) cleanedActivity.botId = String(activity.botId);
      if (activity.metadata && typeof activity.metadata === 'object') cleanedActivity.metadata = activity.metadata;

      await addDoc(this.activityCollection, cleanedActivity);
      console.log('✅ Activity added to Firebase successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      
      console.error('❌ Error adding activity to Firebase:', {
        message: errorMessage,
        code: errorCode,
        activity: `${activity.username} ${activity.type}`,
        fullError: error
      });
      
      // Provide specific guidance based on error type
      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        console.error('🔒 FIREBASE PERMISSIONS ERROR: Firestore security rules are blocking writes');
        console.error('🔧 FIX: Update Firestore security rules to allow authenticated users to write to activity-feed collection');
      } else if (errorMessage.includes('auth') || errorCode === 'unauthenticated') {
        console.error('🔑 AUTHENTICATION ERROR: User not authenticated for Firebase operations');
      } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        console.error('🌐 NETWORK ERROR: Firebase is offline or unreachable');
      }
      
      throw error;
    }
  }

  // Get recent activities (one-time fetch)
  async getRecentActivities(limitCount: number = 100): Promise<LocalActivityItem[]> {
    try {
      console.log(`🔥 Fetching ${limitCount} recent activities from Firebase...`);
      
      // Simplified query without orderBy to avoid index requirement
      const q = query(
        this.activityCollection,
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const activities: LocalActivityItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseActivityItem;
        activities.push(this.convertToLocalActivity(doc.id, data));
      });

      // Sort manually by timestamp (newest first)
      activities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA; // Descending order (newest first)
      });

      console.log(`✅ Fetched ${activities.length} activities from Firebase`);
      return activities.slice(0, limitCount); // Apply limit after sorting
    } catch (error) {
      console.error('❌ Error fetching activities from Firebase:', error);
      throw error;
    }
  }

  // Subscribe to real-time activity updates
  subscribeToActivities(
    callback: (activities: LocalActivityItem[]) => void,
    limitCount: number = 100,
    onError?: (error: Error) => void
  ): () => void {
    console.log(`🔥 Subscribing to real-time activity updates (limit: ${limitCount})`);
    
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      this.activityCollection,
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const activities: LocalActivityItem[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as FirebaseActivityItem;
          activities.push(this.convertToLocalActivity(doc.id, data));
        });

        // Sort manually by timestamp (newest first)
        activities.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA; // Descending order (newest first)
        });

        console.log(`🔄 Real-time update: ${activities.length} activities received`);
        callback(activities.slice(0, limitCount)); // Apply limit after sorting
      },
      (error) => {
        console.error('❌ Error in activity subscription:', error);
        
        // Check for specific permission errors
        if (error.message && error.message.includes('permission')) {
          console.error('🔒 Firebase permissions error - check Firestore security rules');
        }
        
        // Call the optional error handler
        if (onError) {
          onError(error as Error);
        }
      }
    );

    return unsubscribe;
  }

  // Convert Firebase data to local activity format
  private convertToLocalActivity(id: string, data: FirebaseActivityItem): LocalActivityItem {
    // Handle Firestore timestamp conversion
    let timestamp: string;
    if (data.timestamp) {
      if (data.timestamp.toDate) {
        // Firestore Timestamp
        timestamp = (data.timestamp as Timestamp).toDate().toISOString();
      } else if (data.timestamp.seconds) {
        // Timestamp-like object
        timestamp = new Date(data.timestamp.seconds * 1000).toISOString();
      } else {
        // String or other format
        timestamp = new Date(data.timestamp).toISOString();
      }
    } else {
      timestamp = new Date().toISOString();
    }

    return {
      id,
      type: data.type,
      username: data.username,
      opinionText: data.opinionText,
      opinionId: data.opinionId,
      amount: Number(data.amount) || 0,
      price: data.price ? Number(data.price) : undefined,
      quantity: data.quantity ? Number(data.quantity) : undefined,
      targetUser: data.targetUser,
      betType: data.betType,
      targetPercentage: data.targetPercentage,
      timeframe: data.timeframe,
      timestamp,
      relativeTime: this.getRelativeTime(timestamp),
      isBot: data.isBot || false
    };
  }

  // Calculate relative time
  private getRelativeTime(timestamp: string): string {
    try {
      const now = new Date();
      const time = new Date(timestamp);
      const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
      return 'Unknown time';
    }
  }

  // Batch add activities (for migration or bulk operations)
  async addActivitiesBatch(activities: Omit<FirebaseActivityItem, 'id' | 'timestamp'>[]): Promise<void> {
    console.log(`🔥 Adding ${activities.length} activities to Firebase in batch...`);
    
    const promises = activities.map(activity => this.addActivity(activity));
    
    try {
      await Promise.all(promises);
      console.log(`✅ Successfully added ${activities.length} activities to Firebase`);
    } catch (error) {
      console.error('❌ Error in batch activity addition:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseActivityService = FirebaseActivityService.getInstance(); 