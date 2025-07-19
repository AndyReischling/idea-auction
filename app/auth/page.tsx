'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { TrendUp, Users, ChartLine } from '@phosphor-icons/react';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const { signIn, signUp, checkUsernameAvailability, user } = useAuth();
  const router = useRouter();

  // Redirect to profile if already logged in (with delay to prevent immediate redirects)
  useEffect(() => {
    if (user) {
      // Add a delay to prevent immediate redirects from auth state changes
      const redirectTimer = setTimeout(() => {
        router.push('/profile');
      }, 1000); // 1 second delay
      
      return () => clearTimeout(redirectTimer);
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setMessage(null);
    setIsLoading(true);
    setLoadingStep('');

    try {
      if (mode === 'signin') {
        setLoadingStep('Signing in...');
        await signIn(email, password);
        setLoadingStep('Complete! Redirecting...');
        setMessage({ type: 'success', text: 'Sign in successful!' });
        router.push('/profile');
      } else {
        // Sign up mode
        if (!username.trim()) {
          throw new Error('Username is required');
        }
        
        setLoadingStep('Checking username availability...');
        const isAvailable = await checkUsernameAvailability(username);
        if (!isAvailable) {
          throw new Error('Username is already taken. Please choose another one.');
        }
        
        setLoadingStep('Creating your account...');
        await signUp(email, password, username);
        setLoadingStep('Complete! Redirecting...');
        setMessage({ type: 'success', text: 'Account created successfully!' });
        router.push('/profile');
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'An error occurred' 
      });
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setMessage(null);
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    resetForm();
  };

  // Don't render anything if user is logged in (prevents flash)
  if (user) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-page-container">
        {/* Hero Section */}
        <div className="auth-hero">
          <h1 className="auth-hero-title">Join the Opinion Marketplace</h1>
          <p className="auth-hero-subtitle">Trade ideas, earn rewards, shape the future</p>
          <p className="auth-hero-description">
            Turn your opinions into assets. Buy, sell, and trade ideas in the world's first opinion marketplace.
          </p>
          
          <div className="auth-features">
            <div className="auth-feature">
              <TrendUp size={24} />
              <h3>Trade Opinions</h3>
              <p>Buy and sell opinions as they rise and fall in value based on market demand.</p>
            </div>
            
            <div className="auth-feature">
              <Users size={24} />
              <h3>Community Driven</h3>
              <p>Connect with traders worldwide and discover trending ideas before they explode.</p>
            </div>
            
            <div className="auth-feature">
              <ChartLine size={24} />
              <h3>Real-Time Markets</h3>
              <p>Watch opinion prices fluctuate in real-time based on trading activity and demand.</p>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="auth-form-container">
          <div className="card">
            <div className="auth-form-header">
              <h2 className="auth-form-title">
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="auth-form-subtitle">
                {mode === 'signin' ? 
                  'Welcome back! Sign in to your account' : 
                  'Join the marketplace and start trading ideas'
                }
              </p>
            </div>

            {message && (
              <div className={`auth-message ${message.type === 'error' ? 'auth-message-error' : 'auth-message-success'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {/* Email */}
              <div className="auth-form-group">
                <label className="auth-form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="auth-form-input"
                  placeholder="Enter your email"
                />
              </div>

              {/* Password */}
              <div className="auth-form-group">
                <label className="auth-form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-form-input"
                  placeholder="Enter your password"
                  minLength={6}
                />
              </div>

              {/* Username (only for signup) */}
              {mode === 'signup' && (
                <div className="auth-form-group">
                  <label className="auth-form-label">Username</label>
                  <input
                    type="text"
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
                disabled={isLoading}
                className="auth-form-submit"
              >
                {isLoading ? (
                  <div className="auth-loading">
                    <div className="auth-spinner"></div>
                    {loadingStep || (mode === 'signin' ? 'Signing in...' : 'Creating account...')}
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
      </div>
    </div>
  );
} 