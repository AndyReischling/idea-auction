'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function UsernameTestPage() {
  const [username, setUsername] = useState('testuser123');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { checkUsernameAvailability } = useAuth();

  const testUsernameAvailability = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('🧪 Testing username availability...');
      const isAvailable = await checkUsernameAvailability(username);
      console.log('✅ Username availability result:', isAvailable);
      setResult(`${isAvailable ? '✅ Available' : '❌ Taken'}: Username "${username}" is ${isAvailable ? 'available' : 'already taken'}`);
    } catch (error: any) {
      console.error('❌ Username test failed:', error);
      setResult(`❌ Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const directFirestoreTest = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('🧪 Direct Firestore test...');
      const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      const exists = usernameDoc.exists();
      console.log('✅ Direct Firestore result - exists:', exists);
      setResult(`🔍 Direct Firestore check: Document ${exists ? 'EXISTS' : 'DOES NOT EXIST'} for username "${username}"`);
    } catch (error: any) {
      console.error('❌ Direct Firestore test failed:', error);
      setResult(`❌ Direct Firestore test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testMultipleUsernames = async () => {
    setLoading(true);
    setResult('');
    
    const testUsernames = ['user1', 'user2', 'testuser', 'admin', 'john', 'jane', 'newuser123'];
    const results: string[] = [];
    
    try {
      for (const testUsername of testUsernames) {
        console.log(`🧪 Testing username: ${testUsername}`);
        const isAvailable = await checkUsernameAvailability(testUsername);
        results.push(`${testUsername}: ${isAvailable ? 'Available ✅' : 'Taken ❌'}`);
      }
      
      setResult(`📊 Batch test results:\n${results.join('\n')}`);
    } catch (error: any) {
      console.error('❌ Batch test failed:', error);
      setResult(`❌ Batch test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Username Availability Test</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Username</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="Enter username to test"
              />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Tests</h2>
            <div className="space-y-4">
              <button
                onClick={testUsernameAvailability}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Username Availability (via Auth Context)'}
              </button>
              
              <button
                onClick={directFirestoreTest}
                disabled={loading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Direct Firestore Test'}
              </button>
              
              <button
                onClick={testMultipleUsernames}
                disabled={loading}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Multiple Usernames'}
              </button>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg whitespace-pre-line ${
              result.includes('✅') ? 'bg-green-100 text-green-800' : 
              result.includes('❌') ? 'bg-red-100 text-red-800' : 
              'bg-blue-100 text-blue-800'
            }`}>
              {result}
            </div>
          )}

          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Debug Info</h3>
            <p className="text-yellow-700 mb-2">Check your browser console for detailed logs during testing.</p>
            <p className="text-yellow-700">If all usernames show as "taken", there's likely a Firestore configuration or security rule issue.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 