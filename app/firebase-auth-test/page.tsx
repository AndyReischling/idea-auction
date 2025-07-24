'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function FirebaseAuthTestPage() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('testpassword123');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testCreateAccount = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('🧪 Testing account creation...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Account created successfully:', userCredential.user.email);
      setResult(`✅ Test account created successfully for: ${userCredential.user.email}`);
    } catch (error: any) {
      console.error('❌ Account creation failed:', error);
      setResult(`❌ Account creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testSignIn = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('🧪 Testing sign in...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Sign in successful:', userCredential.user.email);
      setResult(`✅ Sign in successful for: ${userCredential.user.email}`);
    } catch (error: any) {
      console.error('❌ Sign in failed:', error);
      setResult(`❌ Sign in failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthConfig = () => {
    console.log('🔍 Checking Firebase Auth configuration...');
    console.log('Project ID:', auth.app.options.projectId);
    console.log('Auth domain:', auth.app.options.authDomain);
    console.log('API key (first 20 chars):', auth.app.options.apiKey?.substring(0, 20));
    console.log('Current user:', auth.currentUser?.email || 'None');
    
    setResult('Check console for Firebase configuration details');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Firebase Auth Test</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Credentials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Tests</h2>
            <div className="space-y-4">
              <button
                onClick={checkAuthConfig}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
              >
                Check Firebase Configuration
              </button>
              
              <button
                onClick={testCreateAccount}
                disabled={loading}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Test Create Account'}
              </button>
              
              <button
                onClick={testSignIn}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Test Sign In'}
              </button>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg ${
              result.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {result}
            </div>
          )}

          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Setup Required</h3>
            <p className="text-yellow-700 mb-2">Make sure you have enabled Email/Password authentication:</p>
            <ol className="text-yellow-700 space-y-1">
              <li>1. Go to <a href="https://console.firebase.google.com" className="underline" target="_blank">Firebase Console</a></li>
              <li>2. Select your project: <code className="bg-yellow-200 px-1 rounded">idea-auction</code></li>
              <li>3. Go to Authentication → Sign-in method</li>
              <li>4. Enable "Email/Password" provider</li>
              <li>5. Make sure Firestore Database is created</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 