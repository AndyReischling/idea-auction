/**
 * Bot Conflict Resolver - Handles Firebase version conflicts for bot operations
 * Implements exponential backoff and retry logic for concurrent bot writes
 */

import { 
  doc, 
  updateDoc, 
  setDoc, 
  getDoc, 
  runTransaction,
  DocumentReference,
  FirestoreError 
} from 'firebase/firestore';
import { db } from './firebase';

export class BotConflictResolver {
  private static instance: BotConflictResolver;
  private retryDelays = [100, 300, 700, 1500, 3000]; // Exponential backoff in ms

  static getInstance(): BotConflictResolver {
    if (!BotConflictResolver.instance) {
      BotConflictResolver.instance = new BotConflictResolver();
    }
    return BotConflictResolver.instance;
  }

  /**
   * Retry a Firestore operation with exponential backoff on version conflicts
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 5
  ): Promise<T> {
    let lastError: FirestoreError | Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry if it took multiple attempts
        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as FirestoreError;
        
        // Only retry on version conflicts or contention errors
        if (this.isRetryableError(error as FirestoreError)) {
          const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
          const jitter = Math.random() * 100; // Add randomness to avoid thundering herd
          
          console.log(`⚠️ ${operationName} conflict on attempt ${attempt + 1}, retrying in ${delay + jitter}ms...`);
          await this.delay(delay + jitter);
          continue;
        } else {
          // Don't retry non-conflict errors
          console.error(`❌ ${operationName} failed with non-retryable error:`, error);
          throw error;
        }
      }
    }

    // All retries exhausted
    console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Safe document update with conflict resolution
   */
  async safeUpdateDoc(
    docRef: DocumentReference,
    data: any,
    operationName: string
  ): Promise<void> {
    return this.retryOperation(
      () => updateDoc(docRef, data),
      `${operationName} (update)`,
      3 // Lower retry count for updates
    );
  }

  /**
   * Safe document set with conflict resolution
   */
  async safeSetDoc(
    docRef: DocumentReference,
    data: any,
    options: any,
    operationName: string
  ): Promise<void> {
    return this.retryOperation(
      () => setDoc(docRef, data, options),
      `${operationName} (set)`,
      3
    );
  }

  /**
   * Safe transaction with conflict resolution
   */
  async safeTransaction<T>(
    transactionFn: (transaction: any) => Promise<T>,
    operationName: string
  ): Promise<T> {
    return this.retryOperation(
      () => runTransaction(db, transactionFn),
      `${operationName} (transaction)`,
      5 // Higher retry count for transactions
    );
  }

  /**
   * Batch multiple operations with staggered timing to reduce conflicts
   */
  async staggeredBatchOperations<T>(
    operations: Array<() => Promise<T>>,
    staggerDelayMs: number = 50
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      if (i > 0) {
        await this.delay(staggerDelayMs);
      }
      results.push(await operations[i]());
    }
    
    return results;
  }

  /**
   * Check if error is retryable (version conflicts, contention, etc.)
   */
  private isRetryableError(error: FirestoreError): boolean {
    if (!error?.code) return false;
    
    const retryableCodes = [
      'aborted',           // Transaction was aborted
      'failed-precondition', // Version mismatch
      'unavailable',       // Service temporarily unavailable
      'deadline-exceeded', // Request timeout
      'internal',          // Internal server error
    ];
    
    const isRetryable = retryableCodes.includes(error.code);
    
    // Also check error message for version conflicts
    const hasVersionConflict = error.message?.includes('stored version') && 
                              error.message?.includes('does not match');
    
    return isRetryable || hasVersionConflict;
  }

  /**
   * Add random jitter to delay to prevent thundering herd
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get a random delay between min and max ms (for staggered bot starts)
   */
  getRandomDelay(minMs: number = 1000, maxMs: number = 5000): number {
    return minMs + Math.random() * (maxMs - minMs);
  }

  /**
   * Create a mutex-like lock for critical sections (using Firestore doc)
   */
  async createDistributedLock(
    lockName: string, 
    botId: string, 
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const lockDoc = doc(db, 'bot-locks', lockName);
    const lockData = {
      botId,
      timestamp: Date.now(),
      expiresAt: Date.now() + timeoutMs
    };

    try {
      // Try to acquire lock atomically
      return await this.safeTransaction(async (transaction) => {
        const lockSnap = await transaction.get(lockDoc);
        
        if (lockSnap.exists()) {
          const existingLock = lockSnap.data();
          // Check if lock is expired
          if (existingLock.expiresAt > Date.now()) {
            // Lock is still held
            return false;
          }
        }
        
        // Acquire or extend lock
        transaction.set(lockDoc, lockData);
        return true;
      }, `acquire-lock-${lockName}`);
    } catch (error) {
      console.error(`Failed to acquire lock ${lockName}:`, error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseDistributedLock(lockName: string, botId: string): Promise<void> {
    const lockDoc = doc(db, 'bot-locks', lockName);
    
    try {
      await this.safeTransaction(async (transaction) => {
        const lockSnap = await transaction.get(lockDoc);
        
        if (lockSnap.exists()) {
          const existingLock = lockSnap.data();
          // Only release if we own the lock
          if (existingLock.botId === botId) {
            transaction.delete(lockDoc);
          }
        }
      }, `release-lock-${lockName}`);
    } catch (error) {
      console.error(`Failed to release lock ${lockName}:`, error);
    }
  }
}

export const botConflictResolver = BotConflictResolver.getInstance(); 