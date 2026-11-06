/**
 * Users API Module
 *
 * Manage end users in your credit system.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  CreateUserParams,
  CreateUserResponse,
  UpdateUserParams,
  UserResponse,
  ListUsersParams,
  ListUsersResponse,
  BulkUsersResponse,
  BalanceResponse,
} from "./types";

export class UsersAPI extends BaseResource {
  /**
   * Create or get an end user
   *
   * Users are identified primarily by email within a project.
   * If a user with the same email already exists, returns the existing user.
   * Falls back to external_id matching if no email is provided.
   *
   * This ensures one wallet per email across all your apps in a project.
   *
   * @example
   * ```typescript
   * // Recommended: Always provide email for wallet consistency
   * const user = await cred.users.createOrGet({
   *   external_id: 'auth0|123456',
   *   email: 'user@example.com',  // Primary identifier
   *   name: 'John Doe'
   * });
   *
   * // Same email from different app = same wallet
   * const sameWallet = await cred.users.createOrGet({
   *   external_id: 'app2_user_789',  // Different external_id
   *   email: 'user@example.com',      // Same email = same wallet
   *   name: 'John Doe'
   * });
   * ```
   */
  async createOrGet(params: CreateUserParams): Promise<APIResponse<CreateUserResponse>> {
    return this.post("/credits-api/users", this.withAppOrigin({ ...params }));
  }

  /**
   * Get a user by their external ID or email
   *
   * Pass an email (or a value containing "@") to look up by email; otherwise the
   * value is treated as an external_id.
   *
   * @example
   * ```typescript
   * const { data } = await cred.users.get('auth0|123456');
   * console.log(data?.user.email);
   * // A missing user fails with error.code === 'USER_NOT_FOUND' (404)
   * ```
   */
  async get(externalIdOrEmail: string): Promise<APIResponse<UserResponse>> {
    const isEmail = externalIdOrEmail.includes("@");
    return this.query(
      "/credits-api/users",
      isEmail
        ? { email: externalIdOrEmail }
        : { external_id: externalIdOrEmail },
    );
  }

  /**
   * Update a user's information. Only the fields you send change; a call with
   * no updatable field fails with `400 NO_FIELDS_TO_UPDATE`. `metadata` replaces
   * the stored object, except `referral_code` (kept unless you send it) and
   * `stripe_account_id` (Cred-only: a value you send is silently dropped).
   *
   * @example
   * ```typescript
   * const updated = await cred.users.update('auth0|123456', {
   *   name: 'Jane Doe',
   *   metadata: { plan: 'premium' }
   * });
   * ```
   */
  async update(
    externalId: string,
    params: UpdateUserParams,
  ): Promise<APIResponse<UserResponse>> {
    return this.patch("/credits-api/users", { ...params, external_id: externalId });
  }

  /**
   * List all users for the project
   *
   * @example
   * ```typescript
   * const users = await cred.users.list({ limit: 100 });
   * ```
   */
  async list(params: ListUsersParams = {}): Promise<APIResponse<ListUsersResponse>> {
    return this.query("/credits-api/users", { ...params });
  }

  /**
   * Bulk create or update users
   *
   * This is useful for syncing your existing users to CRED.
   * Users are matched first by email (if provided), then by external_id.
   * This ensures one wallet per email across all your apps.
   * Maximum 1000 users per request.
   *
   * @example
   * ```typescript
   * const result = await cred.users.bulkSync([
   *   { external_id: 'user_1', email: 'user1@example.com', name: 'User One' },
   *   { external_id: 'user_2', email: 'user2@example.com', name: 'User Two' },
   * ]);
   * console.log(`Created: ${result.data?.created}, Updated: ${result.data?.updated}`);
   * ```
   */
  async bulkSync(
    users: CreateUserParams[],
  ): Promise<APIResponse<BulkUsersResponse>> {
    // Rows without their own signup_url inherit the request-level app origin
    // (x-app-origin header, or the browser page URL added here).
    return this.post(
      "/credits-api/users/bulk",
      this.withAppOrigin({ users } as { users: CreateUserParams[]; signup_url?: string }),
    );
  }

  /**
   * Get a user's credit balances across all credit types
   *
   * @example
   * ```typescript
   * const balances = await cred.users.getBalances('auth0|123456');
   * ```
   */
  async getBalances(externalId: string): Promise<APIResponse<BalanceResponse>> {
    return this.query("/credits-api/balance", { user_id: externalId });
  }

  /**
   * Delete a user (and their credit balances). A user with swap history is
   * kept as a financial record: the call fails with `409 USER_HAS_HISTORY`.
   *
   * @example
   * ```typescript
   * await cred.users.delete('auth0|123456');
   * ```
   */
  async delete(externalId: string): Promise<APIResponse<{ success: boolean }>> {
    return this.del("/credits-api/users", { external_id: externalId });
  }
}
