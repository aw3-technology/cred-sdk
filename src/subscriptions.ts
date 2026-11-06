/**
 * Subscriptions API Module
 *
 * Recurring credit subscriptions created by a hosted checkout sent with
 * `billing: "recurring"`. Credits are issued per paid Stripe invoice.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  ListSubscriptionsParams,
  SubscriptionsResponse,
  CancelSubscriptionParams,
  CancelSubscriptionResponse,
  SubscriptionPortalParams,
  SubscriptionPortalResponse,
  UpdateSubscriptionQuantityParams,
  UpdateSubscriptionQuantityResponse,
} from "./types";

export class SubscriptionsAPI extends BaseResource {
  /**
   * List subscriptions (newest first, at most 100).
   *
   * @example
   * ```typescript
   * const { data } = await cred.subscriptions.list({ user_id: 'user_123', status: 'active' });
   * ```
   */
  async list(
    params: ListSubscriptionsParams = {},
  ): Promise<APIResponse<SubscriptionsResponse>> {
    return this.query("/credits-api/subscriptions", { ...params });
  }

  /**
   * Cancel one subscription (`subscription_id`) or every live subscription of
   * a customer (`user_id` / `email`). Defaults to the end of the paid period.
   *
   * @example
   * ```typescript
   * await cred.subscriptions.cancel({ user_id: 'user_123' });
   * await cred.subscriptions.cancel({ subscription_id: 'sub_123', at_period_end: false });
   * ```
   */
  async cancel(
    params: CancelSubscriptionParams,
  ): Promise<APIResponse<CancelSubscriptionResponse>> {
    return this.post("/credits-api/subscriptions/cancel", { ...params });
  }

  /**
   * Mint a short-lived Stripe customer-portal URL (update card, or `flow:
   * "overview"` for invoices). Create it when the customer clicks. `return_url`
   * on a domain outside Dashboard → Payments → Allowed redirect domains fails
   * with `400 REDIRECT_NOT_ALLOWED`.
   *
   * @example
   * ```typescript
   * const { data } = await cred.subscriptions.portal({ user_id: 'user_123', return_url: 'https://myapp.com/billing' });
   * ```
   */
  async portal(
    params: SubscriptionPortalParams,
  ): Promise<APIResponse<SubscriptionPortalResponse>> {
    return this.post("/credits-api/subscriptions/portal", { ...params });
  }

  /**
   * Change the seat/unit quantity (1–10000). Takes effect at the next renewal
   * with no proration; credits per renewal become unit credits × quantity.
   * Without `subscription_id` the customer must have exactly one live
   * subscription (409 otherwise).
   *
   * @example
   * ```typescript
   * await cred.subscriptions.updateQuantity({ user_id: 'user_123', quantity: 5 });
   * ```
   */
  async updateQuantity(
    params: UpdateSubscriptionQuantityParams,
  ): Promise<APIResponse<UpdateSubscriptionQuantityResponse>> {
    return this.post("/credits-api/subscriptions/quantity", { ...params });
  }
}
