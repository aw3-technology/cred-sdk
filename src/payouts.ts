/**
 * Payouts API Module
 *
 * Cash redemption for credits via Stripe Connect Express.
 * Players onboard a payout account once, then redeem credits → USD transfer.
 *
 * Requires:
 *   - A credit type with `is_redeemable = true` and a valid `exchange_rate`
 *     (USD per credit) configured in the dashboard.
 *   - Your own Stripe secret key configured under Payments → Your Own Keys.
 */

import { BaseResource } from "./base";
import type { RequestOptions } from "./client";
import type { APIResponse } from "./types";

export interface OnboardPayoutParams {
  /** Your external user id (or omit when passing user_email). */
  user_id?: string;
  /** Player email — recommended for cross-app unified wallets. */
  user_email?: string;
  /** URL Stripe redirects to after onboarding completes. */
  return_url: string;
  /** URL Stripe redirects to if the onboarding link expires. */
  refresh_url: string;
  /** ISO country code for the connected account (default "US"). */
  country?: string;
}

export interface OnboardPayoutResponse {
  success: boolean;
  stripe_account_id: string;
  onboarding_url: string;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
}

export interface RedeemCreditsParams {
  user_id?: string;
  user_email?: string;
  credit_type_id: string;
  /** Number of credits to redeem. */
  amount: number;
  /** The user's own Stripe connected account id (acct_xxx) from onboardPayoutAccount; any other account is rejected (INVALID_DESTINATION). */
  destination: string;
  /**
   * @deprecated Ignored. The payout always uses the credit type's stored
   * exchange_rate, so a request cannot inflate the transfer.
   */
  redeem_rate?: number;
  /** ISO currency code (default "usd"). */
  currency?: string;
  reason?: string;
  reference_id?: string;
  metadata?: Record<string, unknown>;
}

export interface RedeemCreditsResponse {
  success: boolean;
  /** True when this idempotency key already settled the redemption; nothing moved again. */
  idempotent_replay?: boolean;
  transaction_id: string;
  stripe_transfer_id: string;
  credits_redeemed: number;
  exchange_rate: number;
  payout_amount: number;
  currency: string;
  destination: string;
  new_balance: number;
}

/**
 * `error.details` of a `502 PAYOUT_PENDING`: the transfer's outcome is not
 * known yet. Retry with the same idempotency key (`idempotency_key` here, which
 * is the generated one if you sent none) to finish it — it never pays twice.
 * If you never retry, the reconciliation sweep settles it after ~15 minutes
 * (finds the transfer and marks it paid, or re-sends it under the same Stripe
 * idempotency key; credits come back only if Stripe definitely refuses). A
 * claim it cannot settle safely is flagged for manual review and keeps
 * answering PAYOUT_PENDING.
 */
export interface PayoutPendingDetails {
  error: string;
  code: "PAYOUT_PENDING";
  stripe_error: string | null;
  transaction_id: string;
  idempotency_key: string;
  request_id?: string;
}

export class PayoutsAPI extends BaseResource {
  /**
   * Create or reuse a Stripe Express account for a player and return a hosted
   * onboarding URL where they enter their debit card / bank details.
   */
  async onboardPayoutAccount(
    params: OnboardPayoutParams,
  ): Promise<APIResponse<OnboardPayoutResponse>> {
    return this.post("/credits-api/onboard-payout", { ...params });
  }

  /**
   * Redeem credits for cash. Atomically deducts credits and transfers USD
   * (credits × exchange_rate) to the player's connected Stripe account.
   * On a Stripe failure that moved no money, credits are automatically refunded.
   *
   * Pass an idempotency key so a retry never deducts or pays twice: it returns
   * the first result (`idempotent_replay: true`). Errors: `402
   * STRIPE_TRANSFER_FAILED` (Stripe refused; credits returned), `502
   * PAYOUT_PENDING` (outcome unknown — retry with the same key, see
   * `PayoutPendingDetails`), `400 INVALID_DESTINATION` (not the user's own
   * payout account), `NOT_REDEEMABLE`, `PAYOUT_TOO_SMALL`,
   * `INSUFFICIENT_CREDITS`, `409 IDEMPOTENCY_KEY_REUSED`.
   */
  async redeem(
    params: RedeemCreditsParams,
    options?: RequestOptions,
  ): Promise<APIResponse<RedeemCreditsResponse>> {
    return this.post("/credits-api/redeem", { ...params }, this.idempotencyHeaders(options));
  }
}
