/**
 * Credits API Module
 *
 * Issue, deduct and refund credits, read balances and transaction history.
 */

import { BaseResource } from "./base";
import type { RequestOptions } from "./client";
import type {
  APIResponse,
  BalanceResponse,
  CreditTypesResponse,
  IssueCreditsParams,
  IssueCreditsResponse,
  DeductCreditsParams,
  DeductCreditsResponse,
  GetBalanceParams,
  GetTransactionsParams,
  TransactionsResponse,
  RefundParams,
  RefundResponse,
} from "./types";

export class CreditsAPI extends BaseResource {
  /**
   * Issue credits to a user (created on first use).
   *
   * Pass an `idempotencyKey` so a retry after a timeout can't issue twice: the
   * replay returns the first transaction with `idempotent_replay: true`.
   *
   * @example
   * ```typescript
   * const result = await cred.credits.issue(
   *   { user_id: 'user_123', credit_type_id: 'ct_123', amount: 100, reason: 'Welcome bonus' },
   *   { idempotencyKey: 'welcome:user_123' },
   * );
   * if (result.success) console.log(result.data.new_balance);
   * ```
   */
  async issue(
    params: IssueCreditsParams,
    options?: RequestOptions,
  ): Promise<APIResponse<IssueCreditsResponse>> {
    return this.post(
      "/credits-api/issue",
      this.withAppOrigin({ ...params }),
      this.idempotencyHeaders(options),
    );
  }

  /**
   * Deduct credits from a user.
   *
   * Fails with `400 INSUFFICIENT_CREDITS` (balance unchanged) or
   * `404 USER_NOT_FOUND`. Pass an `idempotencyKey` so a retry can't charge
   * twice.
   *
   * @example
   * ```typescript
   * const result = await cred.credits.deduct(
   *   { user_id: 'user_123', credit_type_id: 'ct_123', amount: 10, reason: 'API call' },
   *   { idempotencyKey: `req:${requestId}` },
   * );
   * if (!result.success && result.error?.code === 'INSUFFICIENT_CREDITS') {
   *   // prompt the user to top up
   * }
   * ```
   */
  async deduct(
    params: DeductCreditsParams,
    options?: RequestOptions,
  ): Promise<APIResponse<DeductCreditsResponse>> {
    return this.post(
      "/credits-api/deduct",
      this.withAppOrigin({ ...params }),
      this.idempotencyHeaders(options),
    );
  }

  /**
   * Refund credits (and, when the source is a Stripe purchase, the money too).
   *
   * Identify what to refund by one of: `purchase_id`,
   * `stripe_payment_intent_id`, `transaction_id`, or `reference_id`. The credit
   * ledger is always reversed; a Stripe money refund is issued for
   * purchase-backed charges unless `refund_payment: false`. With an
   * `idempotencyKey` a retry returns the first refund (`idempotent_replay`).
   *
   * @example
   * ```typescript
   * // Full refund of a purchase (money + credits)
   * await cred.credits.refund({ purchase_id: 'pur_123' }, { idempotencyKey: 'refund:pur_123' });
   *
   * // Reverse a spend without moving money
   * await cred.credits.refund({ transaction_id: 'txn_456', refund_payment: false });
   * ```
   */
  async refund(
    params: RefundParams,
    options?: RequestOptions,
  ): Promise<APIResponse<RefundResponse>> {
    return this.post("/credits-api/refund", { ...params }, this.idempotencyHeaders(options));
  }

  /**
   * Get a user's balances (all credit types, or one with `credit_type_id`).
   * An unknown user returns an empty `balances` array, not an error.
   *
   * @example
   * ```typescript
   * const { data } = await cred.credits.getBalance({ user_id: 'user_123' });
   * console.log(data?.balances);
   * ```
   */
  async getBalance(
    params: GetBalanceParams,
  ): Promise<APIResponse<BalanceResponse>> {
    return this.query("/credits-api/balance", { ...params });
  }

  /**
   * Get transaction history, newest first.
   *
   * @example
   * ```typescript
   * const { data } = await cred.credits.getTransactions({ user_id: 'user_123', limit: 50 });
   * data?.transactions.forEach(t => console.log(t.type, t.amount));
   * ```
   */
  async getTransactions(
    params: GetTransactionsParams = {},
  ): Promise<APIResponse<TransactionsResponse>> {
    return this.query("/credits-api/transactions", { ...params });
  }

  /**
   * List the project's active credit types.
   *
   * @example
   * ```typescript
   * const { data } = await cred.credits.listCreditTypes();
   * data?.credit_types.forEach(t => console.log(t.symbol, t.exchange_rate));
   * ```
   */
  async listCreditTypes(): Promise<APIResponse<CreditTypesResponse>> {
    return this.query("/credits-api/credit-types");
  }
}
