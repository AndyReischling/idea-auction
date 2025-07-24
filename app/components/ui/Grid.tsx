/**
 * Grid Component - Responsive grid system with design system integration
 */

import React from 'react';
import { cn } from '../../lib/cn';

type GridColumns = 1 | 2 | 3 | 4 | 5 | 'auto-fit-2' | 'auto-fit-3' | 'auto-fit-4' | 'auto-fit-5';
type GridGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns or responsive auto-fit */
  columns?: GridColumns;
  /** Gap between grid items */
  gap?: GridGap;
  /** Additional CSS classes */
  className?: string;
  /** Grid content */
  children: React.ReactNode;
}

export const Grid: React.FC<GridProps> = ({
  columns = 'auto-fit-3',
  gap = 'md',
  className,
  children,
  ...props
}) => {
  // Column classes
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    'auto-fit-2': 'grid-cols-1 sm:grid-cols-2',
    'auto-fit-3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    'auto-fit-4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    'auto-fit-5': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  };

  // Gap classes
  const gapClasses = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
    '2xl': 'gap-10',
  };

  const gridClasses = cn(
    'grid',
    columnClasses[columns],
    gapClasses[gap],
    className
  );

  return (
    <div className={gridClasses} {...props}>
      {children}
    </div>
  );
};

export default Grid; 