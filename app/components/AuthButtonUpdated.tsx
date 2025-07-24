/**
 * AuthButton - Updated to use the new design system
 * This is an example of how to update existing components to use the design system
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { Button, Icon } from './ui';
import AuthModal from './AuthModal';

const AuthButtonUpdated: React.FC = () => {
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
      <Button 
        disabled 
        variant="ghost" 
        iconOnly="loading"
        className="animate-spin"
        aria-label="Loading authentication status"
      />
    );
  }

  // Show sign out button when user is authenticated
  if (user && user.uid) {
    return (
      <Button
        onClick={handleLogout}
        variant="ghost"
        iconBefore="signOut"
        className="text-text-primary hover:text-coral-red"
        title={`Sign out ${userProfile?.username || user.email}`}
      >
        Sign Out
      </Button>
    );
  }

  // Show sign in button when user is not authenticated
  return (
    <>
      <Button
        onClick={() => setShowAuthModal(true)}
        variant="ghost"
        iconBefore="signIn"
        className="text-text-primary hover:text-emerald-green"
      >
        Sign In
      </Button>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default AuthButtonUpdated; 