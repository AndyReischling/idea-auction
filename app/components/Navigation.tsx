'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { User, ScanSmiley, RssSimple, Balloon } from '@phosphor-icons/react';
import AuthButton from './AuthButton';
import AuthStatusIndicator from './AuthStatusIndicator';

interface NavigationProps {
  currentPage?: 'profile' | 'users' | 'feed' | 'generate' | 'home' | 'opinion' | 'bet' | 'other';
  className?: string;
  style?: React.CSSProperties;
}

const Navigation: React.FC<NavigationProps> = ({ 
  currentPage, 
  className = '',
  style = {}
}) => {
  const pathname = usePathname();
  
  // Auto-detect current page if not provided
  const detectedPage = currentPage || (() => {
    if (pathname === '/profile' || pathname?.startsWith('/profile/')) return 'profile';
    if (pathname === '/users' || pathname?.startsWith('/users/')) return 'users';
    if (pathname === '/feed') return 'feed';
    if (pathname === '/generate') return 'generate';
    if (pathname === '/') return 'home';
    if (pathname?.startsWith('/opinion/')) return 'opinion';
    if (pathname?.startsWith('/bet/')) return 'bet';
    return 'other';
  })();

  const navButtons = [
    {
      key: 'profile',
      href: '/profile',
      icon: <User size={24} />,
      label: 'Profile'
    },
    {
      key: 'users',
      href: '/users',
      icon: <ScanSmiley size={24} />,
      label: 'View Traders'
    },
    {
      key: 'feed',
      href: '/feed',
      icon: <RssSimple size={24} />,
      label: 'Live Feed'
    },
    {
      key: 'generate',
      href: '/generate',
      icon: <Balloon size={24} />,
      label: 'Generate'
    }
  ];

  // Filter out the current page
  const visibleButtons = navButtons.filter(button => button.key !== detectedPage);

  const defaultStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0px',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    minWidth: '0', // Allow shrinking
    overflow: 'hidden', // Prevent overflow
    order: -1, // Move to the left
    ...style
  };

  return (
    <div className={`navigation-buttons ${className}`} style={defaultStyle}>
      <AuthStatusIndicator />
      
      {visibleButtons.map((button) => (
        <a
          key={button.key}
          href={button.href}
          className="nav-button"
          style={{
            padding: '0px 20px',
            color: 'var(--text-black)',
            borderRight: '1px solid var(--border-primary)',
            fontSize: 'var(--font-size-md)',
            fontWeight: '400',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-number)',
            gap: '12px',
            transition: 'all var(--transition)',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderBottom: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            outline: 'none',
            boxShadow: 'none',
            whiteSpace: 'nowrap', // Prevent text wrapping
            flexShrink: 0, // Don't shrink buttons
            minWidth: 'fit-content' // Ensure buttons take minimum needed space
          }}
        >
          {button.icon}
          {button.label}
        </a>
      ))}
      
      <AuthButton />
    </div>
  );
};

export default Navigation; 