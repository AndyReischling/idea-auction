/**
 * Header Component - Reusable navigation header
 * Based on the specific layout requirements provided
 */

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { cn } from '../../lib/cn';

interface HeaderProps {
  /** Custom user information to display */
  userInfo?: {
    avatar?: string;
    name?: string;
    subtitle?: string;
    memberSince?: string;
    role?: string;
  };
  /** Additional CSS classes */
  className?: string;
  /** Hide specific navigation items */
  hideNavigation?: string[];
  /** Additional header content */
  children?: React.ReactNode;
}

const NavigationIcon = ({ path }: { path: string }) => {
  const icons = {
    users: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M224,40V76a8,8,0,0,1-16,0V48H180a8,8,0,0,1,0-16h36A8,8,0,0,1,224,40Zm-8,132a8,8,0,0,0-8,8v28H180a8,8,0,0,0,0,16h36a8,8,0,0,0,8-8V180A8,8,0,0,0,216,172ZM76,208H48V180a8,8,0,0,0-16,0v36a8,8,0,0,0,8,8H76a8,8,0,0,0,0-16ZM40,84a8,8,0,0,0,8-8V48H76a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8V76A8,8,0,0,0,40,84Zm88,116a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,200Zm56-72a56,56,0,1,0-56,56A56.06,56.06,0,0,0,184,128Zm-68-12a12,12,0,1,0-12,12A12,12,0,0,0,116,116Zm36-12a12,12,0,1,0,12,12A12,12,0,0,0,152,104Zm-5.29,42c-3.81,3.37-12,6-18.71,6s-14.9-2.63-18.71-6a8,8,0,1,0-10.58,12c7.83,6.91,20.35,10,29.29,10s21.46-3.09,29.29-10a8,8,0,1,0-10.58-12Z" />
      </svg>
    ),
    feed: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M224,192a8,8,0,0,1-16,0c0-79.4-64.6-144-144-144a8,8,0,0,1,0-16C152.22,32,224,103.78,224,192ZM64,104a8,8,0,0,0,0,16,72.08,72.08,0,0,1,72,72,8,8,0,0,0,16,0A88.1,88.1,0,0,0,64,104Zm4,72a12,12,0,1,0,12,12A12,12,0,0,0,68,176Z" />
      </svg>
    ),
    generate: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M128,16a88.1,88.1,0,0,0-88,88c0,23.43,9.4,49.42,25.13,69.5,12.08,15.41,26.5,26,41.91,31.09L96.65,228.85A8,8,0,0,0,104,240h48a8,8,0,0,0,7.35-11.15L149,204.59c15.4-5.07,29.83-15.68,41.91-31.09C206.6,153.42,216,127.43,216,104A88.1,88.1,0,0,0,128,16Zm11.87,208H116.13l6.94-16.19c1.64.12,3.28.19,4.93.19s3.29-.07,4.93-.19Zm38.4-60.37C163.94,181.93,146.09,192,128,192s-35.94-10.07-50.27-28.37C64.12,146.27,56,124,56,104a72,72,0,0,1,144,0C200,124,191.88,146.27,178.27,163.63Zm-1-59.74A8.52,8.52,0,0,1,176,104a8,8,0,0,1-7.88-6.68,41.29,41.29,0,0,0-33.43-33.43,8,8,0,1,1,2.64-15.78,57.5,57.5,0,0,1,46.57,46.57A8,8,0,0,1,177.32,103.89Z" />
      </svg>
    ),
    signOut: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z" />
      </svg>
    ),
    profile: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" />
      </svg>
    )
  };
  
  return icons[path as keyof typeof icons] || null;
};

export const Header: React.FC<HeaderProps> = ({
  userInfo,
  className,
  hideNavigation = [],
  children,
}) => {
  const { user, userProfile, logout } = useAuth();
  const pathname = usePathname();
  
  // Check if we're on the profile page
  const isProfilePage = pathname === '/profile' || pathname?.startsWith('/profile/');
  
  // Default user info or use provided userInfo
  const displayUserInfo = userInfo || {
    avatar: userProfile?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A',
    name: userProfile?.username || user?.displayName || 'AndyMoney',
    subtitle: 'Real-time Portfolio Tracking',
    memberSince: '7/8/2025',
    role: 'Opinion Trader & Collector'
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigationItems = [
    { href: '/users', key: 'users', label: 'View Traders' },
    { href: '/feed', key: 'feed', label: 'Live Feed' },
    { href: '/generate', key: 'generate', label: 'Generate' },
  ].filter(item => !hideNavigation.includes(item.key));

  return (
    <div className={cn(
      'header-section',
      'fixed top-0 z-50',
      'bg-bg-card border-b border-border-primary',
      'h-24',
      className
    )}
    style={{
      left: '280px', // Account for sidebar width
      right: '0',
      width: 'calc(100% - 280px)' // Subtract sidebar width
    }}>
      <div style={{ flex: '1 1 0%' }}></div>
      
      <div 
        className="navigation-buttons"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0px',
          flexWrap: 'nowrap',
          justifyContent: 'flex-start',
          minWidth: 'max-content',
          overflow: 'visible',
          order: -1
        }}
      >
        {/* User Info Section */}
        <div 
          className="nav-button"
          style={{
            padding: '0px 20px',
            color: 'var(--text-black)',
            borderRight: '1px solid var(--border-primary)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-number)',
            gap: '12px',
            background: 'transparent',
            cursor: 'default',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <div className="user-avatar" style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--light-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            color: 'var(--text-black)'
          }}>
            {displayUserInfo.avatar}
          </div>
          
          <div>
            <div className="user-name" style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              margin: 0,
              color: 'var(--text-black)'
            }}>
              {displayUserInfo.name}
            </div>
            <p style={{
              margin: '0px',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)'
            }}>
              {displayUserInfo.subtitle}
            </p>
            <p style={{
              margin: '0px',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)'
            }}>
              Member since {displayUserInfo.memberSince} | {displayUserInfo.role}
            </p>
          </div>
        </div>

        {/* Signed In Status */}
        <div 
          className="nav-button"
          style={{
            padding: '0px 20px',
            color: 'var(--text-black)',
            borderRight: '1px solid var(--border-primary)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-number)',
            gap: '12px',
            background: 'transparent',
            cursor: 'default',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--green)'
          }}></div>
          Signed In
        </div>

        {/* Navigation Links */}
        {navigationItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="nav-button"
            style={{
              padding: '0px 20px',
              color: 'var(--text-black)',
              borderRight: '1px solid var(--border-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-number)',
              gap: '12px',
              background: 'transparent',
              cursor: 'pointer',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-section)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <NavigationIcon path={item.key} />
            {item.label}
          </a>
        ))}

        {/* Back to Profile Button (show on all pages except profile) */}
        {!isProfilePage && (
          <a
            href="/profile"
            className="nav-button"
            style={{
              padding: '0px 20px',
              color: 'var(--text-black)',
              borderRight: '1px solid var(--border-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-number)',
              gap: '12px',
              background: 'transparent',
              cursor: 'pointer',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-section)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <NavigationIcon path="profile" />
            Back to Profile
          </a>
        )}

        {/* Sign Out Button */}
        <button
          className="auth-button"
          onClick={handleLogout}
          style={{
            padding: '0px 20px',
            color: 'var(--text-black)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-number)',
            gap: '12px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-section)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <NavigationIcon path="signOut" />
          Sign Out
        </button>

        {/* Custom Content */}
        {children}
      </div>
    </div>
  );
};

export default Header; 