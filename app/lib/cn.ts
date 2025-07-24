/**
 * Class Name Utility (cn)
 * A simple class name combiner and merger for Tailwind CSS
 * Handles conditional classes and removes duplicates
 */

export type ClassValue = 
  | string 
  | number 
  | boolean 
  | undefined 
  | null 
  | ClassValue[] 
  | { [key: string]: boolean | undefined | null };

/**
 * Combines and deduplicates class names
 * @param classes - Class names to combine
 * @returns Combined class string
 */
export function cn(...classes: ClassValue[]): string {
  const classArray: string[] = [];
  
  for (const cls of classes) {
    if (!cls) continue;
    
    if (typeof cls === 'string') {
      classArray.push(cls);
    } else if (typeof cls === 'number') {
      classArray.push(String(cls));
    } else if (Array.isArray(cls)) {
      const nestedResult = cn(...cls);
      if (nestedResult) classArray.push(nestedResult);
    } else if (typeof cls === 'object') {
      for (const [key, value] of Object.entries(cls)) {
        if (value) classArray.push(key);
      }
    }
  }
  
  // Join all classes and split by spaces to handle multiple classes in single strings
  const allClasses = classArray.join(' ').split(' ').filter(Boolean);
  
  // Remove duplicates while preserving order
  const uniqueClasses = Array.from(new Set(allClasses));
  
  return uniqueClasses.join(' ');
}
