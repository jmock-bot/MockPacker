/**
 * Trip Readiness: one honest score with a visible breakdown, plus the alert
 * list ("what could stop us from being ready") and per-traveler progress.
 */
import { daysUntil } from './format';
import type { Activity, Outfit, PackingItem, Shipment, Theme, Trip, TripMember } from './types';

export interface ReadinessAlert {
  tone: 'rose' | 'amber';
  text: string;
}

export interface Readiness {
  overall: number;
  breakdown: {
    packing: number;
    shopping: number;
    shipping: number;
    documents: number;
    outfits: number;
    activityPrep: number;
  };
  alerts: ReadinessAlert[];
  perTraveler: { member: TripMember; packed: number; total: number; pct: number }[];
}

const pct = (done: number, total: number): number =>
  total === 0 ? 100 : Math.round((done / total) * 100);

export function computeReadiness(args: {
  trip: Trip;
  items: PackingItem[];
  shipments: Shipment[];
  outfits: Outfit[];
  themes: Theme[];
  activities: Activity[];
  members: TripMember[];
}): Readiness {
  const { trip, items, shipments, outfits, themes, activities, members } = args;
  const untilDeparture = daysUntil(trip.start_date) ?? 999;
  const alerts: ReadinessAlert[] = [];

  /* Packing: required items marked packed. */
  const required = items.filter((i) => i.required);
  const packing = pct(required.filter((i) => i.packed).length, required.length);

  /* Shopping: items past the need/considering stage. */
  const stillToBuy = items.filter((i) => i.status === 'need' || i.status === 'considering');
  const shopping = pct(items.length - stillToBuy.length, items.length);

  /* Shipping: shipments delivered. */
  const shipping = pct(shipments.filter((s) => s.status === 'delivered').length, shipments.length);

  /* Documents: the Travel documents category, packed. */
  const docs = items.filter((i) => i.category === 'Travel documents');
  const documents = pct(docs.filter((i) => i.packed).length, docs.length);

  /* Outfits: chosen outfit per traveler for each themed/formal date. */
  const keyDates = new Set<string>();
  for (const t of themes) if (t.date) keyDates.add(t.date);
  for (const a of activities)
    if (a.date && (a.dress_code === 'formal' || a.dress_code === 'themed')) keyDates.add(a.date);
  const outfitSlots = keyDates.size * Math.max(1, members.length);
  const outfitsChosen = outfits.filter((o) => o.chosen && keyDates.has(o.date)).length;
  const outfitScore = pct(Math.min(outfitsChosen, outfitSlots), outfitSlots);

  /* Activity prep: activity-linked items in hand or packed. */
  const actItems = items.filter((i) => i.activity_id != null);
  const activityPrep = pct(
    actItems.filter((i) => i.packed || i.status === 'own' || i.status === 'delivered').length,
    actItems.length
  );

  /* ── Alerts ── */
  for (const s of shipments) {
    if (s.status === 'delayed' || s.status === 'exception')
      alerts.push({ tone: 'rose', text: `Shipment from ${s.retailer ?? s.carrier.toUpperCase()} is ${s.status === 'delayed' ? 'delayed' : 'showing an exception'}${s.eta_date ? ` — ETA ${s.eta_date}` : ''}` });
    else if (s.status !== 'delivered' && s.eta_date && s.eta_date >= trip.start_date)
      alerts.push({ tone: 'rose', text: `A ${s.retailer ?? s.carrier.toUpperCase()} shipment may not arrive before departure (ETA ${s.eta_date})` });
    else if (s.status !== 'delivered' && s.eta_date && (daysUntil(s.eta_date) ?? 0) >= untilDeparture - 2)
      alerts.push({ tone: 'amber', text: `A ${s.retailer ?? s.carrier.toUpperCase()} delivery is cutting it close (ETA ${s.eta_date})` });
  }
  const orderedNoTracking = items.filter(
    (i) => i.status === 'ordered' && !shipments.some((s) => s.packing_item_id === i.id)
  );
  if (orderedNoTracking.length > 0)
    alerts.push({ tone: 'amber', text: `${orderedNoTracking.length} ordered item${orderedNoTracking.length > 1 ? 's have' : ' has'} no tracking added` });
  if (stillToBuy.length > 0 && untilDeparture <= 7)
    alerts.push({ tone: untilDeparture <= 3 ? 'rose' : 'amber', text: `${stillToBuy.length} item${stillToBuy.length > 1 ? 's' : ''} still need to be bought and departure is ${untilDeparture} day${untilDeparture === 1 ? '' : 's'} away` });
  if (docs.length > 0 && documents < 100 && untilDeparture <= 5)
    alerts.push({ tone: 'amber', text: 'Travel documents are not all packed yet' });

  /* ── Per traveler ── */
  const perTraveler = members
    .filter((m) => m.role !== 'viewer')
    .map((member) => {
      const mine = items.filter((i) => i.member_id === member.id);
      const packed = mine.filter((i) => i.packed).length;
      return { member, packed, total: mine.length, pct: pct(packed, mine.length) };
    });

  const overall = Math.round(
    packing * 0.35 +
      shopping * 0.2 +
      shipping * 0.15 +
      documents * 0.1 +
      outfitScore * 0.1 +
      activityPrep * 0.1
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: { packing, shopping, shipping, documents, outfits: outfitScore, activityPrep },
    alerts,
    perTraveler,
  };
}
