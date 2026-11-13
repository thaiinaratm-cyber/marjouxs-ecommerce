# Admin orders and paid-order notification: initial audit

Date: 2026-10-17. The approved claim RPC change was applied and verified.
See `admin-orders-validation.md` for implementation and local validation status.

## Approved claim change: applied

The approved CREATE OR REPLACE was executed successfully. A before/after
metadata comparison confirmed identical arguments, return type, SECURITY
DEFINER, search_path, owner and ACL (postgres and service_role execution).
The function body changed only by adding order.paid to the event allowlist.
Locks, stale-lock recovery after 10 minutes, attempt_count and retry selection
were byte-equivalent after normalizing line endings. Outbox count remained
zero, with the same empty-set digest before and after. No actual claim was
executed. No further SQL, RLS, schema, or scheduler change is part of the local
implementation. The historical approval gates below are retained as audit
history, not as a statement that the approved change is still pending.

## Post-migration read-only verification

The Supabase SQL Editor became accessible. A metadata-only SELECT confirmed:

- `ecommerce_integration_outbox_event_type_ck` accepts ga4_purchase,
  erp_financial and order.paid.
- `ecommerce_integration_outbox_order_event_key` remains UNIQUE
  (order_id, event_type).
- Outbox status remains pending/processing/failed/processed; lock,
  processed_at and attempt_count constraints remain present.
- RLS is enabled on all four tables. No policies were returned for them;
  a session-scoped admin client alone is not evidence of order access.
- ecommerce_claim_outbox still explicitly rejects event types other than
  ga4_purchase and erp_financial with SQLSTATE 22023, Unknown outbox event type.
- Claim retains FOR UPDATE SKIP LOCKED, attempt increment, lock token,
  locked_at and recovery of processing locks older than 10 minutes.
- Complete uses event id + lock token and writes processed_at.
- Fail uses event id + lock token, clears locks and schedules exponential
  backoff from 30 seconds capped at 3600 seconds.
- ecommerce_confirm_payment writes paid status and currently inserts only
  ga4_purchase and erp_financial. It does not create order.paid.
- Existing order_status CHECK matches the nine values confirmed by the user.

The function bodies were read, not executed. The event_type constraint was
already changed by the user; this session has made no database writes.
Without a previous definition snapshot, unchanged function bodies cannot
be proven byte-for-byte; their current behavior was inspected directly.

Approval required: `order-paid-claim-outbox.proposed.sql` changes only the
hardcoded event allowlist inside the installed claim function. It preserves
the existing signature, defaults, return type, SECURITY DEFINER, empty
search_path, lock recovery, retry selection and update logic. CREATE OR
REPLACE retains existing ownership and grants. The companion rollback
restores the read function without deleting events. Do not apply either
file automatically. No admin routes, worker changes or email sending have
been implemented while this approval gate is pending.

The sections below record the initial audit before SQL Editor access was
restored; the verified findings above supersede their pending-read notes.

## Evidence and limits

The configured Supabase project's live PostgREST OpenAPI metadata was read
using the server-side credential. No customer rows were requested and no RPC
was called. The metadata confirms the columns and RPC argument types below.
It does not establish CHECK definitions, allowed status values, table grants,
RLS policies, unique indexes, trigger behavior, or function bodies.

The SQL Editor was opened, but browser automation timed out. The accompanying
`admin-orders-schema-audit.sql` retrieves only metadata to complete this audit.
It contains a single SELECT and does not execute any business function.

## Confirmed live columns

All monetary values below are bigint cents unless stated otherwise.
`required` in OpenAPI identifies non-null fields; generated columns need the
SQL audit to establish their generation expressions.

### public.ecommerce_orders

- UUIDs: id, public_token, shipping_quote_id.
- Identity: order_sequence (bigint), order_number (text),
  checkout_idempotency_key (text), checkout_request_hash (text), store_id (text).
- Customer text: customer_name, customer_phone, customer_email, customer_cpf.
- Delivery text: delivery_method, shipping_zip, shipping_street,
  shipping_number, shipping_complement, shipping_neighborhood, shipping_city,
  shipping_state, shipping_provider, shipping_carrier, shipping_service,
  shipping_service_id.
- Delivery timing: shipping_quoted_at (timestamptz),
  shipping_deadline_days (integer).
- Amounts: subtotal_cents, shipping_cents, discount_cents, total_cents.
- Payment text: payment_provider, payment_method, payment_status.
- Operational status: order_status (text, default pending_payment).
- Analytics text: ga_client_id, ga_session_id.
- Timestamps: paid_at, created_at, updated_at (timestamptz).
- No tracking column exists in this table's live API definition.
- Defaults include store_id=marjouxs, payment_provider=infinitepay,
  payment_status=pending, shipping_cents=0, discount_cents=0.

### public.ecommerce_order_items

- UUIDs: id, order_id (foreign key to ecommerce_orders).
- line_number (integer).
- Snapshot text: product_id, product_slug, product_name, product_image,
  category, subcategory, material, availability.
