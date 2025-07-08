'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import AuthModal from './AuthModal';

const AuthButton: React.FC = () => {
  const { user, userProfile, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (user && userProfile) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center space-x-2 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
            {userProfile.username[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-gray-900">{userProfile.username}</span>
            <span className="text-xs text-gray-500">${userProfile.balance.toLocaleString()}</span>
          </div>
        </button>

        {showUserMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{userProfile.username}</p>
              <p className="text-xs text-gray-500">{userProfile.email}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  // TODO: Open profile settings
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Login
      </button>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default AuthButton; 