'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { dataReconciliationService } from '../lib/data-reconciliation';
import { marketDataSyncService } from '../lib/market-data-sync';

export default function ReconciliationTestPage() {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testReconciliation = async () => {
    if (!user?.uid) {
      addResult('❌ User not authenticated');
      return;
    }

    setLoading(true);
    addResult('🔄 Starting complete reconciliation test...');

    try {
      const results = await dataReconciliationService.completeReconciliation(user.uid);
      
      addResult('✅ Reconciliation completed successfully!');
      addResult(`📊 Activities: ${results.activities.migrated} migrated, ${results.activities.skipped} skipped`);
      addResult(`👤 Profile: ${results.profile.updated ? 'Updated' : 'No changes'}`);
      addResult(`💰 Market data: ${results.marketData.migrated} opinions migrated`);
      
      const totalConflicts = results.activities.conflicts.length + 
                           results.profile.conflicts.length + 
                           results.marketData.conflicts.length;
      addResult(`⚠️ Total conflicts: ${totalConflicts}`);
      
      if (totalConflicts > 0) {
        addResult('🔍 Conflicts found:');
        [...results.activities.conflicts, ...results.profile.conflicts, ...results.marketData.conflicts]
          .forEach(conflict => addResult(`  - ${conflict}`));
      }
      
    } catch (error) {
      addResult(`❌ Reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testReconciliationStatus = async () => {
    if (!user?.uid) {
      addResult('❌ User not authenticated');
      return;
    }

    setLoading(true);
    addResult('🔄 Checking reconciliation status...');

    try {
      const status = await dataReconciliationService.getReconciliationSummary(user.uid);
      
      if (status) {
        addResult('✅ Status retrieved successfully!');
        addResult(`📅 Last reconciliation: ${status.lastReconciliation || 'Never'}`);
        addResult(`🔄 Needs reconciliation: ${status.needsReconciliation ? 'Yes' : 'No'}`);
        addResult(`⚠️ Total conflicts: ${status.totalConflicts}`);
        addResult(`📊 Data types tracked: ${status.dataTypes.length}`);
        
        status.dataTypes.forEach(dataType => {
          addResult(`  - ${dataType.dataType}: ${dataType.status} (${dataType.migratedCount}/${dataType.itemCount})`);
        });
      } else {
        addResult('❌ No status found');
      }
      
    } catch (error) {
      addResult(`❌ Status check failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testMarketDataSync = async () => {
    if (!user?.uid) {
      addResult('❌ User not authenticated');
      return;
    }

    setLoading(true);
    addResult('🔄 Testing market data sync...');

    try {
      // Test sync to Firebase
      const syncResults = await marketDataSyncService.syncAllMarketDataToFirebase(user.uid);
      addResult(`📤 Sync to Firebase: ${syncResults.synced} synced, ${syncResults.failed} failed`);
      
      // Test merge from Firebase
      await marketDataSyncService.mergeMarketData(user.uid);
      addResult('📥 Market data merged from Firebase');
      
      // Test individual market data
      const allMarketData = marketDataSyncService.getAllMarketData();
      addResult(`📊 Total market data entries: ${Object.keys(allMarketData).length}`);
      
      // Show sample data
      const sampleOpinions = Object.keys(allMarketData).slice(0, 3);
      sampleOpinions.forEach(opinion => {
        const data = allMarketData[opinion];
        addResult(`  - "${opinion.substring(0, 50)}...": $${data.currentPrice} (${data.timesPurchased}/${data.timesSold})`);
      });
      
    } catch (error) {
      addResult(`❌ Market data sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testLocalStorageData = () => {
    addResult('🔄 Checking localStorage data...');
    
    const keys = ['userProfile', 'opinions', 'transactions', 'botTransactions', 'opinionMarketData', 'globalActivityFeed'];
    
    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const length = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
          addResult(`✅ ${key}: ${length} items`);
        } else {
          addResult(`❌ ${key}: Not found`);
        }
      } catch (error) {
        addResult(`❌ ${key}: Error parsing - ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };

  const simulateActivity = () => {
    addResult('🔄 Simulating activity...');
    
    // Add a test transaction to localStorage
    const testTransaction = {
      id: `test_${Date.now()}`,
      type: 'buy',
      username: user?.email?.split('@')[0] || 'TestUser',
      opinionText: 'Test opinion for reconciliation',
      amount: 100,
      price: 10.50,
      quantity: 1,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString()
    };
    
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    transactions.push(testTransaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    
    addResult('✅ Test transaction added to localStorage');
    
    // Add test market data
    const marketData = JSON.parse(localStorage.getItem('opinionMarketData') || '{}');
    marketData['Test opinion for reconciliation'] = {
      timesPurchased: 1,
      timesSold: 0,
      currentPrice: 10.50,
      basePrice: 10.00
    };
    localStorage.setItem('opinionMarketData', JSON.stringify(marketData));
    
    addResult('✅ Test market data added to localStorage');
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Reconciliation Test</h1>
        <p className="text-red-600">Please sign in to test reconciliation functions.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Reconciliation Test</h1>
      
      <div className="mb-4">
        <p className="text-gray-600">User: {user.email}</p>
        <p className="text-gray-600">User ID: {user.uid}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={testReconciliation}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Complete Reconciliation'}
        </button>
        
        <button
          onClick={testReconciliationStatus}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Reconciliation Status'}
        </button>
        
        <button
          onClick={testMarketDataSync}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Market Data Sync'}
        </button>
        
        <button
          onClick={testLocalStorageData}
          disabled={loading}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          Check localStorage Data
        </button>
        
        <button
          onClick={simulateActivity}
          disabled={loading}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        >
          Simulate Test Activity
        </button>
        
        <button
          onClick={clearResults}
          disabled={loading}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Clear Results
        </button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Results</h2>
        <div className="max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500">No test results yet. Click a button above to run tests.</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1 font-mono text-sm">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-semibold mb-2">Testing Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>First, click "Simulate Test Activity" to add some test data to localStorage</li>
          <li>Then click "Check localStorage Data" to verify the data was added</li>
          <li>Run "Test Complete Reconciliation" to sync data to Firebase</li>
          <li>Check "Reconciliation Status" to see the migration results</li>
          <li>Test "Market Data Sync" to verify real-time synchronization</li>
        </ol>
      </div>
    </div>
  );
} 