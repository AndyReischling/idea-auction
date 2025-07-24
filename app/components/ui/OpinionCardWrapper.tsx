import React from 'react';
import { OpinionCard, OpinionCardData } from './OpinionCard';
import { opinionConflictResolver } from '../../lib/opinion-conflict-resolver';

interface OpinionCardWrapperProps {
  opinion: any; // Accept any shape of opinion data
  variant?: 'default' | 'compact';
  className?: string;
  onClick?: () => void;
}

/**
 * OpinionCardWrapper - Automatically normalizes opinion data for consistent rendering
 * Use this instead of OpinionCard directly to ensure ID/text field consistency
 */
export function OpinionCardWrapper({ 
  opinion, 
  variant = 'default', 
  className = '',
  onClick 
}: OpinionCardWrapperProps) {
  // Normalize the opinion data to ensure consistent ID and text fields
  const normalizedOpinion = React.useMemo(() => {
    if (!opinion) return null;
    return opinionConflictResolver.normalizeOpinionData(opinion);
  }, [opinion]);

  // Don't render if no valid opinion data
  if (!normalizedOpinion || (!normalizedOpinion.id && !normalizedOpinion.text)) {
    console.warn('OpinionCardWrapper: Invalid opinion data:', opinion);
    return null;
  }

  return (
    <OpinionCard
      opinion={normalizedOpinion}
      variant={variant}
      className={className}
      onClick={onClick}
    />
  );
} 