/**
 * Carrier tracking-link builder — no API key needed. Given a carrier and a
 * tracking number we can deep-link straight to the carrier's own tracking page.
 * A manual override URL always wins (some retailers use their own tracker).
 * Live carrier-API tracking is a server-side integration: see
 * netlify/functions/track-shipment.ts.
 */
export interface Carrier {
  id: string;
  name: string;
  /** Build the carrier's tracking page URL for a tracking number. */
  build?: (tracking: string) => string;
}

export const CARRIERS: Carrier[] = [
  { id: 'usps', name: 'USPS', build: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}` },
  { id: 'ups', name: 'UPS', build: (t) => `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}` },
  { id: 'fedex', name: 'FedEx', build: (t) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}` },
  { id: 'dhl', name: 'DHL', build: (t) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(t)}` },
  { id: 'amazon', name: 'Amazon', build: () => 'https://www.amazon.com/gp/css/order-history' },
  { id: 'other', name: 'Other / retailer' },
];

export const carrierName = (id: string | null | undefined): string =>
  CARRIERS.find((c) => c.id === id)?.name ?? (id ?? '');

/** Best tracking URL for a shipment: manual override, else carrier deep-link. */
export function trackingLink(
  carrier: string | null | undefined,
  tracking: string | null | undefined,
  override?: string | null
): string | null {
  if (override && override.trim()) return override.trim();
  if (!tracking) return null;
  const found = CARRIERS.find((c) => c.id === carrier);
  return found?.build ? found.build(tracking.trim()) : null;
}
