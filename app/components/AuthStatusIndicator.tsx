'use client';

import React from 'react';
import { useAuth } from '../lib/auth-context';

const AuthStatusIndicator: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0px 24px',
        fontSize: 'var(--font-size-md)',
        color: 'var(--text-secondary)',
        fontWeight: '400',
        borderRight: '1px solid var(--border-primary)'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'var(--medium-gray)',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
        <span>Checking...</span>
      </div>
    );
  }

  const isLoggedIn = user && user.uid;
  const statusColor = isLoggedIn ? 'var(--green)' : 'var(--red)';
  const statusText = isLoggedIn ? 'Signed In' : 'Signed Out';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '0px 24px',
      fontSize: 'var(--font-size-md)',
      color: 'var(--text-secondary)',
      fontWeight: '400',
      borderRight: '1px solid var(--border-primary)'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColor,
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <span>{statusText}</span>
    </div>
  );
};

export default AuthStatusIndicator; 