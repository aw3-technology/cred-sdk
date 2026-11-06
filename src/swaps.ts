/**
 * CRED SDK - Swaps API
 *
 * Handles credit swap operations
 */

import { BaseResource } from "./base";
import { calculateSwapQuote } from "./lib/swapMath";
import type { RequestOptions } from "./client";
import type {
  APIResponse,
  SwapResult,
  GetSwapPairsParams,
  ExecuteSwapParams,
  SwapPairsResponse,
  SwapPreview,
  PreviewSwapParams,
} from "./types";

export class SwapsAPI extends BaseResource {
  /**
   * Get available swap pairs
   *
   * @example
   * ```typescript
   * const { data } = await cred.swaps.getPairs();
   * console.log(data.swap_pairs);
   * ```
   */
  async getPairs(
    params: GetSwapPairsParams = {},
  ): Promise<APIResponse<SwapPairsResponse>> {
    return this.query("/credits-api/swap-pairs", { ...params });
  }

  /**
   * Execute a credit swap. Pass an idempotency key so a retry returns the first
   * swap (`idempotent_replay: true`) instead of swapping twice; reusing a key
   * for a different swap fails with `409 IDEMPOTENCY_KEY_REUSED`.
   * `direction: "reverse"` spends the pair's target type and works only on
   * bidirectional pairs (`400 SWAP_NOT_BIDIRECTIONAL` otherwise). Too small a
   * balance fails with `400 INSUFFICIENT_CREDITS`.
   *
   * @example
   * ```typescript
   * const { data } = await cred.swaps.execute({
   *   swap_pair_id: 'pair_123',
   *   user_id: 'user_456',
   *   source_amount: 100
   * }, { idempotencyKey: 'swap:order_789' });
   * console.log(`Received ${data?.transaction.target_amount} credits`);
   * ```
   */
  async execute(
    params: ExecuteSwapParams,
    options?: RequestOptions,
  ): Promise<APIResponse<SwapResult>> {
    return this.post("/credits-api/swap", {
      swap_pair_id: params.swap_pair_id,
      user_id: params.user_id,
      user_email: params.user_email,
      source_amount: params.source_amount,
      ...(params.direction ? { direction: params.direction } : {}),
    }, this.idempotencyHeaders(options));
  }

  /**
   * Calculate swap preview (estimate target amount and fees)
   *
   * @example
   * ```typescript
   * const preview = await cred.swaps.preview({
   *   swap_pair_id: 'pair_123',
   *   source_amount: 100
   * });
   * console.log(`You will receive ${preview.target_amount} after ${preview.fee_amount} fee`);
   * ```
   */
  async preview(params: PreviewSwapParams): Promise<APIResponse<SwapPreview>> {
    // Client-side estimate from the pair's published rate and fee.
    const pairsResult = await this.getPairs();

    if (!pairsResult.success || !pairsResult.data) {
      return {
        success: false,
        error: pairsResult.error || { message: "Failed to fetch swap pairs" },
      };
    }

    const pair = pairsResult.data.swap_pairs.find(
      (p) => p.id === params.swap_pair_id,
    );

    if (!pair) {
      return {
        success: false,
        error: { message: "Swap pair not found", code: "NOT_FOUND" },
      };
    }

    const direction = params.direction ?? "forward";
    if (direction === "reverse" && !pair.is_bidirectional) {
      return {
        success: false,
        error: { message: "This swap pair is one-way", code: "SWAP_NOT_BIDIRECTIONAL" },
      };
    }
    const { feeAmount, targetAmount, rate } = calculateSwapQuote(
      params.source_amount,
      pair.fee_percent,
      pair.exchange_rate,
      direction,
    );

    return {
      success: true,
      data: {
        source_amount: params.source_amount,
        target_amount: targetAmount,
        fee_amount: feeAmount,
        exchange_rate: rate,
      },
    };
  }
}
