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
import { opinionConflictResolver } from './opinion-conflict-resolver';

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
  private recentActivityHashes = new Set<string>();
  private readonly DEDUP_WINDOW_MS = 5000; // 5 seconds - reduced from longer window

  private constructor() {
    console.log('🔥 Firebase Activity Service initialized');
  }

  static getInstance(): FirebaseActivityService {
    if (!FirebaseActivityService.instance) {
      FirebaseActivityService.instance = new FirebaseActivityService();
    }
    return FirebaseActivityService.instance;
  }

  // Generate a stable hash for deduplication (excluding timestamp)
  private generateActivityHash(activity: any): string {
    // Create stable hash that doesn't change based on timing
    const baseComponents = [
      activity.type,
      activity.username,
      activity.amount,
      activity.opinionId || activity.opinionText || 'no-opinion',
      activity.targetUser || '',
      activity.betType || '',
      activity.isBot ? 'bot' : 'user'
    ].join('-');
    
    return baseComponents;
  }

  // Clean old hashes to prevent memory leaks
  private cleanupOldHashes(): void {
    // Simple cleanup - clear all hashes periodically
    if (this.recentActivityHashes.size > 100) {
      this.recentActivityHashes.clear();
      console.log('🧹 Cleared activity hash cache');
    }
  }

  // Enhanced retry logic for network errors and race conditions
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Enhanced error extraction to prevent empty objects
        let errorCode = 'unknown';
        let errorMessage = 'Unknown error occurred';
        
        try {
          if (error && typeof error === 'object') {
            errorCode = (error as any).code || (error as any).status || 'object_error';
            errorMessage = (error as any).message || JSON.stringify(error, null, 2);
          } else if (error instanceof Error) {
            errorCode = (error as any).code || 'error_instance';
            errorMessage = error.message;
          } else {
            errorMessage = String(error);
            errorCode = 'string_error';
          }
        } catch (parseError) {
          errorMessage = 'Error occurred but could not be parsed';
          errorCode = 'parse_error';
        }
        
        console.log(`🔍 Retry attempt ${attempt} - Error details:`, {
          errorCode,
          errorMessage,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
        });

        // Don't retry certain errors
        if (errorCode === 'permission-denied' || 
            errorCode === 'unauthenticated' || 
            errorCode === 'invalid-argument' ||
            attempt >= maxRetries) {
          break;
        }

        // For race condition errors, add more delay and jitter
        if (errorCode === 'already-exists' || errorMessage.includes('already exists')) {
          console.log(`⏳ Race condition detected, adding jitter to retry ${attempt + 1}...`);
          delayMs = delayMs * 2 + Math.random() * 1000; // Exponential backoff with jitter
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying operation in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
    
    // This should never be reached, but if it is, throw the last error
    throw lastError || new Error('Retry logic completed without success or error');
  }

  // Add activity to Firebase with enhanced race condition handling
  async addActivity(activity: Omit<FirebaseActivityItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Add small random delay for bot activities to reduce race conditions
      if (activity.isBot) {
        const delay = Math.random() * 100; // 0-100ms random delay
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Generate stable hash for deduplication
      const activityHash = this.generateActivityHash(activity);
      
      // Check for duplicates with enhanced logging
      if (this.recentActivityHashes.has(activityHash)) {
        console.log('🔄 Skipping duplicate activity (hash match):', {
          hash: activityHash.substring(0, 20) + '...',
          username: activity.username,
          type: activity.type,
          amount: activity.amount
        });
        return;
      }

      console.log('🔥 Adding activity to Firebase:', {
        username: activity.username,
        type: activity.type,
        amount: activity.amount,
        isBot: activity.isBot || false,
        hash: activityHash.substring(0, 20) + '...'
      });
      
      // Add to deduplication set immediately
      this.recentActivityHashes.add(activityHash);
      
      // Clean up old hashes periodically
      this.cleanupOldHashes();

      // Remove hash after time window to allow legitimate duplicates
      setTimeout(() => {
        this.recentActivityHashes.delete(activityHash);
      }, this.DEDUP_WINDOW_MS);
      
      // Filter out undefined values that Firebase doesn't accept
      const cleanedActivity: any = {
        type: activity.type,
        username: activity.username,
        amount: Number(activity.amount) || 0,
        timestamp: serverTimestamp(),
        // Add a unique identifier to prevent true duplicates
        activityHash: activityHash.substring(0, 50), // Store first 50 chars of hash
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

      // Use enhanced conflict resolution retry logic  
      await opinionConflictResolver.retryOperation(async () => {
        await addDoc(this.activityCollection, cleanedActivity);
      }, `add activity ${cleanedActivity.type} by ${cleanedActivity.username}`);
      
      console.log('✅ Activity added to Firebase successfully:', {
        username: activity.username,
        type: activity.type,
        hash: activityHash.substring(0, 20) + '...'
      });
    } catch (error) {
      console.error('❌ Error adding activity to Firebase:', error);
      // Remove from deduplication cache if addition failed
      const activityHash = this.generateActivityHash(activity);
      this.recentActivityHashes.delete(activityHash);
    }
  }

  // Get recent activities (one-time fetch)
  async getRecentActivities(limitCount: number = 100): Promise<LocalActivityItem[]> {
    try {
      console.log(`🔥 Fetching ${limitCount} recent activities from Firebase...`);
      
      // Use orderBy with timestamp for proper Firestore sorting (uses existing index)
      const q = query(
        this.activityCollection,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      // Use retry logic for fetching data
      const querySnapshot = await this.retryOperation(async () => {
        return await getDocs(q);
      });
      const activities: LocalActivityItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirebaseActivityItem;
        activities.push(this.convertToLocalActivity(doc.id, data));
      });

      console.log(`✅ Fetched ${activities.length} activities from Firebase`);
      return activities; // No need to sort or slice - Firestore already did it
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
    
    // Use orderBy with timestamp for proper Firestore sorting (uses existing index)
    const q = query(
      this.activityCollection,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const activities: LocalActivityItem[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as FirebaseActivityItem;
          activities.push(this.convertToLocalActivity(doc.id, data));
        });

        console.log(`🔄 Real-time update: ${activities.length} activities received`);
        callback(activities); // No need to sort or slice - Firestore already did it
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
  // Health check method to test Firebase connection
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', details: any }> {
    try {
      const testQuery = query(this.activityCollection, limit(1));
      await this.retryOperation(async () => {
        await getDocs(testQuery);
      });
      
      return {
        status: 'healthy',
        details: {
          message: 'Firebase connection is working',
          timestamp: new Date().toISOString(),
          dedupCacheSize: this.recentActivityHashes.size
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          message: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

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