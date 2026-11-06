/**
 * Shared base class for resource API modules.
 *
 * Provides the `client` reference plus thin `query`/`post`/`patch`/`del`
 * helpers over `client.request`, so resource classes don't repeat the
 * `{ method, body }` / `{ method, params }` boilerplate.
 *
 * (The GET helper is named `query` rather than `get` so it doesn't collide
 * with resource methods that legitimately expose a public `get`, e.g.
 * `UsersAPI.get`.)
 *
 * Note: `client.request` drops `undefined` query params and body fields are
 * serialised with JSON.stringify (which drops `undefined` too), so callers
 * may pass params straight through.
 */

import type { CredClient, RequestOptions } from "./client";
import { browserLocation } from "./env";
import type { APIResponse } from "./types";

export abstract class BaseResource {
  constructor(protected client: CredClient) {}

  /**
   * Fill in `signup_url` from the current page when running in a browser and
   * the caller didn't supply one (or a `signup_host`), so first-touch
   * attribution records the exact landing URL (query string included).
   *
   * Server-side there is no page URL; those calls are attributed from the
   * client's `appOrigin` (`x-app-origin` header) instead.
   */
  protected withAppOrigin<T extends { signup_url?: string; signup_host?: string }>(params: T): T {
    if (params.signup_url || params.signup_host) return params;
    const href = browserLocation();
    return href ? { ...params, signup_url: href } : params;
  }

  /** Headers from per-call options: `Idempotency-Key` and `X-Request-Id`. */
  protected idempotencyHeaders(options?: RequestOptions): Record<string, string> | undefined {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    if (options?.requestId) headers["X-Request-Id"] = options.requestId;
    return Object.keys(headers).length ? headers : undefined;
  }

  /** Issue a GET request, forwarding query params (undefined values are dropped). */
  protected query<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<APIResponse<T>> {
    return this.client.request<T>(endpoint, { method: "GET", params });
  }

  /** Issue a POST request with a JSON body. */
  protected post<T>(
    endpoint: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<APIResponse<T>> {
    return this.client.request<T>(endpoint, { method: "POST", body, headers });
  }

  /** Issue a PATCH request with a JSON body. */
  protected patch<T>(endpoint: string, body: Record<string, unknown>): Promise<APIResponse<T>> {
    return this.client.request<T>(endpoint, { method: "PATCH", body });
  }

  /**
   * Issue a DELETE request with a JSON body (credits-api reads DELETE params
   * from the body, or from the query string when the body is empty).
   */
  protected del<T>(
    endpoint: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<APIResponse<T>> {
    return this.client.request<T>(endpoint, { method: "DELETE", body, headers });
  }
}
