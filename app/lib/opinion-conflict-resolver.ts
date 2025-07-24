/**
 * Opinion Conflict Resolver - Handles Firebase version conflicts for opinion operations
 * Resolves the "stored version does not match required base version" errors
 */

import { 
  doc, 
  updateDoc, 
  setDoc, 
  getDoc, 
  runTransaction,
  DocumentReference,
  FirestoreError,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { createMarketDataDocId } from './document-id-utils';

export interface OpinionData {
  id?: string;
  opinionId?: string;
  text?: string;
  opinionText?: string;
  currentPrice?: number;
  timesPurchased?: number;
  timesSold?: number;
  [key: string]: any;
}

export class OpinionConflictResolver {
  private static instance: OpinionConflictResolver;
  private retryDelays = [150, 400, 800, 1600, 3200]; // Exponential backoff
  private lockCache = new Map<string, Promise<any>>(); // Prevent concurrent operations on same document

  static getInstance(): OpinionConflictResolver {
    if (!OpinionConflictResolver.instance) {
      OpinionConflictResolver.instance = new OpinionConflictResolver();
    }
    return OpinionConflictResolver.instance;
  }

  /**
   * Normalize opinion data to ensure consistent ID and text fields
   */
  normalizeOpinionData(data: OpinionData): OpinionData {
    const normalized = { ...data };
    
    // Ensure ID consistency
    if (!normalized.id && normalized.opinionId) {
      normalized.id = normalized.opinionId;
    }
    if (!normalized.opinionId && normalized.id) {
      normalized.opinionId = normalized.id;
    }
    
    // Ensure text consistency
    if (!normalized.text && normalized.opinionText) {
      normalized.text = normalized.opinionText;
    }
    if (!normalized.opinionText && normalized.text) {
      normalized.opinionText = normalized.text;
    }
    
    // Generate consistent ID from text if missing
    if (!normalized.id && normalized.text) {
      normalized.id = createMarketDataDocId(normalized.text);
      normalized.opinionId = normalized.id;
    }
    
    return normalized;
  }

  /**
   * Check if error is retryable (version conflicts + network errors)
   */
  private isRetryableError(error: FirestoreError | Error): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = (error as FirestoreError).code;
    
    // Firestore version conflict errors
    const isVersionConflict = errorCode === 'failed-precondition' || 
           errorCode === 'aborted' ||
           errorMessage.includes('version') ||
           errorMessage.includes('contention');
    
    // Network connectivity errors (including QUIC protocol errors)
    const isNetworkError = errorMessage.includes('quic') ||
           errorMessage.includes('err_network') ||
           errorMessage.includes('err_name_not_resolved') ||
           errorMessage.includes('network_changed') ||
           errorMessage.includes('connection') ||
           errorCode === 'unavailable' ||
           errorCode === 'deadline-exceeded';
    
    return isVersionConflict || isNetworkError;
  }

  /**
   * Add random delay to prevent thundering herd
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
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
        
        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as FirestoreError;
        const errorMessage = (error as Error).message?.toLowerCase() || '';
        
        if (this.isRetryableError(error as FirestoreError)) {
          const baseDelay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
          const jitter = Math.random() * 200; // Random jitter
          const delay = baseDelay + jitter;
          
          // Differentiate between version conflicts and network errors in logging
          if (errorMessage.includes('quic') || errorMessage.includes('network')) {
            console.log(`🌐 ${operationName} network error on attempt ${attempt + 1}, retrying in ${delay}ms...`);
          } else {
            console.log(`⚠️ ${operationName} version conflict on attempt ${attempt + 1}, retrying in ${delay}ms...`);
          }
          
          await this.delay(delay);
          continue;
        } else {
          console.error(`❌ ${operationName} failed with non-retryable error:`, error);
          throw error;
        }
      }
    }

    console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Safe market data update with distributed locking
   */
  async safeUpdateMarketData(
    opinionText: string,
    updates: any,
    operationName: string = 'update-market-data'
  ): Promise<void> {
    const lockKey = `market-${createMarketDataDocId(opinionText)}`;
    
    // Check if operation already in progress for this document
    if (this.lockCache.has(lockKey)) {
      console.log(`🔒 ${operationName} waiting for existing operation on ${opinionText.slice(0, 30)}...`);
      await this.lockCache.get(lockKey);
      return;
    }

    const operation = this.retryOperation(async () => {
      const docRef = doc(db, 'market-data', createMarketDataDocId(opinionText));
      
      return runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        
        if (docSnap.exists()) {
          // Update existing document
          transaction.update(docRef, {
            ...updates,
            lastUpdated: serverTimestamp()
          });
        } else {
          // Create new document with defaults
          transaction.set(docRef, {
            opinionText,
            timesPurchased: 0,
            timesSold: 0,
            currentPrice: 10.0,
            basePrice: 10.0,
            lastUpdated: serverTimestamp(),
            ...updates
          });
        }
      });
    }, `${operationName} for ${opinionText.slice(0, 30)}...`);

    // Store operation promise to prevent concurrent access
    this.lockCache.set(lockKey, operation);
    
    try {
      await operation;
    } finally {
      // Clean up lock after operation completes
      this.lockCache.delete(lockKey);
    }
  }

  /**
   * Safe opinion document creation
   */
  async safeCreateOpinion(
    opinionId: string,
    data: any,
    operationName: string = 'create-opinion'
  ): Promise<void> {
    return this.retryOperation(async () => {
      const docRef = doc(db, 'opinions', opinionId);
      await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }, `${operationName} ${opinionId}`);
  }

  /**
   * Safe opinion document update
   */
  async safeUpdateOpinion(
    opinionId: string,
    updates: any,
    operationName: string = 'update-opinion'
  ): Promise<void> {
    return this.retryOperation(async () => {
      const docRef = doc(db, 'opinions', opinionId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }, `${operationName} ${opinionId}`);
  }

  /**
   * Safe portfolio update
   */
  async safeUpdatePortfolio(
    userId: string,
    updates: any,
    operationName: string = 'update-portfolio'
  ): Promise<void> {
    return this.retryOperation(async () => {
      const docRef = doc(db, 'user-portfolios', userId);
      await setDoc(docRef, {
        userId,
        ...updates,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    }, `${operationName} ${userId}`);
  }

  /**
   * Get normalized opinion data with consistent fields
   */
  async getNormalizedOpinionData(collection: string, docId: string): Promise<OpinionData | null> {
    try {
      const docRef = doc(db, collection, docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = { id: docSnap.id, ...docSnap.data() } as OpinionData;
      return this.normalizeOpinionData(data);
    } catch (error) {
      console.error(`Error fetching normalized opinion data:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const opinionConflictResolver = OpinionConflictResolver.getInstance(); 