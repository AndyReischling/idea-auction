'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import AuthModal from './AuthModal';
import { SignOut, User } from '@phosphor-icons/react';

const AuthButton: React.FC = () => {
  const { user, userProfile, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/'); // Redirect to homepage after logout
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <button className="auth-button" disabled>
        <User size={24} /> Loading...
      </button>
    );
  }

  // Show sign out button when user is authenticated
  if (user && user.uid) {
    return (
      <button
        onClick={handleLogout}
        className="auth-button"
        title={`Sign out ${userProfile?.username || user.email}`}
      >
        <SignOut size={24} /> Sign Out
      </button>
    );
  }

  // Show sign in button when user is not authenticated
  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className="auth-button"
      >
        <User size={24} /> Sign In
      </button>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default AuthButton; 