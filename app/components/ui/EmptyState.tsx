/**
 * EmptyState Component - Consistent empty states across the app
 */

import React from 'react';
import { Button, Icon, Card } from './index';
import { cn } from '../../lib/cn';
import type { IconName } from '../../lib/icon-system';

interface EmptyStateProps {
  /** Icon to display */
  icon?: IconName;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    icon?: IconName;
  };
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'empty',
  title,
  description,
  action,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      icon: 'xl' as const,
      title: 'text-lg',
      description: 'text-sm',
    },
    md: {
      container: 'py-12',
      icon: 'xxl' as const,
      title: 'text-xl',
      description: 'text-base',
    },
    lg: {
      container: 'py-16',
      icon: 'xxl' as const,
      title: 'text-2xl',
      description: 'text-lg',
    },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn(
      'text-center',
      config.container,
      className
    )}>
      <div className="space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-bg-section">
            <Icon 
              name={icon} 
              size={config.icon} 
              className="text-text-tertiary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className={cn(
            'font-bold text-text-primary',
            config.title
          )}>
            {title}
          </h3>
          
          {description && (
            <p className={cn(
              'text-text-secondary max-w-md mx-auto',
              config.description
            )}>
              {description}
            </p>
          )}
        </div>

        {/* Action */}
        {action && (
          <div className="pt-2">
            <Button
              onClick={action.onClick}
              variant={action.variant || 'primary'}
              iconBefore={action.icon}
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Loading State - For when content is loading
interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: { container: 'py-8', icon: 'lg' as const, text: 'text-sm' },
    md: { container: 'py-12', icon: 'xl' as const, text: 'text-base' },
    lg: { container: 'py-16', icon: 'xxl' as const, text: 'text-lg' },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn(
      'text-center',
      config.container,
      className
    )}>
      <div className="space-y-4">
        <div className="flex justify-center">
          <Icon 
            name="loading" 
            size={config.icon}
            className="text-lime-green animate-spin"
          />
        </div>
        <p className={cn(
          'text-text-secondary',
          config.text
        )}>
          {message}
        </p>
      </div>
    </div>
  );
};

// Error State - For when something goes wrong
interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message */
  message?: string;
  /** Retry action */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content.',
  onRetry,
  className,
}) => (
  <div className={cn('text-center py-12', className)}>
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="p-4 rounded-full bg-error/10">
          <Icon name="error" size="xxl" className="text-error" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-text-primary">
          {title}
        </h3>
        <p className="text-text-secondary max-w-md mx-auto">
          {message}
        </p>
      </div>

      {onRetry && (
        <div className="pt-2">
          <Button
            onClick={onRetry}
            variant="primary"
            iconBefore="loading"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  </div>
);

export default EmptyState; 