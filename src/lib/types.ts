/** Row types mirroring supabase/migrations/001_schema.sql. */

export type TripRole = 'owner' | 'organizer' | 'traveler' | 'viewer';
export type TripKind = 'personal' | 'family' | 'business' | 'romantic' | 'group' | 'event';
export type BagStatus = 'need' | 'considering' | 'own' | 'ordered' | 'shipped' | 'delivered';
export type ShipmentStatus =
  | 'order_placed'
  | 'preparing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'exception'
  | 'returned';
export type ThemeStatus = 'proposed' | 'voting' | 'approved';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_location: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  dress_size: string | null;
  shoe_size: string | null;
  preferred_fit: string | null;
  gender_neutral: boolean;
  favorite_colors: string | null;
  style_prefs: string | null;
  travel_prefs: string | null;
  accessibility_notes: string | null;
  care_notes: string | null;
}

export interface Trip {
  id: string;
  owner_id: string;
  name: string;
  trip_type: TripKind;
  city: string;
  region: string;
  country: string;
  lodging_type: string | null;
  lodging_name: string | null;
  address: string | null;
  depart_location: string | null;
  transport: string | null;
  start_date: string;
  end_date: string;
  travelers_count: number;
  laundry_available: boolean;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface TripStop {
  id: string;
  trip_id: string;
  name: string;
  city: string;
  region: string;
  country: string;
  arrive_date: string | null;
  depart_date: string | null;
  lat: number | null;
  lon: number | null;
  sort: number;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: TripRole;
  color: string;
  invite_code: string;
  joined: boolean;
}

export interface Activity {
  id: string;
  trip_id: string;
  name: string;
  kind: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  dress_code: string | null;
  setting: string;
  intensity: string;
  equipment: string | null;
  notes: string | null;
}

export interface PackingItem {
  id: string;
  trip_id: string;
  member_id: string | null;
  name: string;
  category: string;
  qty: number;
  required: boolean;
  packed: boolean;
  status: BagStatus;
  day: string | null;
  activity_id: string | null;
  last_minute: boolean;
  notes: string | null;
  photo_path: string | null;
  external_image_url: string | null;
  product_url: string | null;
  store: string | null;
  est_price: number | null;
  created_by: string | null;
  created_at: string;
}

export interface Outfit {
  id: string;
  trip_id: string;
  member_id: string;
  date: string;
  title: string;
  top_item: string | null;
  bottom_item: string | null;
  shoes: string | null;
  outerwear: string | null;
  accessories: string | null;
  notes: string | null;
  product_links: string | null;
  photo_path: string | null;
  external_image_url: string | null;
  chosen: boolean;
  approved: boolean;
  created_by: string | null;
}

export interface Theme {
  id: string;
  trip_id: string;
  name: string;
  date: string | null;
  description: string | null;
  colors: string | null;
  dress_code: string | null;
  suggested_clothing: string | null;
  required_accessories: string | null;
  status: ThemeStatus;
  created_by: string | null;
}

export interface Vote {
  id: string;
  trip_id: string;
  target_kind: 'theme' | 'outfit';
  target_id: string;
  user_id: string;
}

export interface Photo {
  id: string;
  trip_id: string;
  member_id: string | null;
  uploaded_by: string | null;
  uploader_name: string;
  storage_path: string | null;
  external_url: string | null;
  caption: string | null;
  date: string | null;
  activity_id: string | null;
  kind: string;
  approved: boolean;
  created_at: string;
}

export interface CommentRow {
  id: string;
  trip_id: string;
  target_kind: 'photo' | 'theme' | 'outfit' | 'trip';
  target_id: string | null;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  trip_id: string;
  target_kind: 'photo' | 'comment' | 'outfit' | 'theme';
  target_id: string;
  user_id: string;
  emoji: string;
}

export interface Shipment {
  id: string;
  trip_id: string;
  member_id: string | null;
  packing_item_id: string | null;
  carrier: string;
  tracking_number: string | null;
  tracking_url: string | null;
  retailer: string | null;
  order_number: string | null;
  status: ShipmentStatus;
  eta_date: string | null;
  last_scan: string | null;
  last_scan_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  trip_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface FeedEntry {
  id: string;
  trip_id: string;
  actor_name: string;
  kind: string;
  message: string;
  created_at: string;
}

/** One day of forecast, normalized from the weather provider. */
export interface WeatherDay {
  date: string;
  tMax: number | null;
  tMin: number | null;
  precipProb: number | null;
  windMax: number | null;
  code: number | null;
}

/** One product from /api/product-search. */
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
