/**
 * POST /api/product-search   { query, filters? }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Server-side product search so the shopping-data API key never reaches the
 * browser. Uses SerpAPI's Google Shopping engine (SERPAPI_KEY) — an approved
 * provider; MockPacker never scrapes Google directly. Without a key it returns
 * { configured: false } and the UI shows a graceful "not connected yet" state —
 * no fabricated results, ever.
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

interface SerpShoppingResult {
  product_id?: string;
  title?: string;
  source?: string;
  link?: string;
  product_link?: string;
  extracted_price?: number;
  extracted_old_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  delivery?: string;
  tag?: string;
  extensions?: string[];
}

function mapResult(r: SerpShoppingResult, index: number) {
  const price = r.extracted_price ?? null;
  const original = r.extracted_old_price ?? null;
  const delivery = (r.delivery ?? '').trim();
  const tagText = [(r.tag ?? ''), ...(r.extensions ?? [])].join(' ').toLowerCase();
  return {
    id: r.product_id ?? `serp-${index}`,
    name: r.title ?? 'Unknown product',
    brand: null,
    imageUrl: r.thumbnail ?? null,
    price,
    originalPrice: original,
    discountPercent:
      price != null && original != null && original > price
        ? Math.round(((original - price) / original) * 100)
        : null,
    store: r.source ?? null,
    shippingCost: delivery.toLowerCase().includes('free') ? 0 : null,
    deliveryEstimate: delivery || null,
    inStock: tagText.includes('out of stock') ? false : null,
    rating: r.rating ?? null,
    reviewCount: r.reviews ?? null,
    url: r.product_link ?? r.link ?? null,
    checkedAt: new Date().toISOString(),
  };
}

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
  let filters: { priceMin?: number; priceMax?: number } = {};
  try {
    const body = (await req.json()) as { query?: string; filters?: typeof filters };
    query = String(body.query ?? '').trim().slice(0, 200);
    filters = body.filters ?? {};
  } catch {
    return json({ ok: false, configured: true, results: [], error: 'Invalid request body.' }, 400);
  }
  if (!query) return json({ ok: false, configured: true, results: [], error: 'Enter a search.' }, 400);

  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) {
    return json({ ok: true, configured: false, results: [] });
  }

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: serpKey,
    num: '20',
    gl: process.env.SEARCH_COUNTRY ?? 'us',
    hl: 'en',
  });
  if (typeof filters.priceMin === 'number') params.set('low_price', String(filters.priceMin));
  if (typeof filters.priceMax === 'number') params.set('high_price', String(filters.priceMax));

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return json({ ok: false, configured: true, results: [], error: 'The search provider had a problem. Try again shortly.' }, 502);
    }
    const data = (await res.json()) as { shopping_results?: SerpShoppingResult[] };
    const results = (data.shopping_results ?? []).slice(0, 20).map(mapResult);
    return json({ ok: true, configured: true, provider: 'SerpAPI Google Shopping', results });
  } catch {
    return json({ ok: false, configured: true, results: [], error: 'The search provider did not respond. Try again.' }, 504);
  }
}
