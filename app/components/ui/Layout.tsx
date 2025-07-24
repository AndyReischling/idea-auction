/**
 * Layout Components - Consistent page layouts using design system
 */

import React from 'react';
import { Header } from './Header';
import { cn } from '../../lib/cn';

interface LayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Header configuration */
  header?: {
    title?: string;
    showSearch?: boolean;
    hideNavigation?: boolean;
    currentPage?: string;
  };
  /** Maximum width container */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Padding around content */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  className,
  header = {},
  maxWidth = 'xl',
  padding = 'md',
}) => {
  // Max width classes
  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl', 
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    '2xl': 'max-w-full',
    full: '',
  };

  // Padding classes
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className="min-h-screen bg-bg-white">
      <Header {...header} />
      
      {/* Main content area with proper top spacing for fixed header */}
      <main className={cn(
        // Base layout
        'pt-28', // Account for fixed header (h-24) + extra spacing
        'mx-auto',
        
        // Max width
        maxWidthClasses[maxWidth],
        
        // Padding
        paddingClasses[padding],
        
        className
      )}>
        {children}
      </main>
    </div>
  );
};

// Page Container - Simple wrapper for page content
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  title,
  subtitle,
}) => (
  <div className={cn('space-y-8', className)}>
    {(title || subtitle) && (
      <div className="space-y-2">
        {title && (
          <h1 className="text-4xl font-bold text-text-primary">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-lg text-text-secondary">
            {subtitle}
          </p>
        )}
      </div>
    )}
    {children}
  </div>
);

// Section - Consistent spacing for page sections
interface SectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

export const Section: React.FC<SectionProps> = ({
  children,
  className,
  title,
  subtitle,
  spacing = 'md',
}) => {
  const spacingClasses = {
    sm: 'space-y-4',
    md: 'space-y-6',
    lg: 'space-y-8',
  };

  return (
    <section className={cn(spacingClasses[spacing], className)}>
      {(title || subtitle) && (
        <div className="space-y-2">
          {title && (
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

export default Layout; 