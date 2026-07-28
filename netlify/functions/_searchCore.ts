/**
 * Shared types and helpers for the product-search providers.
 *
 * Lives behind the `_` prefix so Netlify treats it as a module, not a function
 * (same convention as `_supabaseAuth.ts`).
 */

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
}

export interface SearchContext {
  query: string;
  filters: SearchFilters;
  /** ISO-3166 alpha-2, lowercase. From SEARCH_COUNTRY. */
  country: string;
}

export interface ProductResult {
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

/** A provider failure worth describing to the user. */
export class ProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Row = Record<string, unknown>;

/* ── Field readers (providers disagree on names, so read defensively) ───── */

export const str = (row: Row, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/** Parses 29.99, "$29.99", "US$1,299.00" → 29.99 / 1299. */
export const num = (row: Row, ...keys: string[]): number | null => {
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

export const int = (row: Row, ...keys: string[]): number | null => {
  const n = num(row, ...keys);
  return n == null ? null : Math.round(n);
};

export const asRows = (v: unknown): Row[] =>
  Array.isArray(v) ? v.filter((r): r is Row => typeof r === 'object' && r !== null) : [];

export const extensions = (row: Row): string[] =>
  Array.isArray(row.extensions) ? row.extensions.filter((e): e is string => typeof e === 'string') : [];

/** Reads a nested path, returning null rather than throwing on any gap. */
export const dig = (value: unknown, ...path: (string | number)[]): unknown => {
  let cur: unknown = value;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Row)[key as string];
  }
  return cur ?? null;
};

export const discountPercent = (price: number | null, original: number | null): number | null =>
  price != null && original != null && original > price
    ? Math.round(((original - price) / original) * 100)
    : null;

/**
 * Builds the normalized result for providers whose rows are flat key/value
 * objects (the Google Shopping proxies). `tags` is extra text — badges,
 * extensions — scanned for stock hints.
 */
export function buildResult(row: Row, index: number, prefix: string, tags: string[] = []): ProductResult {
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
    discountPercent: discountPercent(price, original),
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

/**
 * Google's `tbs` price filter, understood by the providers that proxy Google
 * Shopping verbatim (Serper, SearchAPI).
 */
export function priceTbs({ priceMin, priceMax }: SearchFilters): string | null {
  const parts: string[] = [];
  if (typeof priceMin === 'number') parts.push(`ppr_min:${priceMin}`);
  if (typeof priceMax === 'number') parts.push(`ppr_max:${priceMax}`);
  return parts.length ? `mr:1,price:1,${parts.join(',')}` : null;
}

export const TIMEOUT_MS = 15_000;

export async function fetchJson(url: string, init: RequestInit = {}): Promise<Row> {
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
