/**
 * Shared request authentication for MockPacker's Netlify Functions.
 *
 * The functions here are server-side product-search / carrier-tracking proxies:
 * they only need to know *which signed-in user* is calling so they can rate-
 * limit and gate access — they never read or write the database. So all we do
 * is verify the caller's Supabase access token and return their user id.
 *
 * Primary path — `@supabase/server` in `auth: 'user'` mode. It verifies the JWT
 * locally against the project's JWKS (the new asymmetric signing keys), so
 * there is no round-trip to the auth server and no secret key is required. The
 * remote JWKS is fetched once and cached across warm invocations by the SDK.
 *
 * Env vars (server-side only). New names are preferred; the old ones are still
 * accepted so a deployment can migrate without a flag day:
 *
 *   SUPABASE_URL          — required. Falls back to VITE_SUPABASE_URL.
 *   SUPABASE_JWKS         — optional inline JWKS JSON (authoritative when set).
 *   SUPABASE_JWKS_URL     — optional remote JWKS endpoint. When neither JWKS var
 *                           is set it is derived from the project URL, so most
 *                           deployments need not set it at all.
 *   SUPABASE_SECRET_KEY   — optional. Falls back to SUPABASE_SERVICE_ROLE_KEY.
 *                           Only used for the legacy fallback below.
 *
 * Legacy fallback — a project that has not enabled asymmetric JWT signing keys
 * still issues HS256 tokens whose secret is never exposed via JWKS, so local
 * verification can't succeed. When JWKS verification yields no user and a
 * secret / service-role key is present, we validate the token against the auth
 * server with supabase-js instead. Fully-migrated projects never reach this.
 */
import { verifyAuth } from '@supabase/server/core';
import type { SupabaseEnv } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';

/** First non-empty value among the given env var names. */
function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; reason: 'unconfigured' | 'no_token' | 'invalid_token' };

/** Extract the bearer token from the Authorization header. */
function bearerToken(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  if (!url) return { ok: false, status: 500, reason: 'unconfigured' };

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, reason: 'no_token' };

  // ── Primary: local JWKS verification (new asymmetric signing keys) ──
  let jwks: SupabaseEnv['jwks'] = null;
  const inlineJwks = env('SUPABASE_JWKS');
  if (inlineJwks) {
    try {
      jwks = JSON.parse(inlineJwks) as SupabaseEnv['jwks'];
    } catch {
      jwks = null; // Malformed inline JWKS — fall back to the derived URL below.
    }
  }
  if (!jwks) {
    const jwksUrl = env('SUPABASE_JWKS_URL') ?? `${url.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
    try {
      jwks = new URL(jwksUrl);
    } catch {
      jwks = null;
    }
  }
  if (jwks) {
    const { data, error } = await verifyAuth(req, { auth: 'user', env: { url, jwks } });
    if (!error && data.userClaims?.id) return { ok: true, userId: data.userClaims.id };
  }

  // ── Fallback: verify against the auth server (legacy HS256 projects) ──
  const secret = env('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (secret) {
    const admin = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) return { ok: true, userId: data.user.id };
  }

  return { ok: false, status: 401, reason: 'invalid_token' };
}
