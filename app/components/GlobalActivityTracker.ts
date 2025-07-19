'use client';

import { db } from '../lib/firebase';
import { createActivityId } from '../lib/document-id-utils';
import {
  collection,
  query,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

interface UserData {
  uid: string;
  username: string;
  balance: number;
  totalEarnings: number;
  totalLosses: number;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Singleton service that manages global activity tracking
 * Subscribes to Firestore changes and tracks user activity
 */
class GlobalActivityTracker {
  private static instance: GlobalActivityTracker;
  private unsubscribe: Unsubscribe | null = null;
  private currentUser: UserData | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GlobalActivityTracker {
    if (!GlobalActivityTracker.instance) {
      GlobalActivityTracker.instance = new GlobalActivityTracker();
    }
    return GlobalActivityTracker.instance;
  }

  /**
   * Initialize the tracker with auth context
   */
  initializeWithAuthContext(): void {
    if (this.isInitialized) return;
    
    console.log('🔧 GlobalActivityTracker: Initializing with auth context...');
    this.isInitialized = true;
    
    // Set up global activity subscription
    this.setupGlobalSubscription();
  }

  /**
   * Update the current user being tracked
   */
  updateCurrentUser(userData: UserData): void {
    this.currentUser = userData;
    console.log('👤 GlobalActivityTracker: Updated current user →', userData.username);
    
    // If not initialized yet, initialize now
    if (!this.isInitialized) {
      this.initializeWithAuthContext();
    }
  }

  /**
   * Set up global Firestore subscription
   */
  private setupGlobalSubscription(): void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const q = query(collection(db, 'users'));
    this.unsubscribe = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        console.log(`[Activity] ${change.type}`, change.doc.data());
        
        // Additional activity tracking logic can be added here
        this.processActivityChange(change);
      });
    });
  }

  /**
   * Process activity changes
   */
  private processActivityChange(change: any): void {
    // This is where you can add logic to process different types of activity changes
    // For example, updating UI, logging, analytics, etc.
    
    const data = change.doc.data();
    const changeType = change.type;
    
    // Log activity for debugging
    console.log(`🔄 Activity ${changeType}:`, {
      docId: change.doc.id,
      data: data,
      user: this.currentUser?.username || 'unknown'
    });
  }

  /**
   * Clean up subscriptions
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * Get current user data
   */
  getCurrentUser(): UserData | null {
    return this.currentUser;
  }

  /**
   * Check if tracker is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export default GlobalActivityTracker.getInstance();
