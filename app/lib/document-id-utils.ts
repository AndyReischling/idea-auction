/**
 * Centralized Document ID Utilities
 * 
 * This file provides consistent document ID generation across all Firestore collections
 * to ensure that opinions, market data, transactions, activities, bets, and shorts
 * all reference the same documents correctly.
 */

/**
 * Creates a consistent document ID from opinion text for market data and related collections
 * @param text - The opinion text to create a document ID from
 * @returns A consistent, Firestore-safe document ID
 */
export function createMarketDataDocId(text: string): string {
  return btoa(text.slice(0, 100)).replace(/[^A-Za-z0-9]/g, '').slice(0, 100);
}

/**
 * Creates a consistent document ID from any text input
 * @param text - The text to create a document ID from
 * @returns A consistent, Firestore-safe document ID
 */
export function createDocumentId(text: string): string {
  return btoa(text.slice(0, 100)).replace(/[^A-Za-z0-9]/g, '').slice(0, 100);
}

/**
 * Creates a transaction ID with timestamp and random suffix
 * @returns A unique transaction ID
 */
export function createTransactionId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates an activity ID with timestamp and random suffix
 * @returns A unique activity ID
 */
export function createActivityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a bet ID with timestamp and random suffix
 * @returns A unique bet ID
 */
export function createBetId(): string {
  return `bet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a short position ID with timestamp and random suffix
 * @returns A unique short position ID
 */
export function createShortPositionId(): string {
  return `short_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * For backward compatibility - alias to createDocumentId
 * @deprecated Use createDocumentId instead
 */
export const createDocId = createDocumentId;

/**
 * For backward compatibility - alias to createMarketDataDocId
 * @deprecated Use createMarketDataDocId instead
 */
export const createMarketDocId = createMarketDataDocId; 