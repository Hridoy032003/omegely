# Shared Supabase setup

The admin and PWA apps already read the same Supabase project URL and
publishable key from their local environment files. Before enabling production
admin data, add the database migrations here and create the first admin user.

The Supabase secret key belongs only in `apps/admin/.env.local` and Vercel's
server environment. It must not be committed or used by the PWA.

Apply migrations `0001` through `0010` in order before enabling production
rewards. Migration `0010` adds server-side daily reward caps, delayed referral
qualification, anonymous safety reports, and public wallet policy settings.

For Razorpay coin purchases, also apply `0011_razorpay_coin_purchases.sql` and
set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and
`NEXT_PUBLIC_RAZORPAY_KEY_ID` in the public app's server environment. Configure
the Razorpay webhook URL as `/api/payments/razorpay/webhook` for
`payment.captured`, `order.paid`, and `payment.failed` events. Apply
`0012_anonymous_wallet_visibility.sql` as well so anonymous balances can be
shown in chat and claimed after sign-in. Use test-mode keys first; the initial
packs are defined in `src/lib/coin-packs.ts`.

Apply `0013_coin_ledger_hardening.sql` after `0012`. It adds atomic,
idempotent coin sends, withdrawal requests, admin credits, and withdrawal
review so concurrent requests cannot overwrite wallet balances.
