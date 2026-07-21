/**
 * The packing engine: turns trip facts (dates, transport, lodging, activities,
 * weather) into a personalized starter list. Pure functions — easy to test and
 * to re-run when the itinerary changes.
 */
import type { Activity, Outfit, Theme, TripKind, WeatherDay } from './types';

export interface TripFacts {
  trip_type: TripKind;
  transport: string | null;
  lodging_type: string | null;
  country: string;
  laundry_available: boolean;
  days: number;
  international: boolean;
}

export interface GeneratedItem {
  name: string;
  category: string;
  qty: number;
  /** true → one copy per traveler; false → one shared/group item. */
  perTraveler: boolean;
  required: boolean;
  status: 'own' | 'need';
  last_minute: boolean;
  notes?: string;
  activityKind?: string;
}

interface ActivityFacts {
  kind: string;
  dress_code: string | null;
  intensity: string;
  setting: string;
}

const cap = (n: number, max: number) => Math.max(1, Math.min(n, max));

export function generatePackingList(
  trip: TripFacts,
  activities: ActivityFacts[],
  weather: WeatherDay[] = []
): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  const kinds = new Set(activities.map((a) => a.kind));
  const dressCodes = new Set(activities.map((a) => (a.dress_code ?? '').toLowerCase()));
  const has = (...ks: string[]) => ks.some((k) => kinds.has(k));
  const days = Math.max(1, trip.days);
  const wearDays = trip.laundry_available ? Math.min(days, 5) : days;

  const add = (i: GeneratedItem) => {
    if (!items.some((x) => x.name === i.name)) items.push(i);
  };

  /* ── Travel documents ── */
  add({ name: trip.international ? 'Passport' : 'Driver’s license / ID', category: 'Travel documents', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true });
  if (trip.international)
    add({ name: 'Visa / entry documents (if required)', category: 'Travel documents', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: true });
  if (trip.transport === 'flight')
    add({ name: 'Boarding passes (mobile or printed)', category: 'Travel documents', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true });
  if (trip.transport === 'cruise' || trip.lodging_type === 'cruise')
    add({ name: 'Cruise boarding documents', category: 'Travel documents', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true });
  add({ name: 'Lodging confirmation', category: 'Travel documents', qty: 1, perTraveler: false, required: true, status: 'own', last_minute: false });
  add({ name: 'Travel insurance details', category: 'Travel documents', qty: 1, perTraveler: false, required: false, status: 'own', last_minute: false });
  if (trip.trip_type === 'business')
    add({ name: 'Business cards', category: 'Work equipment', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false });

  /* ── Clothing, scaled by trip length & laundry ── */
  add({ name: 'Tops / shirts', category: 'Clothing', qty: cap(wearDays + 1, 10), perTraveler: true, required: true, status: 'own', last_minute: false });
  add({ name: 'Bottoms (pants / shorts / skirts)', category: 'Clothing', qty: cap(Math.ceil(wearDays / 2) + 1, 6), perTraveler: true, required: true, status: 'own', last_minute: false });
  add({ name: 'Sleepwear', category: 'Clothing', qty: cap(Math.ceil(days / 3), 3), perTraveler: true, required: true, status: 'own', last_minute: false });
  add({ name: 'Underwear', category: 'Undergarments', qty: cap(days + 1, 12), perTraveler: true, required: true, status: 'own', last_minute: false });
  add({ name: 'Socks', category: 'Undergarments', qty: cap(days + 1, 12), perTraveler: true, required: true, status: 'own', last_minute: false });
  add({ name: 'Everyday walking shoes', category: 'Shoes', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false });

  /* ── Weather-driven outerwear ── */
  const temps = weather.map((w) => w.tMin).filter((t): t is number => t != null);
  const minTemp = temps.length ? Math.min(...temps) : null;
  const maxRain = Math.max(0, ...weather.map((w) => w.precipProb ?? 0));
  if (minTemp != null && minTemp < 45)
    add({ name: 'Warm coat', category: 'Outerwear', qty: 1, perTraveler: true, required: true, status: 'own', notes: `Lows near ${Math.round(minTemp)}°F`, last_minute: false });
  else if (minTemp != null && minTemp < 62)
    add({ name: 'Light jacket or sweater', category: 'Outerwear', qty: 1, perTraveler: true, required: true, status: 'own', notes: `Cool evenings around ${Math.round(minTemp)}°F`, last_minute: false });
  if (maxRain >= 35)
    add({ name: 'Rain jacket or travel umbrella', category: 'Outerwear', qty: 1, perTraveler: true, required: true, status: 'own', notes: `Rain chance up to ${Math.round(maxRain)}%`, last_minute: false });
  const highs = weather.map((w) => w.tMax).filter((t): t is number => t != null);
  if (highs.some((t) => t >= 78)) {
    add({ name: 'Sunglasses', category: 'Destination-specific', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false });
    add({ name: 'Sunscreen', category: 'Toiletries', qty: 1, perTraveler: false, required: true, status: 'need', last_minute: false });
  }

  /* ── Toiletries / grooming / medication ── */
  add({ name: 'Toiletry kit (toothbrush, toothpaste, deodorant)', category: 'Toiletries', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true, notes: trip.transport === 'flight' ? 'Carry-on liquids ≤ 3.4 oz / 100 ml' : undefined });
  add({ name: 'Hair care / grooming', category: 'Grooming', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: true });
  add({ name: 'Personal medications', category: 'Medication', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true, notes: 'In carry-on, original containers' });

  /* ── Electronics ── */
  add({ name: 'Phone charger', category: 'Chargers', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true });
  add({ name: 'Portable power bank', category: 'Electronics', qty: 1, perTraveler: false, required: false, status: 'own', last_minute: false });
  if (trip.international)
    add({ name: 'Power adapter (international)', category: 'Electronics', qty: 1, perTraveler: false, required: true, status: 'need', last_minute: false });
  if (trip.trip_type === 'business' || has('business', 'conference'))
    add({ name: 'Laptop + charger', category: 'Work equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: true });

  /* ── Transport ── */
  if (trip.transport === 'flight') {
    add({ name: 'Luggage tags', category: 'Other', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false });
    add({ name: 'Packing cubes', category: 'Other', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false });
    add({ name: 'Headphones for the flight', category: 'Entertainment', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: true });
  }
  if (trip.transport === 'car' || has('road_trip')) {
    add({ name: 'Car snacks + drinks', category: 'Food and snacks', qty: 1, perTraveler: false, required: false, status: 'need', last_minute: true });
    add({ name: 'Car phone charger', category: 'Chargers', qty: 1, perTraveler: false, required: false, status: 'own', last_minute: true });
  }

  /* ── Lodging ── */
  if (trip.lodging_type === 'campground' || has('camping')) {
    add({ name: 'Tent + stakes', category: 'Outdoor equipment', qty: 1, perTraveler: false, required: true, status: 'own', last_minute: false, activityKind: 'camping' });
    add({ name: 'Sleeping bags', category: 'Outdoor equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'camping' });
    add({ name: 'Headlamp / flashlight', category: 'Outdoor equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'camping' });
  }
  if (trip.lodging_type === 'rental' && trip.laundry_available)
    add({ name: 'Laundry detergent pods', category: 'Other', qty: 1, perTraveler: false, required: false, status: 'need', last_minute: false });

  /* ── Activity-specific ── */
  if (has('beach', 'pool', 'cruise_day')) {
    add({ name: 'Swimsuit', category: 'Clothing', qty: has('beach') && has('pool') ? 2 : 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'beach' });
    add({ name: 'Beach towel / cover-up', category: 'Activity-specific', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false, activityKind: 'beach' });
    add({ name: 'Sandals / flip-flops', category: 'Shoes', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'beach' });
    add({ name: 'Sunscreen (reef-safe)', category: 'Toiletries', qty: 1, perTraveler: false, required: true, status: 'need', last_minute: false, activityKind: 'beach' });
  }
  if (has('hiking', 'outdoor')) {
    add({ name: 'Hiking shoes / trail runners', category: 'Shoes', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'hiking' });
    add({ name: 'Daypack + water bottle', category: 'Outdoor equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'hiking' });
    add({ name: 'Bug spray', category: 'Toiletries', qty: 1, perTraveler: false, required: false, status: 'need', last_minute: false, activityKind: 'hiking' });
  }
  if (has('golf'))
    add({ name: 'Golf clubs + glove + polo', category: 'Sports equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'golf' });
  if (has('skiing')) {
    add({ name: 'Ski jacket + snow pants', category: 'Outerwear', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'skiing' });
    add({ name: 'Base layers + gloves + goggles', category: 'Sports equipment', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'skiing' });
  }
  if (has('exercise', 'theme_park', 'sporting_event'))
    add({ name: 'Athletic wear + sneakers', category: 'Clothing', qty: cap(Math.ceil(days / 2), 4), perTraveler: true, required: false, status: 'own', last_minute: false, activityKind: 'exercise' });
  if (has('wedding', 'formal_dinner') || dressCodes.has('formal')) {
    add({ name: 'Formal outfit (suit / dress)', category: 'Clothing', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'formal_dinner', notes: 'Garment bag recommended' });
    add({ name: 'Dress shoes', category: 'Shoes', qty: 1, perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'formal_dinner' });
  }
  if (has('business', 'conference') || dressCodes.has('business'))
    add({ name: 'Business attire', category: 'Clothing', qty: cap(Math.ceil(days / 2), 4), perTraveler: true, required: true, status: 'own', last_minute: false, activityKind: 'business' });
  if (has('photography'))
    add({ name: 'Camera + memory cards', category: 'Electronics', qty: 1, perTraveler: false, required: false, status: 'own', last_minute: false, activityKind: 'photography' });
  if (has('concert', 'nightlife'))
    add({ name: 'Going-out outfit', category: 'Clothing', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false, activityKind: 'nightlife' });

  /* ── Kids / group extras ── */
  if (trip.trip_type === 'family') {
    add({ name: 'Kids’ entertainment (tablet, books, games)', category: "Children's items", qty: 1, perTraveler: false, required: false, status: 'own', last_minute: true });
    add({ name: 'Kids’ snacks', category: "Children's items", qty: 1, perTraveler: false, required: false, status: 'need', last_minute: true });
  }

  /* ── Always ── */
  add({ name: 'First-aid kit', category: 'Emergency supplies', qty: 1, perTraveler: false, required: true, status: 'own', last_minute: false });
  add({ name: 'Reusable water bottle', category: 'Other', qty: 1, perTraveler: true, required: false, status: 'own', last_minute: false });

  return items;
}

/* ── "What to Wear" recommendation ─────────────────────────── */

export interface WearRecommendation {
  headline: string;
  pieces: string[];
  notes: string[];
}

/**
 * Recommend an outfit for one traveler on one day, weighing weather, the
 * day's activities and dress codes, any group theme, and clothing already
 * chosen for other days (to avoid accidental repeats).
 */
export function recommendOutfit(args: {
  day: string;
  weather: WeatherDay | undefined;
  activities: Activity[];
  theme: Theme | undefined;
  otherOutfits: Outfit[];
}): WearRecommendation {
  const { weather, activities, theme, otherOutfits } = args;
  const pieces: string[] = [];
  const notes: string[] = [];
  const dress = activities.map((a) => (a.dress_code ?? '').toLowerCase());
  const kinds = new Set(activities.map((a) => a.kind));
  const outdoor = activities.some((a) => a.setting !== 'indoor');
  const active = activities.some((a) => a.intensity === 'high');

  let headline = 'Casual and comfortable';
  if (theme) {
    headline = `Theme day: ${theme.name}`;
    if (theme.colors) pieces.push(`Palette: ${theme.colors}`);
    if (theme.dress_code) pieces.push(theme.dress_code);
    if (theme.required_accessories) notes.push(`Accessories: ${theme.required_accessories}`);
  } else if (dress.includes('formal')) {
    headline = 'Formal evening';
    pieces.push('Suit or formal dress', 'Dress shoes', 'Light layer for indoors');
  } else if (dress.includes('business')) {
    headline = 'Business ready';
    pieces.push('Business attire', 'Comfortable dress shoes');
  } else if (kinds.has('beach') || kinds.has('pool')) {
    headline = 'Swim + sun day';
    pieces.push('Swimsuit + cover-up', 'Sandals', 'Hat + sunglasses');
  } else if (active) {
    headline = 'Built to move';
    pieces.push('Athletic wear', 'Supportive sneakers');
  } else {
    pieces.push('Comfortable top + bottoms', 'Walking shoes');
  }

  if (weather?.tMax != null && weather.tMin != null) {
    notes.push(`Forecast ${Math.round(weather.tMin)}–${Math.round(weather.tMax)}°F`);
    if (weather.tMin < 55) pieces.push('Warm layer for the morning/evening');
    if (weather.tMax >= 85) notes.push('Hot afternoon — light, breathable fabrics');
  }
  if ((weather?.precipProb ?? 0) >= 40) pieces.push('Rain jacket or umbrella');
  if ((weather?.windMax ?? 0) >= 20) notes.push('Windy — skip loose hats and light skirts');
  if (outdoor) notes.push('Mostly outdoors — sunscreen before you head out');

  const wornElsewhere = new Set(
    otherOutfits.flatMap((o) => [o.top_item, o.bottom_item, o.shoes].filter(Boolean) as string[])
  );
  if (wornElsewhere.size > 0)
    notes.push('Already planned on other days: ' + [...wornElsewhere].slice(0, 3).join(', '));

  const walkHeavy = kinds.has('sightseeing') || kinds.has('theme_park');
  if (walkHeavy) notes.push('Lots of walking — comfort over fashion for shoes');

  return { headline, pieces, notes };
}
