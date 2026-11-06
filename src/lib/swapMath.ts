/**
 * Swap amount math.
 *
 * Mirrors the server-side calculation.
 */

export interface SwapAmountResult {
  feeAmount: number;
  effectiveAmount: number;
  targetAmount: number;
}

/**
 * Calculate the fee, effective (post-fee) amount, and resulting target amount
 * for a swap. The formula must match the server-side implementation exactly.
 */
// Credit balances/ledger are stored as numeric(20,6). Round all derived amounts
// to 6 decimals so accumulated IEEE-754 float drift never gets written to the
// ledger (e.g. 0.1 * 3 = 0.30000000000000004).
const CREDIT_SCALE = 1e6;
export function roundCredits(n: number): number {
  return Math.round((n + Number.EPSILON) * CREDIT_SCALE) / CREDIT_SCALE;
}

export function calculateSwapAmount(
  sourceAmount: number,
  feePercent: number | undefined,
  exchangeRate: number,
): SwapAmountResult {
  const feeAmount = roundCredits(sourceAmount * ((feePercent || 0) / 100));
  const effectiveAmount = roundCredits(sourceAmount - feeAmount);
  const targetAmount = roundCredits(effectiveAmount * exchangeRate);
  return { feeAmount, effectiveAmount, targetAmount };
}

export type SwapDirection = "forward" | "reverse";

export interface SwapQuote extends SwapAmountResult {
  /** Target credits per source credit for this direction (rounded for storage). */
  rate: number;
}

/**
 * A swap in either direction of a pair. "forward" spends the pair's source
 * type at exchange_rate; "reverse" (bidirectional pairs only) spends the
 * pair's target type at the inverse rate, 1/exchange_rate. The fee is taken
 * from the spent amount before conversion either way. The reverse target is
 * divided rather than multiplied by a rounded inverse, so 1/3-style rates
 * lose no precision.
 */
export const calculateSwapQuote = (
  sourceAmount: number,
  feePercent: number | null | undefined,
  exchangeRate: number,
  direction: SwapDirection,
): SwapQuote => {
  if (direction === "forward") {
    return { ...calculateSwapAmount(sourceAmount, feePercent ?? undefined, exchangeRate), rate: exchangeRate };
  }
  const feeAmount = roundCredits(sourceAmount * ((feePercent || 0) / 100));
  const effectiveAmount = roundCredits(sourceAmount - feeAmount);
  const targetAmount = roundCredits(effectiveAmount / exchangeRate);
  return { feeAmount, effectiveAmount, targetAmount, rate: roundCredits(1 / exchangeRate) };
};

/**
 * min_swap_amount / max_swap_amount are in units of the pair's source type. A
 * reverse swap spends the target type, so its amount is converted back at the
 * pair rate before the limits apply.
 */
export const swapLimitAmount = (
  sourceAmount: number,
  exchangeRate: number,
  direction: SwapDirection,
): number => (direction === "forward" ? sourceAmount : roundCredits(sourceAmount / exchangeRate));
