/**
 * x402 API Module
 *
 * Read-side of x402 (HTTP 402 stablecoin payments): the public capability
 * document and this project's payment receipts. Paying for a request is done
 * by an x402 client library, which answers the 402 with a PAYMENT-SIGNATURE.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  X402SupportedResponse,
  ListX402ReceiptsParams,
  X402ReceiptsResponse,
} from "./types";

export class X402API extends BaseResource {
  /**
   * The public capability document (no API key needed server-side). Pass a
   * project id to include that project's price list for agent purchases.
   *
   * @example
   * ```typescript
   * const { data } = await cred.x402.supported('your_project_id');
   * console.log(data?.project?.accepts_x402);
   * ```
   */
  async supported(projectId?: string): Promise<APIResponse<X402SupportedResponse>> {
    return this.query("/credits-api/x402/supported", { project_id: projectId });
  }

  /**
   * x402 payments received by this project, newest first.
   *
   * @example
   * ```typescript
   * const { data } = await cred.x402.receipts({ status: 'settled', limit: 50 });
   * ```
   */
  async receipts(
    params: ListX402ReceiptsParams = {},
  ): Promise<APIResponse<X402ReceiptsResponse>> {
    return this.query("/credits-api/x402/receipts", { ...params });
  }
}
