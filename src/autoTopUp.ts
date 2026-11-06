/**
 * Auto Top-Up API Module
 *
 * Rules that buy a pack on the user's saved card whenever their balance of a
 * credit type falls below a threshold. Checked after every deduct and by a
 * background sweep; charges go through the same replay-safe path as
 * `paymentMethods.chargeSaved`.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  AutoTopUpResponse,
  AutoTopUpListResponse,
  SaveAutoTopUpParams,
  DeleteAutoTopUpResponse,
} from "./types";

export class AutoTopUpAPI extends BaseResource {
  /**
   * The user's rule for one credit type (`auto_topup: null` when none), plus
   * their saved card.
   *
   * @example
   * ```typescript
   * const { data } = await cred.autoTopUp.get({ user_id: 'user_123', credit_type_id: 'ct_123' });
   * ```
   */
  async get(params: {
    user_id: string;
    credit_type_id: string;
  }): Promise<APIResponse<AutoTopUpResponse>> {
    return this.query("/credits-api/auto-topup", { ...params });
  }

  /**
   * Every rule for the user, plus their saved card.
   *
   * @example
   * ```typescript
   * const { data } = await cred.autoTopUp.list('user_123');
   * ```
   */
  async list(userId: string): Promise<APIResponse<AutoTopUpListResponse>> {
    return this.query("/credits-api/auto-topup", { user_id: userId });
  }

  /**
   * Create or replace the rule for (user, credit type). Saving also clears
   * any backoff or automatic disable, and tops up right away when the balance
   * is already below the threshold. `warning` is set when the user has no
   * saved card yet.
   *
   * @example
   * ```typescript
   * await cred.autoTopUp.save({
   *   user_id: 'user_123',
   *   pricing_tier_id: 'tier_123',
   *   credit_type_id: 'ct_123',
   *   threshold: 50,
   *   max_per_day: 3,
   * });
   * ```
   */
  async save(params: SaveAutoTopUpParams): Promise<APIResponse<AutoTopUpResponse>> {
    return this.post("/credits-api/auto-topup", { ...params });
  }

  /**
   * Delete the rule for one credit type, or every rule for the user when
   * `credit_type_id` is omitted.
   *
   * @example
   * ```typescript
   * await cred.autoTopUp.remove({ user_id: 'user_123', credit_type_id: 'ct_123' });
   * ```
   */
  async remove(params: {
    user_id: string;
    credit_type_id?: string;
  }): Promise<APIResponse<DeleteAutoTopUpResponse>> {
    return this.del("/credits-api/auto-topup", { ...params });
  }
}
