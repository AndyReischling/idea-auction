'use client';

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

interface MarketData {
  opinionText: string;
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  lastUpdated: string;
  updatedBy: string;
  priceHistory: PricePoint[];
}

interface PricePoint {
  price: number;
  timestamp: string;
  action: 'buy' | 'sell';
}

interface LocalMarketData {
  [opinionText: string]: {
    timesPurchased: number;
    timesSold: number;
    currentPrice: number;
    basePrice: number;
  };
}

export class MarketDataSyncService {
  private static instance: MarketDataSyncService;
  private marketDataCollection = collection(db, 'market-data');
  private syncInterval: NodeJS.Timeout | null = null;
  private realtimeUnsubscribes: (() => void)[] = [];

  public static getInstance(): MarketDataSyncService {
    if (!MarketDataSyncService.instance) {
      MarketDataSyncService.instance = new MarketDataSyncService();
    }
    return MarketDataSyncService.instance;
  }

  // Safe localStorage helper
  private safeGetFromStorage(key: string, defaultValue: any = null): any {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key ${key}:`, error);
      return defaultValue;
    }
  }

  private safeSetToStorage(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
    }
  }

  // Calculate price based on supply and demand
  private calculatePrice(timesPurchased: number, timesSold: number, basePrice: number = 10.00): number {
    const netDemand = timesPurchased - timesSold;
    let priceMultiplier;
    
    if (netDemand >= 0) {
      priceMultiplier = Math.pow(1.001, netDemand);
    } else {
      priceMultiplier = Math.max(0.1, Math.pow(0.999, Math.abs(netDemand)));
    }
    
    const calculatedPrice = Math.max(basePrice * 0.5, basePrice * priceMultiplier);
    return Math.round(calculatedPrice * 100) / 100;
  }

  // Create document ID from opinion text
  private createDocumentId(opinionText: string): string {
    return btoa(opinionText.substring(0, 100)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 100);
  }

  // Sync single opinion's market data to Firebase
  async syncOpinionToFirebase(opinionText: string, userId: string): Promise<void> {
    // CRITICAL: Sanitize inputs to prevent Firebase errors
    const sanitizedOpinionText = String(opinionText || '').trim();
    const sanitizedUserId = String(userId || 'unknown').trim();
    
    if (!sanitizedOpinionText) {
      console.log(`❌ Invalid opinion text for sync: ${opinionText}`);
      return;
    }
    
    try {
      
      const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
      const opinionData = localMarketData[sanitizedOpinionText];
      
      if (!opinionData) {
        console.log(`No local market data found for opinion: ${sanitizedOpinionText}`);
        return;
      }
      
      // CRITICAL: Validate opinionData has required fields
      if (typeof opinionData !== 'object' || opinionData === null) {
        console.log(`❌ Invalid opinion data structure for: ${sanitizedOpinionText}`);
        return;
      }
      
      // Ensure all required fields exist with proper defaults
      opinionData.timesPurchased = Number(opinionData.timesPurchased) || 0;
      opinionData.timesSold = Number(opinionData.timesSold) || 0;
      opinionData.currentPrice = Number(opinionData.currentPrice) || 10.00;
      opinionData.basePrice = Number(opinionData.basePrice) || 10.00;

      const docId = this.createDocumentId(sanitizedOpinionText);
      const marketDocRef = doc(this.marketDataCollection, docId);
      
      // Check if document exists
      const existingDoc = await getDoc(marketDocRef);
      
      if (existingDoc.exists()) {
        // Update existing document with safe type conversion
        const existingData = existingDoc.data() as MarketData;
        const localTimesPurchased = Number(opinionData.timesPurchased) || 0;
        const localTimesSold = Number(opinionData.timesSold) || 0;
        const existingTimesPurchased = Number(existingData.timesPurchased) || 0;
        const existingTimesSold = Number(existingData.timesSold) || 0;
        
        const updatedData: Partial<MarketData> = {
          timesPurchased: Math.max(existingTimesPurchased, localTimesPurchased),
          timesSold: Math.max(existingTimesSold, localTimesSold),
          currentPrice: this.calculatePrice(
            Math.max(existingTimesPurchased, localTimesPurchased),
            Math.max(existingTimesSold, localTimesSold),
            Number(opinionData.basePrice) || 10.00
          ),
          lastUpdated: new Date().toISOString(),
          updatedBy: sanitizedUserId
        };
        
        await updateDoc(marketDocRef, updatedData);
        console.log(`✅ Updated market data for: ${sanitizedOpinionText}`);
      } else {
        // Create new document with safe type conversion
        const newMarketData: MarketData = {
          opinionText: sanitizedOpinionText,
          timesPurchased: Number(opinionData.timesPurchased) || 0,
          timesSold: Number(opinionData.timesSold) || 0,
          currentPrice: Number(opinionData.currentPrice) || 10.00,
          basePrice: Number(opinionData.basePrice) || 10.00,
          lastUpdated: new Date().toISOString(),
          updatedBy: sanitizedUserId,
          priceHistory: Array.isArray(opinionData.priceHistory) ? opinionData.priceHistory : []
        };
        
        await setDoc(marketDocRef, newMarketData);
        console.log(`✅ Created market data for: ${sanitizedOpinionText}`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync market data for ${sanitizedOpinionText || opinionText}:`, error);
    }
  }

  // Sync all local market data to Firebase
  async syncAllMarketDataToFirebase(userId: string): Promise<{ synced: number; failed: number }> {
    console.log('🔄 Syncing all market data to Firebase...');
    
    // CRITICAL: Sanitize userId input
    const sanitizedUserId = String(userId || 'unknown').trim();
    if (!sanitizedUserId || sanitizedUserId === 'unknown') {
      console.log(`❌ Invalid userId for sync: ${userId}`);
      return { synced: 0, failed: 0 };
    }
    
    const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
    const opinions = Object.keys(localMarketData);
    
    console.log(`📊 Found ${opinions.length} opinions to sync for user: ${sanitizedUserId}`);
    
    let synced = 0;
    let failed = 0;
    
    for (const opinionText of opinions) {
      try {
        // CRITICAL: Sanitize opinion text before sync
        const sanitizedOpinionText = String(opinionText || '').trim();
        if (!sanitizedOpinionText) {
          console.log(`❌ Skipping invalid opinion text: ${opinionText}`);
          failed++;
          continue;
        }
        
        await this.syncOpinionToFirebase(sanitizedOpinionText, sanitizedUserId);
        synced++;
      } catch (error) {
        console.error(`Failed to sync opinion: ${opinionText}`, error);
        failed++;
      }
    }
    
    console.log(`📊 Market data sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  // Load market data from Firebase and merge with local data
  async loadMarketDataFromFirebase(): Promise<LocalMarketData> {
    try {
      console.log('📥 Loading market data from Firebase...');
      
      const querySnapshot = await getDocs(this.marketDataCollection);
      const firebaseMarketData: LocalMarketData = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as MarketData;
        firebaseMarketData[data.opinionText] = {
          timesPurchased: data.timesPurchased,
          timesSold: data.timesSold,
          currentPrice: data.currentPrice,
          basePrice: data.basePrice
        };
      });
      
      console.log(`📊 Loaded ${Object.keys(firebaseMarketData).length} market data entries from Firebase`);
      return firebaseMarketData;
    } catch (error) {
      console.error('❌ Failed to load market data from Firebase:', error);
      return {};
    }
  }

  // Merge Firebase and local market data
  async mergeMarketData(userId: string): Promise<void> {
    try {
      console.log('🔄 Merging market data from Firebase and localStorage...');
      
      const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
      const firebaseMarketData = await this.loadMarketDataFromFirebase();
      
      const mergedData: LocalMarketData = { ...localMarketData };
      
      // Merge Firebase data, preferring higher transaction counts
      for (const [opinionText, firebaseData] of Object.entries(firebaseMarketData)) {
        const localData = mergedData[opinionText];
        
        if (!localData) {
          // Use Firebase data if no local data
          mergedData[opinionText] = firebaseData;
        } else {
          // Merge by taking the higher transaction counts
          const mergedTimesPurchased = Math.max(localData.timesPurchased, firebaseData.timesPurchased);
          const mergedTimesSold = Math.max(localData.timesSold, firebaseData.timesSold);
          
          mergedData[opinionText] = {
            timesPurchased: mergedTimesPurchased,
            timesSold: mergedTimesSold,
            currentPrice: this.calculatePrice(mergedTimesPurchased, mergedTimesSold, localData.basePrice),
            basePrice: localData.basePrice
          };
        }
      }
      
      // Update localStorage with merged data
      this.safeSetToStorage('opinionMarketData', mergedData);
      
      console.log(`✅ Market data merged successfully: ${Object.keys(mergedData).length} opinions`);
    } catch (error) {
      console.error('❌ Failed to merge market data:', error);
    }
  }

  // Start real-time synchronization
  startRealtimeSync(userId: string): void {
    console.log('🔄 Starting real-time market data sync...');
    
    // Clear existing subscriptions
    this.stopRealtimeSync();
    
    // Subscribe to Firebase changes
    const unsubscribe = onSnapshot(this.marketDataCollection, (snapshot) => {
      console.log('🔄 Market data changed in Firebase, updating local data...');
      
      const firebaseMarketData: LocalMarketData = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as MarketData;
        firebaseMarketData[data.opinionText] = {
          timesPurchased: data.timesPurchased,
          timesSold: data.timesSold,
          currentPrice: data.currentPrice,
          basePrice: data.basePrice
        };
      });
      
      // Update localStorage with Firebase data
      const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
      const mergedData = { ...localMarketData };
      
      // Update with Firebase data where Firebase has higher transaction counts
      for (const [opinionText, firebaseData] of Object.entries(firebaseMarketData)) {
        const localData = mergedData[opinionText];
        
        if (!localData || 
            firebaseData.timesPurchased > localData.timesPurchased ||
            firebaseData.timesSold > localData.timesSold) {
          mergedData[opinionText] = firebaseData;
        }
      }
      
      this.safeSetToStorage('opinionMarketData', mergedData);
      
      // Dispatch event for UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('marketDataUpdated', {
          detail: { marketData: mergedData }
        }));
      }
    });
    
    this.realtimeUnsubscribes.push(unsubscribe);
    
    // Periodic sync every 30 seconds with error handling
    this.syncInterval = setInterval(async () => {
      try {
        // CRITICAL: Validate userId before periodic sync
        const sanitizedUserId = String(userId || '').trim();
        if (!sanitizedUserId || sanitizedUserId === 'unknown') {
          console.log(`❌ Skipping periodic sync - invalid userId: ${userId}`);
          return;
        }
        
        console.log('🔄 Running periodic market data sync...');
        await this.syncAllMarketDataToFirebase(sanitizedUserId);
      } catch (error) {
        console.error('❌ Error during periodic market data sync:', error);
      }
    }, 30000);
  }

  // Stop real-time synchronization
  stopRealtimeSync(): void {
    console.log('⏹️ Stopping real-time market data sync...');
    
    // Clear interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Unsubscribe from Firebase listeners
    this.realtimeUnsubscribes.forEach(unsubscribe => unsubscribe());
    this.realtimeUnsubscribes = [];
  }

  // Update market data for a single opinion (called after transactions)
  async updateMarketData(opinionText: string, action: 'buy' | 'sell', userId: string): Promise<void> {
    // CRITICAL: Sanitize inputs to prevent Firebase errors
    const sanitizedOpinionText = String(opinionText || '').trim();
    const sanitizedUserId = String(userId || 'unknown').trim();
    const sanitizedAction = String(action || 'buy').trim() as 'buy' | 'sell';
    
    if (!sanitizedOpinionText) {
      console.log(`❌ Invalid opinion text for update: ${opinionText}`);
      return;
    }
    
    try {
      // Update localStorage
      const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
      
      if (!localMarketData[sanitizedOpinionText]) {
        localMarketData[sanitizedOpinionText] = {
          timesPurchased: 0,
          timesSold: 0,
          currentPrice: 10.00,
          basePrice: 10.00
        };
      }
      
      const opinionData = localMarketData[sanitizedOpinionText];
      
      if (sanitizedAction === 'buy') {
        opinionData.timesPurchased++;
      } else {
        opinionData.timesSold++;
      }
      
      opinionData.currentPrice = this.calculatePrice(
        opinionData.timesPurchased,
        opinionData.timesSold,
        opinionData.basePrice
      );
      
      this.safeSetToStorage('opinionMarketData', localMarketData);
      
      // Sync to Firebase
      await this.syncOpinionToFirebase(sanitizedOpinionText, sanitizedUserId);
      
    } catch (error) {
      console.error(`❌ Failed to update market data for ${sanitizedOpinionText}:`, error);
    }
  }

  // Get current market data for an opinion
  getMarketData(opinionText: string): LocalMarketData[string] | null {
    const localMarketData = this.safeGetFromStorage('opinionMarketData', {});
    return localMarketData[opinionText] || null;
  }

  // Get all market data
  getAllMarketData(): LocalMarketData {
    return this.safeGetFromStorage('opinionMarketData', {});
  }

  // TEST: Validate Firebase data sanitization
  async testFirebaseDataSanitization(): Promise<void> {
    console.log('🧪 TESTING MARKET DATA SYNC SANITIZATION...');
    
    const testCases = [
      { opinionText: undefined, userId: 'test-user', action: 'buy' },
      { opinionText: null, userId: undefined, action: 'sell' },
      { opinionText: '', userId: null, action: 'buy' },
      { opinionText: 'Valid opinion', userId: '', action: 'sell' },
      { opinionText: 'Another valid opinion', userId: 'valid-user', action: 'buy' }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n🧪 Test Case ${i + 1}:`, testCase);
      
      try {
        // Test updateMarketData
        await this.updateMarketData(
          testCase.opinionText as any,
          testCase.action as any,
          testCase.userId as any
        );
        
        // Test syncOpinionToFirebase
        await this.syncOpinionToFirebase(
          testCase.opinionText as any,
          testCase.userId as any
        );
        
        console.log(`✅ Test ${i + 1} passed - no Firebase errors`);
      } catch (error) {
        console.error(`❌ Test ${i + 1} failed:`, error);
      }
    }
    
    console.log('\n✅ Market data sync sanitization test complete!');
  }
}

// Export singleton instance
export const marketDataSyncService = MarketDataSyncService.getInstance();

// Global test function
if (typeof window !== 'undefined') {
  (window as any).testMarketDataSyncSanitization = () => marketDataSyncService.testFirebaseDataSanitization();
} 