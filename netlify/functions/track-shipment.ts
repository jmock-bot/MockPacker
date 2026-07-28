/**
 * POST /api/track-shipment   { carrier, trackingNumber }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Server-side carrier tracking so carrier API credentials never reach the
 * browser. This is the integration point for live tracking:
 *
 *   UPS    — OAuth client credentials (UPS_CLIENT_ID / UPS_CLIENT_SECRET)
 *            https://developer.ups.com  → Track API
 *   FedEx  — OAuth (FEDEX_API_KEY / FEDEX_SECRET_KEY)
 *            https://developer.fedex.com → Track API
 *   USPS   — Web Tools (USPS_USER_ID)
 *            https://www.usps.com/business/web-tools-apis
 *   DHL    — API key (DHL_API_KEY)
 *            https://developer.dhl.com → Shipment Tracking - Unified
 *
 * Until credentials are configured, the endpoint reports { configured: false }
 * and the app falls back to manual statuses + deep links to the carrier's own
 * tracking page (see src/lib/carriers.ts) — the feature still works, it just
 * isn't automatic.
 */
import { authenticateRequest } from './_supabaseAuth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const CARRIER_ENV: Record<string, string[]> = {
  ups: ['UPS_CLIENT_ID', 'UPS_CLIENT_SECRET'],
  fedex: ['FEDEX_API_KEY', 'FEDEX_SECRET_KEY'],
  usps: ['USPS_USER_ID'],
  dhl: ['DHL_API_KEY'],
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only.' }, 405);

  // Only signed-in users may hit carrier APIs through us.
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    if (auth.reason === 'unconfigured') {
      return json({ ok: false, configured: false, error: 'Server is not configured.' }, 500);
    }
    const error = auth.reason === 'no_token' ? 'Sign in first.' : 'Session expired — sign in again.';
    return json({ ok: false, configured: false, error }, auth.status);
  }

  let carrier = '';
  let trackingNumber = '';
  try {
    const body = (await req.json()) as { carrier?: string; trackingNumber?: string };
    carrier = String(body.carrier ?? '').toLowerCase().trim();
    trackingNumber = String(body.trackingNumber ?? '').trim().slice(0, 60);
  } catch {
    return json({ ok: false, configured: false, error: 'Invalid request body.' }, 400);
  }
  if (!carrier || !trackingNumber) {
    return json({ ok: false, configured: false, error: 'carrier and trackingNumber are required.' }, 400);
  }

  const requiredEnv = CARRIER_ENV[carrier];
  if (!requiredEnv) {
    return json({ ok: false, configured: false, error: `No live integration for carrier "${carrier}".` }, 400);
  }
  const configured = requiredEnv.every((k) => Boolean(process.env[k]));
  if (!configured) {
    // Placeholder path: credentials not set. The client shows manual tracking
    // with a deep link to the carrier's site instead.
    return json({
      ok: true,
      configured: false,
      carrier,
      trackingNumber,
      message: `Live ${carrier.toUpperCase()} tracking is not connected yet. Set ${requiredEnv.join(' and ')} in the server environment to enable it.`,
    });
  }

  // ── Live integration goes here ──
  // Each carrier block should: authenticate, call the tracking endpoint,
  // normalize the response to { status, eta, lastScan, scannedAt, events[] },
  // and never leak credentials or raw errors to the client.
  return json({
    ok: true,
    configured: true,
    carrier,
    trackingNumber,
    message: 'Carrier credentials detected — implement the live API call for this carrier here.',
  });
}
