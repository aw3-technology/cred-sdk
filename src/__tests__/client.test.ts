import { afterEach, describe, expect, it, vi } from "vitest";
import { CredClient, DEFAULT_BASE_URL } from "../index";

const BASE = "https://api.test/functions/v1";

/** A client whose fetch records each call and answers with the queued responses. */
function setup(
  responses: Array<{ status?: number; body?: unknown; raw?: string; headers?: Record<string, string> }> = [{ body: {} }],
) {
  const queue = [...responses];
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift() ?? { body: {} };
    const text = next.raw ?? JSON.stringify(next.body ?? {});
    return new Response(text, {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json", ...(next.headers ?? {}) },
    });
  });
  const cred = new CredClient({
    apiKey: "sk_live_test",
    baseUrl: `${BASE}/`,
    appOrigin: "https://app.example.com",
    fetch: fetchMock as unknown as typeof fetch,
  });
  const call = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i];
    const headers = init.headers as Record<string, string>;
    return {
      url,
      method: init.method,
      headers,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
  };
  return { cred, fetchMock, call };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CredClient construction", () => {
  it("defaults to the production functions URL and needs only an API key", () => {
    expect(DEFAULT_BASE_URL).toBe("https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1");
    expect(() => new CredClient({ apiKey: "sk_live_x" })).not.toThrow();
    expect(() => new CredClient({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("sends x-api-key and x-app-origin, and no x-project-id unless configured", async () => {
    const { cred, call } = setup();
    await cred.credits.getBalance({ user_id: "u1" });
    const { url, method, headers, body } = call();
    expect(url).toBe(`${BASE}/credits-api/balance?user_id=u1`);
    expect(method).toBe("GET");
    expect(body).toBeUndefined();
    expect(headers["x-api-key"]).toBe("sk_live_test");
    expect(headers["x-app-origin"]).toBe("https://app.example.com");
    expect(headers).not.toHaveProperty("x-project-id");
    expect(headers).not.toHaveProperty("Idempotency-Key");
  });

  it("works server-side without window/document and adds no signup_url", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const cred = new CredClient({ apiKey: "sk_live_x", fetch: fetchMock as unknown as typeof fetch });
    await cred.credits.issue({ user_id: "u1", credit_type_id: "ct", amount: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("signup_url");
    expect(init.headers as Record<string, string>).not.toHaveProperty("x-app-origin");
  });

  it("in a browser, defaults x-app-origin and signup_url from the page", async () => {
    vi.stubGlobal("document", {});
    vi.stubGlobal("location", { href: "https://app.example.com/signup?ref=x", origin: "https://app.example.com" });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const cred = new CredClient({ apiKey: "sk_live_x", fetch: fetchMock as unknown as typeof fetch });
    await cred.credits.deduct({ user_id: "u1", credit_type_id: "ct", amount: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-app-origin"]).toBe("https://app.example.com");
    expect(JSON.parse(init.body as string).signup_url).toBe("https://app.example.com/signup?ref=x");
  });
});

describe("credits", () => {
  it("issue posts snake_case params with the Idempotency-Key header", async () => {
    const { cred, call } = setup([
      { body: { success: true, transaction_id: "t1", user_id: "u1", credit_type_id: "ct", amount_issued: 100, new_balance: 100, idempotent_replay: true } },
    ]);
    const res = await cred.credits.issue(
      { user_id: "u1", credit_type_id: "ct", amount: 100, reason: "welcome", user_email: "a@b.co", signup_credit_type_id: "ct" },
      { idempotencyKey: "welcome:u1" },
    );
    const { url, method, headers, body } = call();
    expect(url).toBe(`${BASE}/credits-api/issue`);
    expect(method).toBe("POST");
    expect(headers["Idempotency-Key"]).toBe("welcome:u1");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(body).toEqual({ user_id: "u1", credit_type_id: "ct", amount: 100, reason: "welcome", user_email: "a@b.co", signup_credit_type_id: "ct" });
    expect(res.success).toBe(true);
    expect(res.data?.idempotent_replay).toBe(true);
    expect(res.data?.new_balance).toBe(100);
  });

  it("deduct sends the key and surfaces 400 INSUFFICIENT_CREDITS with details", async () => {
    const { cred, call } = setup([
      { status: 400, body: { error: "Insufficient credits", code: "INSUFFICIENT_CREDITS", requested_amount: 10 } },
    ]);
    const res = await cred.credits.deduct(
      { user_email: "a@b.co", credit_type_id: "ct", amount: 10 },
      { idempotencyKey: "req-1" },
    );
    expect(call().url).toBe(`${BASE}/credits-api/deduct`);
    expect(call().headers["Idempotency-Key"]).toBe("req-1");
    expect(call().body).toEqual({ user_email: "a@b.co", credit_type_id: "ct", amount: 10 });
    expect(res.success).toBe(false);
    expect(res.error).toMatchObject({ message: "Insufficient credits", code: "INSUFFICIENT_CREDITS", status: 400 });
    expect(res.error?.details?.requested_amount).toBe(10);
  });

  it("deduct surfaces 404 USER_NOT_FOUND", async () => {
    const { cred } = setup([{ status: 404, body: { error: "User not found", code: "USER_NOT_FOUND" } }]);
    const res = await cred.credits.deduct({ user_id: "ghost", credit_type_id: "ct", amount: 1 });
    expect(res.error).toMatchObject({ code: "USER_NOT_FOUND", status: 404 });
  });

  it("refund posts to /credits-api/refund with the idempotency key", async () => {
    const { cred, call } = setup();
    await cred.credits.refund({ purchase_id: "p1", amount: 25, refund_payment: true }, { idempotencyKey: "refund:p1" });
    expect(call().url).toBe(`${BASE}/credits-api/refund`);
    expect(call().method).toBe("POST");
    expect(call().headers["Idempotency-Key"]).toBe("refund:p1");
    expect(call().body).toEqual({ purchase_id: "p1", amount: 25, refund_payment: true });
  });

  it("omits the Idempotency-Key header when no key is given", async () => {
    const { cred, call } = setup();
    await cred.credits.refund({ transaction_id: "t1", refund_payment: false });
    expect(call().headers).not.toHaveProperty("Idempotency-Key");
  });
});

describe("saved cards and auto top-up", () => {
  it("chargeSaved posts with the required key and returns a 202 processing result as success", async () => {
    const { cred, call } = setup([{ status: 202, body: { status: "processing", purchase_id: "p1", payment_intent_id: "pi_1" } }]);
    const res = await cred.paymentMethods.chargeSaved(
      { user_id: "u1", pricing_tier_id: "tier1", credit_type_id: "ct" },
      { idempotencyKey: "topup:u1:1" },
    );
    expect(call().url).toBe(`${BASE}/credits-api/charge-saved`);
    expect(call().method).toBe("POST");
    expect(call().headers["Idempotency-Key"]).toBe("topup:u1:1");
    expect(call().body).toEqual({ user_id: "u1", pricing_tier_id: "tier1", credit_type_id: "ct" });
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe("processing");
  });

  it("chargeSaved exposes a 402 decline's fields through error.details", async () => {
    const { cred } = setup([
      {
        status: 402,
        body: { status: "failed", code: "card_declined", decline_code: "insufficient_funds", message: "Your card was declined.", requires_action: false, purchase_id: "p1" },
      },
    ]);
    const res = await cred.paymentMethods.chargeSaved({ user_id: "u1", pricing_tier_id: "tier1" }, { idempotencyKey: "k" });
    expect(res.success).toBe(false);
    expect(res.error).toMatchObject({ message: "Your card was declined.", code: "card_declined", status: 402 });
    expect(res.error?.details).toMatchObject({ decline_code: "insufficient_funds", purchase_id: "p1", requires_action: false });
  });

  it("paymentMethods.get/remove use GET query and DELETE body", async () => {
    const { cred, call } = setup([{ body: { payment_method: null } }, { body: { deleted: true } }]);
    await cred.paymentMethods.get("u 1");
    await cred.paymentMethods.remove("u1");
    expect(call(0).url).toBe(`${BASE}/credits-api/payment-method?user_id=u+1`);
    expect(call(1)).toMatchObject({ url: `${BASE}/credits-api/payment-method`, method: "DELETE", body: { user_id: "u1" } });
  });

  it("autoTopUp save/get/list/remove hit /credits-api/auto-topup", async () => {
    const { cred, call } = setup([{ body: {} }, { body: {} }, { body: {} }, { body: { deleted: 1 } }]);
    await cred.autoTopUp.save({ user_id: "u1", pricing_tier_id: "tier1", threshold: 50, max_per_day: 3, enabled: true });
    await cred.autoTopUp.get({ user_id: "u1", credit_type_id: "ct" });
    await cred.autoTopUp.list("u1");
    await cred.autoTopUp.remove({ user_id: "u1" });
    expect(call(0)).toMatchObject({
      url: `${BASE}/credits-api/auto-topup`,
      method: "POST",
      body: { user_id: "u1", pricing_tier_id: "tier1", threshold: 50, max_per_day: 3, enabled: true },
    });
    expect(call(1).url).toBe(`${BASE}/credits-api/auto-topup?user_id=u1&credit_type_id=ct`);
    expect(call(2).url).toBe(`${BASE}/credits-api/auto-topup?user_id=u1`);
    expect(call(3)).toMatchObject({ method: "DELETE", body: { user_id: "u1" } });
  });
});

describe("checkout and subscriptions", () => {
  it("creates a recurring hosted checkout with tier + credit type", async () => {
    const { cred, call } = setup([{ body: { checkout_url: "https://checkout", url: "https://checkout", session_id: "cs_1", billing: "subscription" } }]);
    const res = await cred.checkout.create({
      user_id: "u1",
      user_email: "a@b.co",
      pricing_tier_id: "tier1",
      credit_type_id: "ct",
      quantity: 3,
      billing: "recurring",
      success_url: "https://app/ok",
    });
    expect(call().url).toBe(`${BASE}/hosted-checkout`);
    expect(call().method).toBe("POST");
    expect(call().headers["x-api-key"]).toBe("sk_live_test");
    expect(call().body).toEqual({
      user_id: "u1",
      user_email: "a@b.co",
      pricing_tier_id: "tier1",
      credit_type_id: "ct",
      quantity: 3,
      billing: "recurring",
      success_url: "https://app/ok",
    });
    expect(res.data?.billing).toBe("subscription");
  });

  it("sends save_payment_method and custom-amount fields", async () => {
    const { cred, call } = setup();
    await cred.checkout.create({ user_id: "u1", credit_type_id: "ct", amount: 500, save_payment_method: true });
    expect(call().body).toEqual({ user_id: "u1", credit_type_id: "ct", amount: 500, save_payment_method: true });
  });

  it("updates subscription quantity, cancels and opens the portal", async () => {
    const { cred, call } = setup([{ body: {} }, { body: {} }, { body: {} }, { body: {} }]);
    await cred.subscriptions.updateQuantity({ subscription_id: "sub_1", quantity: 5 });
    await cred.subscriptions.cancel({ user_id: "u1", at_period_end: false });
    await cred.subscriptions.portal({ email: "a@b.co", flow: "overview" });
    await cred.subscriptions.list({ user_id: "u1", status: "active" });
    expect(call(0)).toMatchObject({ url: `${BASE}/credits-api/subscriptions/quantity`, method: "POST", body: { subscription_id: "sub_1", quantity: 5 } });
    expect(call(1)).toMatchObject({ url: `${BASE}/credits-api/subscriptions/cancel`, body: { user_id: "u1", at_period_end: false } });
    expect(call(2)).toMatchObject({ url: `${BASE}/credits-api/subscriptions/portal`, body: { email: "a@b.co", flow: "overview" } });
    expect(call(3).url).toBe(`${BASE}/credits-api/subscriptions?user_id=u1&status=active`);
  });

  it("filters pricing tiers by credit type", async () => {
    const { cred, call } = setup();
    await cred.pricing.list({ credit_type_id: "ct" });
    expect(call().url).toBe(`${BASE}/credits-api/pricing-tiers?credit_type_id=ct`);
  });
});

describe("request ids and error codes", () => {
  it("surfaces X-Request-Id on success and on error (header or request_id body field)", async () => {
    const { cred } = setup([
      { body: { balances: [] }, headers: { "X-Request-Id": "req-ok-123" } },
      {
        status: 401,
        body: { error: "API key has expired", code: "API_KEY_EXPIRED", request_id: "req-body-456" },
      },
      {
        status: 429,
        body: { error: "Rate limit exceeded. Try again later.", code: "RATE_LIMITED", request_id: "req-body-789" },
        headers: { "X-Request-Id": "req-hdr-789" },
      },
    ]);
    const ok = await cred.credits.getBalance({ user_id: "u1" });
    expect(ok.requestId).toBe("req-ok-123");
    const expired = await cred.credits.getBalance({ user_id: "u1" });
    expect(expired.error).toMatchObject({ code: "API_KEY_EXPIRED", status: 401, requestId: "req-body-456" });
    expect(expired.requestId).toBe("req-body-456");
    const limited = await cred.credits.getBalance({ user_id: "u1" });
    expect(limited.error).toMatchObject({ code: "RATE_LIMITED", status: 429, requestId: "req-hdr-789" });
  });

  it("sends a caller-chosen X-Request-Id alongside the idempotency key", async () => {
    const { cred, call } = setup();
    await cred.credits.deduct({ user_id: "u1", credit_type_id: "ct", amount: 1 }, { idempotencyKey: "k1", requestId: "trace-0001" });
    expect(call().headers["X-Request-Id"]).toBe("trace-0001");
    expect(call().headers["Idempotency-Key"]).toBe("k1");
  });

  it("keeps Stripe's code and exposes error_code CARD_DECLINED separately", async () => {
    const { cred } = setup([
      {
        status: 402,
        body: { error: "Your card was declined.", error_code: "CARD_DECLINED", status: "failed", code: "card_declined", purchase_id: "p1" },
      },
    ]);
    const res = await cred.paymentMethods.chargeSaved({ user_id: "u1", pricing_tier_id: "tier1" }, { idempotencyKey: "k" });
    expect(res.error).toMatchObject({ code: "card_declined", errorCode: "CARD_DECLINED", status: 402 });
  });

  it("402 PLATFORM_CREDITS_EXHAUSTED keeps code without a duplicate errorCode", async () => {
    const { cred } = setup([
      { status: 402, body: { error: "Insufficient platform credits", code: "PLATFORM_CREDITS_EXHAUSTED", error_code: "PLATFORM_CREDITS_EXHAUSTED", credits_remaining: 0 } },
    ]);
    const res = await cred.credits.listCreditTypes();
    expect(res.error?.code).toBe("PLATFORM_CREDITS_EXHAUSTED");
    expect(res.error).not.toHaveProperty("errorCode");
    expect(res.error?.details?.credits_remaining).toBe(0);
  });

  it("pricing.delete sends force only when asked and surfaces 409 TIER_IN_USE", async () => {
    const { cred, call } = setup([
      { status: 409, body: { error: "Pricing tier is used by 2 auto top-up rules.", code: "TIER_IN_USE", auto_topup_rules: 2 } },
      { body: { success: true, deleted_id: "tier1", auto_topup_rules_deleted: 2 } },
    ]);
    const refused = await cred.pricing.delete("tier1");
    expect(call(0)).toMatchObject({ url: `${BASE}/credits-api/pricing-tiers`, method: "DELETE", body: { id: "tier1" } });
    expect(refused.error).toMatchObject({ code: "TIER_IN_USE", status: 409 });
    expect(refused.error?.details?.auto_topup_rules).toBe(2);
    const forced = await cred.pricing.delete("tier1", { force: true });
    expect(call(1).body).toEqual({ id: "tier1", force: true });
    expect(forced.data?.auto_topup_rules_deleted).toBe(2);
  });

  it("users update/delete surface NO_FIELDS_TO_UPDATE and USER_HAS_HISTORY", async () => {
    const { cred, call } = setup([
      { status: 400, body: { error: "No updatable fields provided.", code: "NO_FIELDS_TO_UPDATE" } },
      { status: 409, body: { error: "User has swap history", code: "USER_HAS_HISTORY", swap_transactions: 3 } },
    ]);
    const upd = await cred.users.update("u1", {});
    expect(call(0)).toMatchObject({ method: "PATCH", body: { external_id: "u1" } });
    expect(upd.error).toMatchObject({ code: "NO_FIELDS_TO_UPDATE", status: 400 });
    const del = await cred.users.delete("u1");
    expect(call(1)).toMatchObject({ method: "DELETE", body: { external_id: "u1" } });
    expect(del.error).toMatchObject({ code: "USER_HAS_HISTORY", status: 409 });
  });

  it("redeem sends the key and surfaces 502 PAYOUT_PENDING with the key to retry", async () => {
    const { cred, call } = setup([
      {
        status: 502,
        body: { error: "The payout's outcome is not known yet.", code: "PAYOUT_PENDING", stripe_error: "timeout", transaction_id: "t1", idempotency_key: "redeem:o1", request_id: "rid-12345678" },
      },
    ]);
    const res = await cred.payouts.redeem(
      { user_id: "u1", credit_type_id: "ct", amount: 500, destination: "acct_1" },
      { idempotencyKey: "redeem:o1" },
    );
    expect(call()).toMatchObject({ url: `${BASE}/credits-api/redeem`, method: "POST" });
    expect(call().headers["Idempotency-Key"]).toBe("redeem:o1");
    expect(res.error).toMatchObject({ code: "PAYOUT_PENDING", status: 502, requestId: "rid-12345678" });
    expect(res.error?.details).toMatchObject({ transaction_id: "t1", idempotency_key: "redeem:o1" });
  });

  it("swaps.execute sends direction + key; escrow.hold sends the key", async () => {
    const { cred, call } = setup([
      { status: 400, body: { error: "This swap pair is one-way", code: "SWAP_NOT_BIDIRECTIONAL" } },
      { body: { success: true, hold_id: "h1", status: "held", idempotent_replay: true } },
    ]);
    const swap = await cred.swaps.execute(
      { swap_pair_id: "pair1", user_id: "u1", source_amount: 10, direction: "reverse" },
      { idempotencyKey: "swap:1" },
    );
    expect(call(0)).toMatchObject({
      url: `${BASE}/credits-api/swap`,
      body: { swap_pair_id: "pair1", user_id: "u1", source_amount: 10, direction: "reverse" },
    });
    expect(call(0).headers["Idempotency-Key"]).toBe("swap:1");
    expect(swap.error?.code).toBe("SWAP_NOT_BIDIRECTIONAL");
    const hold = await cred.escrow.hold({ user_id: "u1", credit_type_id: "ct", amount: 5 }, { idempotencyKey: "hold:1" });
    expect(call(1).url).toBe(`${BASE}/credits-api/escrow/hold`);
    expect(call(1).headers["Idempotency-Key"]).toBe("hold:1");
    expect(hold.data?.idempotent_replay).toBe(true);
  });
});

describe("transport errors", () => {
  it("maps a non-JSON error body to a message with the HTTP status", async () => {
    const { cred } = setup([{ status: 502, raw: "Bad Gateway" }]);
    const res = await cred.credits.getBalance({ user_id: "u1" });
    expect(res.error).toMatchObject({ message: "Bad Gateway", status: 502 });
  });

  it("maps a thrown fetch to NETWORK_ERROR", async () => {
    const cred = new CredClient({
      apiKey: "sk_live_x",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    const res = await cred.credits.listCreditTypes();
    expect(res.error).toMatchObject({ code: "NETWORK_ERROR", message: "fetch failed" });
  });
});
