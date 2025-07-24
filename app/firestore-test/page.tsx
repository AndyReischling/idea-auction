'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';

export default function FirestoreTestPage() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { testFirestoreConnection } = useAuth();

  const runTest = async () => {
    setIsLoading(true);
    setTestResult('');
    
    try {
      const result = await testFirestoreConnection();
      setTestResult(result ? 'Firestore connection successful!' : 'Firestore connection failed - check console for details');
    } catch (error) {
      setTestResult(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Firestore Connection Test</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Status</h2>
            <button
              onClick={runTest}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Testing...' : 'Test Firestore Connection'}
            </button>
            
            {testResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                testResult.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {testResult}
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Setup Instructions</h2>
            <div className="space-y-6">
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-800 mb-2">1. Create Firestore Database</h3>
                <ol className="text-gray-600 space-y-1">
                  <li>1. Go to <a href="https://console.firebase.google.com" className="text-blue-600 hover:underline" target="_blank">Firebase Console</a></li>
                  <li>2. Select your project: <code className="bg-gray-100 px-2 py-1 rounded">idea-auction</code></li>
                  <li>3. Click "Firestore Database" in the left sidebar</li>
                  <li>4. Click "Create database"</li>
                  <li>5. Choose "Start in test mode" for now</li>
                  <li>6. Select a location (any region is fine)</li>
                </ol>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-800 mb-2">2. Configure Security Rules</h3>
                <p className="text-gray-600 mb-2">Add these temporary rules for testing:</p>
                <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow read access for test documents
    match /test/{document} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-semibold text-gray-800 mb-2">3. Enable Authentication</h3>
                <ol className="text-gray-600 space-y-1">
                  <li>1. Go to "Authentication" in Firebase Console</li>
                  <li>2. Click "Sign-in method" tab</li>
                  <li>3. Enable "Email link (passwordless sign-in)"</li>
                  <li>4. Add your domain to authorized domains</li>
                </ol>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-gray-800 mb-2">4. Common Issues</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• <strong>400 Bad Request:</strong> Database not created or wrong project ID</li>
                  <li>• <strong>Permission Denied:</strong> Security rules too restrictive</li>
                  <li>• <strong>Network Error:</strong> Check your internet connection</li>
                  <li>• <strong>Invalid Project:</strong> Verify project ID in firebase.ts</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Check Console Output</h3>
            <p className="text-gray-600">
              Open your browser's developer console to see detailed error messages and test results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 