- Amounts: unit_price_cents, subtotal_cents; quantity (integer).
- customization (jsonb): documented as holding two alliance ring sizes
  from 8 to 35 and optional Unicode engravings.
- created_at (timestamptz).
- No separate sale_unit column is exposed. Do not infer an item's historical
  sale unit from today's catalog; inspect the existing snapshot contract.

### public.ecommerce_payment_attempts

- UUIDs: id, order_id (foreign key to ecommerce_orders).
- Text: provider, idempotency_key, order_nsu, checkout_url,
  provider_checkout_id, transaction_nsu, status, capture_method, receipt_url,
  verification_source, failure_code, failure_detail.
- Amounts: requested_amount_cents, provider_amount_cents, paid_amount_cents.
- installments (integer).
- Booleans: payment_verified, verification_success, verification_paid.
- JSONB: request_metadata, response_metadata.
- Timestamps: verification_checked_at, confirmed_at, created_at, updated_at.
- There is no paid_at column here; order.paid_at and the attempt's
  confirmed_at must be interpreted according to the actual confirmation RPC.
- Defaults: provider=infinitepay, status=creating, payment_verified=false.

### public.ecommerce_integration_outbox

- UUIDs: id, order_id (foreign key to ecommerce_orders), lock_token.
- Text: event_type, status, last_error.
- payload (jsonb), attempt_count (integer).
- Timestamps: locked_at, next_attempt_at, created_at, processed_at.
- Defaults: status=pending, attempt_count=0, next_attempt_at=now().
- The columns support retry/locking in principle. Allowed event types,
  uniqueness, expired-lock recovery, and status values remain unverified.

## Existing payment flow in code

1. `lib/checkout/create-checkout.ts` recalculates the order, then invokes
   ecommerce_create_checkout before asking InfinitePay to generate a link.
2. The returned attempt is used by createInfinitePayCheckout; the link is
   registered through ecommerce_set_checkout_link.
3. `app/api/payments/infinitepay/webhook/route.ts` validates the webhook,
   finds the stored attempt by order_nsu, and calls the provider's official
   payment_check server-to-server.
4. It requires success=true, paid=true, paid_amount>0, and amount equal to
   the stored requested_amount_cents. A mismatch is marked for review.
5. Only then does it invoke ecommerce_confirm_payment. The backend accepts
   paid/already_paid/order_already_paid responses. The SQL body is the missing
   evidence for exactly which order/attempt fields and events are persisted.
6. Opening the confirmation page or generating a link is not a paid sale.

## Existing outbox processing

- `lib/checkout/outbox.ts` claims ga4_purchase events only, through
  ecommerce_claim_outbox(p_event_types, p_limit).
- Completion requires ecommerce_complete_outbox(p_event_id, p_lock_token).
- Failure uses ecommerce_fail_outbox(p_event_id, p_lock_token, p_error).
- Its TypeScript event type mentions ga4_purchase and erp_financial;
  this is not evidence of the actual SQL event_type constraint.
- `netlify/functions/process-ecommerce-outbox.ts` already declares a
  */5 * * * * schedule. No new cron or configuration change was made.
- order.paid/email processing is not implemented in this worker today.

## Pending approval gates

Before implementing the requested feature, inspect the SQL audit for:

1. Reusable operational order_status values and allowed transitions.
2. Authenticated admin SELECT and narrowly scoped UPDATE permissions;
   ensure order edits cannot modify payment confirmation or amounts.
3. Existing unique key for order_id + event_type.
4. Whether order.paid is allowed and atomically produced on first payment.
5. Claim/complete/fail behavior, including expired locks and retry limits.
6. Whether any existing trigger already produces the required event.

If a CHECK, policy, RPC, index, or structural payment change is needed, provide
the exact proposed SQL, impact and rollback and wait for approval. No such
change has been applied. Do not claim payment notification durability based
on a best-effort insert after the confirmation RPC.

## Proposed implementation once the audit is complete

- Reuse server-side admin authentication for /admin/pedidos and its detail.
- Read snapshots from orders/items/attempts, never current catalog products.
- Use the existing order_status if its confirmed SQL contract supports it.
- Do not show empty tracking fields or invent tracking for store pickup.
- Reuse outbox locking, pending/failed retry and idempotency if confirmed.
- Prefer Resend if a repository-wide provider check confirms none exists.
- Notification disabled by default; no production email during development.
- Expected server-only configuration: RESEND_API_KEY,
  ORDER_NOTIFICATION_EMAIL, ORDER_NOTIFICATION_FROM,
  ORDER_NOTIFICATIONS_ENABLED=false. Reuse existing canonical site URL config
  rather than introduce another SITE_URL unless necessary.
- Email failure must not revert paid status or break checkout.
- Do not change the InfinitePay contract or the existing worker schedule.

## Current delivery status

- No application route, payment code, schema, policy, product, or env changed.
- Only these audit documents were added.
- No payment, test order, notification, commit, push, or deploy was created.
- Tests/lint/TypeScript/build were not rerun: implementation has not begun.
- Manual panel/email tests remain pending, not passed.
