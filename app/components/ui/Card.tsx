/**
 * Card Component - Design system compliant card with variants
 */

import React from 'react';
import { cn } from '../../lib/cn';

type CardVariant = 'default' | 'elevated' | 'outline';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Whether the card is clickable/interactive */
  interactive?: boolean;
  /** Whether the card should animate on hover */
  hoverable?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card content */
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  hoverable = true,
  className,
  children,
  ...props
}) => {
  // Base card classes using standard Tailwind
  const baseClasses = [
    'rounded-lg transition-all duration-200',
    'border border-gray-200',
  ];

  // Variant styles using standard Tailwind
  const variantClasses = {
    default: [
      'bg-white shadow-sm',
    ],
    elevated: [
      'bg-white shadow-md',
      'border-gray-100',
    ],
    outline: [
      'bg-transparent shadow-none',
      'border-gray-300',
    ],
  };

  // Padding variations
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4', 
    lg: 'p-6',
  };

  // Interactive states
  const interactiveClasses = interactive || hoverable ? [
    'hover:shadow-lg',
    'hover:-translate-y-1',
    'hover:border-blue-300',
  ] : [];

  const cursorClass = interactive ? 'cursor-pointer' : '';

  // Combine all classes
  const cardClasses = cn(
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    interactiveClasses,
    cursorClass,
    className
  );

  return (
    <div className={cardClasses} {...props}>
      {children}
    </div>
  );
};

// Card sub-components for better composition
export const CardHeader: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={cn('flex justify-between items-start gap-4', className)}>
    {children}
  </div>
);

export const CardTitle: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <h3 className={cn('text-lg font-bold text-text-primary m-0', className)}>
    {children}
  </h3>
);

export const CardSubtitle: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <p className={cn('text-sm text-text-tertiary mt-1 mb-0', className)}>
    {children}
  </p>
);

export const CardContent: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={cn('flex-1 flex flex-col', className)}>
    {children}
  </div>
);

export const CardFooter: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={cn('mt-auto border-t border-border-secondary pt-3', className)}>
    {children}
  </div>
);

export default Card; 