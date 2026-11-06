# @cred-diy/sdk

TypeScript SDK for [cred.diy](https://cred.diy): issue, deduct and refund
application credits, sell them through hosted Stripe checkout or subscriptions,
charge saved cards, run auto top-up, and manage wallets, swaps, escrow, payouts
and referrals.

Docs: https://cred.diy/docs/sdk · API reference: https://cred.diy/docs/api-reference

## Installation

```bash
npm install @cred-diy/sdk
```

Runs on Node 18+, Deno, Bun, edge runtimes and the browser (anything with
`fetch`). Ships ESM and CommonJS builds with type declarations. **Keep your API
key on the server.**

```typescript
import { CredClient } from '@cred-diy/sdk';

const cred = new CredClient({
  apiKey: process.env.CRED_API_KEY!,      // sk_live_…
  appOrigin: 'https://app1.example.com',  // recommended on a server, see App Origin
});
```

The project is resolved from the API key. Every method resolves to
`{ success, data?, error? }` and never throws.

## User identity

Users are identified primarily by **email** within a project:

- One email = one wallet across all your apps and credit types in the project.
- `user_id` is your external id. If the same email arrives with different
  `user_id` values, they share one balance.
- Lookups try the email first (`user_email`, or a `user_id` containing `@`),
  then the external id.

## Credits

`credit_type_id` is required on issue and deduct (list them with
`cred.credits.listCreditTypes()`).

```typescript
// Issue (the user is created on first use)
const issued = await cred.credits.issue(
  {
    user_id: 'user_123',
    user_email: 'user@example.com',
    credit_type_id: 'ct_123',
    amount: 100,
    reason: 'Welcome bonus',
  },
  { idempotencyKey: 'welcome:user_123' },
);
if (issued.success) console.log(issued.data.new_balance);

// Deduct
const spent = await cred.credits.deduct(
  { user_id: 'user_123', credit_type_id: 'ct_123', amount: 10, reason: 'API call' },
  { idempotencyKey: `req:${requestId}` },
);
if (!spent.success) {
  if (spent.error?.code === 'INSUFFICIENT_CREDITS') { /* 400 — balance unchanged */ }
  if (spent.error?.code === 'USER_NOT_FOUND') { /* 404 */ }
}

// Balances (an unknown user returns balances: [])
const { data: bal } = await cred.credits.getBalance({ user_id: 'user_123' });
bal?.balances.forEach(b => console.log(b.credit_type_symbol, b.balance));

// History, newest first
const { data: tx } = await cred.credits.getTransactions({ user_id: 'user_123', limit: 50 });

// Credit types (exchange_rate is USD per credit)
const { data: types } = await cred.credits.listCreditTypes();
```

### Idempotency

`credits.issue`, `credits.deduct`, `credits.refund`, `swaps.execute`,
`escrow.hold` and `payouts.redeem` take an optional `{ idempotencyKey }` (sent
as the `Idempotency-Key` header, max 255 chars, else `400
INVALID_IDEMPOTENCY_KEY`). Retrying with the same key after a timeout returns
the first result with `idempotent_replay: true` and moves nothing again.
Reusing a key for a different request fails with `409 IDEMPOTENCY_KEY_REUSED`.
`paymentMethods.chargeSaved` **requires** a key (its replay says
`replayed: true`).

### Refunds

Refunds always reverse the credit ledger; for purchase-backed (Stripe) charges
they also refund the money unless `refund_payment: false`.

```typescript
await cred.credits.refund({ purchase_id: 'pur_123' }, { idempotencyKey: 'refund:pur_123' });
await cred.credits.refund({ stripe_payment_intent_id: 'pi_123' });
await cred.credits.refund({ transaction_id: 'txn_456', refund_payment: false }); // ledger only
await cred.credits.refund({ purchase_id: 'pur_123', amount: 25 });               // partial
```

## Checkout

Hosted Stripe checkout. Credits are issued when Stripe confirms the payment.

```typescript
// A pricing-tier package
const { data } = await cred.checkout.create({
  pricing_tier_id: 'tier_123',
  credit_type_id: 'ct_123',          // needed when the tier applies to several credit types
  user_id: 'user_456',
  user_email: 'buyer@example.com',
  quantity: 1,                       // seats/units, 1–10000
  success_url: 'https://myapp.com/success',
  cancel_url: 'https://myapp.com/cancel',
});
// redirect the buyer to data.checkout_url

// A custom amount, priced at the credit type's exchange_rate (USD per credit)
await cred.checkout.create({ credit_type_id: 'ct_123', amount: 500, user_id: 'user_456' });

// A monthly subscription — only when you send billing: 'recurring'
// (the tier's billing_type must be 'recurring' or 'both')
await cred.checkout.create({ pricing_tier_id: 'tier_123', user_id: 'user_456', billing: 'recurring' });

// Keep the card for off-session charges / auto top-up (one-time checkouts only)
await cred.checkout.create({ pricing_tier_id: 'tier_123', user_id: 'user_456', save_payment_method: true });
```

## Subscriptions

Subscriptions credit the user on every paid invoice.

```typescript
const { data } = await cred.subscriptions.list({ user_id: 'user_456', status: 'active' });

// Change seats — takes effect at the next renewal, no proration
await cred.subscriptions.updateQuantity({ user_id: 'user_456', quantity: 5 });

// Cancel at period end (default) or immediately
await cred.subscriptions.cancel({ subscription_id: 'sub_123', at_period_end: false });

// Short-lived Stripe portal link (mint it when the customer clicks)
const { data: portal } = await cred.subscriptions.portal({ user_id: 'user_456', return_url: 'https://myapp.com/billing' });
```

## Saved cards and auto top-up

A card is saved only by a one-time checkout sent with `save_payment_method: true`.

```typescript
const { data: card } = await cred.paymentMethods.get('user_456');   // { payment_method: { brand, last4, … } | null }

// Charge one pack of a one-time tier, buyer absent. The key is required:
// a retry with the same key returns the first outcome and never charges twice.
const charge = await cred.paymentMethods.chargeSaved(
  { user_id: 'user_456', pricing_tier_id: 'tier_123' },
  { idempotencyKey: `topup:user_456:${orderId}` },
);
if (charge.success) {
  // data.status: 'succeeded' (credits added) or 'processing' (credited when Stripe confirms)
} else if (charge.error?.errorCode === 'CARD_DECLINED') {
  // 402 — charge.error.code is Stripe's (card_declined, …); details has decline_code, purchase_id
} else if (charge.error?.errorCode === 'CARD_AUTHENTICATION_REQUIRED') {
  // 402 — the bank wants the buyer (3-D Secure): send them through checkout instead
}

await cred.paymentMethods.remove('user_456');

// Auto top-up: buy a pack whenever the balance drops below the threshold
await cred.autoTopUp.save({
  user_id: 'user_456',
  pricing_tier_id: 'tier_123',
  threshold: 50,
  max_per_day: 3,      // 1–100, default 5
});
const { data: rule } = await cred.autoTopUp.get({ user_id: 'user_456', credit_type_id: 'ct_123' });
const { data: rules } = await cred.autoTopUp.list('user_456');
await cred.autoTopUp.remove({ user_id: 'user_456' }); // omit credit_type_id to remove all
```

A deduct that crosses a threshold returns `auto_topup_triggered: true`.

## Pricing tiers

```typescript
// Active tiers, cheapest first; price is a 2-decimal string
const { data } = await cred.pricing.list({ credit_type_id: 'ct_123' });
data?.pricing_tiers.forEach(t => console.log(t.name, t.credits, t.price));

const { data: created } = await cred.pricing.create({
  name: 'Starter Pack',
  price: 9.99,
  credits: 100,
  billing_type: 'both',
  credit_type_ids: ['ct_123'], // omit or [] for every credit type
});
await cred.pricing.update(created!.pricing_tier.id, { is_popular: true });

// A tier that auto top-up rules buy is protected: 409 TIER_IN_USE with the rule count
const del = await cred.pricing.delete(created!.pricing_tier.id);
if (del.error?.code === 'TIER_IN_USE') {
  console.log(del.error.details?.auto_topup_rules); // rules that would go with it
  // After confirming, delete the tier and those rules in one transaction:
  await cred.pricing.delete(created!.pricing_tier.id, { force: true }); // data.auto_topup_rules_deleted
}
// Or keep history and stop selling it: update(id, { is_active: false })
```

## Users

```typescript
const { data } = await cred.users.createOrGet({
  external_id: 'auth0|123456',
  email: 'user@example.com',
  name: 'John Doe',
});
// data.user, data.created

const { data: found } = await cred.users.get('user@example.com'); // or an external id
await cred.users.update('auth0|123456', { name: 'Jane Doe' }); // nothing to change → 400 NO_FIELDS_TO_UPDATE
const { data: page } = await cred.users.list({ limit: 100, signup_host: 'app1.example.com' });
await cred.users.bulkSync([{ external_id: 'u1', email: 'u1@example.com' }]); // up to 1000
const { data: balances } = await cred.users.getBalances('auth0|123456');
await cred.users.delete('auth0|123456'); // 409 USER_HAS_HISTORY if the user has swapped
```

## Swaps

```typescript
const { data: pairs } = await cred.swaps.getPairs({ source_credit_type_id: 'ct_a' });
const { data: preview } = await cred.swaps.preview({ swap_pair_id: 'pair_1', source_amount: 100 }); // client-side estimate
const { data } = await cred.swaps.execute(
  { user_id: 'user_123', swap_pair_id: 'pair_1', source_amount: 100 },
  { idempotencyKey: 'swap:order_789' }, // a retry returns the first swap
);
console.log(data?.transaction.target_amount);

// Bidirectional pairs also swap target → source (else 400 SWAP_NOT_BIDIRECTIONAL)
await cred.swaps.execute({ user_id: 'user_123', swap_pair_id: 'pair_1', source_amount: 50, direction: 'reverse' });
```

## Cash payouts (redemption)

Requires an `is_redeemable` credit type with an `exchange_rate`, plus your own
Stripe key under **Payments → Your Own Keys**.

```typescript
const { data } = await cred.payouts.onboardPayoutAccount({
  user_id: 'user_123',
  return_url: 'https://myapp.com/payouts/done',
  refresh_url: 'https://myapp.com/payouts/retry',
});
// send the player to data.onboarding_url

const payout = await cred.payouts.redeem(
  { user_id: 'user_123', credit_type_id: 'ct_123', amount: 500, destination: data!.stripe_account_id },
  { idempotencyKey: 'redeem:order_789' },
);
if (payout.error?.code === 'PAYOUT_PENDING') {
  // 502: Stripe's answer was lost. Retry with the same key (details.idempotency_key)
  // to finish it — it never pays twice. Left alone, the reconciliation sweep settles
  // it after ~15 minutes; credits return only if Stripe definitely refused.
} else if (payout.error?.code === 'STRIPE_TRANSFER_FAILED') {
  // 402: Stripe refused; the credits are back on the balance
}
```

`destination` must be the user's own account from `onboardPayoutAccount`
(else `400 INVALID_DESTINATION`).

## Escrow / credit holds

```typescript
const { data: hold } = await cred.escrow.hold(
  { user_id: 'buyer', credit_type_id: 'ct_123', amount: 100, reference_id: 'order_789' },
  { idempotencyKey: 'hold:order_789' }, // a retry returns the same hold
);
await cred.escrow.capture({ hold_id: hold!.hold_id, to_user_id: 'seller' }); // remainder returns to the buyer
await cred.escrow.release({ hold_id: hold!.hold_id });
const { data: holds } = await cred.escrow.list({ status: 'held' });
```

## Wallets and on-chain credits

```typescript
// Assert an address (no proof)
await cred.wallets.set({ user_email: 'user@example.com', wallet_address: '0x1234…' });

// Or prove it: the holder signs a nonce the server chose
const { data: challenge } = await cred.wallets.challenge({ user_email: 'user@example.com', address });
const signature = await signer.signMessage(challenge!.message);
await cred.wallets.verify({ nonce: challenge!.nonce, signature });

const { data } = await cred.wallets.get({ user_email: 'user@example.com' }); // { wallet_address, verified, verified_at }
const { data: deposits } = await cred.wallets.deposits({ user_id: 'user_123' });
await cred.wallets.remove({ user_email: 'user@example.com' });
```

Issuing on a credit type that mints returns `on_chain` (`enqueued` or
`skipped` with a `reason`); the ledger issuance succeeds either way.
`listCreditTypes()` returns `contract_address`, `chain_id`, `token_decimals`
and `mint_on_issue`.

## Referrals

```typescript
await cred.referrals.saveSettings({ is_active: true, referrer_credits: 100, referee_credits: 50, credit_type_id: 'ct_123' });
const { data } = await cred.referrals.generateCode({ user_id: 'user_123' });
await cred.referrals.apply({ user_id: 'user_999', referral_code: data!.referral_code });
const { data: list } = await cred.referrals.list({ status: 'completed' });
```

## Analytics and x402

```typescript
const { data } = await cred.analytics.getSignupAnalytics(30); // per-signup-host users/purchases/revenue
const { data: hosts } = await cred.analytics.getSignupHosts();

const { data: x402 } = await cred.x402.supported('your_project_id'); // public capability document
const { data: receipts } = await cred.x402.receipts({ status: 'settled' });
```

## Error handling

```typescript
const result = await cred.credits.deduct({ user_id: 'user_123', credit_type_id: 'ct_123', amount: 10 });
if (!result.success) {
  result.error?.message; // the API's `error` text
  result.error?.code;      // e.g. INSUFFICIENT_CREDITS, USER_NOT_FOUND, IDEMPOTENCY_KEY_REUSED,
                           // or TIMEOUT / NETWORK_ERROR / INVALID_RESPONSE (see CredErrorCode)
  result.error?.errorCode; // CARD_DECLINED / CARD_AUTHENTICATION_REQUIRED on a charge-saved 402
  result.error?.status;    // HTTP status
  result.error?.requestId; // X-Request-Id — quote it to support
  result.error?.details;   // the full JSON error body
}
result.requestId;          // also set on successful responses
```

Codes that apply to every call:

| Status | `code` | Meaning |
| --- | --- | --- |
| 401 | `INVALID_API_KEY`, `API_KEY_DISABLED`, `API_KEY_EXPIRED` | Key unknown, switched off, or past its expiry — create a new key |
| 429 | `RATE_LIMITED` | Too many requests for this key; wait for `X-RateLimit-Reset`. Checked before the 1 CRD charge, so a 429 costs nothing |
| 402 | `PLATFORM_CREDITS_EXHAUSTED` | Your project's CRD platform balance is spent (`details.credits_remaining`); top up, or pay the x402 offer |
| 400 | `INVALID_IDEMPOTENCY_KEY` | `Idempotency-Key` longer than 255 characters |
| 409 | `IDEMPOTENCY_KEY_REUSED` | The key was already used for a different request |

Every response carries an `X-Request-Id` header and every error body a
`request_id`. Pass your own with `{ requestId }` (8–128 chars: letters, digits,
`. _ : -`) on any call that takes options, to correlate the call with your
logs:

```typescript
await cred.credits.deduct(params, { idempotencyKey: `req:${id}`, requestId: `req-${id}` });
```

## Configuration

```typescript
const cred = new CredClient({
  apiKey: 'sk_live_…',                    // required
  appOrigin: 'https://app1.example.com',  // x-app-origin; defaults to the page origin in a browser
  baseUrl: 'https://…/functions/v1',      // defaults to DEFAULT_BASE_URL (production)
  timeout: 60000,                         // ms, default 30000
  fetch: customFetch,                     // defaults to globalThis.fetch
  projectId: 'proj_…',                    // optional; sent as x-project-id for your logs only
});
```

## App origin

The app origin tells cred which of your apps a call came from, so signups can
be attributed per app. It is optional but recommended on `users.createOrGet`,
`users.bulkSync`, `credits.issue`, `credits.deduct` and `checkout.create`; calls
succeed without it and the user's attribution stays blank until a later call
fills it in.

In a browser the SDK sends the page origin as `x-app-origin` and defaults
`signup_url` to the current page URL (query string included). On a server
there is no page, so set `appOrigin` on the client, or pass `signup_url` /
`signup_host` per call (they win over the header):

```typescript
await cred.users.createOrGet({
  external_id: 'auth0|123456',
  email: 'user@example.com',
  signup_url: 'https://app1.example.com/signup?ref=twitter',
  signup_credit_type_id: 'ct_123',
});
```

Attribution is **first-touch**: recorded once and never overwritten (except by
an explicit `users.update`), so it is safe to send on every call.

## TypeScript

All request and response shapes are exported:

```typescript
import type {
  IssueCreditsResponse,
  DeductCreditsResponse,
  BalanceResponse,
  PricingTier,
  EndUser,
  CheckoutSession,
  CreditSubscription,
  ChargeSavedResponse,
  AutoTopUpRule,
  APIError,       // alias: CredError
  CredErrorCode,
  PayoutPendingDetails,
} from '@cred-diy/sdk';
```

## License

MIT
