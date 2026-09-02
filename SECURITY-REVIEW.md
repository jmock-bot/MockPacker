# Pre-release security review

Reviewed at commit `a4a210b`, ahead of a friends-and-family beta.

Full report, with reproduction output for each finding:
<https://claude.ai/code/artifact/b4fd281c-d942-4a37-9b58-85584a1b0024>

Findings marked **Proven** were reproduced end-to-end against a local PostgreSQL 16
instance running this repo's own policies and `security definer` functions, with
Supabase's `auth.uid()` emulated by a session variable. Findings marked *Observed*
are plain in the code but were not demonstrated against a live third-party service.

## Blocking — fix before sending invites

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| MP-01 | Any organizer can rewrite `trips.owner_id` to themselves, then delete the trip. Cascades take members, items, photos, shipments and chat with it. | Critical | Proven |
| MP-02 | Every member — viewers included — can read `invite_code` for unclaimed seats. A leaked organizer code redeemed by a second account chains into MP-01. Codes never expire and are not email-bound. | Critical | Proven |
| MP-03 | `chat_messages` never binds `author_id` to `auth.uid()`, so any contributor can post a message that renders as another member. | High | Proven |
| MP-04 | `packing_items.product_url` and `shipments.tracking_url` reach `href` unvalidated. React 18.3.1 renders `javascript:` URLs (warning only; blocking landed in React 19), so a stored link runs with the victim's session — and supabase-js keeps tokens in `localStorage`. | High | Proven |
| MP-05 | No security headers at all: no CSP, no `frame-ancestors`, no `nosniff`, no referrer policy. | High | Observed |

## Fix during the beta

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| MP-06 | Invite links — bearer credentials — are placed in a query string sent to `api.qrserver.com`. | Medium | Observed |
| MP-07 | Notification inserts never check that the *recipient* belongs to the trip. | Medium | Proven |
| MP-08 | An organizer can set their own role to `owner`, which hides the demote/remove controls from the real owner. | Medium | Proven |
| MP-09 | Buckets have no size or MIME limit; `avatars` is public, so arbitrary content can be hosted on the project's storage domain. | Medium | Observed |
| MP-10 | `/api/weather` is unauthenticated — an open proxy against your Netlify quota. | Medium | Observed |
| MP-11 | `product-search` rate limits in per-instance memory, so the cap on paid SerpAPI calls is far weaker than it appears. | Medium | Observed |

## Lower priority

`MP-12` spoofable display names on feed and comments · `MP-13` allergy and
body-measurement data readable by every co-traveler · `MP-14` Supabase dashboard
settings to confirm (email confirmation, leaked-password protection, OTP expiry,
redirect allowlist) · `MP-15` trip photos orphaned in storage after trip deletion.

## What this migration covers

`supabase/migrations/005_security_hardening.sql` fixes the findings that need no
frontend change: **MP-01**, **MP-07**, **MP-08**, **MP-09**, and the expiry half of
**MP-02**. Each fix was verified against the live test instance — the attack blocked,
and the legitimate flows it could have broken (an owner transferring their own trip,
an organizer renaming a trip, notifying a real co-member) confirmed still working.

Still outstanding after that migration, because each needs database and frontend
changes landing together:

- **MP-02 (rest)** — stop returning `invite_code` to clients; serve members through a
  view without the column and fetch a single code via a definer function that checks
  `can_organize()`. `GroupPage.tsx` reads `m.invite_code` directly.
- **MP-03** — the policy *cannot* simply be tightened to `author_id = auth.uid()`:
  `ImportChatModal.tsx` legitimately inserts rows with `author_id = null` and
  `kind = 'system'`. Move that seeding into a definer function first.
- **MP-04 / MP-05** — allowlist URL schemes before putting user-supplied links in
  `href`, and add security headers to `netlify.toml`. Note that a `script-src 'self'`
  policy will block the inline theme script in `index.html`.

## Verified sound

No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `document.write` anywhere in the
source. No secrets committed; `.env` correctly ignored; no server-side key reachable
from the browser bundle. RLS enabled on every table. JWTs verified locally against the
project JWKS rather than trusting a client-supplied id. The `redeem_trip_invite`
self-escalation guard works — a joined viewer cannot upgrade their own account with a
higher-privilege code. Row-pivot attacks against `trip_members` and `photos` are
blocked, because an omitted `WITH CHECK` falls back to the `USING` clause. The service
worker never caches application data and skips cross-origin requests. Dependencies are
current, legitimate and integrity-pinned.
