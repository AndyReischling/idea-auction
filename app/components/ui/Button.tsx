/**
 * Button Component - Design system compliant button with variants
 */

import React from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './Icon';
import type { IconName } from '../../lib/icon-system';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to display before text */
  iconBefore?: IconName;
  /** Icon to display after text */
  iconAfter?: IconName;
  /** Icon-only button (no text) */
  iconOnly?: IconName;
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  iconBefore,
  iconAfter,
  iconOnly,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) => {
  // Base button classes
  const baseClasses = [
    // Layout and interaction
    'inline-flex items-center justify-center',
    'border border-transparent',
    'font-medium transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Hover effects
    'hover:-translate-y-0.5 hover:shadow-md',
    'active:translate-y-0',
  ];

  // Size variations
  const sizeClasses = {
    sm: [
      'px-3 py-1.5 text-sm rounded-sm',
      iconOnly ? 'w-8 h-8 p-1.5' : 'gap-1.5',
    ],
    md: [
      'px-6 py-3 text-base rounded-md',
      iconOnly ? 'w-10 h-10 p-2.5' : 'gap-2',
    ],
    lg: [
      'px-8 py-4 text-lg rounded-lg',
      iconOnly ? 'w-12 h-12 p-3' : 'gap-2.5',
    ],
  };

  // Variant styles
  const variantClasses = {
    primary: [
      'bg-lime-green text-text-black',
      'hover:bg-lime-dark',
      'focus:ring-lime-green',
    ],
    secondary: [
      'bg-soft-purple text-bg-card',
      'hover:bg-accent-purple',
      'focus:ring-soft-purple',
    ],
    danger: [
      'bg-coral-red text-bg-card',
      'hover:bg-coral-bright',
      'focus:ring-coral-red',
    ],
    ghost: [
      'bg-transparent text-text-primary',
      'hover:bg-bg-section',
      'focus:ring-text-primary',
    ],
  };

  // Combine all classes
  const buttonClasses = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    {
      'w-full': fullWidth,
      'cursor-not-allowed opacity-50': disabled || loading,
      'hover:transform-none hover:shadow-none': disabled || loading,
    },
    className
  );

  const iconSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Icon
          name="loading"
          size={iconSize}
          className="animate-spin"
        />
      )}
      
      {!loading && iconBefore && (
        <Icon name={iconBefore} size={iconSize} />
      )}
      
      {!loading && iconOnly && (
        <Icon name={iconOnly} size={iconSize} />
      )}
      
      {!iconOnly && children && <span>{children}</span>}
      
      {!loading && iconAfter && (
        <Icon name={iconAfter} size={iconSize} />
      )}
    </button>
  );
};

export default Button; 