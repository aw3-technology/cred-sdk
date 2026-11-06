/**
 * Payment Methods API Module
 *
 * Saved cards and off-session charges. A card is saved only by a one-time
 * hosted checkout sent with `save_payment_method: true`; `chargeSaved` then
 * buys a pack on it with the buyer absent.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  PaymentMethodResponse,
  DeletePaymentMethodResponse,
  ChargeSavedParams,
  ChargeSavedResponse,
} from "./types";

export class PaymentMethodsAPI extends BaseResource {
  /**
   * The user's saved card (`payment_method: null` when none).
   *
   * @example
   * ```typescript
   * const { data } = await cred.paymentMethods.get('user_123');
   * if (data?.payment_method) console.log(data.payment_method.brand, data.payment_method.last4);
   * ```
   */
  async get(userId: string): Promise<APIResponse<PaymentMethodResponse>> {
    return this.query("/credits-api/payment-method", { user_id: userId });
  }

  /**
   * Detach the saved card in Stripe and forget it.
   *
   * @example
   * ```typescript
   * await cred.paymentMethods.remove('user_123');
   * ```
   */
  async remove(userId: string): Promise<APIResponse<DeletePaymentMethodResponse>> {
    return this.del("/credits-api/payment-method", { user_id: userId });
  }

  /**
   * Charge the saved card for one pack of a one-time tier, off-session.
   *
   * The idempotency key is required: a retry with the same key answers with
   * the first outcome (`replayed: true`) and never charges twice. Use a new key
   * only for a deliberate new charge.
   *
   * Results: `200 status: "succeeded"` (credits added), `202 status:
   * "processing"` (credited when Stripe confirms), or an error — `402` for a
   * decline (`error.details.decline_code`, `requires_action` when 3-D Secure
   * is needed: send the buyer through checkout instead), `404
   * no_saved_payment_method`, `409 saved_payment_method_unusable`, `502
   * charge_not_started` (retry with the same key).
   *
   * @example
   * ```typescript
   * const result = await cred.paymentMethods.chargeSaved(
   *   { user_id: 'user_123', pricing_tier_id: 'tier_123', credit_type_id: 'ct_123' },
   *   { idempotencyKey: `topup:user_123:${orderId}` },
   * );
   * ```
   */
  async chargeSaved(
    params: ChargeSavedParams,
    options: { idempotencyKey: string },
  ): Promise<APIResponse<ChargeSavedResponse>> {
    return this.post(
      "/credits-api/charge-saved",
      { ...params },
      this.idempotencyHeaders(options),
    );
  }
}
