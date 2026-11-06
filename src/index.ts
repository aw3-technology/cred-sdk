/**
 * CRED SDK - Credit System as a Service
 *
 * A TypeScript SDK for integrating credit systems into your applications.
 *
 * @example
 * ```typescript
 * import { CredClient } from '@cred-diy/sdk';
 *
 * const cred = new CredClient({
 *   apiKey: process.env.CRED_API_KEY!,
 *   appOrigin: 'https://yourapp.com',
 * });
 *
 * // Issue credits to a user (retry-safe with an idempotency key)
 * await cred.credits.issue(
 *   { user_id: 'user_123', credit_type_id: 'ct_123', amount: 100, reason: 'Welcome bonus' },
 *   { idempotencyKey: 'welcome:user_123' },
 * );
 * ```
 */

export {
  CredClient,
  DEFAULT_BASE_URL,
  type CredClientConfig,
  type RequestOptions,
} from "./client";
export { CreditsAPI } from "./credits";
export { PricingAPI } from "./pricing";
export { UsersAPI } from "./users";
export { CheckoutAPI } from "./checkout";
export { SubscriptionsAPI } from "./subscriptions";
export { PaymentMethodsAPI } from "./paymentMethods";
export { AutoTopUpAPI } from "./autoTopUp";
export { SwapsAPI } from "./swaps";
export {
  PayoutsAPI,
  type OnboardPayoutParams,
  type OnboardPayoutResponse,
  type RedeemCreditsParams,
  type RedeemCreditsResponse,
  type PayoutPendingDetails,
} from "./payouts";
export { ReferralsAPI } from "./referrals";
export { AnalyticsAPI } from "./analytics";
export { EscrowAPI } from "./escrow";
export { WalletsAPI } from "./wallets";
export { X402API } from "./x402";
export * from "./types";
