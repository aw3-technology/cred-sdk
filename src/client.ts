/**
 * CRED SDK Client
 *
 * Main entry point for the CRED SDK. Runs anywhere `fetch` exists: Node 18+,
 * Deno, Bun, edge runtimes and the browser. Nothing here touches `window` at
 * import time, and browser-only defaults are feature-detected per call.
 */

import { CreditsAPI } from "./credits";
import { PricingAPI } from "./pricing";
import { UsersAPI } from "./users";
import { CheckoutAPI } from "./checkout";
import { SubscriptionsAPI } from "./subscriptions";
import { PaymentMethodsAPI } from "./paymentMethods";
import { AutoTopUpAPI } from "./autoTopUp";
import { SwapsAPI } from "./swaps";
import { PayoutsAPI } from "./payouts";
import { ReferralsAPI } from "./referrals";
import { AnalyticsAPI } from "./analytics";
import { EscrowAPI } from "./escrow";
import { WalletsAPI } from "./wallets";
import { X402API } from "./x402";
import { browserOrigin } from "./env";
import type { APIResponse, APIError } from "./types";

/** Production edge-functions base URL. Paths such as `/credits-api/issue` are appended. */
export const DEFAULT_BASE_URL =
  "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";

export interface CredClientConfig {
  /** Your CRED API key (`sk_live_…`). Keep it on the server. */
  apiKey: string;
  /**
   * Your CRED project ID. Optional: the API resolves the project from the API
   * key. When set it is sent as `x-project-id` for your own request logs.
   */
  projectId?: string;
  /** Base URL for the API (optional, defaults to production). */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /**
   * Your app's public origin (e.g. "https://yourapp.com"). Sent as the
   * `x-app-origin` header so cred can attribute signups to this app.
   *
   * In a browser this defaults to the page origin; on a server there is no
   * origin to infer, so set it explicitly. Calls without an app origin still
   * succeed — the user's signup attribution just stays blank.
   */
  appOrigin?: string;
  /**
   * A `fetch` implementation. Defaults to the global `fetch`. Pass one to use
   * a custom agent, add tracing, or run on a runtime without a global fetch.
   */
  fetch?: typeof fetch;
}

/** Per-call options for writes that accept an idempotency key. */
export interface RequestOptions {
  /**
   * Sent as the `Idempotency-Key` header (max 255 characters). A retry with
   * the same key returns the first result (`idempotent_replay: true`) instead
   * of moving credits or money again; reusing a key for a different request
   * fails with `409 IDEMPOTENCY_KEY_REUSED`.
   */
  idempotencyKey?: string;
  /**
   * Sent as the `X-Request-Id` header (8–128 characters: letters, digits and
   * `. _ : -`) so you can trace the call in your own logs and quote it to
   * support. Without one the API generates an id; either way it comes back as
   * `requestId` on the response (and on `error`).
   */
  requestId?: string;
}

