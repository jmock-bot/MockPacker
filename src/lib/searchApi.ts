/**
 * Client for the server-side product search (netlify/functions/product-search).
 * The shopping-data API key lives only on the server; the browser sends the
 * user's Supabase token so the function can authenticate + rate-limit.
 */
import { supabase } from './supabase';
import type { ProductResult } from './types';

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  category?: string;
  brand?: string;
  size?: string;
  color?: string;
  store?: string;
}

export interface SearchResponse {
  ok: boolean;
  configured: boolean;
  provider?: string;
  results: ProductResult[];
  error?: string;
}

export async function searchProducts(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, configured: true, results: [], error: 'Sign in first.' };
  try {
    const res = await fetch('/api/product-search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, filters }),
    });
    return (await res.json()) as SearchResponse;
  } catch {
    return {
      ok: false,
      configured: true,
      results: [],
      error: 'Could not reach the search service. Check your connection.',
    };
  }
}
