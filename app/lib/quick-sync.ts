'use client';

import { localStorageToFirebaseService } from './localStorage-to-firebase';

/**
 * Quick sync function to push all localStorage data to Firebase
 * This is a simple wrapper around the full service for easy use
 */
export const syncLocalStorageToFirebase = async (options?: {
  onProgress?: (progress: { completed: number; total: number; current: string }) => void;
  onComplete?: (results: any[]) => void;
}) => {
  try {
    console.log('🚀 Starting quick localStorage sync...');
    
    const results = await localStorageToFirebaseService.pushAllLocalStorageToFirebase(
      options?.onProgress,
      options?.onComplete
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    
    console.log(`✅ Quick sync completed: ${successful} successful, ${failed} failed, ${totalItems} total items`);
    
    return {
      success: failed === 0,
      results,
      summary: {
        successful,
        failed,
        totalItems,
        collections: new Set(results.map(r => r.collectionUsed)).size
      }
    };
  } catch (error) {
    console.error('❌ Quick sync failed:', error);
    throw error;
  }
};

/**
 * Quick sync function for specific localStorage keys
 */
export const syncSpecificData = async (keys: string[]) => {
  try {
    console.log(`🚀 Starting quick sync for keys: ${keys.join(', ')}`);
    
    const results = await localStorageToFirebaseService.syncSpecificData(keys);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    
    console.log(`✅ Quick sync completed: ${successful} successful, ${failed} failed, ${totalItems} total items`);
    
    return {
      success: failed === 0,
      results,
      summary: {
        successful,
        failed,
        totalItems,
        collections: new Set(results.map(r => r.collectionUsed)).size
      }
    };
  } catch (error) {
    console.error('❌ Quick sync failed:', error);
    throw error;
  }
};

/**
 * Get localStorage stats without syncing
 */
export const getLocalStorageStats = () => {
  if (typeof window === 'undefined') {
    return { totalItems: 0, totalSize: 0, itemTypes: [] };
  }
  
  let totalSize = 0;
  const items: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += new Blob([value]).size;
        items.push(key);
      }
    }
  }
  
  return {
    totalItems: items.length,
    totalSize,
    itemTypes: items
  };
};

/**
 * Simple console-based sync - just call this function from browser console
 */
export const quickSyncNow = async () => {
  console.log('🚀 Starting immediate localStorage sync...');
  
  try {
    const result = await syncLocalStorageToFirebase({
      onProgress: (progress) => {
        console.log(`📊 Progress: ${progress.completed}/${progress.total} - ${progress.current}`);
      }
    });
    
    if (result.success) {
      console.log('🎉 Sync completed successfully!');
      console.log('📊 Summary:', result.summary);
    } else {
      console.log('⚠️ Sync completed with some errors');
      console.log('📊 Summary:', result.summary);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
};

// For easy browser console access
if (typeof window !== 'undefined') {
  (window as any).quickSyncNow = quickSyncNow;
  (window as any).syncLocalStorageToFirebase = syncLocalStorageToFirebase;
  (window as any).getLocalStorageStats = getLocalStorageStats;
} 