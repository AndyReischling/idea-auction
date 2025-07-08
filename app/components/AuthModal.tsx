'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register, resetPassword, checkUsernameAvailability } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        if (!username.trim()) {
          setError('Username is required');
          return;
        }
        
        if (username.length < 3) {
          setError('Username must be at least 3 characters long');
          return;
        }
        
        if (password.length < 6) {
          setError('Password must be at least 6 characters long');
          return;
        }
        
        await register(email, password, username);
        setSuccess('Account created! Please check your email to verify your account.');
        
        // Switch to login mode after successful registration
        setTimeout(() => {
          setMode('login');
          setSuccess('');
        }, 3000);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccess('Password reset email sent! Check your inbox.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    
    // Real-time username availability check
    if (value.length >= 3) {
      const isAvailable = await checkUsernameAvailability(value);
      if (!isAvailable) {
        setError('Username is already taken');
      } else {
        setError('');
      }
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 
             mode === 'login' ? 'Login' : 
             mode === 'register' ? 'Create Account' : 
             'Send Reset Email'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {mode === 'login' && (
            <>
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => switchMode('register')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Sign up
                </button>
              </p>
              <p className="text-sm text-gray-600">
                Forgot your password?{' '}
                <button
                  onClick={() => switchMode('forgot')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Reset password
                </button>
              </p>
            </>
          )}

          {mode === 'register' && (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-blue-600 hover:text-blue-800"
              >
                Login
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-blue-600 hover:text-blue-800"
              >
                Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal; 