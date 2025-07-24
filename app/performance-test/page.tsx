'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';

export default function PerformanceTestPage() {
  const [results, setResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { checkUsernameAvailability } = useAuth();

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const measureTime = async <T,>(operation: () => Promise<T>, description: string): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await operation();
      const endTime = Date.now();
      addResult(`✅ ${description}: ${endTime - startTime}ms`);
      return result;
    } catch (error) {
      const endTime = Date.now();
      addResult(`❌ ${description} FAILED: ${endTime - startTime}ms - ${error}`);
      throw error;
    }
  };

  const runPerformanceTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    const testEmail = `perftest${Date.now()}@example.com`;
    const testPassword = 'testpassword123';
    const testUsername = `perfuser${Date.now()}`;
    
    addResult('🚀 Starting performance tests...');
    addResult('⚠️ WARNING: This test will temporarily sign out the current user for testing purposes');
    
    // Store current user info before testing
    const currentUserEmail = auth.currentUser?.email;
    const wasLoggedIn = !!auth.currentUser;
    
    try {
      // Test 1: Username availability check
      await measureTime(
        () => checkUsernameAvailability(testUsername),
        'Username availability check'
      );

      // Test 2: Firebase Auth account creation
      const userCredential = await measureTime(
        () => createUserWithEmailAndPassword(auth, testEmail, testPassword),
        'Firebase Auth account creation'
      );

      // Test 3: Firestore document write
      const userProfile = {
        uid: userCredential.user.uid,
        email: testEmail,
        username: testUsername,
        balance: 10000,
        createdAt: new Date().toISOString()
      };

      await measureTime(
        () => setDoc(doc(db, 'users', userCredential.user.uid), userProfile),
        'Firestore profile document write'
      );

      // Test 4: Username reservation write
      await measureTime(
        () => setDoc(doc(db, 'usernames', testUsername.toLowerCase()), {
          uid: userCredential.user.uid,
          reserved: true,
          createdAt: new Date().toISOString()
        }),
        'Firestore username reservation write'
      );

      // Test 5: Sign out test user (not the main user)
      await measureTime(
        () => auth.signOut(),
        'Sign out test user'
      );

      // Test 6: Sign back in with test credentials
      await measureTime(
        () => signInWithEmailAndPassword(auth, testEmail, testPassword),
        'Sign in with test credentials'
      );

      // Test 7: Firestore document read
      await measureTime(
        () => getDoc(doc(db, 'users', userCredential.user.uid)),
        'Firestore profile document read'
      );

      // Cleanup: Delete test data
      await measureTime(async () => {
        await deleteDoc(doc(db, 'users', userCredential.user.uid));
        await deleteDoc(doc(db, 'usernames', testUsername.toLowerCase()));
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      }, 'Cleanup test data');

      addResult('✅ All performance tests completed successfully!');
      
      // Important note about authentication state
      if (wasLoggedIn) {
        addResult('⚠️ NOTE: Your original session was interrupted by this test');
        addResult('🔄 Please sign in again to restore your session');
        addResult(`📧 You were previously logged in as: ${currentUserEmail}`);
      }
      
    } catch (error) {
      addResult(`❌ Performance test failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const handleRunTests = () => {
    if (auth.currentUser) {
      setShowConfirmation(true);
    } else {
      runPerformanceTests();
    }
  };

  const confirmRunTests = () => {
    setShowConfirmation(false);
    runPerformanceTests();
  };

  const cancelRunTests = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Performance Tests</h1>
          
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              This page measures the performance of various Firebase operations to help diagnose slow loading times.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleRunTests}
                disabled={isRunning}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isRunning ? 'Running Tests...' : 'Run Performance Tests'}
              </button>
              
              <button
                onClick={clearResults}
                disabled={isRunning}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 ml-4"
              >
                Clear Results
              </button>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Performance Test Warning</h3>
                <p className="text-gray-600 mb-4">
                  Running this test will temporarily sign you out of your current session to test authentication performance.
                </p>
                <p className="text-gray-600 mb-6">
                  You are currently logged in as: <strong>{auth.currentUser?.email}</strong>
                </p>
                <p className="text-sm text-yellow-600 mb-6">
                  After the test completes, you will need to sign in again to restore your session.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={confirmRunTests}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                  >
                    Continue (Sign Me Out)
                  </button>
                  <button
                    onClick={cancelRunTests}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="bg-gray-100 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Test Results</h2>
              <div className="space-y-2 font-mono text-sm">
                {results.map((result, index) => (
                  <div key={index} className={
                    result.includes('✅') ? 'text-green-700' :
                    result.includes('❌') ? 'text-red-700' :
                    'text-gray-700'
                  }>
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Performance Guidelines</h3>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>Username check:</strong> Should be &lt; 500ms</li>
              <li>• <strong>Auth operations:</strong> Should be &lt; 2000ms</li>
              <li>• <strong>Firestore writes:</strong> Should be &lt; 1000ms each</li>
              <li>• <strong>Firestore reads:</strong> Should be &lt; 500ms</li>
              <li>• <strong>Total sign up:</strong> Should be &lt; 5000ms</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 