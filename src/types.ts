/**
 * CRED SDK Type Definitions
 *
 * Field names are the API's wire names (snake_case). Shapes mirror the
 * credits-api and hosted-checkout edge-function responses.
 */

// ============ Credit Types ============

/** A credit type, as returned by `GET /credits-api/credit-types`. */
export interface CreditType {
  id: string;
  name: string;
  symbol: string;
  description?: string | null;
  /** USD per credit. Prices custom-amount checkout and cash redemption. */
  exchange_rate: number;
  /** Whether this credit type can be redeemed for cash via the payouts API. */
  is_redeemable?: boolean;
  /** Whether this credit type is backed on-chain. */
  is_on_chain?: boolean;
  /** Blockchain identifier when `is_on_chain` is true. */
  blockchain?: string | null;
  /** ERC-20 address, once a token has been deployed for this credit type. */
  contract_address?: string | null;
  /** EVM chain id the contract lives on. */
  chain_id?: number | null;
  /** Token decimals — needed to convert a credit amount to atomic units. */
  token_decimals?: number | null;
  /** Whether issuing credits also mints tokens to the user's wallet. */
  mint_on_issue?: boolean;
  /** Who signed the deployment: "managed", "self", or "thirdweb". */
  deployment_type?: string | null;
}

/** Response shape returned by `GET /credits-api/credit-types`. */
export interface CreditTypesResponse {
  credit_types: CreditType[];
}

/** One entry in a balance response. */
export interface CreditBalance {
  credit_type_id: string;
  credit_type_name?: string;
  credit_type_symbol?: string;
  balance: number;
}

/**
 * Response shape returned by `GET /credits-api/balance`. An unknown user is not
 * an error: it comes back with an empty `balances` array.
 */
export interface BalanceResponse {
  user_id: string;
  email?: string | null;
  balances: CreditBalance[];
}

export type CreditTransactionType = "issue" | "deduct" | "refund" | "transfer";

/** A ledger row, as returned by `GET /credits-api/transactions`. */
export interface CreditTransaction {
  id: string;
  /** Your external id for the user. */
  user_id: string;
  credit_type_id: string;
  credit_type_name?: string;
  credit_type_symbol?: string;
  /** Signed: positive added credits, negative removed them. */
  amount: number;
  type: CreditTransactionType;
  reason?: string | null;
  reference_id?: string | null;
  created_at: string;
}

/** Response shape returned by `GET /credits-api/transactions`. */
export interface TransactionsResponse {
  transactions: CreditTransaction[];
  limit: number;
  offset: number;
}

// ============ User Types ============

