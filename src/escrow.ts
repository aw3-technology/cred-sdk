/**
 * Escrow API Module
 *
 * Hold credits in escrow, then release them back to the holder or capture
 * (settle) them — optionally crediting a different end user for peer-to-peer /
 * marketplace settlement.
 *
 * Lifecycle: hold → release | capture. A captured hold can settle to another
 * user; any uncaptured remainder is released back to the holder automatically.
 */

import { BaseResource } from "./base";
import type { RequestOptions } from "./client";
import type {
  APIResponse,
  CreateHoldParams,
  ReleaseHoldParams,
  CaptureHoldParams,
  ListHoldsParams,
  HoldResponse,
  ReleaseHoldResponse,
  CaptureHoldResponse,
  ListHoldsResponse,
} from "./types";

export class EscrowAPI extends BaseResource {
  /**
   * Reserve credits from a user's balance into escrow.
   *
   * @example
   * ```typescript
   * const { data } = await cred.escrow.hold({
   *   user_id: 'user_123',
   *   credit_type_id: 'ct_123',
   *   amount: 100,
   *   reference_id: 'order_789',
   * });
   * console.log(data?.hold_id);
   * ```
   */
  async hold(params: CreateHoldParams, options?: RequestOptions): Promise<APIResponse<HoldResponse>> {
    // With an idempotency key a retry returns the original hold
    // (idempotent_replay: true) instead of placing a second one.
    return this.post("/credits-api/escrow/hold", { ...params }, this.idempotencyHeaders(options));
  }

  /**
   * Release a hold, returning the full held amount to the original holder.
   *
   * @example
   * ```typescript
   * await cred.escrow.release({ hold_id: 'hold_123' });
   * ```
   */
  async release(
    params: ReleaseHoldParams,
  ): Promise<APIResponse<ReleaseHoldResponse>> {
    return this.post("/credits-api/escrow/release", { ...params });
  }

  /**
   * Capture (settle) a hold. Optionally credits a different end user; any
   * uncaptured remainder is released back to the holder.
   *
   * @example
   * ```typescript
   * // Settle the held credits to the seller
   * await cred.escrow.capture({ hold_id: 'hold_123', to_user_id: 'seller_456' });
   *
   * // Partial capture; remainder returns to the holder
   * await cred.escrow.capture({ hold_id: 'hold_123', amount: 60 });
   * ```
   */
  async capture(
    params: CaptureHoldParams,
  ): Promise<APIResponse<CaptureHoldResponse>> {
    return this.post("/credits-api/escrow/capture", { ...params });
  }

  /**
   * List escrow holds for the project.
   *
   * @example
   * ```typescript
   * const { data } = await cred.escrow.list({ status: 'held' });
   * ```
   */
  async list(
    params: ListHoldsParams = {},
  ): Promise<APIResponse<ListHoldsResponse>> {
    return this.query("/credits-api/escrow", { ...params });
  }
}
