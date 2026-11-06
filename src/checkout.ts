/**
 * Checkout API Module
 *
 * Hosted Stripe checkout (`POST /hosted-checkout`): a pricing-tier package, a
 * custom credit amount, or a monthly subscription. Credits are issued when
 * Stripe confirms the payment (per paid invoice for subscriptions).
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  CheckoutSession,
  CreateCheckoutParams,
} from "./types";

export class CheckoutAPI extends BaseResource {
  /**
   * Create a hosted checkout session.
   *
   * Use a `pricing_tier_id` for a pre-defined package, or `credit_type_id` +
   * `amount` for a custom amount priced at the credit type's USD-per-credit
   * `exchange_rate`. Send `credit_type_id` with a tier too: omitted on a tier
   * that applies to several credit types, the oldest active one is used
   * silently.
   *
   * `success_url` and `cancel_url` must be on a Cred host or a domain listed
   * under Dashboard → Payments → Allowed redirect domains. On any other domain
   * the session is still created and silently redirects to Cred's default pages.
   *
   * @example
   * ```typescript
   * // One-time package, and keep the card for auto top-up
   * const { data } = await cred.checkout.create({
   *   pricing_tier_id: 'tier_123',
   *   credit_type_id: 'ct_123',
   *   user_id: 'user_456',
   *   user_email: 'buyer@example.com',
   *   save_payment_method: true,
   *   success_url: 'https://myapp.com/success',
   *   cancel_url: 'https://myapp.com/cancel',
   * });
   * // redirect the buyer to data.checkout_url
   * ```
   *
   * @example
   * ```typescript
   * // Monthly subscription (tier billing_type must be "recurring" or "both")
   * await cred.checkout.create({ pricing_tier_id: 'tier_123', credit_type_id: 'ct_123', user_id: 'user_456', billing: 'recurring' });
   *
   * // Custom amount
   * await cred.checkout.create({ credit_type_id: 'ct_123', amount: 500, user_id: 'user_456' });
   * ```
   */
  async create(
    params: CreateCheckoutParams,
  ): Promise<APIResponse<CheckoutSession>> {
    return this.post("/hosted-checkout", this.withAppOrigin({ ...params }));
  }

  /**
   * Create a checkout session and return just its URL (null on failure).
   *
   * @example
   * ```typescript
   * const url = await cred.checkout.createUrl({ pricing_tier_id: 'tier_123', credit_type_id: 'ct_123', user_id: 'user_456' });
   * ```
   */
  async createUrl(params: CreateCheckoutParams): Promise<string | null> {
    const result = await this.create(params);
    return result.success && result.data ? result.data.checkout_url : null;
  }
}
