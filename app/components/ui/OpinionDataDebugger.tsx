import React from 'react';
import { OpinionCardData } from './OpinionCard';

interface OpinionDataDebuggerProps {
  opinions: OpinionCardData[];
  showInConsole?: boolean;
}

export function OpinionDataDebugger({ 
  opinions, 
  showInConsole = true 
}: OpinionDataDebuggerProps) {
  React.useEffect(() => {
    if (!showInConsole) return;
    
    const issues: string[] = [];
    const stats = {
      total: opinions.length,
      missingId: 0,
      missingText: 0,
      missingPrice: 0,
      valid: 0
    };
    
    opinions.forEach((opinion, index) => {
      if (!opinion.id) {
        stats.missingId++;
        issues.push(`Opinion ${index}: Missing ID`);
      }
      
      if (!opinion.text || opinion.text.trim() === '') {
        stats.missingText++;
        issues.push(`Opinion ${index} (ID: ${opinion.id}): Missing text`);
      }
      
      if (!opinion.currentPrice) {
        stats.missingPrice++;
        issues.push(`Opinion ${index} (ID: ${opinion.id}): Missing price`);
      }
      
      if (opinion.id && opinion.text && opinion.currentPrice) {
        stats.valid++;
      }
    });
    
    console.group('📊 Opinion Data Debug Report');
    console.log('Total opinions:', stats.total);
    console.log('Valid opinions:', stats.valid);
    console.log('Missing IDs:', stats.missingId);
    console.log('Missing text:', stats.missingText);
    console.log('Missing prices:', stats.missingPrice);
    
    if (issues.length > 0) {
      console.group('❌ Issues found:');
      issues.forEach(issue => console.warn(issue));
      console.groupEnd();
    } else {
      console.log('✅ No issues found!');
    }
    
    console.groupEnd();
  }, [opinions, showInConsole]);
  
  return null; // This is a debugging component, doesn't render anything
} 