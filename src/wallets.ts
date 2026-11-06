/**
 * Wallets API Module
 *
 * Attach an EVM address to one of your end users, so that on-chain credit
 * types have somewhere to mint.
 *
 * Two ways in, and the difference is recorded on the user:
 *
 *   set()                      you assert the address. One call, no signature,
 *                              worth exactly what your own checks are worth.
 *   challenge() → verify()     the holder signs a nonce this server chose, and
 *                              `verified` comes back true.
 *
 * Either is enough to receive a mint. Verification exists so that an operator
 * who cares can tell the two apart — and so that a wallet-connect flow in your
 * app can prove an address without sending your users to Cred.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  WalletChallengeParams,
  WalletChallengeResponse,
  WalletVerifyParams,
  WalletVerifyResponse,
  GetWalletParams,
  WalletResponse,
  SetWalletParams,
  ListDepositsParams,
  ListDepositsResponse,
  EndUser,
} from "./types";

export class WalletsAPI extends BaseResource {
  /**
   * Attach an address without a signature. The user must already exist.
   *
   * Changing the address clears any previous verification, because the new one
   * has not been signed for.
   *
   * @example
   * ```typescript
   * await cred.wallets.set({
   *   user_id: 'user_123',
   *   wallet_address: '0xAbC…',
   * });
   * ```
   */
  async set(params: SetWalletParams): Promise<APIResponse<{ user: EndUser }>> {
    const { user_id, user_email, wallet_address } = params;
    return this.client.request("/credits-api/users", {
      method: "PATCH",
      body: {
        external_id: user_id,
        user_email,
        wallet_address,
      },
    });
  }

  /**
   * Step 1 of proving an address: ask for a message to sign.
   *
   * The returned `message` is written to be read by a human in a wallet popup
   * and names your project, not Cred. Show it as-is.
   *
   * @example
   * ```typescript
   * const { data } = await cred.wallets.challenge({
   *   user_id: 'user_123',
   *   address: await signer.getAddress(),
   * });
   * const signature = await signer.signMessage(data!.message);
   * ```
   */
  async challenge(
    params: WalletChallengeParams,
  ): Promise<APIResponse<WalletChallengeResponse>> {
    const { user_id, user_email, address } = params;
    return this.post("/credits-api/wallet/challenge", {
      external_id: user_id,
      user_email,
      address,
    });
  }

  /**
   * Step 2: hand back the signature. On success the address is stored and
   * marked verified.
   *
   * A challenge is single-use and expires in ten minutes — a rejected
   * signature consumes it too, so a failed attempt needs a fresh challenge.
   *
   * @example
   * ```typescript
   * const { data } = await cred.wallets.verify({
   *   nonce: challenge.nonce,
   *   signature,
   *   address,
   * });
   * ```
   */
  async verify(
    params: WalletVerifyParams,
  ): Promise<APIResponse<WalletVerifyResponse>> {
    return this.post("/credits-api/wallet/verify", { ...params });
  }

  /**
   * Read the address on file for a user, and whether it was ever proved.
   *
   * @example
   * ```typescript
   * const { data } = await cred.wallets.get({ user_id: 'user_123' });
   * if (!data?.wallet_address) promptToConnectWallet();
   * ```
   */
  async get(params: GetWalletParams): Promise<APIResponse<WalletResponse>> {
    return this.query("/credits-api/wallet", {
      external_id: params.user_id,
      email: params.user_email,
    });
  }

  /**
   * List token deposits observed against your deposit addresses.
   *
   * Read-only — deposits are written by the on-chain ingest pass, never
   * asserted by a caller. Render `unattributed` rows too: those are tokens that
   * arrived from an address no user has claimed, and they stay uncredited until
   * someone attaches that address to a user.
   *
   * @example
   * ```typescript
   * const { data } = await cred.wallets.deposits({ user_id: 'user_123' });
   * const stuck = data?.deposits.filter(d => d.status === 'unattributed');
   * ```
   */
  async deposits(
    params: ListDepositsParams = {},
  ): Promise<APIResponse<ListDepositsResponse>> {
    return this.query("/credits-api/deposits", {
      user_id: params.user_id,
      email: params.user_email,
      credit_type_id: params.credit_type_id,
      status: params.status,
      transaction_hash: params.transaction_hash,
      limit: params.limit,
      offset: params.offset,
    });
  }

  /**
   * Detach the address. Ledger balances are untouched, and tokens already
   * minted stay in the wallet they were sent to.
   *
   * @example
   * ```typescript
   * await cred.wallets.remove({ user_id: 'user_123' });
   * ```
   */
  async remove(
    params: GetWalletParams,
  ): Promise<APIResponse<{ success: boolean; wallet_address: null }>> {
    return this.client.request("/credits-api/wallet", {
      method: "DELETE",
      body: { external_id: params.user_id, user_email: params.user_email },
    });
  }
}
