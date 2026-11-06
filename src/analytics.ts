/**
 * Analytics API Module
 *
 * Signup attribution analytics — breakdown of users, purchases, and revenue by
 * the host a user signed up from.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  SignupAnalyticsResponse,
  SignupHostsResponse,
} from "./types";

export class AnalyticsAPI extends BaseResource {
  /**
   * Get a signup-host breakdown of users, purchases, and revenue.
   *
   * @param days Window in days (default 30). Pass 0 for all time.
   *
   * @example
   * ```typescript
   * const { data } = await cred.analytics.getSignupAnalytics(30);
   * data?.breakdown.forEach(row => console.log(row.signup_host, row.total_users));
   * ```
   */
  async getSignupAnalytics(
    days?: number,
  ): Promise<APIResponse<SignupAnalyticsResponse>> {
    return this.query("/credits-api/signup-analytics", { days });
  }

  /**
   * List the distinct signup hosts observed for this project.
   *
   * @example
   * ```typescript
   * const { data } = await cred.analytics.getSignupHosts();
   * ```
   */
  async getSignupHosts(): Promise<APIResponse<SignupHostsResponse>> {
    return this.query("/credits-api/signup-hosts");
  }
}
