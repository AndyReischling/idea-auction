'use client';

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { realtimeDataService } from './realtime-data-service';
import { unifiedMigrationService } from './unified-migration';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResults: TestResult[];
  dataIntegrityScore: number;
  performanceMetrics: {
    firebaseLatency: number;
    localStorageLatency: number;
    syncLatency: number;
  };
}

interface BackupData {
  id: string;
  userId: string;
  timestamp: string;
  dataTypes: string[];
  size: number;
  checksum: string;
  data: { [key: string]: any };
}

export class MigrationTestingService {
  private static instance: MigrationTestingService;
  private testResults: TestResult[] = [];
  private backups: Map<string, BackupData> = new Map();

  private constructor() {}

  public static getInstance(): MigrationTestingService {
    if (!MigrationTestingService.instance) {
      MigrationTestingService.instance = new MigrationTestingService();
    }
    return MigrationTestingService.instance;
  }

  /**
   * Run comprehensive migration validation tests
   */
  async runMigrationValidation(userId: string): Promise<ValidationResult> {
    console.log('🧪 Starting migration validation tests...');
    
    const testResults: TestResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();

    try {
      // Test 1: Firebase Connection
      const firebaseTest = await this.testFirebaseConnection();
      testResults.push(firebaseTest);
      if (!firebaseTest.passed) errors.push(firebaseTest.message);

      // Test 2: Data Integrity
      const dataIntegrityTest = await this.testDataIntegrity(userId);
      testResults.push(dataIntegrityTest);
      if (!dataIntegrityTest.passed) errors.push(dataIntegrityTest.message);

      // Test 3: User Profile Sync
      const profileTest = await this.testUserProfileSync(userId);
      testResults.push(profileTest);
      if (!profileTest.passed) errors.push(profileTest.message);

      // Test 4: Opinions Sync
      const opinionsTest = await this.testOpinionsSync();
      testResults.push(opinionsTest);
      if (!opinionsTest.passed) errors.push(opinionsTest.message);

      // Test 5: Market Data Sync
      const marketDataTest = await this.testMarketDataSync();
      testResults.push(marketDataTest);
      if (!marketDataTest.passed) errors.push(marketDataTest.message);

      // Test 6: Transactions Sync
      const transactionsTest = await this.testTransactionsSync(userId);
      testResults.push(transactionsTest);
      if (!transactionsTest.passed) errors.push(transactionsTest.message);

      // Test 7: Real-time Updates
      const realtimeTest = await this.testRealtimeUpdates(userId);
      testResults.push(realtimeTest);
      if (!realtimeTest.passed) warnings.push(realtimeTest.message);

      // Test 8: Performance Metrics
      const performanceTest = await this.testPerformanceMetrics();
      testResults.push(performanceTest);
      if (!performanceTest.passed) warnings.push(performanceTest.message);

      // Test 9: Offline Functionality
      const offlineTest = await this.testOfflineFunctionality();
      testResults.push(offlineTest);
      if (!offlineTest.passed) warnings.push(offlineTest.message);

      // Test 10: Data Consistency
      const consistencyTest = await this.testDataConsistency(userId);
      testResults.push(consistencyTest);
      if (!consistencyTest.passed) errors.push(consistencyTest.message);

      // Calculate data integrity score
      const passedTests = testResults.filter(t => t.passed).length;
      const dataIntegrityScore = Math.round((passedTests / testResults.length) * 100);

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics();

      this.testResults = testResults;

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        testResults,
        dataIntegrityScore,
        performanceMetrics
      };

      console.log(`✅ Migration validation complete: ${passedTests}/${testResults.length} tests passed`);
      console.log(`📊 Data integrity score: ${dataIntegrityScore}%`);
      
      return result;

    } catch (error) {
      console.error('❌ Migration validation failed:', error);
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: [],
        testResults,
        dataIntegrityScore: 0,
        performanceMetrics: {
          firebaseLatency: -1,
          localStorageLatency: -1,
          syncLatency: -1
        }
      };
    }
  }

  /**
   * Test Firebase connection
   */
  private async testFirebaseConnection(): Promise<TestResult> {
    const testName = 'Firebase Connection Test';
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const testDoc = doc(db, 'test', 'connection');
      await setDoc(testDoc, { 
        timestamp: serverTimestamp(),
        test: 'connection'
      });
      
      const readDoc = await getDoc(testDoc);
      if (!readDoc.exists()) {
        throw new Error('Failed to read test document');
      }
      
      // Clean up
      await deleteDoc(testDoc);
      
      const latency = Date.now() - startTime;
      
      return {
        testName,
        passed: true,
        message: `Firebase connection successful (${latency}ms)`,
        details: { latency },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Firebase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test data integrity between localStorage and Firebase
   */
  private async testDataIntegrity(userId: string): Promise<TestResult> {
    const testName = 'Data Integrity Test';
    
    try {
      // Get local data
      const localProfile = this.getFromLocalStorage('userProfile', null);
      const localOpinions = this.getFromLocalStorage('opinions', []);
      const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
      
      // Get Firebase data
      const firebaseProfile = await this.getFirebaseUserProfile(userId);
      const firebaseOpinions = await realtimeDataService.getOpinions();
      const firebaseMarketData = await realtimeDataService.getMarketData();
      
      const issues: string[] = [];
      
      // Compare profiles
      if (localProfile && firebaseProfile) {
        if (localProfile.username !== firebaseProfile.username) {
          issues.push('Username mismatch');
        }
        if (Math.abs(localProfile.balance - firebaseProfile.balance) > 0.01) {
          issues.push(`Balance mismatch: local=${localProfile.balance}, firebase=${firebaseProfile.balance}`);
        }
      }
      
      // Compare opinions
      if (localOpinions.length !== firebaseOpinions.length) {
        issues.push(`Opinion count mismatch: local=${localOpinions.length}, firebase=${firebaseOpinions.length}`);
      }
      
      // Compare market data
      const localMarketKeys = Object.keys(localMarketData);
      const firebaseMarketKeys = Object.keys(firebaseMarketData);
      
      if (localMarketKeys.length !== firebaseMarketKeys.length) {
        issues.push(`Market data count mismatch: local=${localMarketKeys.length}, firebase=${firebaseMarketKeys.length}`);
      }
      
      return {
        testName,
        passed: issues.length === 0,
        message: issues.length === 0 ? 'Data integrity validated' : `Data integrity issues: ${issues.join(', ')}`,
        details: { issues },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Data integrity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test user profile synchronization
   */
  private async testUserProfileSync(userId: string): Promise<TestResult> {
    const testName = 'User Profile Sync Test';
    
    try {
      // Get profile from both sources
      const localProfile = this.getFromLocalStorage('userProfile', null);
      const firebaseProfile = await this.getFirebaseUserProfile(userId);
      
      if (!localProfile && !firebaseProfile) {
        return {
          testName,
          passed: true,
          message: 'No profile data found (valid for new users)',
          timestamp: new Date().toISOString()
        };
      }
      
      if (localProfile && !firebaseProfile) {
        return {
          testName,
          passed: false,
          message: 'Profile exists locally but not in Firebase',
          timestamp: new Date().toISOString()
        };
      }
      
      if (!localProfile && firebaseProfile) {
        return {
          testName,
          passed: true,
          message: 'Profile exists in Firebase only (migration complete)',
          timestamp: new Date().toISOString()
        };
      }
      
      // Both exist - check for key differences
      const issues: string[] = [];
      if (localProfile.username !== firebaseProfile.username) {
        issues.push('Username mismatch');
      }
      
      return {
        testName,
        passed: issues.length === 0,
        message: issues.length === 0 ? 'Profile sync validated' : `Profile sync issues: ${issues.join(', ')}`,
        details: { issues },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Profile sync test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test opinions synchronization
   */
  private async testOpinionsSync(): Promise<TestResult> {
    const testName = 'Opinions Sync Test';
    
    try {
      const localOpinions = this.getFromLocalStorage('opinions', []);
      const firebaseOpinions = await realtimeDataService.getOpinions();
      
      // Check if Firebase has at least as many opinions as local
      if (firebaseOpinions.length < localOpinions.length) {
        return {
          testName,
          passed: false,
          message: `Missing opinions in Firebase: local=${localOpinions.length}, firebase=${firebaseOpinions.length}`,
          timestamp: new Date().toISOString()
        };
      }
      
      // Check if key opinions exist in both
      const missingOpinions = localOpinions.filter(opinion => 
        !firebaseOpinions.includes(opinion)
      );
      
      return {
        testName,
        passed: missingOpinions.length === 0,
        message: missingOpinions.length === 0 ? 
          'Opinions sync validated' : 
          `${missingOpinions.length} opinions missing in Firebase`,
        details: { missingOpinions: missingOpinions.slice(0, 5) },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Opinions sync test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test market data synchronization
   */
  private async testMarketDataSync(): Promise<TestResult> {
    const testName = 'Market Data Sync Test';
    
    try {
      const localMarketData = this.getFromLocalStorage('opinionMarketData', {});
      const firebaseMarketData = await realtimeDataService.getMarketData();
      
      const localKeys = Object.keys(localMarketData);
      const firebaseKeys = Object.keys(firebaseMarketData);
      
      // Check if Firebase has at least as many market data entries as local
      if (firebaseKeys.length < localKeys.length) {
        return {
          testName,
          passed: false,
          message: `Missing market data in Firebase: local=${localKeys.length}, firebase=${firebaseKeys.length}`,
          timestamp: new Date().toISOString()
        };
      }
      
      // Check for significant price differences
      const priceIssues: string[] = [];
      localKeys.forEach(opinion => {
        const localData = localMarketData[opinion];
        const firebaseData = firebaseMarketData[opinion];
        
        if (firebaseData && Math.abs(localData.currentPrice - firebaseData.currentPrice) > 0.01) {
          priceIssues.push(`${opinion}: local=${localData.currentPrice}, firebase=${firebaseData.currentPrice}`);
        }
      });
      
      return {
        testName,
        passed: priceIssues.length === 0,
        message: priceIssues.length === 0 ? 
          'Market data sync validated' : 
          `${priceIssues.length} price mismatches found`,
        details: { priceIssues: priceIssues.slice(0, 5) },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Market data sync test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test transactions synchronization
   */
  private async testTransactionsSync(userId: string): Promise<TestResult> {
    const testName = 'Transactions Sync Test';
    
    try {
      const localTransactions = this.getFromLocalStorage('transactions', []);
      const firebaseTransactions = await realtimeDataService.getUserTransactions(userId);
      
      // Check if Firebase has at least as many transactions as local
      if (firebaseTransactions.length < localTransactions.length) {
        return {
          testName,
          passed: false,
          message: `Missing transactions in Firebase: local=${localTransactions.length}, firebase=${firebaseTransactions.length}`,
          timestamp: new Date().toISOString()
        };
      }
      
      // Check for duplicate transaction IDs
      const firebaseIds = new Set(firebaseTransactions.map(t => t.id));
      const duplicateIds = localTransactions.filter(t => !firebaseIds.has(t.id));
      
      return {
        testName,
        passed: duplicateIds.length === 0,
        message: duplicateIds.length === 0 ? 
          'Transactions sync validated' : 
          `${duplicateIds.length} transactions not found in Firebase`,
        details: { duplicateIds: duplicateIds.slice(0, 5) },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Transactions sync test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test real-time updates
   */
  private async testRealtimeUpdates(userId: string): Promise<TestResult> {
    const testName = 'Real-time Updates Test';
    
    try {
      const testData = {
        test: 'realtime',
        timestamp: Date.now(),
        userId
      };
      
      // Update user profile
      await realtimeDataService.updateUserProfile(userId, testData);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if update was received
      const profile = await realtimeDataService.getUserProfile(userId);
      
      if (profile && profile.test === 'realtime') {
        return {
          testName,
          passed: true,
          message: 'Real-time updates working',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          testName,
          passed: false,
          message: 'Real-time updates not working',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Real-time updates test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test performance metrics
   */
  private async testPerformanceMetrics(): Promise<TestResult> {
    const testName = 'Performance Metrics Test';
    
    try {
      const metrics = await this.getPerformanceMetrics();
      
      // Check if latencies are within acceptable ranges
      const issues: string[] = [];
      
      if (metrics.firebaseLatency > 2000) {
        issues.push('Firebase latency too high');
      }
      
      if (metrics.localStorageLatency > 100) {
        issues.push('LocalStorage latency too high');
      }
      
      if (metrics.syncLatency > 3000) {
        issues.push('Sync latency too high');
      }
      
      return {
        testName,
        passed: issues.length === 0,
        message: issues.length === 0 ? 
          'Performance metrics acceptable' : 
          `Performance issues: ${issues.join(', ')}`,
        details: { metrics, issues },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Performance metrics test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test offline functionality
   */
  private async testOfflineFunctionality(): Promise<TestResult> {
    const testName = 'Offline Functionality Test';
    
    try {
      // This is a simplified test - in practice, you'd need to mock network conditions
      const config = realtimeDataService.getConfig();
      
      return {
        testName,
        passed: config.enableLocalStorageFallback,
        message: config.enableLocalStorageFallback ? 
          'Offline fallback enabled' : 
          'Offline fallback disabled',
        details: { config },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Offline functionality test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test data consistency
   */
  private async testDataConsistency(userId: string): Promise<TestResult> {
    const testName = 'Data Consistency Test';
    
    try {
      // Check if data is consistent across different access patterns
      const profile1 = await realtimeDataService.getUserProfile(userId);
      const profile2 = await this.getFirebaseUserProfile(userId);
      
      if (!profile1 || !profile2) {
        return {
          testName,
          passed: true,
          message: 'No profile data to test consistency',
          timestamp: new Date().toISOString()
        };
      }
      
      const issues: string[] = [];
      
      if (profile1.username !== profile2.username) {
        issues.push('Username inconsistency');
      }
      
      if (Math.abs(profile1.balance - profile2.balance) > 0.01) {
        issues.push('Balance inconsistency');
      }
      
      return {
        testName,
        passed: issues.length === 0,
        message: issues.length === 0 ? 
          'Data consistency validated' : 
          `Consistency issues: ${issues.join(', ')}`,
        details: { issues },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        message: `Data consistency test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create backup of current data
   */
  async createBackup(userId: string, description: string = 'Manual backup'): Promise<string> {
    console.log('💾 Creating data backup...');
    
    try {
      const backupId = `backup_${userId}_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Collect all data
      const data: { [key: string]: any } = {};
      const dataTypes: string[] = [];
      
      // LocalStorage data
      const localStorageKeys = [
        'userProfile',
        'opinions',
        'opinionMarketData',
        'transactions',
        'globalActivityFeed',
        'ownedOpinions',
        'advancedBets',
        'autonomousBots',
        'shortPositions',
        'botTransactions',
        'semanticEmbeddings'
      ];
      
      localStorageKeys.forEach(key => {
        const value = this.getFromLocalStorage(key, null);
        if (value !== null) {
          data[`localStorage_${key}`] = value;
          dataTypes.push(key);
        }
      });
      
      // Firebase data
      try {
        const firebaseProfile = await this.getFirebaseUserProfile(userId);
        if (firebaseProfile) {
          data.firebase_userProfile = firebaseProfile;
          dataTypes.push('firebase_userProfile');
        }
        
        const firebaseOpinions = await realtimeDataService.getOpinions();
        if (firebaseOpinions.length > 0) {
          data.firebase_opinions = firebaseOpinions;
          dataTypes.push('firebase_opinions');
        }
        
        const firebaseMarketData = await realtimeDataService.getMarketData();
        if (Object.keys(firebaseMarketData).length > 0) {
          data.firebase_marketData = firebaseMarketData;
          dataTypes.push('firebase_marketData');
        }
      } catch (error) {
        console.warn('Error backing up Firebase data:', error);
      }
      
      // Calculate size and checksum
      const dataString = JSON.stringify(data);
      const size = new Blob([dataString]).size;
      const checksum = await this.calculateChecksum(dataString);
      
      const backup: BackupData = {
        id: backupId,
        userId,
        timestamp,
        dataTypes,
        size,
        checksum,
        data
      };
      
      // Store backup
      this.backups.set(backupId, backup);
      
      // Also save to localStorage for persistence
      this.saveToLocalStorage(`backup_${backupId}`, backup);
      
      console.log(`✅ Backup created: ${backupId} (${this.formatBytes(size)})`);
      
      return backupId;
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    console.log('🔄 Restoring from backup...');
    
    try {
      let backup = this.backups.get(backupId);
      
      if (!backup) {
        // Try to load from localStorage
        backup = this.getFromLocalStorage(`backup_${backupId}`, null);
      }
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      // Restore localStorage data
      Object.entries(backup.data).forEach(([key, value]) => {
        if (key.startsWith('localStorage_')) {
          const realKey = key.replace('localStorage_', '');
          this.saveToLocalStorage(realKey, value);
        }
      });
      
      console.log(`✅ Restored from backup: ${backupId}`);
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * Get available backups
   */
  getBackups(): BackupData[] {
    return Array.from(this.backups.values());
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    this.backups.delete(backupId);
    
    // Also remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`backup_${backupId}`);
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<{
    firebaseLatency: number;
    localStorageLatency: number;
    syncLatency: number;
  }> {
    // Test Firebase latency
    const firebaseStart = Date.now();
    try {
      const testDoc = doc(db, 'test', 'performance');
      await getDoc(testDoc);
    } catch (error) {
      // Ignore errors for performance test
    }
    const firebaseLatency = Date.now() - firebaseStart;
    
    // Test localStorage latency
    const localStorageStart = Date.now();
    try {
      const testData = { test: 'performance', timestamp: Date.now() };
      localStorage.setItem('test_performance', JSON.stringify(testData));
      localStorage.getItem('test_performance');
      localStorage.removeItem('test_performance');
    } catch (error) {
      // Ignore errors for performance test
    }
    const localStorageLatency = Date.now() - localStorageStart;
    
    // Test sync latency (simplified)
    const syncStart = Date.now();
    try {
      await realtimeDataService.getOpinions();
    } catch (error) {
      // Ignore errors for performance test
    }
    const syncLatency = Date.now() - syncStart;
    
    return {
      firebaseLatency,
      localStorageLatency,
      syncLatency
    };
  }

  /**
   * Get Firebase user profile
   */
  private async getFirebaseUserProfile(userId: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error getting Firebase user profile:', error);
      return null;
    }
  }

  /**
   * Calculate checksum
   */
  private async calculateChecksum(data: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for environments without crypto.subtle
      return data.length.toString(16);
    }
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Safe localStorage operations
   */
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

  /**
   * Get test results
   */
  getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Clear test results
   */
  clearTestResults(): void {
    this.testResults = [];
  }
}

// Export singleton instance
export const migrationTestingService = MigrationTestingService.getInstance(); 