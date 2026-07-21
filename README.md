# 🎒 MockPacker

**Pack together. Travel ready.**

MockPacker is a collaborative trip-planning and packing app for individuals,
families, couples, and groups: enter your trip's dates, destination, and
activities, and it generates a **personalized packing list**, builds a
**weather-aware daily outfit plan**, coordinates **themed days** across the
group, helps you **shop for missing items**, tracks **shipments** against your
departure date, and rolls everything into a single **Trip Readiness score**.

Built with **React + TypeScript + Vite + Tailwind CSS + Supabase**, deployed as
an installable **PWA** on **Netlify** with serverless **Netlify Functions**
(no permanently running server, no secret keys in the browser). The codebase
reuses the architecture, auth flow, design system, RLS patterns, PWA shell,
and serverless product-search of the Back2SchoMock project, generalized for
trip planning.

---

## Feature overview

| Area | What it does |
| --- | --- |
| **Trip creation** | 5-step wizard: basics (dates, transport, lodging, trip type), destination, travelers, activity picker (25+ activity types with dress code / setting / intensity / equipment), review → generates the packing list |
| **Packing engine** | Rule-based generator in `src/lib/packing.ts`: trip length, laundry availability, weather forecast, transport (flight → TSA liquids, boarding passes; car → snacks, chargers), lodging (camping gear, rental laundry), international travel (passport, adapters), activities (beach, ski, golf, hiking, formal, business…), trip type (family → kids' items), last-minute flags |
| **Packing checklist** | Grouped by 20 categories, filter by traveler/status, per-traveler progress, quantities, required/optional, duplicate, move category, reassign, notes, product link, price |
| **The Bag** | Trip inventory (not a checkout cart): Need → Considering → Own → Ordered → Shipped → Delivered, plus Packed. Purchases happen at the retailer via product links |
| **Daily plans** | A page per trip day: forecast (temp range, rain %, wind), activities with dress codes, group theme, per-traveler **What to Wear** recommendation (weather + activities + dress code + theme + duplicate-outfit avoidance), outfit options with photos, votes, and a "wear this" pick |
| **Group** | Invite by email / shareable link / QR; roles (Owner / Organizer / Traveler / Viewer) enforced by RLS; themed days with palettes + voting + approval; coordination board showing everyone's outfit side by side; private photo gallery with comments + reactions; live activity feed; realtime sync via Supabase channels |
| **Shopping** | Server-side product search (SerpAPI Google Shopping — never scrapes Google), filters (price, brand, size, color, store, category), compare tray, save to Bag with traveler/day/activity assignment |
| **Shipments** | Carrier + tracking + retailer + order number + ETA; status pipeline (Order placed → … → Delivered, plus Delayed/Exception/Returned); deep links to USPS/UPS/FedEx/DHL/Amazon tracking; **Delivery Risk** panel (arriving after/near departure, delayed, ordered-without-tracking, not-yet-ordered); linked Bag items follow shipment status |
| **Readiness** | Weighted score with breakdown (Packing, Shopping, Shipping, Documents, Outfits, Activity prep), per-traveler progress, and actionable alerts on the Home dashboard |
| **Auth & profiles** | Supabase Auth: email/password, magic link, **Google**, **Apple**; profile with photo, home location, sizes, fit, gender-neutral preference, colors, style/travel prefs, accessibility + care notes |
| **PWA** | Installable (Android/desktop native prompt, iOS instructions), offline app shell, scroll restoration, safe-area support, maroon backpack icon |
| **Demo** | One tap loads a seeded 4-traveler, 5-day beach trip: formal dinner, approved all-white theme day, packing progress, saved products, one delivered + one delayed shipment, outfit photos, comments, feed |

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migrations in order:
   1. [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql) — tables, enums, triggers, RLS, storage buckets
   2. [`supabase/migrations/002_demo.sql`](supabase/migrations/002_demo.sql) — the `seed_demo_trip()` function behind the "Load a demo trip" button

   > **Seeing `relation "trip_members" does not exist`?** The SQL Editor runs a
   > file as a single transaction: if any statement fails, the *entire*
   > migration rolls back and no tables are created, so every query afterwards
   > fails with an error like this. Pull the latest `001_schema.sql` (an older
   > version created a `profiles` policy before the `trip_members` table it
   > references) and re-run it in full, then `002_demo.sql`. If a piecemeal
   > run left partial objects behind, reset first:
   >
   > <details><summary>Reset snippet (deletes all MockPacker data!)</summary>
   >
   > ```sql
   > drop table if exists trip_feed, notifications, shipments, reactions,
   >   comments, photos, votes, themes, outfits, packing_items, activities,
   >   trip_stops, trip_members, trips, profiles cascade;
   > drop trigger if exists on_auth_user_created on auth.users;
   > drop function if exists handle_new_user, handle_new_trip, is_trip_member,
   >   trip_role_of, can_organize, can_contribute, redeem_trip_invite,
   >   seed_demo_trip cascade;
   > drop type if exists trip_role, trip_kind, bag_status, shipment_status, theme_status;
   > drop policy if exists "anyone reads avatars" on storage.objects;
   > drop policy if exists "user writes own avatar" on storage.objects;
   > drop policy if exists "user updates own avatar" on storage.objects;
   > drop policy if exists "user deletes own avatar" on storage.objects;
   > ```
   > </details>
3. **Authentication → Providers**: enable **Email**, **Google**, and **Apple**.
   For each OAuth provider, add its client ID/secret and set the Supabase
   callback URL in the provider's console:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. **Authentication → URL Configuration → Redirect URLs**: add your production
   Netlify domain, `http://localhost:8888`, and any preview URL pattern.
5. Copy the **Project URL** and your **API keys** from **Project Settings →
   API Keys**. MockPacker uses Supabase's new key format:
   - **publishable key** (`sb_publishable_…`) — the browser key, replaces the
     old anon key. Safe to expose; RLS protects the data.
   - **secret key** (`sb_secret_…`) — server-side only, replaces the old
     service-role key. Bypasses RLS. Only used by the Netlify Functions, and
     only for the legacy token-verification fallback (see below).

   The legacy **anon** and **service_role** keys still work as a fallback, so
   you can migrate on your own schedule.

### Security model (RLS)

- Every trip-scoped table is protected by Row Level Security: only **members
  of that trip** can read it, and write access is role-gated
  (`owner`/`organizer` for itinerary + members; any non-viewer for their own
  packing items, outfits, photos, comments, votes, shipments).
- Invitations are placeholder member rows with a random code; `redeem_trip_invite()`
  (security definer) atomically claims the row for the signed-in user.
- **Photos are private**: they live in the `trip-photos` bucket under
  `<trip_id>/…`, storage policies only allow that trip's members, and the app
  displays them through short-lived signed URLs. Avatars are public.
- **Function auth**: the Netlify Functions authenticate the caller with
  [`@supabase/server`](https://www.npmjs.com/package/@supabase/server), which
  verifies the user's JWT locally against the project's JWKS — no round-trip to
  the auth server and no secret key needed. The shared helper lives in
  `netlify/functions/_supabaseAuth.ts`. A secret / service-role key is used
  only for the legacy fallback that covers projects still issuing HS256 tokens.

---

## 2. Netlify deployment

[`netlify.toml`](netlify.toml) configures build, functions, SPA fallback, and
the `/api/*` alias.

### Environment variables (Site settings → Environment variables)

| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Builds + Functions | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Builds | Publishable key `sb_publishable_…` (browser key, safe to expose). Falls back to `VITE_SUPABASE_ANON_KEY` |
| `VITE_AUTH_REDIRECT_URL` | Builds | Optional; defaults to the current origin |
| `SUPABASE_URL` | Functions | Optional — Functions fall back to `VITE_SUPABASE_URL` |
| `SUPABASE_JWKS_URL` | Functions | Optional — derived from the project URL (`…/auth/v1/.well-known/jwks.json`) when unset |
| `SUPABASE_SECRET_KEY` | **Functions only** | Secret key `sb_secret_…`. **Never referenced by frontend code.** Optional — only the legacy HS256 fallback needs it. Falls back to `SUPABASE_SERVICE_ROLE_KEY` |
| `SERPAPI_KEY` | Functions | Optional — enables product search |
| `SEARCH_COUNTRY` | Functions | Optional — ISO country for results (default `us`) |
| `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` | Functions | Optional — live UPS tracking |
| `FEDEX_API_KEY` / `FEDEX_SECRET_KEY` | Functions | Optional — live FedEx tracking |
| `USPS_USER_ID` | Functions | Optional — live USPS tracking |
| `DHL_API_KEY` | Functions | Optional — live DHL tracking |
| `OPENWEATHER_API_KEY` | Functions | Optional — alternate weather provider |

A template lives in [`.env.example`](.env.example). **Without the optional
keys the app still runs** — search shows a clear "not connected yet" state,
shipping falls back to manual statuses + carrier deep links, and weather uses
keyless Open-Meteo directly.

### Netlify Functions

| Endpoint | Purpose |
| --- | --- |
| `POST /api/product-search` | Server-side product search (SerpAPI Google Shopping). Auth-required, rate-limited |
| `POST /api/track-shipment` | Carrier-API integration point (UPS/FedEx/USPS/DHL). Reports `configured:false` until credentials are set |
| `GET /api/weather` | Optional weather proxy (default provider Open-Meteo is keyless and called client-side) |

---

## 3. Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase values

npx netlify dev        # app + functions on one port (recommended)
# or
npm run dev            # frontend only (product search needs functions)
```

Type checking: `npm run typecheck`. Production build: `npm run build`.

---

## 4. Project structure

```
netlify/functions/     product-search, track-shipment, weather;
                       _supabaseAuth (shared @supabase/server token check)
public/                manifest.webmanifest, sw.js (offline shell), icons
supabase/migrations/   001 schema+RLS+storage · 002 demo seed function
src/
  lib/                 packing (list engine + what-to-wear), readiness (score),
                       weather (Open-Meteo), activities (catalog), statuses,
                       carriers, searchApi, format, supabase, types
  context/             AuthContext (email/OAuth/magic-link + profile),
                       TripContext (trips, members, items, outfits, themes,
                       photos, comments, shipments, feed, realtime sync),
                       ToastContext
  components/          ui (buttons/cards/modals/readiness ring), Layout,
                       shared (avatars, weather badge, photo + comment thread),
                       ItemFormModal, InstallPrompt, ScrollRestoration
  pages/               Login, Home (readiness dashboard), Trips, NewTrip
                       (wizard), Packing, Days (+ day detail with outfits),
                       Group (members/themes/board/photos), Bag, Search,
                       Shipments, Profile, Join
```

---

## 5. Phase status

- **Phase 1** — repository, reused components, auth, profiles, trip creation,
  invitations, packing generation, checklist, daily itinerary, weather,
  responsive dashboard: ✅
- **Phase 2** — outfit planning, themed days, photo uploads, comments,
  reactions, group voting, Bag inventory: ✅
- **Phase 3** — product search ✅ · comparison ✅ · shipping tracking (manual +
  deep links ✅, live carrier APIs stubbed server-side) · delivery-risk alerts ✅ ·
  in-app notifications (table + UI ✅; push/email designed as future channels)

## 6. Honest-data notes

- Prices and availability come from the search provider and can change at the
  retailer — the UI timestamps and labels them, and links out for purchase.
  MockPacker **does not process payments**.
- Weather beyond ~16 days shows "forecast not available yet" instead of
  guessing.
- Demo content is clearly labeled and isolated to a deletable demo trip.