export { browserLocation, browserOrigin } from "./env";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class CredClient {
  private readonly config: {
    apiKey: string;
    projectId?: string;
    baseUrl: string;
    timeout: number;
    appOrigin?: string;
    fetch?: typeof fetch;
  };

  /** Credits: issue, deduct, refund, balances, transactions, credit types */
  public readonly credits: CreditsAPI;
  /** Pricing tiers API */
  public readonly pricing: PricingAPI;
  /** End users API */
  public readonly users: UsersAPI;
  /** Hosted (Stripe) checkout — one-time, custom-amount and recurring */
  public readonly checkout: CheckoutAPI;
  /** Recurring credit subscriptions */
  public readonly subscriptions: SubscriptionsAPI;
  /** Saved cards and off-session charges (`POST /charge-saved`) */
  public readonly paymentMethods: PaymentMethodsAPI;
  /** Auto top-up rules */
  public readonly autoTopUp: AutoTopUpAPI;
  /** Swaps API */
  public readonly swaps: SwapsAPI;
  /** Cash payouts / credit redemption API */
  public readonly payouts: PayoutsAPI;
  /** Referral program API */
  public readonly referrals: ReferralsAPI;
  /** Signup attribution analytics API */
  public readonly analytics: AnalyticsAPI;
  /** Escrow / credit holds API */
  public readonly escrow: EscrowAPI;
  /** End-user wallets — attach or prove an address for on-chain credits */
  public readonly wallets: WalletsAPI;
  /** x402 discovery and payment receipts */
  public readonly x402: X402API;

  constructor(config: CredClientConfig) {
    if (!config || !config.apiKey) {
      throw new Error("CRED SDK: apiKey is required");
    }

    this.config = {
      apiKey: config.apiKey,
      projectId: config.projectId || undefined,
      baseUrl: (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeout: config.timeout || 30000,
      // In the browser, fetch also sets an Origin header the API can fall back
      // to; sending it explicitly keeps behaviour identical server-side.
      appOrigin: config.appOrigin || browserOrigin(),
      fetch: config.fetch,
    };

    this.credits = new CreditsAPI(this);
    this.pricing = new PricingAPI(this);
    this.users = new UsersAPI(this);
    this.checkout = new CheckoutAPI(this);
    this.subscriptions = new SubscriptionsAPI(this);
    this.paymentMethods = new PaymentMethodsAPI(this);
    this.autoTopUp = new AutoTopUpAPI(this);
    this.swaps = new SwapsAPI(this);
    this.payouts = new PayoutsAPI(this);
    this.referrals = new ReferralsAPI(this);
    this.analytics = new AnalyticsAPI(this);
    this.escrow = new EscrowAPI(this);
    this.wallets = new WalletsAPI(this);
    this.x402 = new X402API(this);
  }

  /**
   * Make an authenticated request to the CRED API.
   *
   * Never throws: failures come back as `{ success: false, error }`, where
   * `error.message`/`error.code` mirror the API's `error`/`code` fields and
   * `error.details` carries the full JSON error body (e.g. `decline_code` on a
   * declined `charge-saved`, `requested_amount` on `INSUFFICIENT_CREDITS`).
   * `requestId` (from the `X-Request-Id` response header, or the error body's
   * `request_id`) is set on the response and on `error` — quote it to support.
   */
  async request<T>(
    endpoint: string,
    options: {
      method?: HttpMethod;
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
      headers?: Record<string, string | undefined>;
    } = {},
  ): Promise<APIResponse<T>> {
    const { method = "GET", body, params } = options;

    let url = `${this.config.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) url += `?${queryString}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
    };
    if (this.config.projectId) headers["x-project-id"] = this.config.projectId;
    if (this.config.appOrigin) headers["x-app-origin"] = this.config.appOrigin;
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (value !== undefined) headers[key] = value;
    }

    // credits-api parses a JSON body on every POST/PATCH/DELETE and rejects an
    // empty one, so always send at least `{}` for those methods.
    const sendBody = method === "GET" ? undefined : JSON.stringify(body ?? {});

    const fetchImpl = this.config.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      return {
        success: false,
        error: { message: "No fetch implementation available; pass `fetch` in the client config", code: "NETWORK_ERROR" },
      };
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    const timeoutId = setTimeout(() => controller?.abort(), this.config.timeout);

    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body: sendBody,
        signal: controller?.signal,
      });

      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      // Every API response carries X-Request-Id; error bodies repeat it as
      // request_id (the header may be hidden by a proxy or CORS).
      const requestId =
        response.headers?.get?.("x-request-id") ||
        (typeof obj.request_id === "string" ? obj.request_id : undefined) ||
        undefined;

      if (!response.ok) {
        const error: APIError = {
          message:
            (typeof obj.error === "string" && obj.error) ||
            (typeof obj.message === "string" && obj.message) ||
            text.slice(0, 200) ||
            `HTTP ${response.status}`,
          code: typeof obj.code === "string" ? obj.code : undefined,
          ...(typeof obj.error_code === "string" && obj.error_code !== obj.code
            ? { errorCode: obj.error_code }
            : {}),
          status: response.status,
          ...(requestId ? { requestId } : {}),
          details: data && typeof data === "object" ? obj : undefined,
        };
        return { success: false, error, ...(requestId ? { requestId } : {}) };
      }

      if (data === null && text) {
        return {
          success: false,
          error: {
            message: "Invalid JSON in API response",
            code: "INVALID_RESPONSE",
            status: response.status,
            ...(requestId ? { requestId } : {}),
          },
          ...(requestId ? { requestId } : {}),
        };
      }

      return { success: true, data: data as T, ...(requestId ? { requestId } : {}) };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: { message: "Request timeout", code: "TIMEOUT" } };
      }
      return {
        success: false,
        error: {
          message: err instanceof Error ? err.message : "Network error",
          code: "NETWORK_ERROR",
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
