/**
 * Badge Component - Status indicators and labels
 */

import React from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';
import type { IconName } from '../../lib/icon-system';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'trending';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant/color scheme */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Icon to display in badge */
  icon?: IconName;
  /** Whether badge should have a dot indicator */
  dot?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Badge content */
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  className,
  children,
  ...props
}) => {
  // Base badge classes
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-pill',
    'border transition-all duration-200',
  ];

  // Size variations
  const sizeClasses = {
    sm: [
      'px-2 py-0.5 text-xs',
      'gap-1',
    ],
    md: [
      'px-2.5 py-1 text-sm',
      'gap-1.5',
    ],
    lg: [
      'px-3 py-1.5 text-base',
      'gap-2',
    ],
  };

  // Variant styles
  const variantClasses = {
    success: [
      'bg-success text-text-black border-success',
    ],
    error: [
      'bg-error text-white border-error',
    ],
    warning: [
      'bg-warning text-text-black border-warning',
    ],
    info: [
      'bg-info text-white border-info',
    ],
    neutral: [
      'bg-bg-section text-text-secondary border-border-accent',
    ],
    trending: [
      'bg-gradient-to-r from-emerald-green to-lime-green',
      'text-white border-emerald-green shadow-glow',
      'animate-glow',
    ],
  };

  // Combine all classes
  const badgeClasses = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className
  );

  const iconSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';

  return (
    <span className={badgeClasses} {...props}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      
      {icon && (
        <Icon name={icon} size={iconSize} />
      )}
      
      {children}
    </span>
  );
};

export default Badge; 