export interface EndUser {
  id: string;
  external_id: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown>;
  /** First-touch signup attribution. */
  signup_url?: string | null;
  signup_host?: string | null;
  signup_credit_type_id?: string | null;
  /** EVM address on-chain credits mint to, if one is attached. */
  wallet_address?: string | null;
  /**
   * When the holder proved the address by signature. Null means it was
   * asserted by you and never proved — see `cred.wallets.verify`.
   */
  wallet_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * First-touch signup attribution accepted on user, issue and deduct calls.
 * Recorded once per user and never overwritten (except by `users.update`).
 */
export interface SignupAttribution {
  /** URL of the page the user signed up from. */
  signup_url?: string;
  /** Normalized signup host. Overrides the host derived from signup_url. */
  signup_host?: string;
  /** Credit type associated with the signup flow. */
  signup_credit_type_id?: string;
}

export interface CreateUserParams extends SignupAttribution {
  external_id: string;
  email?: string;
  name?: string;
  /**
   * Your free-form object. On an existing user it replaces the stored one (see
   * `UpdateUserParams.metadata`). `stripe_account_id` is Cred-only: a value you
   * send is silently dropped.
   */
  metadata?: Record<string, unknown>;
  /**
   * EVM address to mint on-chain credits to. Stored as asserted, not verified;
   * use `cred.wallets.challenge`/`verify` when you need proof of control.
   */
  wallet_address?: string | null;
}

export interface UpdateUserParams extends SignupAttribution {
  /** Look the user up by email instead of external_id. */
  user_email?: string;
  email?: string;
  name?: string;
  /**
   * Replaces the stored object. `referral_code` is kept unless you send it.
   * `stripe_account_id` is Cred-only: the stored value stays and a value you
   * send is silently dropped.
   */
  metadata?: Record<string, unknown>;
  /** Pass `null` to detach. Changing the address clears any verification. */
  wallet_address?: string | null;
}

export interface ListUsersParams {
  /** Max 1000 (default 100). */
  limit?: number;
  offset?: number;
  /** Filter by normalized signup host. */
  signup_host?: string;
  /** Filter by the credit type associated with signup. */
  signup_credit_type_id?: string;
}

/** Response shape returned by `POST /credits-api/users`. */
export interface CreateUserResponse {
  user: EndUser;
  /** False when an existing user (matched by email, then external_id) was returned. */
  created: boolean;
}

/** Response shape returned by `GET /credits-api/users?external_id=` and `PATCH /users`. */
export interface UserResponse {
  user: EndUser;
}

/** Response shape returned by `GET /credits-api/users` (list). */
export interface ListUsersResponse {
  users: EndUser[];
  total: number;
  limit: number;
  offset: number;
}

/** Response shape returned by `POST /credits-api/users/bulk`. */
export interface BulkUsersResponse {
  success: boolean;
  created: number;
  updated: number;
  /** Per-row failures; absent when every row succeeded. */
  errors?: string[];
}

// ============ Pricing Types ============

export type BillingType = "one_time" | "recurring" | "both";

/** A pricing tier (credit package). */
export interface PricingTier {
  id: string;
  name: string;
  description?: string | null;
  /** Decimal string with two places, e.g. "9.99". */
  price: string;
  credits: number;
  currency: string;
  billing_type: BillingType;
  is_active: boolean;
  is_popular: boolean;
  /**
   * Credit types this tier can be purchased for.
   * Empty array = applies to all active credit types in the project.
   */
  credit_type_ids: string[];
  /** Returned by create. */
  created_at?: string;
  /** Returned by update. */
  updated_at?: string;
}

export interface ListPricingTiersParams {
  /**
   * Narrow to tiers sold for this credit type (UUID): tiers that list it plus
   * tiers that apply to every type (empty `credit_type_ids`). 400 if not a UUID.
   */
  credit_type_id?: string;
}

export interface DeletePricingTierParams {
  /**
   * Also delete the auto top-up rules that buy this tier. Without it a tier
   * that rules use is refused with `409 TIER_IN_USE` (`details.auto_topup_rules`
   * is the rule count); with it the rules and the tier go in one transaction.
   */
  force?: boolean;
}

/** Response shape returned by `DELETE /credits-api/pricing-tiers`. */
export interface DeletePricingTierResponse {
  success: boolean;
  deleted_id: string;
  /** Rules deleted with the tier (only when `force` removed some). */
  auto_topup_rules_deleted?: number;
}

/** Response shape returned by `GET /credits-api/pricing-tiers` (active tiers only). */
export interface PricingTiersResponse {
  pricing_tiers: PricingTier[];
}

/** Response shape returned by creating or updating a tier. */
export interface PricingTierResponse {
  success: boolean;
  pricing_tier: PricingTier;
}

export interface CreatePricingTierParams {
  name: string;
  description?: string;
  /** USD amount; 0 for a free tier, otherwise at least 0.50 and at most $1 per credit. */
  price: number;
  /** Positive integer. */
  credits: number;
  currency?: string;
  billing_type?: BillingType;
  is_popular?: boolean;
  /** Restrict to specific credit types. Omit or pass [] to apply to all credit types in the project. */
  credit_type_ids?: string[];
}

export interface UpdatePricingTierParams {
  name?: string;
  description?: string | null;
  price?: number;
  credits?: number;
  currency?: string;
  billing_type?: BillingType;
  is_active?: boolean;
  is_popular?: boolean;
  /** Restrict to specific credit types. Pass [] to apply to all credit types in the project. */
  credit_type_ids?: string[];
}

// ============ Checkout Types ============

export interface CreateCheckoutParams {
  /** Your external id for the buyer. */
  user_id: string;
  /** Buyer email — prefilled on Stripe and used to link the wallet. */
  user_email?: string;
  /** Buyer name, stored when the user is created on fulfilment. */
  user_name?: string;
  /** A pre-defined package. */
  pricing_tier_id?: string;
  /**
   * With `pricing_tier_id`: which credit type the tier grants. Required when
   * the tier applies to several types, otherwise 400 CREDIT_TYPE_REQUIRED.
   * Without a tier: required, the credit type of a custom-amount
   * checkout, priced at its `exchange_rate` (USD per credit).
   */
  credit_type_id?: string;
  /** Custom-amount checkout: number of credits to buy (with `credit_type_id`). */
  amount?: number;
  /** Units / seats, 1–10000 (default 1). Charges and credits are multiplied. */
  quantity?: number;
  /**
   * `"recurring"` creates a monthly Stripe subscription (needs a tier whose
   * billing_type is `recurring` or `both`). Omitted or `"one_time"` is a
   * one-off payment, whatever the tier's billing_type.
   */
  billing?: "one_time" | "recurring";
  /**
   * Keep the card for off-session charges (`paymentMethods.chargeSaved`,
   * auto top-up). One-time checkouts only.
   */
  save_payment_method?: boolean;
  /**
   * https URL on a Cred host or a domain listed under Dashboard → Payments →
   * Allowed redirect domains (subdomains included; localhost also works). On
   * any other domain the checkout still succeeds and silently redirects to
   * Cred's default page.
   */
  success_url?: string;
  /** Same rule as `success_url`. */
  cancel_url?: string;
  /**
   * URL of the page the user signed up from. Stored on the purchase and on the
   * end user (first time). Falls back to x-app-origin / Origin / Referer.
   */
  signup_url?: string;
  /** Explicit signup host; overrides the host derived from signup_url. */
  signup_host?: string;
}

/** Response shape returned by `POST /hosted-checkout`. */
export interface CheckoutSession {
  checkout_url: string;
  /** Same as checkout_url. */
  url: string;
  session_id: string;
  purchase_id?: string;
  billing: "one_time" | "subscription";
  expires_at?: string;
}

// ============ Subscription Types ============

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"
  | (string & {});

export interface CreditSubscription {
  /** cred subscription id (UUID). */
  id: string;
  stripe_subscription_id: string;
  /** Your external id for the subscriber. */
  user_id: string;
  end_user_id: string | null;
  user_email: string | null;
  pricing_tier_id: string | null;
  credit_type_id: string;
  /** Credits issued per paid invoice (unit credits × quantity). */
  credits_per_period: number;
  quantity: number;
  /** Decimal string, e.g. "9.99". */
  price: string;
  currency: string;
  interval: string;
  payment_mode: "own_keys" | "connect";
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
}

export interface ListSubscriptionsParams {
  user_id?: string;
  email?: string;
  /** `"active"` matches active, trialing and past_due; any other value matches exactly. */
  status?: string;
}

/** Identify a subscription by id, or a customer by user_id / email. */
export interface SubscriptionTarget {
  /** cred id (UUID) or Stripe `sub_…` id. */
  subscription_id?: string;
  user_id?: string;
  email?: string;
}

export interface CancelSubscriptionParams extends SubscriptionTarget {
  /** Default true: keep crediting until the paid period ends. False cancels now, no refund. */
  at_period_end?: boolean;
}

export interface SubscriptionPortalParams extends SubscriptionTarget {
  /**
   * https URL on a Cred host or a domain listed under Dashboard → Payments →
   * Allowed redirect domains, else `400 REDIRECT_NOT_ALLOWED`.
   */
  return_url?: string;
  /** Default "payment_method_update". */
  flow?: "payment_method_update" | "overview";
}

export interface UpdateSubscriptionQuantityParams extends SubscriptionTarget {
  /** Integer 1–10000. Takes effect at the next renewal, no proration. */
  quantity: number;
}

export interface SubscriptionsResponse {
  subscriptions: CreditSubscription[];
}

export interface CancelSubscriptionResponse {
  success: boolean;
  at_period_end: boolean;
  subscriptions: CreditSubscription[];
}

export interface SubscriptionPortalResponse {
  /** Short-lived Stripe portal URL — mint it on click, don't store it. */
  url: string;
  subscription: CreditSubscription;
}

export interface UpdateSubscriptionQuantityResponse {
  success: boolean;
  subscription: CreditSubscription;
}

// ============ Saved Card / Auto Top-Up Types ============

/** The public view of a saved card. */
export interface SavedPaymentMethod {
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentMethodResponse {
  payment_method: SavedPaymentMethod | null;
}

export interface DeletePaymentMethodResponse {
  deleted: boolean;
  /** `"no_saved_payment_method"` when there was nothing to delete. */
  code?: string;
}

export interface ChargeSavedParams {
  user_id: string;
  /** A one-time (or `both`) tier. */
  pricing_tier_id: string;
  /**
   * Required when the tier applies to several credit types, otherwise
   * 400 CREDIT_TYPE_REQUIRED.
   */
  credit_type_id?: string;
}

/**
 * Successful (`200`, `status: "succeeded"`) or pending (`202`,
 * `status: "processing"`) result of `POST /credits-api/charge-saved`. A
 * decline is an error (402) whose `details` carry `code`, `decline_code`,
 * `requires_action` and `purchase_id`.
 */
export interface ChargeSavedResponse {
  status: "succeeded" | "processing";
  purchase_id: string;
  payment_intent_id?: string | null;
  /** Credits added (succeeded only). */
  credits?: number;
  new_balance?: number | null;
  /** True when this key was already used and the first outcome is returned. */
  replayed?: boolean;
  /** Set when the charge succeeded but crediting is still being retried. */
  fulfillment?: string;
}

export interface AutoTopUpRule {
  user_id: string;
  credit_type_id: string;
  pricing_tier_id: string;
  threshold: number;
  enabled: boolean;
  max_per_day: number;
  charges_last_24h: number;
  disabled_reason: string | null;
  consecutive_failures: number;
  last_attempt_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_purchase_id: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveAutoTopUpParams {
  user_id: string;
  /** One-time (or `both`) tier to buy. */
  pricing_tier_id: string;
  /** Top up when the balance falls below this many credits (> 0). */
  threshold: number;
  /**
   * Required when the tier applies to several credit types, otherwise
   * 400 CREDIT_TYPE_REQUIRED.
   */
  credit_type_id?: string;
  /** Default true. */
  enabled?: boolean;
  /** Whole number 1–100 (default 5). */
  max_per_day?: number;
}

export interface AutoTopUpResponse {
  auto_topup: AutoTopUpRule | null;
  payment_method: SavedPaymentMethod | null;
  /** Present when the user has no saved card yet. */
  warning?: string;
}

export interface AutoTopUpListResponse {
  auto_topups: AutoTopUpRule[];
  payment_method: SavedPaymentMethod | null;
}

export interface DeleteAutoTopUpResponse {
  /** Number of rules removed. */
  deleted: number;
}

// ============ API Response Types ============

export interface APIResponse<T> {
  data?: T;
  error?: APIError;
  success: boolean;
  /**
   * The call's request id (`X-Request-Id`). Present whenever the API answered;
   * absent for timeouts and network errors. Quote it to support.
   */
  requestId?: string;
}

/**
 * Error codes the API returns in `code` (or `error_code`). Not exhaustive —
 * `APIError.code` is typed `string` so new codes never break a build. See the
 * "Errors & request IDs" docs for statuses and meanings.
 */
export type CredErrorCode =
  // Auth, metering, request shape
  | "INVALID_API_KEY" // 401
  | "API_KEY_DISABLED" // 401
  | "API_KEY_EXPIRED" // 401
  | "RATE_LIMITED" // 429 — checked before the 1 CRD charge, so it costs nothing
  | "PLATFORM_CREDITS_EXHAUSTED" // 402 — your CRD balance is spent (may carry an x402 offer)
  | "INVALID_IDEMPOTENCY_KEY" // 400 — longer than 255 characters
  | "IDEMPOTENCY_KEY_REUSED" // 409 — same key, different request
  | "IDEMPOTENCY_KEY_REQUIRED" // 400 — charge-saved
  | "REDIRECT_NOT_ALLOWED" // 400 — payout onboarding / billing portal URL not on an allowed domain
  // Credits, users
  | "INSUFFICIENT_CREDITS" // 400
  | "USER_NOT_FOUND" // 404
  | "INVALID_CREDIT_TYPE" // 400 — unknown or inactive credit_type_id
  | "CREDIT_TYPE_REQUIRED" // 400 — tier applies to several credit types
  | "NO_FIELDS_TO_UPDATE" // 400 — PATCH /users with nothing to change
  | "USER_HAS_HISTORY" // 409 — DELETE /users for a user with swap history
  // Pricing tiers
  | "TIER_IN_USE" // 409 — auto top-up rules buy the tier; retry with force
  | "tier_not_one_time" // 400 — recurring-only tier for charge-saved / auto top-up
  // Escrow
  | "HOLD_NOT_FOUND" // 404
  | "HOLD_NOT_ACTIVE" // 409
  | "CAPTURE_EXCEEDS_HELD" // 400
  | "INVALID_AMOUNT" // 400
  // Refunds
  | "PURCHASE_NOT_FOUND" // 404
  | "TRANSACTION_NOT_FOUND" // 404
  | "ALREADY_REFUNDED" // 409
  | "PURCHASE_NOT_REFUNDABLE" // 400
  | "NOT_REFUNDABLE" // 400
  | "REFUND_EXCEEDS_ORIGINAL" // 400
  | "STRIPE_REFUND_FAILED" // 402
  // Payouts
  | "NOT_REDEEMABLE" // 400
  | "PAYOUT_TOO_SMALL" // 400
  | "INVALID_DESTINATION" // 400
  | "STRIPE_TRANSFER_FAILED" // 402 — credits returned
  | "PAYOUT_PENDING" // 502 — outcome unknown; retry with the same key
  // Swaps
  | "SWAP_NOT_BIDIRECTIONAL" // 400
  | "INVALID_DIRECTION" // 400
  // Saved cards (402 declines put these in error_code; code stays Stripe's)
  | "CARD_DECLINED" // 402
  | "CARD_AUTHENTICATION_REQUIRED" // 402
  | "no_saved_payment_method" // 404
  | "saved_payment_method_unusable" // 409
  | "charge_not_started" // 502
  // Referrals
  | "INVALID_REFERRAL_CODE" // 400
  | "ALREADY_REFERRED" // 400
  | "SELF_REFERRAL" // 400
  | "CREDIT_TYPE_REQUIRED" // 400
  | "NO_REFERRAL" // 404
  | "NO_CREDIT_TYPE" // 409
  | "REFERRER_GONE" // 409
  | "CREDIT_TYPE_INACTIVE" // 400 / 409
  | "NO_DEFAULT_PROGRAM" // 409
  // SDK-side (no HTTP response)
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export interface APIError {
  /** The API's `error` field (or `message` when there is none). */
  message: string;
  /**
   * Machine-readable code (see `CredErrorCode`), e.g. `INSUFFICIENT_CREDITS`,
   * `USER_NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED`, `TIER_IN_USE`, `PAYOUT_PENDING`.
   * On a saved-card decline this is Stripe's code (`card_declined`) and
   * `errorCode` is `CARD_DECLINED`. SDK-side failures use `TIMEOUT`,
   * `NETWORK_ERROR` and `INVALID_RESPONSE`.
   */
  code?: CredErrorCode | (string & {});
  /**
   * The body's `error_code`, when it differs from `code`: `CARD_DECLINED` /
   * `CARD_AUTHENTICATION_REQUIRED` on a 402 from `charge-saved`.
   */
  errorCode?: CredErrorCode | (string & {});
  /** HTTP status; absent for timeouts and network errors. */
  status?: number;
  /**
   * The call's request id (`X-Request-Id` header, also `request_id` in every
   * error body). Quote it to support so the call can be found in the logs.
   */
  requestId?: string;
  /** The full JSON error body, for fields beyond `error`/`code`. */
  details?: Record<string, unknown>;
}

/** Alias of `APIError`: what a failed call returns in `error`. */
export type CredError = APIError;

// ============ Issue/Deduct Params ============

export interface IssueCreditsParams extends SignupAttribution {
  /** Your external id. The user is created if it doesn't exist. */
  user_id: string;
  amount: number;
  credit_type_id: string;
  /** Email — used to find or link the wallet (one email = one wallet). */
  user_email?: string;
  /** Display name — set when the user is created as part of this call. */
  user_name?: string;
  reason?: string;
  reference_id?: string;
  /**
   * Mint this issuance to a specific address, overriding the one on the user.
   * Only consulted when the credit type has `mint_on_issue` set.
   */
  wallet_address?: string;
}

export interface DeductCreditsParams extends SignupAttribution {
  /** Your external id (or an email). One of user_id / user_email is required. */
  user_id?: string;
  amount: number;
  credit_type_id: string;
  /** Email — looked up first. */
  user_email?: string;
  reason?: string;
  reference_id?: string;
}

/** What happened on-chain, when the credit type mints on issue. */
export interface MintSyncResult {
  /** `enqueued` means a mint row exists and a send was attempted. */
  status: "enqueued" | "skipped" | (string & {});
  mint_id?: string;
  transaction_hash?: string;
  /**
   * Why no mint happens. Present on `skipped` — a missing wallet address is
   * the usual answer, and the ledger issuance succeeded regardless.
   */
  reason?: string;
}

/** Response shape returned by `POST /credits-api/issue`. */
export interface IssueCreditsResponse {
  success: boolean;
  transaction_id: string;
  user_id: string;
  credit_type_id: string;
  amount_issued: number;
  new_balance: number;
  /** Present only when the credit type is on-chain and mints on issue (never on a replay). */
  on_chain?: MintSyncResult;
  /** True when the idempotency key was already used: nothing was issued again. */
  idempotent_replay?: boolean;
}

/** Response shape returned by `POST /credits-api/deduct`. */
export interface DeductCreditsResponse {
  success: boolean;
  transaction_id: string;
  user_id?: string;
  credit_type_id: string;
  amount_deducted: number;
  new_balance: number;
  /** True when the new balance fell below an auto top-up threshold and a charge was started. */
  auto_topup_triggered?: boolean;
  /** True when the idempotency key was already used: nothing was deducted again. */
  idempotent_replay?: boolean;
}

// ============ Wallet Types ============

export interface SetWalletParams {
  /** Your id for the user. */
  user_id?: string;
  /** Or look them up by email. */
  user_email?: string;
  /** Pass `null` to detach. */
  wallet_address: string | null;
}

export interface WalletChallengeParams {
  user_id?: string;
  user_email?: string;
  /** The address the user is claiming, from their connected wallet. */
  address: string;
}

export interface WalletChallengeResponse {
  /** Single-use, expires in ten minutes. Pass it back to `verify`. */
  nonce: string;
  /** Lowercased form of the address the challenge was issued for. */
  address: string;
  /** Show this to the user and have their wallet sign it, unmodified. */
  message: string;
  expires_at: string;
}

export interface WalletVerifyParams {
  nonce: string;
  /** `personal_sign` output over the challenge message. */
  signature: string;
  /** Optional guard: rejected if it is not the address the nonce was for. */
  address?: string;
  /** Chain the proof was signed on, recorded as provenance. */
  chain_id?: number;
}

export interface WalletVerifyResponse {
  verified: boolean;
  user: EndUser;
}

export interface GetWalletParams {
  user_id?: string;
  user_email?: string;
}

/** A token transfer the ingest pass observed against a deposit address. */
export interface TokenDeposit {
  id: string;
  credit_type_id: string;
  end_user_id: string | null;
  chain_id: number;
  contract_address: string;
  /** The wallet the tokens came from. Matched to a user by wallet_address. */
  from_address: string;
  to_address: string;
  /** Raw token units, as a decimal string — may exceed Number.MAX_SAFE_INTEGER. */
  amount_atomic: string;
  block_number: number;
  transaction_hash: string;
  log_index: number;
  /** The rate as it stood when this deposit was handled, not as it stands now. */
  credits_per_token: number;
  credits_granted: number;
  /**
   * `credited` — the ledger moved.
   * `unattributed` — tokens arrived from an address no user had claimed; held,
   *   not credited. Attaching the address to a user only matches later
   *   deposits; it does not credit this one.
   * `observed` — recorded, not yet credited.
   * `rejected` — failed a safety check; `reason` says which.
   */
  status: "observed" | "credited" | "unattributed" | "rejected";
  reason: string | null;
  created_at: string;
  credited_at: string | null;
}

export interface ListDepositsParams {
  user_id?: string;
  user_email?: string;
  credit_type_id?: string;
  status?: TokenDeposit["status"];
  transaction_hash?: string;
  limit?: number;
  offset?: number;
}

export interface ListDepositsResponse {
  deposits: TokenDeposit[];
  pagination: { limit: number; offset: number; total: number };
}

export interface WalletResponse {
  user_id: string;
  email?: string | null;
  wallet_address: string | null;
  /** Whether the holder ever signed for this address. */
  verified: boolean;
  verified_at: string | null;
}

export interface GetBalanceParams {
  user_id?: string;
  /** Look the balance up by email (tried before user_id). */
  email?: string;
  credit_type_id?: string;
}

export interface GetTransactionsParams {
  user_id?: string;
  /** Look transactions up by email (tried before user_id). */
  email?: string;
  credit_type_id?: string;
  /** Max 100 (default 50). */
  limit?: number;
  offset?: number;
}

// ============ Refund Types ============

export interface RefundParams {
  /** Refund a Stripe-backed credit purchase by its id. */
  purchase_id?: string;
  /** Refund a purchase located by its Stripe payment intent. */
  stripe_payment_intent_id?: string;
  /** Reverse a specific credit transaction by id. */
  transaction_id?: string;
  /** Reverse the most recent non-refund transaction with this reference. */
  reference_id?: string;
  /** Partial refund amount in credits. Defaults to the full original amount. */
  amount?: number;
  reason?: string;
  /**
   * Whether to also issue a Stripe money refund when the source is a charge.
   * Defaults to true. Set false to reverse credits only.
   */
  refund_payment?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RefundResponse {
  success: boolean;
  refund_transaction_id: string;
  user_id?: string;
  credit_type_id: string;
  refunded_credits: number;
  partial: boolean;
  new_balance: number | null;
  credits_clawed_back: boolean;
  payment_refunded: boolean;
  stripe_refund_id: string | null;
  source: "purchase" | "transaction";
  /** True when the idempotency key was already used: this is the first refund's result. */
  idempotent_replay?: boolean;
}

// ============ Swap Types ============

export interface SwapPair {
  id: string;
  source_credit_type_id: string;
  target_credit_type_id: string;
  exchange_rate: number;
  rate_type: "fixed" | "dynamic";
  min_swap_amount?: number;
  max_swap_amount?: number;
  fee_percent?: number;
  is_bidirectional: boolean;
  is_active: boolean;
  created_at: string;
  source_credit_type?: {
    id: string;
    name: string;
    symbol: string;
    project_id?: string;
  };
  target_credit_type?: {
    id: string;
    name: string;
    symbol: string;
    project_id?: string;
  };
}

/** Response shape returned by `POST /credits-api/swap`. */
export interface SwapResult {
  success: boolean;
  /** True when this idempotency key already ran the swap (no credits moved again). */
  idempotent_replay?: boolean;
  transaction: {
    id: string;
    direction?: "forward" | "reverse";
    source_amount: number;
    target_amount: number;
    fee_amount: number;
    exchange_rate: number;
    source_credit: { id: string; name: string; symbol: string; [key: string]: unknown };
    target_credit: { id: string; name: string; symbol: string; [key: string]: unknown };
  };
}

/** Response shape returned by `GET /credits-api/swap-pairs`. */
export interface SwapPairsResponse {
  swap_pairs: SwapPair[];
  total: number;
}

/** Parameters for `swaps.preview`. */
export interface PreviewSwapParams {
  swap_pair_id: string;
  source_amount: number;
  /** "reverse" previews spending the pair's target type (bidirectional pairs). */
  direction?: "forward" | "reverse";
}

/** Estimated swap result returned by `swaps.preview`. */
export interface SwapPreview {
  source_amount: number;
  target_amount: number;
  fee_amount: number;
  exchange_rate: number;
}

export interface GetSwapPairsParams {
  source_credit_type_id?: string;
  target_credit_type_id?: string;
  include_inactive?: boolean;
}

export interface ExecuteSwapParams {
  swap_pair_id: string;
  user_id?: string;
  /** Look the user up by email instead of user_id. */
  user_email?: string;
  source_amount: number;
  /**
   * "forward" (default) spends the pair's source type. "reverse" spends its
   * target type at 1/exchange_rate — only on is_bidirectional pairs.
   */
  direction?: "forward" | "reverse";
}

// ============ x402 Types ============

/** Response shape of the public `GET /credits-api/x402/supported` document. */
export interface X402SupportedResponse {
  x402Version: number;
  enabled: boolean;
  kinds: Array<{ x402Version: number; scheme: string; network: string }>;
  disabled_reason?: string | null;
  asset?: { address: string; name: string; decimals: number; network: string };
  facilitator?: string;
  facilitator_auth?: "api_key" | "none";
  platform_topup?: Record<string, unknown>;
  platform_packages?: Array<Record<string, unknown>>;
  /** Present when a project_id was passed. */
  project?: {
    project_id: string;
    accepts_x402: boolean;
    purchase_url?: string;
    credit_type?: { id: string; name: string; symbol: string };
    price_per_credit_usd?: number;
    min_credits?: number;
    max_credits?: number;
    pay_to?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface X402Receipt {
  id: string;
  kind: string;
  status: string;
  scheme: string | null;
  network: string | null;
  asset: string | null;
  pay_to: string | null;
  payer: string | null;
  amount_atomic: string | null;
  amount_usd: number | null;
  transaction_hash: string | null;
  resource: unknown;
  credit_type_id: string | null;
  credits_granted: number | null;
  error: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface ListX402ReceiptsParams {
  status?: string;
  /** Max 200 (default 50). */
  limit?: number;
}

export interface X402ReceiptsResponse {
  payments: X402Receipt[];
  count: number;
}

// ============ Referral Types ============

export interface ReferralSettings {
  id: string;
  is_active: boolean;
  referrer_credits: number;
  referee_credits: number;
  credit_type_id: string | null;
  /** The program requests without `credit_type_id` use (the project's first, unless another was made default). */
  is_default: boolean;
  credit_type_name?: string;
  credit_type_symbol?: string;
  created_at: string;
  updated_at: string;
}

/** Only the fields you send change (the first save fills the rest with defaults). */
export interface SaveReferralSettingsParams {
  is_active?: boolean;
  referrer_credits?: number;
  referee_credits?: number;
  /** `true` makes this program the default (the one requests without `credit_type_id` use). */
  is_default?: true;
  /**
   * Writes THAT credit type's program (one program per credit type; created on
   * first save). Omitted: the project's default program. `null` (or "") clears
   * the default program's credit type.
   */
  credit_type_id?: string | null;
}

/** Response shape returned by `referrals.getSettings`. */
export interface ReferralSettingsResponse {
  settings: ReferralSettings | null;
}

/** Response shape returned by `referrals.saveSettings`. */
export interface SaveReferralSettingsResponse {
  success: boolean;
  settings: ReferralSettings;
}

/** Parameters for `referrals.apply`. */
export interface ApplyReferralParams {
  user_id: string;
  referral_code: string;
  /** The credit type whose program pays. Omitted: the project's default program. */
  credit_type_id?: string;
  /** Pay the referee now and hold the referrer's credits until `referrals.complete`. */
  defer_referrer_credits?: boolean;
}

/** Parameters for `referrals.complete`. */
export interface CompleteReferralParams {
  /** The REFERRED user. */
  user_id: string;
  credit_type_id?: string;
}

/** Response shape returned by `referrals.complete`. */
export interface CompleteReferralResponse {
  success: boolean;
  referral_id: string;
  referrer_credits_issued: number;
  already_completed: boolean;
}

/** Parameters for `referrals.generateCode`. */
export interface GenerateReferralCodeParams {
  user_id: string;
}

/** Response shape returned by `referrals.apply`. */
export interface ApplyReferralResponse {
  success: boolean;
  referral_id: string;
  status: "completed" | "pending";
  credit_type_id: string;
  referrer_credits_issued: number;
  referee_credits_issued: number;
  /** Held until `referrals.complete` when applied with defer_referrer_credits. */
  referrer_credits_pending: number;
  /** A `credit_type_id` retry with the same code: the first referral, not a new one. */
  replayed?: boolean;
}

/** Response shape returned by `referrals.generateCode`. */
export interface GenerateReferralCodeResponse {
  success: boolean;
  user_id: string;
  referral_code: string;
}

export interface Referral {
  id: string;
  project_id: string;
  referral_code: string;
  referrer_user_id: string;
  referred_user_id: string;
  /** The program (credit type); null for referrals made before per-credit-type programs. */
  credit_type_id: string | null;
  status: string;
  referrer_credits_earned: number;
  referee_credits_earned: number;
  completed_at?: string;
  created_at: string;
}

export interface GetReferralsParams {
  status?: string;
  referrer_user_id?: string;
  referrer_email?: string;
  credit_type_id?: string;
  limit?: number;
  offset?: number;
}

/** Response shape returned by `referrals.list`. */
export interface ReferralsListResponse {
  referrals: Referral[];
  total: number;
  limit: number;
  offset: number;
}

// ============ Analytics Types ============

export interface SignupHostBreakdown {
  signup_host: string | null;
  total_users: number;
  total_purchases: number;
  total_revenue: number;
  [key: string]: unknown;
}

export interface SignupAnalyticsResponse {
  days: number | null;
  breakdown: SignupHostBreakdown[];
}

/** Response shape returned by `analytics.getSignupHosts`. */
export interface SignupHostsResponse {
  hosts: string[];
}

// ============ Escrow Types ============

export type EscrowHoldStatus = "held" | "released" | "captured" | "expired";

export interface EscrowHold {
  id: string;
  project_id: string;
  end_user_id: string;
  credit_type_id: string;
  amount: number;
  status: EscrowHoldStatus;
  reason?: string | null;
  reference_id?: string | null;
  captured_to_end_user_id?: string | null;
  captured_amount?: number | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

/** Response shape returned by `escrow.hold`. */
export interface HoldResponse {
  success: boolean;
  hold_id: string;
  /** "held" for a new hold; an idempotent replay reports the hold's current status. */
  status: "held" | "released" | "captured" | "expired" | (string & {});
  user_id: string;
  credit_type_id: string;
  amount: number;
  new_balance: number | null;
  /** True when this idempotency key already placed the hold (no second hold). */
  idempotent_replay?: boolean;
}

/** Response shape returned by `escrow.release`. */
export interface ReleaseHoldResponse {
  success: boolean;
  hold_id: string;
  status: "released";
  user_id: string;
  credit_type_id: string;
  amount: number;
  new_balance: number | null;
}

/** Response shape returned by `escrow.capture`. */
export interface CaptureHoldResponse {
  success: boolean;
  hold_id: string;
  status: "captured";
  credit_type_id: string;
  captured_amount: number;
  remainder_released: number;
  from_user_id: string;
  to_user_id: string | null;
  recipient_new_balance: number | null;
  holder_new_balance: number | null;
}

/** Response shape returned by `escrow.list`. */
export interface ListHoldsResponse {
  holds: EscrowHold[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateHoldParams {
  user_id?: string;
  user_email?: string;
  credit_type_id: string;
  amount: number;
  reason?: string;
  reference_id?: string;
  /**
   * Informational expiry timestamp (ISO). Stored on the hold for your own
   * logic; not automatically enforced server-side.
   */
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseHoldParams {
  hold_id: string;
  reason?: string;
}

export interface CaptureHoldParams {
  hold_id: string;
  /** Partial capture amount in credits. Defaults to the full held amount. */
  amount?: number;
  /** Settle the captured credits to a different end user (P2P / marketplace). */
  to_user_id?: string;
  to_user_email?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ListHoldsParams {
  status?: EscrowHoldStatus;
  user_id?: string;
  user_email?: string;
  reference_id?: string;
  limit?: number;
  offset?: number;
}
