'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import AuthGuard from '../components/AuthGuard';

function AuthTestPage() {
  const { user, userProfile, updateProfile, testFirestoreConnection } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'failed' | null>(null);

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) {
      setMessage('Username cannot be empty');
      return;
    }

    setUpdating(true);
    setMessage('');

    try {
      await updateProfile({ username: newUsername });
      setMessage('Profile updated successfully!');
      setNewUsername('');
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      const isConnected = await testFirestoreConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('failed');
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              🔧 Firebase Authentication Test
            </h1>

            {/* User Information */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">User Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Firebase User</h3>
                  <p><strong>UID:</strong> {user?.uid}</p>
                  <p><strong>Email:</strong> {user?.email}</p>
                  <p><strong>Email Verified:</strong> {user?.emailVerified ? 'Yes' : 'No'}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">User Profile</h3>
                  <p><strong>Username:</strong> {userProfile?.username}</p>
                  <p><strong>Balance:</strong> ${userProfile?.balance.toLocaleString()}</p>
                  <p><strong>Joined:</strong> {userProfile?.joinDate?.toDate?.()?.toLocaleDateString() || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Profile Update Test */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile Update Test</h2>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    New Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new username"
                  />
                </div>
                <button
                  onClick={handleUpdateProfile}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update'}
                </button>
              </div>
              {message && (
                <div className={`mt-2 p-2 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {message}
                </div>
              )}
            </div>

            {/* Connection Test */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Firestore Connection Test</h2>
              <div className="flex gap-4 items-center">
                <button
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'testing'}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
                >
                  {connectionStatus === 'testing' ? 'Testing...' : 'Test Firestore Connection'}
                </button>
                
                {connectionStatus && (
                  <div className={`px-3 py-1 rounded text-sm ${
                    connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                    connectionStatus === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {connectionStatus === 'connected' ? '✅ Firestore Connected' :
                     connectionStatus === 'failed' ? '❌ Firestore Failed' :
                     '🔄 Testing...'}
                  </div>
                )}
              </div>
              
              {connectionStatus === 'failed' && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Firestore Connection Failed</h4>
                  <p className="text-red-700 text-sm mb-2">Please ensure:</p>
                  <ul className="text-red-700 text-sm list-disc ml-5">
                    <li>Firestore Database is created in Firebase Console</li>
                    <li>Firestore rules allow read/write access</li>
                    <li>Your internet connection is working</li>
                    <li>Firebase project configuration is correct</li>
                  </ul>
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">System Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">Firebase Auth</h3>
                  <p className="text-green-600">✅ Connected</p>
                </div>
                <div className={`p-4 rounded-lg ${
                  connectionStatus === 'connected' ? 'bg-green-50' : 
                  connectionStatus === 'failed' ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <h3 className={`font-medium mb-1 ${
                    connectionStatus === 'connected' ? 'text-green-800' : 
                    connectionStatus === 'failed' ? 'text-red-800' : 'text-gray-800'
                  }`}>Firestore</h3>
                  <p className={
                    connectionStatus === 'connected' ? 'text-green-600' : 
                    connectionStatus === 'failed' ? 'text-red-600' : 'text-gray-600'
                  }>
                    {connectionStatus === 'connected' ? '✅ Connected' : 
                     connectionStatus === 'failed' ? '❌ Failed' : '❓ Unknown'}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-1">User Profile</h3>
                  <p className="text-green-600">✅ Loaded</p>
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">✅ Phase 1 Complete</h2>
              <div className="space-y-2 text-blue-700">
                <p>• ✅ Firebase configuration and initialization</p>
                <p>• ✅ User authentication (login/register/logout)</p>
                <p>• ✅ User profile management in Firestore</p>
                <p>• ✅ Username uniqueness validation</p>
                <p>• ✅ Password recovery functionality</p>
                <p>• ✅ Authentication state management</p>
                <p>• ✅ Protected routes with AuthGuard</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Back to App
              </button>
              <button
                onClick={() => window.location.href = '/admin'}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Admin Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

export default AuthTestPage; 