/**
 * POST /api/product-search   { query, filters? }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Server-side product search so the shopping-data API key never reaches the
 * browser. MockPacker never scrapes Google directly — it calls an approved
 * shopping-data provider. Any one of these keys turns search on:
 *
 *   SERPAPI_KEY     — SerpAPI, Google Shopping engine
 *   SERPER_API_KEY  — Serper.dev, /shopping endpoint
 *   SEARCHAPI_KEY   — SearchAPI.io, google_shopping engine
 *
 * The first configured provider wins (or set SEARCH_PROVIDER to pick one).
 * Without any key it returns { configured: false } and the UI shows a graceful
 * "not connected yet" state — no fabricated results, ever.
 */
import { authenticateRequest } from './_supabaseAuth';

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

/* ── Shared shapes ─────────────────────────────────────────────────────── */

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
}

interface SearchContext {
  query: string;
  filters: SearchFilters;
  country: string;
}

interface ProductResult {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  store: string | null;
  shippingCost: number | null;
  deliveryEstimate: string | null;
  inStock: boolean | null;
  rating: number | null;
  reviewCount: number | null;
  url: string | null;
  checkedAt: string;
}

/** A provider fetch that failed in a way worth telling the user about. */
class ProviderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Row = Record<string, unknown>;

/* ── Field readers (providers disagree on names, so read defensively) ───── */

const str = (row: Row, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/** Parses 29.99, "$29.99", "US$1,299.00" → 29.99 / 1299. */
const num = (row: Row, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const m = v.replace(/,/g, '').match(/\d+(\.\d+)?/);
      if (m) return parseFloat(m[0]);
    }
  }
  return null;
};

const int = (row: Row, ...keys: string[]): number | null => {
  const n = num(row, ...keys);
  return n == null ? null : Math.round(n);
};

/**
 * Builds the normalized result every provider returns. `tags` is any extra
 * text (badges, extensions) scanned for stock hints.
 */
function buildResult(row: Row, index: number, prefix: string, tags: string[] = []): ProductResult {
  const price = num(row, 'extracted_price', 'price');
  const original = num(row, 'extracted_old_price', 'extracted_original_price', 'original_price', 'old_price');
  const delivery = str(row, 'delivery', 'shipping', 'delivery_options') ?? '';
  const tagText = [str(row, 'tag') ?? '', ...tags].join(' ').toLowerCase();
  return {
    id: str(row, 'product_id', 'productId', 'id') ?? `${prefix}-${index}`,
    name: str(row, 'title', 'name') ?? 'Unknown product',
    brand: str(row, 'brand'),
    imageUrl: str(row, 'thumbnail', 'imageUrl', 'image', 'image_url'),
    price,
    originalPrice: original,
    discountPercent:
      price != null && original != null && original > price
        ? Math.round(((original - price) / original) * 100)
        : null,
    store: str(row, 'source', 'seller', 'merchant', 'store'),
    shippingCost: delivery.toLowerCase().includes('free') ? 0 : null,
    deliveryEstimate: delivery || null,
    inStock: tagText.includes('out of stock') ? false : null,
    rating: num(row, 'rating'),
    reviewCount: int(row, 'reviews', 'ratingCount', 'reviews_count', 'review_count'),
    url: str(row, 'product_link', 'link', 'url'),
    checkedAt: new Date().toISOString(),
  };
}

const asRows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((r): r is Row => typeof r === 'object' && r !== null) : [];

const extensions = (row: Row): string[] =>
  Array.isArray(row.extensions) ? row.extensions.filter((e): e is string => typeof e === 'string') : [];

/**
 * Google's `tbs` price filter, understood by the providers that proxy Google
 * Shopping verbatim (Serper, SearchAPI).
 */
function priceTbs({ priceMin, priceMax }: SearchFilters): string | null {
  const parts: string[] = [];
  if (typeof priceMin === 'number') parts.push(`ppr_min:${priceMin}`);
  if (typeof priceMax === 'number') parts.push(`ppr_max:${priceMax}`);
  return parts.length ? `mr:1,price:1,${parts.join(',')}` : null;
}

/* ── Providers ─────────────────────────────────────────────────────────── */

interface Provider {
  id: string;
  label: string;
  envVar: string;
  search(key: string, ctx: SearchContext): Promise<ProductResult[]>;
}

const TIMEOUT_MS = 15_000;

async function fetchJson(url: string, init: RequestInit = {}): Promise<Row> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(502, 'The search provider rejected the API key. Check the server configuration.');
  }
  if (res.status === 429) {
    throw new ProviderError(429, 'The search provider’s quota is used up. Try again later.');
  }
  if (!res.ok) {
    throw new ProviderError(502, 'The search provider had a problem. Try again shortly.');
  }
  return (await res.json()) as Row;
}

const PROVIDERS: Provider[] = [
  {
    id: 'serpapi',
    label: 'SerpAPI Google Shopping',
    envVar: 'SERPAPI_KEY',
    async search(key, { query, filters, country }) {
      const params = new URLSearchParams({
        engine: 'google_shopping',
        q: query,
        api_key: key,
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
    envVar: 'SERPER_API_KEY',
    async search(key, { query, filters, country }) {
      const body: Row = { q: query, gl: country, hl: 'en', num: 20 };
      const tbs = priceTbs(filters);
      if (tbs) body.tbs = tbs;
      const data = await fetchJson('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-API-KEY': key },
        body: JSON.stringify(body),
      });
      return asRows(data.shopping).map((r, i) => buildResult(r, i, 'serper'));
    },
  },
  {
    id: 'searchapi',
    label: 'SearchAPI.io Google Shopping',
    envVar: 'SEARCHAPI_KEY',
    async search(key, { query, filters, country }) {
      const params = new URLSearchParams({
        engine: 'google_shopping',
        q: query,
        api_key: key,
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
 * Picks the provider to use: SEARCH_PROVIDER if set and keyed, otherwise the
 * first provider whose key is present. Returns null when nothing is configured.
 */
function selectProvider(): { provider: Provider; key: string } | null {
  const forced = (process.env.SEARCH_PROVIDER ?? '').trim().toLowerCase();
  const candidates = forced ? PROVIDERS.filter((p) => p.id === forced) : PROVIDERS;
  for (const provider of candidates) {
    const key = (process.env[provider.envVar] ?? '').trim();
    if (key) return { provider, key };
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
  const { provider, key } = selected;

  const ctx: SearchContext = {
    query,
    filters,
    country: process.env.SEARCH_COUNTRY ?? 'us',
  };

  try {
    const results = (await provider.search(key, ctx))
      .filter((r) => withinPriceRange(r, filters))
      .slice(0, 20);
    return json({ ok: true, configured: true, provider: provider.label, results });
  } catch (err) {
    if (err instanceof ProviderError) {
      return json({ ok: false, configured: true, results: [], error: err.message }, err.status);
    }
    return json({ ok: false, configured: true, results: [], error: 'The search provider did not respond. Try again.' }, 504);
  }
}
