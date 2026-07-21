import type { BagStatus, ShipmentStatus, ThemeStatus, TripRole } from './types';

/* ── Bag pipeline ─────────────────────────────────────────── */

export const BAG_STATUSES: BagStatus[] = [
  'need',
  'considering',
  'own',
  'ordered',
  'shipped',
  'delivered',
];

export const BAG_STATUS_META: Record<BagStatus, { label: string; chip: string }> = {
  need: { label: 'Need', chip: 'bg-rose-100 text-rose-800' },
  considering: { label: 'Considering', chip: 'bg-amber-100 text-amber-800' },
  own: { label: 'Own', chip: 'bg-cream text-ink-soft' },
  ordered: { label: 'Ordered', chip: 'bg-sky-100 text-sky-800' },
  shipped: { label: 'Shipped', chip: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Delivered', chip: 'bg-emerald-100 text-emerald-800' },
};

/** Statuses that mean "the traveler physically has this item". */
export const IN_HAND: BagStatus[] = ['own', 'delivered'];

/* ── Shipments ────────────────────────────────────────────── */

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'order_placed',
  'preparing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delayed',
  'exception',
  'returned',
];

export const SHIPMENT_STATUS_META: Record<
  ShipmentStatus,
  { label: string; chip: string; done?: boolean; problem?: boolean }
> = {
  order_placed: { label: 'Order placed', chip: 'bg-cream text-ink-soft' },
  preparing: { label: 'Preparing', chip: 'bg-cream text-ink-soft' },
  shipped: { label: 'Shipped', chip: 'bg-sky-100 text-sky-800' },
  in_transit: { label: 'In transit', chip: 'bg-sky-100 text-sky-800' },
  out_for_delivery: { label: 'Out for delivery', chip: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Delivered', chip: 'bg-emerald-100 text-emerald-800', done: true },
  delayed: { label: 'Delayed', chip: 'bg-amber-100 text-amber-900', problem: true },
  exception: { label: 'Exception', chip: 'bg-rose-100 text-rose-800', problem: true },
  returned: { label: 'Returned', chip: 'bg-rose-100 text-rose-800', problem: true },
};

/* ── Packing categories ───────────────────────────────────── */

export const PACKING_CATEGORIES = [
  'Travel documents',
  'Clothing',
  'Shoes',
  'Outerwear',
  'Undergarments',
  'Toiletries',
  'Grooming',
  'Medication',
  'Electronics',
  'Chargers',
  'Work equipment',
  'Entertainment',
  'Food and snacks',
  "Children's items",
  'Outdoor equipment',
  'Sports equipment',
  'Emergency supplies',
  'Destination-specific',
  'Activity-specific',
  'Other',
] as const;

/* ── Roles / dress codes / misc pickers ───────────────────── */

export const ROLE_META: Record<TripRole, { label: string; blurb: string }> = {
  owner: { label: 'Trip Owner', blurb: 'Full control — edits everything, manages travelers, can delete the trip' },
  organizer: { label: 'Organizer', blurb: 'Edits itinerary, themes, and assignments; moderates comments' },
  traveler: { label: 'Traveler', blurb: 'Manages their own list, outfits, photos, comments, and votes' },
  viewer: { label: 'Viewer', blurb: 'Can view the trip but not make changes' },
};

export const THEME_STATUS_META: Record<ThemeStatus, { label: string; chip: string }> = {
  proposed: { label: 'Proposed', chip: 'bg-cream text-ink-soft' },
  voting: { label: 'Voting', chip: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', chip: 'bg-emerald-100 text-emerald-800' },
};

export const DRESS_CODES = [
  'casual',
  'smart casual',
  'business',
  'formal',
  'athletic',
  'swim',
  'themed',
];

export const TRANSPORTS = ['flight', 'car', 'train', 'cruise', 'bus', 'other'];
export const LODGING_TYPES = ['hotel', 'resort', 'cruise', 'campground', 'rental', 'venue', 'family/friends'];
export const TRIP_TYPES = ['personal', 'family', 'business', 'romantic', 'group', 'event'] as const;
