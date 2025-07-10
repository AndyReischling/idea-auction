'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { localStorageToFirebaseService } from '../lib/localStorage-to-firebase';

interface SyncProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

interface SyncResult {
  success: boolean;
  dataType: string;
  itemsProcessed: number;
  errors: string[];
  collectionUsed: string;
}

export default function LocalStorageSync() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStorageStats, setLocalStorageStats] = useState<{
    totalItems: number;
    totalSize: string;
    itemTypes: string[];
  } | null>(null);

  // Get localStorage stats on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      getLocalStorageStats();
    }
  }, []);

  const getLocalStorageStats = () => {
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

    setLocalStorageStats({
      totalItems: items.length,
      totalSize: formatBytes(totalSize),
      itemTypes: items
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSyncAll = async () => {
    if (!user) {
      setError('You must be logged in to sync data');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(null);
    setResults(null);

    try {
      const syncResults = await localStorageToFirebaseService.pushAllLocalStorageToFirebase(
        (progressUpdate) => {
          setProgress(progressUpdate);
        },
        (finalResults) => {
          setResults(finalResults);
        }
      );

      setResults(syncResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sync');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSpecific = async (keys: string[]) => {
    if (!user) {
      setError('You must be logged in to sync data');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const syncResults = await localStorageToFirebaseService.syncSpecificData(keys);
      setResults(syncResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sync');
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return (progress.completed / progress.total) * 100;
  };

  const getSuccessCount = () => {
    if (!results) return 0;
    return results.filter(r => r.success).length;
  };

  const getFailureCount = () => {
    if (!results) return 0;
    return results.filter(r => !r.success).length;
  };

  const getTotalItemsProcessed = () => {
    if (!results) return 0;
    return results.reduce((sum, r) => sum + r.itemsProcessed, 0);
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">📦 localStorage to Firebase Sync</h2>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">You need to be logged in to sync your localStorage data to Firebase.</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled>
            Please Log In First
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">📦 localStorage to Firebase Sync</h2>
      
      {/* localStorage Stats */}
      {localStorageStats && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Current localStorage Data</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-xl font-bold">{localStorageStats.totalItems}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-xl font-bold">{localStorageStats.totalSize}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Types</p>
              <p className="text-xl font-bold">{localStorageStats.itemTypes.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Actions */}
      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleSyncAll}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Syncing...
              </>
            ) : (
              <>🚀 Sync All Data to Firebase</>
            )}
          </button>
          
          <button
            onClick={() => getLocalStorageStats()}
            disabled={isLoading}
            className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            🔄 Refresh Stats
          </button>
        </div>

        <p className="text-sm text-gray-600">
          This will sync all your localStorage data to Firebase, organized by data type into appropriate collections.
        </p>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Sync Progress</span>
            <span className="text-sm text-gray-600">{progress.completed}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">{progress.current}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">❌ Error</p>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">📊 Sync Results</h3>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Successful</p>
              <p className="text-2xl font-bold text-green-700">{getSuccessCount()}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-700">{getFailureCount()}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-700">{getTotalItemsProcessed()}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Collections</p>
              <p className="text-2xl font-bold text-gray-700">{new Set(results.map(r => r.collectionUsed)).size}</p>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div key={index} className={`p-3 mb-2 rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{result.success ? '✅' : '❌'} {result.dataType}</p>
                    <p className="text-sm text-gray-600">
                      {result.itemsProcessed} items → {result.collectionUsed}
                    </p>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="text-sm text-red-600">
                      {result.errors.map((error, i) => (
                        <p key={i}>{error}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Types Available */}
      {localStorageStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Available Data Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {localStorageStats.itemTypes.map((type, index) => (
              <button
                key={index}
                onClick={() => handleSyncSpecific([type])}
                disabled={isLoading}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Click on individual data types to sync them separately.
          </p>
        </div>
      )}
    </div>
  );
} 