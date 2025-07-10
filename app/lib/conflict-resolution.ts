'use client';

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { realtimeDataService } from './realtime-data-service';

// Conflict resolution strategies
type ConflictResolutionStrategy = 
  | 'localStorage_wins'      // Always prefer localStorage data
  | 'firebase_wins'          // Always prefer Firebase data
  | 'latest_timestamp_wins'  // Prefer data with latest timestamp
  | 'merge_intelligent'      // Intelligent merge based on data type
  | 'user_choice'           // Let user choose resolution
  | 'automatic_smart';       // Smart automatic resolution

// Conflict types
interface DataConflict {
  id: string;
  dataType: string;
  conflictType: 'value_mismatch' | 'missing_data' | 'timestamp_conflict' | 'structure_mismatch';
  localData: any;
  firebaseData: any;
  localTimestamp?: string;
  firebaseTimestamp?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
  resolution?: ConflictResolutionStrategy;
  resolvedData?: any;
  resolvedAt?: string;
}

interface ConflictResolutionResult {
  conflicts: DataConflict[];
  resolved: number;
  failed: number;
  userInputRequired: DataConflict[];
  summary: {
    totalConflicts: number;
    autoResolved: number;
    manualResolutionRequired: number;
    dataTypes: { [key: string]: number };
  };
}

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;
  private pendingConflicts: Map<string, DataConflict> = new Map();
  private resolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map();
  private conflictHistory: DataConflict[] = [];

  private constructor() {
    this.initializeDefaultStrategies();
  }

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  /**
   * Initialize default resolution strategies for different data types
   */
  private initializeDefaultStrategies(): void {
    // User profile: localStorage wins for balance/stats, Firebase wins for settings
    this.resolutionStrategies.set('userProfile', 'merge_intelligent');
    
    // Market data: merge with highest transaction counts
    this.resolutionStrategies.set('opinionMarketData', 'merge_intelligent');
    
    // Transactions: merge by timestamp, no duplicates
    this.resolutionStrategies.set('transactions', 'merge_intelligent');
    
    // Activity feed: merge by timestamp, no duplicates
    this.resolutionStrategies.set('globalActivityFeed', 'merge_intelligent');
    
    // Opinions: merge arrays, no duplicates
    this.resolutionStrategies.set('opinions', 'merge_intelligent');
    
    // Bot data: latest timestamp wins
    this.resolutionStrategies.set('autonomousBots', 'latest_timestamp_wins');
    
    // Bets: merge by ID, no duplicates
    this.resolutionStrategies.set('advancedBets', 'merge_intelligent');
    
    // Portfolio: merge holdings, sum quantities
    this.resolutionStrategies.set('ownedOpinions', 'merge_intelligent');
  }

  /**
   * Main conflict resolution method
   */
  async resolveAllConflicts(userId: string): Promise<ConflictResolutionResult> {
    console.log('🔍 Starting conflict resolution for user:', userId);
    
    const result: ConflictResolutionResult = {
      conflicts: [],
      resolved: 0,
      failed: 0,
      userInputRequired: [],
      summary: {
        totalConflicts: 0,
        autoResolved: 0,
        manualResolutionRequired: 0,
        dataTypes: {}
      }
    };

    try {
      // Check conflicts for each data type
      const dataTypes = [
        'userProfile',
        'opinions',
        'opinionMarketData',
        'transactions',
        'globalActivityFeed',
        'ownedOpinions',
        'advancedBets',
        'autonomousBots',
        'shortPositions',
        'botTransactions'
      ];

      for (const dataType of dataTypes) {
        const conflicts = await this.detectConflicts(dataType, userId);
        result.conflicts.push(...conflicts);
        
        if (conflicts.length > 0) {
          result.summary.dataTypes[dataType] = conflicts.length;
          console.log(`📊 Found ${conflicts.length} conflicts in ${dataType}`);
        }
      }

      result.summary.totalConflicts = result.conflicts.length;

      // Auto-resolve conflicts where possible
      for (const conflict of result.conflicts) {
        if (conflict.autoResolvable) {
          try {
            const resolved = await this.resolveConflict(conflict, userId);
            if (resolved) {
              result.resolved++;
              result.summary.autoResolved++;
            } else {
              result.failed++;
            }
          } catch (error) {
            console.error(`Failed to resolve conflict ${conflict.id}:`, error);
            result.failed++;
          }
        } else {
          result.userInputRequired.push(conflict);
          result.summary.manualResolutionRequired++;
        }
      }

      console.log(`✅ Conflict resolution complete: ${result.resolved} resolved, ${result.failed} failed, ${result.userInputRequired.length} need manual resolution`);
      
      return result;
    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      throw error;
    }
  }

  /**
   * Detect conflicts between localStorage and Firebase for a specific data type
   */
  private async detectConflicts(dataType: string, userId: string): Promise<DataConflict[]> {
    const conflicts: DataConflict[] = [];
    
    try {
      // Get local data
      const localData = this.getFromLocalStorage(dataType, null);
      
      // Get Firebase data
      const firebaseData = await this.getFirebaseData(dataType, userId);
      
      // Compare data
      if (localData !== null && firebaseData !== null) {
        const conflict = this.compareData(dataType, localData, firebaseData);
        if (conflict) {
          conflicts.push(conflict);
        }
      } else if (localData !== null && firebaseData === null) {
        // Data exists locally but not in Firebase
        conflicts.push({
          id: `${dataType}_missing_firebase`,
          dataType,
          conflictType: 'missing_data',
          localData,
          firebaseData: null,
          severity: 'medium',
          autoResolvable: true,
          resolution: 'localStorage_wins'
        });
      } else if (localData === null && firebaseData !== null) {
        // Data exists in Firebase but not locally
        conflicts.push({
          id: `${dataType}_missing_local`,
          dataType,
          conflictType: 'missing_data',
          localData: null,
          firebaseData,
          severity: 'low',
          autoResolvable: true,
          resolution: 'firebase_wins'
        });
      }
    } catch (error) {
      console.error(`Error detecting conflicts for ${dataType}:`, error);
    }
    
    return conflicts;
  }

  /**
   * Compare local and Firebase data to identify conflicts
   */
  private compareData(dataType: string, localData: any, firebaseData: any): DataConflict | null {
    const conflictId = `${dataType}_${Date.now()}`;
    
    // Handle different data types
    switch (dataType) {
      case 'userProfile':
        return this.compareUserProfile(conflictId, localData, firebaseData);
      
      case 'opinionMarketData':
        return this.compareMarketData(conflictId, localData, firebaseData);
      
      case 'transactions':
        return this.compareTransactions(conflictId, localData, firebaseData);
      
      case 'opinions':
        return this.compareArrays(conflictId, dataType, localData, firebaseData);
      
      case 'globalActivityFeed':
        return this.compareActivityFeed(conflictId, localData, firebaseData);
      
      default:
        return this.compareGeneric(conflictId, dataType, localData, firebaseData);
    }
  }

  /**
   * Compare user profile data
   */
  private compareUserProfile(conflictId: string, localData: any, firebaseData: any): DataConflict | null {
    const conflicts: string[] = [];
    
    // Check critical fields
    if (localData.balance !== firebaseData.balance) {
      conflicts.push('balance');
    }
    if (localData.totalEarnings !== firebaseData.totalEarnings) {
      conflicts.push('totalEarnings');
    }
    if (localData.totalLosses !== firebaseData.totalLosses) {
      conflicts.push('totalLosses');
    }
    if (localData.username !== firebaseData.username) {
      conflicts.push('username');
    }
    
    if (conflicts.length > 0) {
      return {
        id: conflictId,
        dataType: 'userProfile',
        conflictType: 'value_mismatch',
        localData,
        firebaseData,
        localTimestamp: localData.lastUpdated,
        firebaseTimestamp: firebaseData.updatedAt,
        severity: conflicts.includes('balance') ? 'high' : 'medium',
        autoResolvable: true,
        resolution: 'merge_intelligent'
      };
    }
    
    return null;
  }

  /**
   * Compare market data
   */
  private compareMarketData(conflictId: string, localData: any, firebaseData: any): DataConflict | null {
    const conflicts: string[] = [];
    
    // Check each opinion's market data
    const allOpinions = new Set([...Object.keys(localData), ...Object.keys(firebaseData)]);
    
    for (const opinion of allOpinions) {
      const localOpinion = localData[opinion];
      const firebaseOpinion = firebaseData[opinion];
      
      if (localOpinion && firebaseOpinion) {
        if (localOpinion.timesPurchased !== firebaseOpinion.timesPurchased ||
            localOpinion.timesSold !== firebaseOpinion.timesSold ||
            localOpinion.currentPrice !== firebaseOpinion.currentPrice) {
          conflicts.push(opinion);
        }
      }
    }
    
    if (conflicts.length > 0) {
      return {
        id: conflictId,
        dataType: 'opinionMarketData',
        conflictType: 'value_mismatch',
        localData,
        firebaseData,
        severity: 'medium',
        autoResolvable: true,
        resolution: 'merge_intelligent'
      };
    }
    
    return null;
  }

  /**
   * Compare transactions
   */
  private compareTransactions(conflictId: string, localData: any[], firebaseData: any[]): DataConflict | null {
    const localIds = new Set(localData.map(t => t.id));
    const firebaseIds = new Set(firebaseData.map(t => t.id));
    
    const onlyLocal = localData.filter(t => !firebaseIds.has(t.id));
    const onlyFirebase = firebaseData.filter(t => !localIds.has(t.id));
    
    if (onlyLocal.length > 0 || onlyFirebase.length > 0) {
      return {
        id: conflictId,
        dataType: 'transactions',
        conflictType: 'missing_data',
        localData,
        firebaseData,
        severity: 'high',
        autoResolvable: true,
        resolution: 'merge_intelligent'
      };
    }
    
    return null;
  }

  /**
   * Compare arrays (opinions, etc.)
   */
  private compareArrays(conflictId: string, dataType: string, localData: any[], firebaseData: any[]): DataConflict | null {
    const localSet = new Set(localData);
    const firebaseSet = new Set(firebaseData);
    
    const onlyLocal = localData.filter(item => !firebaseSet.has(item));
    const onlyFirebase = firebaseData.filter(item => !localSet.has(item));
    
    if (onlyLocal.length > 0 || onlyFirebase.length > 0) {
      return {
        id: conflictId,
        dataType,
        conflictType: 'missing_data',
        localData,
        firebaseData,
        severity: 'low',
        autoResolvable: true,
        resolution: 'merge_intelligent'
      };
    }
    
    return null;
  }

  /**
   * Compare activity feed
   */
  private compareActivityFeed(conflictId: string, localData: any[], firebaseData: any[]): DataConflict | null {
    const localIds = new Set(localData.map(a => a.id || `${a.timestamp}_${a.type}_${a.username}`));
    const firebaseIds = new Set(firebaseData.map(a => a.id));
    
    const onlyLocal = localData.filter(a => !firebaseIds.has(a.id || `${a.timestamp}_${a.type}_${a.username}`));
    const onlyFirebase = firebaseData.filter(a => !localIds.has(a.id));
    
    if (onlyLocal.length > 0 || onlyFirebase.length > 0) {
      return {
        id: conflictId,
        dataType: 'globalActivityFeed',
        conflictType: 'missing_data',
        localData,
        firebaseData,
        severity: 'medium',
        autoResolvable: true,
        resolution: 'merge_intelligent'
      };
    }
    
    return null;
  }

  /**
   * Generic comparison for other data types
   */
  private compareGeneric(conflictId: string, dataType: string, localData: any, firebaseData: any): DataConflict | null {
    const localJson = JSON.stringify(localData);
    const firebaseJson = JSON.stringify(firebaseData);
    
    if (localJson !== firebaseJson) {
      return {
        id: conflictId,
        dataType,
        conflictType: 'value_mismatch',
        localData,
        firebaseData,
        severity: 'medium',
        autoResolvable: true,
        resolution: this.resolutionStrategies.get(dataType) || 'latest_timestamp_wins'
      };
    }
    
    return null;
  }

  /**
   * Resolve a specific conflict
   */
  private async resolveConflict(conflict: DataConflict, userId: string): Promise<boolean> {
    console.log(`🔧 Resolving conflict: ${conflict.id} using strategy: ${conflict.resolution}`);
    
    try {
      let resolvedData: any;
      
      switch (conflict.resolution) {
        case 'localStorage_wins':
          resolvedData = conflict.localData;
          break;
        
        case 'firebase_wins':
          resolvedData = conflict.firebaseData;
          break;
        
        case 'latest_timestamp_wins':
          resolvedData = this.resolveByTimestamp(conflict);
          break;
        
        case 'merge_intelligent':
          resolvedData = this.mergeIntelligently(conflict);
          break;
        
        case 'automatic_smart':
          resolvedData = this.resolveAutomatically(conflict);
          break;
        
        default:
          throw new Error(`Unknown resolution strategy: ${conflict.resolution}`);
      }
      
      // Apply resolved data
      await this.applyResolvedData(conflict.dataType, resolvedData, userId);
      
      // Update conflict record
      conflict.resolvedData = resolvedData;
      conflict.resolvedAt = new Date().toISOString();
      
      this.conflictHistory.push(conflict);
      
      return true;
    } catch (error) {
      console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      return false;
    }
  }

  /**
   * Resolve by timestamp
   */
  private resolveByTimestamp(conflict: DataConflict): any {
    const localTime = new Date(conflict.localTimestamp || 0).getTime();
    const firebaseTime = new Date(conflict.firebaseTimestamp || 0).getTime();
    
    return localTime > firebaseTime ? conflict.localData : conflict.firebaseData;
  }

  /**
   * Intelligent merge based on data type
   */
  private mergeIntelligently(conflict: DataConflict): any {
    switch (conflict.dataType) {
      case 'userProfile':
        return this.mergeUserProfile(conflict.localData, conflict.firebaseData);
      
      case 'opinionMarketData':
        return this.mergeMarketData(conflict.localData, conflict.firebaseData);
      
      case 'transactions':
        return this.mergeTransactions(conflict.localData, conflict.firebaseData);
      
      case 'opinions':
        return this.mergeArrays(conflict.localData, conflict.firebaseData);
      
      case 'globalActivityFeed':
        return this.mergeActivityFeed(conflict.localData, conflict.firebaseData);
      
      case 'ownedOpinions':
        return this.mergePortfolio(conflict.localData, conflict.firebaseData);
      
      default:
        return this.resolveByTimestamp(conflict);
    }
  }

  /**
   * Merge user profile data intelligently
   */
  private mergeUserProfile(localData: any, firebaseData: any): any {
    return {
      ...firebaseData,
      // localStorage wins for financial data (more recent transactions)
      balance: localData.balance || firebaseData.balance,
      totalEarnings: Math.max(localData.totalEarnings || 0, firebaseData.totalEarnings || 0),
      totalLosses: Math.max(localData.totalLosses || 0, firebaseData.totalLosses || 0),
      // Firebase wins for settings and metadata
      preferences: firebaseData.preferences || localData.preferences,
      joinDate: firebaseData.joinDate || localData.joinDate,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Merge market data intelligently
   */
  private mergeMarketData(localData: any, firebaseData: any): any {
    const merged: any = { ...firebaseData };
    
    // For each opinion, take the higher transaction counts
    Object.keys(localData).forEach(opinion => {
      const localOpinion = localData[opinion];
      const firebaseOpinion = firebaseData[opinion];
      
      if (firebaseOpinion) {
        merged[opinion] = {
          ...firebaseOpinion,
          timesPurchased: Math.max(localOpinion.timesPurchased || 0, firebaseOpinion.timesPurchased || 0),
          timesSold: Math.max(localOpinion.timesSold || 0, firebaseOpinion.timesSold || 0),
          currentPrice: localOpinion.currentPrice || firebaseOpinion.currentPrice,
          basePrice: localOpinion.basePrice || firebaseOpinion.basePrice
        };
      } else {
        merged[opinion] = localOpinion;
      }
    });
    
    return merged;
  }

  /**
   * Merge transactions
   */
  private mergeTransactions(localData: any[], firebaseData: any[]): any[] {
    const merged = [...firebaseData];
    const firebaseIds = new Set(firebaseData.map(t => t.id));
    
    // Add local transactions that don't exist in Firebase
    localData.forEach(transaction => {
      if (!firebaseIds.has(transaction.id)) {
        merged.push(transaction);
      }
    });
    
    // Sort by timestamp
    return merged.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
  }

  /**
   * Merge arrays (remove duplicates)
   */
  private mergeArrays(localData: any[], firebaseData: any[]): any[] {
    const merged = [...firebaseData];
    const firebaseSet = new Set(firebaseData);
    
    localData.forEach(item => {
      if (!firebaseSet.has(item)) {
        merged.push(item);
      }
    });
    
    return merged;
  }

  /**
   * Merge activity feed
   */
  private mergeActivityFeed(localData: any[], firebaseData: any[]): any[] {
    const merged = [...firebaseData];
    const firebaseIds = new Set(firebaseData.map(a => a.id));
    
    localData.forEach(activity => {
      const activityId = activity.id || `${activity.timestamp}_${activity.type}_${activity.username}`;
      if (!firebaseIds.has(activityId)) {
        merged.push({
          ...activity,
          id: activityId
        });
      }
    });
    
    // Sort by timestamp
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Merge portfolio data
   */
  private mergePortfolio(localData: any[], firebaseData: any[]): any[] {
    const merged: any[] = [];
    const localMap = new Map(localData.map(item => [item.opinionText || item.opinion, item]));
    const firebaseMap = new Map(firebaseData.map(item => [item.opinionText || item.opinion, item]));
    
    // Merge by opinion, sum quantities
    const allOpinions = new Set([...localMap.keys(), ...firebaseMap.keys()]);
    
    allOpinions.forEach(opinion => {
      const localItem = localMap.get(opinion);
      const firebaseItem = firebaseMap.get(opinion);
      
      if (localItem && firebaseItem) {
        // Merge quantities
        merged.push({
          ...firebaseItem,
          quantity: (localItem.quantity || 0) + (firebaseItem.quantity || 0),
          totalCost: (localItem.totalCost || 0) + (firebaseItem.totalCost || 0)
        });
      } else {
        merged.push(localItem || firebaseItem);
      }
    });
    
    return merged;
  }

  /**
   * Automatic smart resolution
   */
  private resolveAutomatically(conflict: DataConflict): any {
    // Use intelligent merging for most cases
    if (conflict.conflictType === 'missing_data') {
      return conflict.localData || conflict.firebaseData;
    }
    
    return this.mergeIntelligently(conflict);
  }

  /**
   * Apply resolved data to both localStorage and Firebase
   */
  private async applyResolvedData(dataType: string, resolvedData: any, userId: string): Promise<void> {
    // Update localStorage
    this.saveToLocalStorage(dataType, resolvedData);
    
    // Update Firebase based on data type
    await this.saveToFirebase(dataType, resolvedData, userId);
  }

  /**
   * Save data to Firebase based on type
   */
  private async saveToFirebase(dataType: string, data: any, userId: string): Promise<void> {
    switch (dataType) {
      case 'userProfile':
        await updateDoc(doc(db, 'users', userId), {
          ...data,
          updatedAt: serverTimestamp()
        });
        break;
      
      case 'opinionMarketData':
        const batch = writeBatch(db);
        Object.entries(data).forEach(([opinion, marketData]: [string, any]) => {
          const docId = btoa(opinion).replace(/[^a-zA-Z0-9]/g, '');
          const docRef = doc(db, 'market-data', docId);
          batch.set(docRef, {
            opinionText: opinion,
            ...marketData,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
        break;
      
      case 'transactions':
        const transactionBatch = writeBatch(db);
        data.forEach((transaction: any) => {
          const docRef = doc(db, 'transactions', transaction.id);
          transactionBatch.set(docRef, {
            ...transaction,
            userId,
            timestamp: serverTimestamp()
          });
        });
        await transactionBatch.commit();
        break;
      
      // Add more cases as needed
    }
  }

  /**
   * Get Firebase data for a specific data type
   */
  private async getFirebaseData(dataType: string, userId: string): Promise<any> {
    try {
      switch (dataType) {
        case 'userProfile':
          const userDoc = await getDoc(doc(db, 'users', userId));
          return userDoc.exists() ? userDoc.data() : null;
        
        case 'opinionMarketData':
          const marketSnapshot = await getDocs(collection(db, 'market-data'));
          const marketData: any = {};
          marketSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.opinionText) {
              marketData[data.opinionText] = data;
            }
          });
          return Object.keys(marketData).length > 0 ? marketData : null;
        
        case 'transactions':
          const transactionSnapshot = await getDocs(
            query(collection(db, 'transactions'), where('userId', '==', userId))
            // Removed potential orderBy to avoid composite index requirement
          );
          const transactions: any[] = [];
          transactionSnapshot.docs.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
          });
          
          // Sort manually if needed
          transactions.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp.toDate ? a.timestamp.toDate() : a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp.toDate ? b.timestamp.toDate() : b.timestamp).getTime() : 0;
            return timeB - timeA; // Descending order
          });
          
          return transactions.length > 0 ? transactions : null;
        
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error getting Firebase data for ${dataType}:`, error);
      return null;
    }
  }

  /**
   * Manual conflict resolution (for user choice)
   */
  async resolveManualConflict(conflictId: string, resolution: 'local' | 'firebase' | 'merge', userId: string): Promise<boolean> {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }
    
    let resolvedData: any;
    
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'firebase':
        resolvedData = conflict.firebaseData;
        break;
      case 'merge':
        resolvedData = this.mergeIntelligently(conflict);
        break;
    }
    
    try {
      await this.applyResolvedData(conflict.dataType, resolvedData, userId);
      this.pendingConflicts.delete(conflictId);
      return true;
    } catch (error) {
      console.error(`Failed to resolve manual conflict ${conflictId}:`, error);
      return false;
    }
  }

  /**
   * Get pending conflicts that need manual resolution
   */
  getPendingConflicts(): DataConflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get conflict resolution history
   */
  getConflictHistory(): DataConflict[] {
    return [...this.conflictHistory];
  }

  /**
   * Clear conflict history
   */
  clearConflictHistory(): void {
    this.conflictHistory = [];
  }

  // Utility methods
  private getFromLocalStorage<T>(key: string, defaultValue: T): T {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  private saveToLocalStorage<T>(key: string, value: T): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }
}

// Export singleton instance
export const conflictResolutionService = ConflictResolutionService.getInstance(); 