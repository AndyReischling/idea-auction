/**
 * Icon Component - Reusable icon with design system integration
 */

import React from 'react';
import { getIcon, getIconSize, type IconName, type IconSize, type IconWeight } from '../../lib/icon-system';
import { cn } from '../../lib/cn';

interface IconProps {
  /** Icon name from the icon system */
  name: IconName;
  /** Icon size - uses design system sizes */
  size?: IconSize | number;
  /** Icon color - can use CSS classes or direct color values */
  color?: string;
  /** Icon weight/style */
  weight?: IconWeight;
  /** Additional CSS classes */
  className?: string;
  /** Semantic meaning for accessibility */
  'aria-label'?: string;
  /** Whether the icon is decorative (hidden from screen readers) */
  'aria-hidden'?: boolean;
  /** Click handler for interactive icons */
  onClick?: () => void;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color,
  weight = 'regular',
  className,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  onClick,
}) => {
  const IconComponent = getIcon(name);
  
  // Determine the actual pixel size
  const iconSize = typeof size === 'number' ? size : getIconSize(size);
  
  // Base classes for the icon
  const iconClasses = cn(
    'inline-block',
    {
      'cursor-pointer': onClick,
      'transition-colors duration-200': onClick,
    },
    className
  );

  return (
    <IconComponent
      size={iconSize}
      weight={weight}
      color={color}
      className={iconClasses}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      onClick={onClick}
    />
  );
};

export default Icon; 