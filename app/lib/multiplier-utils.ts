/**
 * Shared multiplier calculation utilities for all betting functionality
 */

/**
 * Calculate dynamic multiplier based on risk factors
 * @param percentChange - Target percentage change (higher = more risk)
 * @param timeHours - Time limit in hours (shorter = more risk)
 * @returns Calculated multiplier between 1.1x and 10.0x
 */
export const calculateMultiplier = (percentChange: number, timeHours: number): number => {
  // Base multiplier
  const baseMultiplier = 1.0;
  
  // Risk from percent change (higher % = higher risk = higher multiplier)
  // Scale: 10% = +0.5, 20% = +1.0, 50% = +2.5
  const percentRisk = percentChange / 20;
  
  // Risk from timeframe (shorter time = higher risk = higher multiplier)  
  // Reference: 168 hours (7 days) = baseline, 24 hours = +0.86
  const baseTimeHours = 168;
  const timeRisk = Math.max(0, (baseTimeHours - timeHours) / baseTimeHours);
  
  // Combined multiplier with reasonable caps
  const multiplier = baseMultiplier + percentRisk + timeRisk;
  
  // Cap multiplier between 1.1x and 10.0x for reasonable betting
  return Math.max(1.1, Math.min(10.0, multiplier));
};

/**
 * Calculate potential payout for any bet
 * @param amount - Bet amount
 * @param percentChange - Target percentage change
 * @param timeHours - Time limit in hours
 * @returns Potential payout amount
 */
export const calculatePayout = (amount: number, percentChange: number, timeHours: number): number => {
  return amount * calculateMultiplier(percentChange, timeHours);
}; 