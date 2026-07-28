/**
 * POST /api/product-search   { query, filters? }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Server-side product search so the shopping-data credentials never reach the
 * browser. MockPacker never scrapes Google directly — it calls an approved
 * provider. Any one of these turns search on:
 *
 *   AMAZON_ACCESS_KEY + AMAZON_SECRET_KEY + AMAZON_PARTNER_TAG
 *                   — Amazon Product Advertising API 5.0 (earns affiliate
 *                     commission; requires an approved Associates account)
 *   SERPAPI_KEY     — SerpAPI, Google Shopping engine
 *   SERPER_API_KEY  — Serper.dev, /shopping endpoint
 *   SEARCHAPI_KEY   — SearchAPI.io, google_shopping engine
 *
 * The first fully configured provider wins, in that order — Amazon leads
 * because it is the monetized one. Set SEARCH_PROVIDER to force a specific
 * provider. Without any credentials it returns { configured: false } and the
 * UI shows a graceful "not connected yet" state — no fabricated results, ever.
 */
import { authenticateRequest } from './_supabaseAuth';
import { amazonDisclosures, searchAmazon } from './_amazonPaapi';
import {
  ProviderError,
  asRows,
  buildResult,
  extensions,
  fetchJson,
  priceTbs,
  type ProductResult,
  type Row,
  type SearchContext,
  type SearchFilters,
} from './_searchCore';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Simple per-user rate limit (per warm function instance).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

/* ── Providers ─────────────────────────────────────────────────────────── */

type Env = Record<string, string>;

interface Provider {
  id: string;
  label: string;
  /** Every one of these must be set for the provider to be selectable. */
  requiredEnv: string[];
  search(env: Env, ctx: SearchContext): Promise<ProductResult[]>;
  /** Legal/program notices to render alongside this provider's results. */
  disclosures?(now: Date): string[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'amazon',
    label: 'Amazon',
    requiredEnv: ['AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY', 'AMAZON_PARTNER_TAG'],
    search(env, ctx) {
      return searchAmazon(
        {
          accessKey: env.AMAZON_ACCESS_KEY,
          secretKey: env.AMAZON_SECRET_KEY,
          partnerTag: env.AMAZON_PARTNER_TAG,
        },
        ctx
      );
    },
    disclosures: amazonDisclosures,
  },
  {
    id: 'serpapi',
    label: 'SerpAPI Google Shopping',
    requiredEnv: ['SERPAPI_KEY'],
    async search(env, { query, filters, country }) {
      const params = new URLSearchParams({
        engine: 'google_shopping',
        q: query,
        api_key: env.SERPAPI_KEY,
        num: '20',
        gl: country,
        hl: 'en',
      });
      if (typeof filters.priceMin === 'number') params.set('low_price', String(filters.priceMin));
      if (typeof filters.priceMax === 'number') params.set('high_price', String(filters.priceMax));
      const data = await fetchJson(`https://serpapi.com/search.json?${params.toString()}`);
      return asRows(data.shopping_results).map((r, i) => buildResult(r, i, 'serp', extensions(r)));
    },
  },
  {
    id: 'serper',
    label: 'Serper.dev Google Shopping',
    requiredEnv: ['SERPER_API_KEY'],
    async search(env, { query, filters, country }) {
      const body: Row = { q: query, gl: country, hl: 'en', num: 20 };
      const tbs = priceTbs(filters);
      if (tbs) body.tbs = tbs;
      const data = await fetchJson('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-API-KEY': env.SERPER_API_KEY },
        body: JSON.stringify(body),
      });
      return asRows(data.shopping).map((r, i) => buildResult(r, i, 'serper'));
    },
  },
  {
    id: 'searchapi',
    label: 'SearchAPI.io Google Shopping',
    requiredEnv: ['SEARCHAPI_KEY'],
    async search(env, { query, filters, country }) {
      const params = new URLSearchParams({
        engine: 'google_shopping',
        q: query,
        api_key: env.SEARCHAPI_KEY,
        num: '20',
        gl: country,
        hl: 'en',
      });
      const tbs = priceTbs(filters);
      if (tbs) params.set('tbs', tbs);
      const data = await fetchJson(`https://www.searchapi.io/api/v1/search?${params.toString()}`);
      return asRows(data.shopping_results).map((r, i) => buildResult(r, i, 'searchapi', extensions(r)));
    },
  },
];

/**
 * Picks the provider to use: SEARCH_PROVIDER if set and fully configured,
 * otherwise the first provider whose credentials are all present. Returns null
 * when nothing is configured.
 */
function selectProvider(): { provider: Provider; env: Env } | null {
  const forced = (process.env.SEARCH_PROVIDER ?? '').trim().toLowerCase();
  const candidates = forced ? PROVIDERS.filter((p) => p.id === forced) : PROVIDERS;
  for (const provider of candidates) {
    const env: Env = {};
    for (const name of provider.requiredEnv) {
      const value = (process.env[name] ?? '').trim();
      if (!value) break;
      env[name] = value;
    }
    if (Object.keys(env).length === provider.requiredEnv.length) return { provider, env };
  }
  return null;
}

/**
 * Backstop price filter. Providers apply price ranges with varying fidelity —
 * some ignore them entirely — so enforce the range here too. Results with an
 * unknown price are kept rather than silently dropped.
 */
function withinPriceRange(r: ProductResult, { priceMin, priceMax }: SearchFilters): boolean {
  if (r.price == null) return true;
  if (typeof priceMin === 'number' && r.price < priceMin) return false;
  if (typeof priceMax === 'number' && r.price > priceMax) return false;
  return true;
}

/* ── Handler ───────────────────────────────────────────────────────────── */

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only.' }, 405);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    if (auth.reason === 'unconfigured') {
      return json({ ok: false, configured: true, results: [], error: 'Server is not configured.' }, 500);
    }
    const error = auth.reason === 'no_token' ? 'Sign in first.' : 'Session expired — sign in again.';
    return json({ ok: false, configured: true, results: [], error }, auth.status);
  }
  const userId = auth.userId;

  if (rateLimited(userId)) {
    return json({ ok: false, configured: true, results: [], error: 'Too many searches — slow down a little.' }, 429);
  }

  let query = '';
  let filters: SearchFilters = {};
  try {
    const body = (await req.json()) as { query?: string; filters?: SearchFilters };
    query = String(body.query ?? '').trim().slice(0, 200);
    filters = body.filters ?? {};
  } catch {
    return json({ ok: false, configured: true, results: [], error: 'Invalid request body.' }, 400);
  }
  if (!query) return json({ ok: false, configured: true, results: [], error: 'Enter a search.' }, 400);

  const selected = selectProvider();
  if (!selected) {
    return json({ ok: true, configured: false, results: [] });
  }
  const { provider, env } = selected;

  const ctx: SearchContext = {
    query,
    filters,
    country: (process.env.SEARCH_COUNTRY ?? 'us').trim().toLowerCase(),
  };

  try {
    const results = (await provider.search(env, ctx))
      .filter((r) => withinPriceRange(r, filters))
      .slice(0, 20);
    return json({
      ok: true,
      configured: true,
      provider: provider.label,
      disclosures: provider.disclosures?.(new Date()) ?? [],
      results,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      return json({ ok: false, configured: true, results: [], error: err.message }, err.status);
    }
    return json({ ok: false, configured: true, results: [], error: 'The search provider did not respond. Try again.' }, 504);
  }
}
