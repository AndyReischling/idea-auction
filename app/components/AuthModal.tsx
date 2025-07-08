'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signIn, signUp, checkUsernameAvailability } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setLoadingStep('');

    try {
      if (mode === 'signin') {
        setLoadingStep('Signing in...');
        await signIn(email, password);
        setLoadingStep('Complete! Redirecting...');
        setSuccess('Sign in successful!');
        onClose();
        router.push('/profile');
      } else {
        // Sign up mode
        if (!username.trim()) {
          throw new Error('Username is required');
        }
        
        setLoadingStep('Checking username...');
        const isAvailable = await checkUsernameAvailability(username);
        if (!isAvailable) {
          throw new Error('Username is already taken. Please choose another one.');
        }
        
        setLoadingStep('Creating account...');
        await signUp(email, password, username);
        setLoadingStep('Complete! Redirecting...');
        setSuccess('Account created successfully!');
        onClose();
        router.push('/profile');
      }
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Provide specific guidance for common auth errors
      if (errorMessage.includes('auth/invalid-credential')) {
        if (mode === 'signin') {
          errorMessage = 'Invalid email or password. Please check your credentials or create a new account.';
        }
      } else if (errorMessage.includes('auth/user-not-found')) {
        errorMessage = 'No account found with this email. Would you like to create a new account?';
      } else if (errorMessage.includes('auth/wrong-password')) {
        errorMessage = 'Incorrect password. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError('');
    setSuccess('');
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal-content">
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="auth-modal-close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="auth-message auth-message-error">
            {error}
          </div>
        )}

        {success && (
          <div className="auth-message auth-message-success">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-group">
            <label htmlFor="email" className="auth-form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-form-input"
              placeholder="Enter your email"
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password" className="auth-form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-form-input"
              placeholder="Enter your password"
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className="auth-form-group">
              <label htmlFor="username" className="auth-form-label">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="auth-form-input"
                placeholder="Choose a username"
                minLength={3}
                maxLength={20}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-form-submit"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{loadingStep || (mode === 'signin' ? 'Signing in...' : 'Creating account...')}</span>
              </div>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-modal-footer">
          <p className="auth-footer-text">
            {mode === 'signin' ? 
              "Don't have an account? " : 
              "Already have an account? "
            }
            <button
              type="button"
              onClick={switchMode}
              className="auth-footer-link"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal; 