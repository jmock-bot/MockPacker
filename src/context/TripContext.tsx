import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase, uploadTripPhoto } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { eachDay } from '../lib/format';
import { generatePackingList } from '../lib/packing';
import { fetchTripWeather, geocode } from '../lib/weather';
import type {
  Activity,
  BagStatus,
  CommentRow,
  FeedEntry,
  NotificationRow,
  Outfit,
  PackingItem,
  Photo,
  Reaction,
  Shipment,
  Theme,
  Trip,
  TripMember,
  TripRole,
  Vote,
  WeatherDay,
} from '../lib/types';

const ACTIVE_TRIP_KEY = 'mp-active-trip';

export interface NewTripActivity {
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

export interface NewTripInput {
  name: string;
  trip_type: Trip['trip_type'];
  city: string;
  region: string;
  country: string;
  /** Coordinates from city autocomplete; when present we skip re-geocoding. */
  lat: number | null;
  lon: number | null;
  lodging_type: string | null;
  lodging_name: string | null;
  address: string | null;
  depart_location: string | null;
  transport: string | null;
  start_date: string;
  end_date: string;
  laundry_available: boolean;
  notes: string | null;
  travelers: { name: string; email: string | null; role: TripRole }[];
  activities: NewTripActivity[];
}

interface Result {
  ok: boolean;
  error?: string;
  id?: string;
}

interface TripContextValue {
  offline: boolean;
  trips: Trip[];
  tripsLoading: boolean;
  activeTrip: Trip | null;
  setActiveTripId: (id: string | null) => void;
  loading: boolean;
  members: TripMember[];
  activities: Activity[];
  items: PackingItem[];
  outfits: Outfit[];
  themes: Theme[];
  votes: Vote[];
  photos: Photo[];
  comments: CommentRow[];
  reactions: Reaction[];
  shipments: Shipment[];
  feed: FeedEntry[];
  notifications: NotificationRow[];
  unreadNotifications: number;
  weather: WeatherDay[];
  tripDays: string[];
  myMember: TripMember | null;
  myRole: TripRole | null;
  canOrganize: boolean;
  canContribute: boolean;
  reloadTrips: () => Promise<void>;
  reloadTrip: () => Promise<void>;
  createTrip: (input: NewTripInput) => Promise<Result>;
  updateTrip: (patch: Partial<Trip>) => Promise<Result>;
  deleteTrip: (id: string) => Promise<Result>;
  seedDemo: () => Promise<Result>;
  inviteMember: (name: string, email: string | null, role: TripRole) => Promise<Result & { code?: string }>;
  updateMember: (id: string, patch: Partial<TripMember>) => Promise<Result>;
  removeMember: (id: string) => Promise<Result>;
  redeemInvite: (code: string) => Promise<Result>;
  saveActivity: (a: Partial<Activity> & { name: string }) => Promise<Result>;
  deleteActivity: (id: string) => Promise<Result>;
  addItem: (i: Partial<PackingItem> & { name: string }) => Promise<Result>;
  updateItem: (id: string, patch: Partial<PackingItem>) => Promise<Result>;
  deleteItem: (id: string) => Promise<Result>;
  duplicateItem: (id: string) => Promise<Result>;
  setItemPacked: (id: string, packed: boolean) => Promise<Result>;
  setItemStatus: (id: string, status: BagStatus) => Promise<Result>;
  saveOutfit: (o: Partial<Outfit> & { member_id: string; date: string }, photo?: File) => Promise<Result>;
  deleteOutfit: (id: string) => Promise<Result>;
  chooseOutfit: (o: Outfit) => Promise<Result>;
  saveTheme: (t: Partial<Theme> & { name: string }) => Promise<Result>;
  deleteTheme: (id: string) => Promise<Result>;
  toggleVote: (kind: Vote['target_kind'], targetId: string) => Promise<Result>;
  addPhoto: (
    meta: Partial<Photo> & { kind: string },
    file?: File
  ) => Promise<Result>;
  deletePhoto: (id: string) => Promise<Result>;
  addComment: (kind: CommentRow['target_kind'], targetId: string | null, body: string) => Promise<Result>;
  deleteComment: (id: string) => Promise<Result>;
  toggleReaction: (kind: Reaction['target_kind'], targetId: string, emoji: string) => Promise<Result>;
  saveShipment: (s: Partial<Shipment>) => Promise<Result>;
  deleteShipment: (id: string) => Promise<Result>;
  postFeed: (kind: string, message: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}

const err = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : 'Something went wrong.',
});

export function TripProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_TRIP_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [weather, setWeather] = useState<WeatherDay[]>([]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const setActiveTripId = useCallback((id: string | null) => {
    setActiveTripIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_TRIP_KEY, id);
      else localStorage.removeItem(ACTIVE_TRIP_KEY);
    } catch {
      /* best effort */
    }
  }, []);

  const reloadTrips = useCallback(async () => {
    if (!session) {
      setTrips([]);
      setTripsLoading(false);
      return;
    }
    setTripsLoading(true);
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: true });
    setTrips((data as Trip[] | null) ?? []);
    setTripsLoading(false);
  }, [session]);

  useEffect(() => {
    void reloadTrips();
  }, [reloadTrips]);

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === activeTripId) ?? trips[0] ?? null,
    [trips, activeTripId]
  );

  const reloadTrip = useCallback(async () => {
    const t = activeTrip;
    if (!t || !session) {
      setMembers([]);
      setActivities([]);
      setItems([]);
      setOutfits([]);
      setThemes([]);
      setVotes([]);
      setPhotos([]);
      setComments([]);
      setReactions([]);
      setShipments([]);
      setFeed([]);
      return;
    }
    const id = t.id;
    const [mem, act, itm, out, thm, vot, pho, com, rea, shp, fed] = await Promise.all([
      supabase.from('trip_members').select('*').eq('trip_id', id).order('created_at'),
      supabase.from('activities').select('*').eq('trip_id', id).order('date').order('start_time'),
      supabase.from('packing_items').select('*').eq('trip_id', id).order('category').order('name'),
      supabase.from('outfits').select('*').eq('trip_id', id).order('date'),
      supabase.from('themes').select('*').eq('trip_id', id).order('date'),
      supabase.from('votes').select('*').eq('trip_id', id),
      supabase.from('photos').select('*').eq('trip_id', id).order('created_at', { ascending: false }),
      supabase.from('comments').select('*').eq('trip_id', id).order('created_at'),
      supabase.from('reactions').select('*').eq('trip_id', id),
      supabase.from('shipments').select('*').eq('trip_id', id).order('created_at', { ascending: false }),
      supabase.from('trip_feed').select('*').eq('trip_id', id).order('created_at', { ascending: false }).limit(40),
    ]);
    setMembers((mem.data as TripMember[] | null) ?? []);
    setActivities((act.data as Activity[] | null) ?? []);
    setItems((itm.data as PackingItem[] | null) ?? []);
    setOutfits((out.data as Outfit[] | null) ?? []);
    setThemes((thm.data as Theme[] | null) ?? []);
    setVotes((vot.data as Vote[] | null) ?? []);
    setPhotos((pho.data as Photo[] | null) ?? []);
    setComments((com.data as CommentRow[] | null) ?? []);
    setReactions((rea.data as Reaction[] | null) ?? []);
    setShipments((shp.data as Shipment[] | null) ?? []);
    setFeed((fed.data as FeedEntry[] | null) ?? []);
  }, [activeTrip, session]);

  useEffect(() => {
    let cancelled = false;
    if (!activeTrip) return;
    setLoading(true);
    void reloadTrip().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTrip, reloadTrip]);

  /* Weather for the active trip window. */
  useEffect(() => {
    let cancelled = false;
    if (!activeTrip || activeTrip.lat == null || activeTrip.lon == null) {
      setWeather([]);
      return;
    }
    const days = eachDay(activeTrip.start_date, activeTrip.end_date);
    void fetchTripWeather(activeTrip.lat, activeTrip.lon, activeTrip.start_date, activeTrip.end_date, days).then(
      (w) => {
        if (!cancelled) setWeather(w);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeTrip]);

  /* Group sync: realtime changes on the active trip trigger a debounced reload. */
  const reloadTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!activeTrip || !session) return;
    const debouncedReload = () => {
      window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => void reloadTrip(), 400);
    };
    const channel = supabase.channel(`trip-${activeTrip.id}`);
    for (const table of [
      'trip_members',
      'activities',
      'packing_items',
      'outfits',
      'themes',
      'votes',
      'photos',
      'comments',
      'reactions',
      'shipments',
      'trip_feed',
    ]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `trip_id=eq.${activeTrip.id}` },
        debouncedReload
      );
    }
    channel.subscribe();
    return () => {
      window.clearTimeout(reloadTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [activeTrip, session, reloadTrip]);

  /* Notifications (user-level). */
  const reloadNotifications = useCallback(async () => {
    if (!session) {
      setNotifications([]);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as NotificationRow[] | null) ?? []);
  }, [session]);

  useEffect(() => {
    void reloadNotifications();
  }, [reloadNotifications]);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === session?.user.id) ?? null,
    [members, session]
  );
  const myRole: TripRole | null =
    myMember?.role ?? (activeTrip && activeTrip.owner_id === session?.user.id ? 'owner' : null);
  const canOrganize = myRole === 'owner' || myRole === 'organizer';
  const canContribute = canOrganize || myRole === 'traveler';

  const actorName = profile?.display_name || 'Someone';

  const postFeed = useCallback(
    async (kind: string, message: string) => {
      if (!activeTrip) return;
      await supabase
        .from('trip_feed')
        .insert({ trip_id: activeTrip.id, actor_name: actorName, kind, message });
    },
    [activeTrip, actorName]
  );

  /* ── Trips ── */

  const createTrip = useCallback(
    async (input: NewTripInput): Promise<Result> => {
      if (!session) return { ok: false, error: 'Sign in first.' };
      try {
        // Prefer coordinates captured from city autocomplete; only geocode
        // when the organizer typed a city without picking a suggestion.
        const coords: { lat: number; lon: number } | null =
          input.lat != null && input.lon != null
            ? { lat: input.lat, lon: input.lon }
            : await geocode([input.city, input.region, input.country].filter(Boolean).join(', '));
        const { data: tripRow, error } = await supabase
          .from('trips')
          .insert({
            owner_id: session.user.id,
            name: input.name,
            trip_type: input.trip_type,
            city: input.city,
            region: input.region,
            country: input.country,
            lodging_type: input.lodging_type,
            lodging_name: input.lodging_name,
            address: input.address,
            depart_location: input.depart_location,
            transport: input.transport,
            start_date: input.start_date,
            end_date: input.end_date,
            travelers_count: input.travelers.length + 1,
            laundry_available: input.laundry_available,
            lat: coords?.lat ?? null,
            lon: coords?.lon ?? null,
            notes: input.notes,
          })
          .select('*')
          .single();
        if (error) return { ok: false, error: error.message };
        const trip = tripRow as Trip;

        // Placeholder member rows for invited travelers.
        if (input.travelers.length > 0) {
          const palette = ['#0e7490', '#a16207', '#15803d', '#7c3aed', '#be185d', '#334155'];
          await supabase.from('trip_members').insert(
            input.travelers.map((tr, i) => ({
              trip_id: trip.id,
              name: tr.name,
              email: tr.email,
              role: tr.role,
              color: palette[i % palette.length],
            }))
          );
        }

        // Itinerary.
        let activityRows: Activity[] = [];
        if (input.activities.length > 0) {
          const { data: actData } = await supabase
            .from('activities')
            .insert(input.activities.map((a) => ({ ...a, trip_id: trip.id })))
            .select('*');
          activityRows = (actData as Activity[] | null) ?? [];
        }

        // Generate the personalized packing list.
        const allDays = eachDay(trip.start_date, trip.end_date);
        const wx =
          coords != null
            ? await fetchTripWeather(coords.lat, coords.lon, trip.start_date, trip.end_date, allDays)
            : [];
        const international =
          Boolean(input.country) &&
          !/^(us|usa|united states)/i.test(input.country.trim());
        const generated = generatePackingList(
          {
            trip_type: trip.trip_type,
            transport: trip.transport,
            lodging_type: trip.lodging_type,
            country: trip.country,
            laundry_available: trip.laundry_available,
            days: allDays.length,
            international,
          },
          input.activities.map((a) => ({
            kind: a.kind,
            dress_code: a.dress_code,
            intensity: a.intensity,
            setting: a.setting,
          })),
          wx
        );

        const { data: memberData } = await supabase
          .from('trip_members')
          .select('*')
          .eq('trip_id', trip.id);
        const allMembers = (memberData as TripMember[] | null) ?? [];
        const travelerMembers = allMembers.filter((m) => m.role !== 'viewer');

        const findActivity = (kind?: string) =>
          kind ? activityRows.find((a) => a.kind === kind) : undefined;

        interface NewItemRow {
          trip_id: string;
          name: string;
          category: string;
          qty: number;
          required: boolean;
          status: 'own' | 'need';
          last_minute: boolean;
          notes: string | null;
          day: string | null;
          activity_id: string | null;
          created_by: string;
          member_id: string | null;
        }
        const rows = generated.flatMap((g): NewItemRow[] => {
          const act = findActivity(g.activityKind);
          const base = {
            trip_id: trip.id,
            name: g.name,
            category: g.category,
            qty: g.qty,
            required: g.required,
            status: g.status,
            last_minute: g.last_minute,
            notes: g.notes ?? null,
            day: act?.date ?? null,
            activity_id: act?.id ?? null,
            created_by: session.user.id,
          };
          return g.perTraveler
            ? travelerMembers.map((m) => ({ ...base, member_id: m.id }))
            : [{ ...base, member_id: null }];
        });
        if (rows.length > 0) await supabase.from('packing_items').insert(rows);

        await supabase.from('trip_feed').insert({
          trip_id: trip.id,
          actor_name: actorName,
          kind: 'member',
          message: `created the trip and generated ${rows.length} packing items`,
        });

        await reloadTrips();
        setActiveTripId(trip.id);
        return { ok: true, id: trip.id };
      } catch (e) {
        return err(e);
      }
    },
    [session, actorName, reloadTrips, setActiveTripId]
  );

  const updateTrip = useCallback(
    async (patch: Partial<Trip>): Promise<Result> => {
      if (!activeTrip) return { ok: false, error: 'No active trip.' };
      const { error } = await supabase.from('trips').update(patch).eq('id', activeTrip.id);
      if (!error) await reloadTrips();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, reloadTrips]
  );

  const deleteTrip = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (!error) {
        if (activeTripId === id) setActiveTripId(null);
        await reloadTrips();
      }
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTripId, setActiveTripId, reloadTrips]
  );

  const seedDemo = useCallback(async (): Promise<Result> => {
    const { data, error } = await supabase.rpc('seed_demo_trip');
    if (error) return { ok: false, error: error.message };
    await reloadTrips();
    setActiveTripId(data as string);
    return { ok: true, id: data as string };
  }, [reloadTrips, setActiveTripId]);

  /* ── Members & invitations ── */

  const inviteMember = useCallback(
    async (name: string, email: string | null, role: TripRole) => {
      if (!activeTrip) return { ok: false, error: 'No active trip.' };
      const { data, error } = await supabase
        .from('trip_members')
        .insert({ trip_id: activeTrip.id, name, email, role })
        .select('invite_code')
        .single();
      if (error) return { ok: false, error: error.message };
      await postFeed('member', `invited ${name} as ${role}`);
      await reloadTrip();
      return { ok: true, code: (data as { invite_code: string }).invite_code };
    },
    [activeTrip, postFeed, reloadTrip]
  );

  const updateMember = useCallback(
    async (id: string, patch: Partial<TripMember>): Promise<Result> => {
      const { error } = await supabase.from('trip_members').update(patch).eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const removeMember = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('trip_members').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const redeemInvite = useCallback(
    async (code: string): Promise<Result> => {
      const { data, error } = await supabase.rpc('redeem_trip_invite', { p_code: code.trim() });
      if (error) return { ok: false, error: error.message };
      await reloadTrips();
      setActiveTripId(data as string);
      return { ok: true, id: data as string };
    },
    [reloadTrips, setActiveTripId]
  );

  /* ── Activities ── */

  const saveActivity = useCallback(
    async (a: Partial<Activity> & { name: string }): Promise<Result> => {
      if (!activeTrip) return { ok: false, error: 'No active trip.' };
      const { id, ...rest } = a;
      const { error } = id
        ? await supabase.from('activities').update(rest).eq('id', id)
        : await supabase.from('activities').insert({ ...rest, trip_id: activeTrip.id });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, reloadTrip]
  );

  const deleteActivity = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  /* ── Packing items / Bag ── */

  const addItem = useCallback(
    async (i: Partial<PackingItem> & { name: string }): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      const { error } = await supabase
        .from('packing_items')
        .insert({ ...i, trip_id: activeTrip.id, created_by: session.user.id });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, session, reloadTrip]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<PackingItem>): Promise<Result> => {
      // Optimistic update keeps the checklist feeling instant.
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const { error } = await supabase.from('packing_items').update(patch).eq('id', id);
      if (error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const deleteItem = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('packing_items').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const duplicateItem = useCallback(
    async (id: string): Promise<Result> => {
      const src = items.find((i) => i.id === id);
      if (!src || !activeTrip) return { ok: false, error: 'Item not found.' };
      const { id: _id, created_at: _c, ...rest } = src;
      const { error } = await supabase
        .from('packing_items')
        .insert({ ...rest, name: `${src.name} (copy)`, packed: false });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [items, activeTrip, reloadTrip]
  );

  const setItemPacked = useCallback(
    (id: string, packed: boolean) => updateItem(id, { packed }),
    [updateItem]
  );

  const setItemStatus = useCallback(
    (id: string, status: BagStatus) => updateItem(id, { status }),
    [updateItem]
  );

  /* ── Outfits ── */

  const saveOutfit = useCallback(
    async (
      o: Partial<Outfit> & { member_id: string; date: string },
      photo?: File
    ): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      try {
        let photo_path = o.photo_path ?? null;
        if (photo) photo_path = await uploadTripPhoto(activeTrip.id, photo);
        const { id, ...rest } = o;
        const payload = { ...rest, photo_path };
        const { error } = id
          ? await supabase.from('outfits').update(payload).eq('id', id)
          : await supabase
              .from('outfits')
              .insert({ ...payload, trip_id: activeTrip.id, created_by: session.user.id });
        if (error) return { ok: false, error: error.message };
        await reloadTrip();
        return { ok: true };
      } catch (e) {
        return err(e);
      }
    },
    [activeTrip, session, reloadTrip]
  );

  const deleteOutfit = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('outfits').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  /** Mark one outfit as the traveler's pick for that day (unsets siblings). */
  const chooseOutfit = useCallback(
    async (o: Outfit): Promise<Result> => {
      await supabase
        .from('outfits')
        .update({ chosen: false })
        .eq('trip_id', o.trip_id)
        .eq('member_id', o.member_id)
        .eq('date', o.date);
      const { error } = await supabase.from('outfits').update({ chosen: true }).eq('id', o.id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  /* ── Themes & votes ── */

  const saveTheme = useCallback(
    async (t: Partial<Theme> & { name: string }): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      const { id, ...rest } = t;
      const { error } = id
        ? await supabase.from('themes').update(rest).eq('id', id)
        : await supabase
            .from('themes')
            .insert({ ...rest, trip_id: activeTrip.id, created_by: session.user.id });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, session, reloadTrip]
  );

  const deleteTheme = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('themes').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const toggleVote = useCallback(
    async (kind: Vote['target_kind'], targetId: string): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      const mine = votes.find(
        (v) => v.target_kind === kind && v.target_id === targetId && v.user_id === session.user.id
      );
      const { error } = mine
        ? await supabase.from('votes').delete().eq('id', mine.id)
        : await supabase.from('votes').insert({
            trip_id: activeTrip.id,
            target_kind: kind,
            target_id: targetId,
            user_id: session.user.id,
          });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, session, votes, reloadTrip]
  );

  /* ── Photos, comments, reactions ── */

  const addPhoto = useCallback(
    async (meta: Partial<Photo> & { kind: string }, file?: File): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      try {
        let storage_path: string | null = null;
        if (file) storage_path = await uploadTripPhoto(activeTrip.id, file);
        if (!storage_path && !meta.external_url)
          return { ok: false, error: 'Choose a photo to upload.' };
        const { error } = await supabase.from('photos').insert({
          ...meta,
          trip_id: activeTrip.id,
          uploaded_by: session.user.id,
          uploader_name: actorName,
          storage_path,
        });
        if (error) return { ok: false, error: error.message };
        await postFeed('photo', 'added a photo');
        await reloadTrip();
        return { ok: true };
      } catch (e) {
        return err(e);
      }
    },
    [activeTrip, session, actorName, postFeed, reloadTrip]
  );

  const deletePhoto = useCallback(
    async (id: string): Promise<Result> => {
      const photo = photos.find((p) => p.id === id);
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (!error && photo?.storage_path) {
        await supabase.storage.from('trip-photos').remove([photo.storage_path]);
      }
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [photos, reloadTrip]
  );

  const addComment = useCallback(
    async (
      kind: CommentRow['target_kind'],
      targetId: string | null,
      body: string
    ): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      const { error } = await supabase.from('comments').insert({
        trip_id: activeTrip.id,
        target_kind: kind,
        target_id: targetId,
        author_id: session.user.id,
        author_name: actorName,
        body,
      });
      if (!error) {
        await postFeed('comment', 'added a comment');
        await reloadTrip();
      }
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, session, actorName, postFeed, reloadTrip]
  );

  const deleteComment = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  const toggleReaction = useCallback(
    async (kind: Reaction['target_kind'], targetId: string, emoji: string): Promise<Result> => {
      if (!activeTrip || !session) return { ok: false, error: 'No active trip.' };
      const mine = reactions.find(
        (r) =>
          r.target_kind === kind &&
          r.target_id === targetId &&
          r.user_id === session.user.id &&
          r.emoji === emoji
      );
      const { error } = mine
        ? await supabase.from('reactions').delete().eq('id', mine.id)
        : await supabase.from('reactions').insert({
            trip_id: activeTrip.id,
            target_kind: kind,
            target_id: targetId,
            user_id: session.user.id,
            emoji,
          });
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, session, reactions, reloadTrip]
  );

  /* ── Shipments ── */

  const saveShipment = useCallback(
    async (s: Partial<Shipment>): Promise<Result> => {
      if (!activeTrip) return { ok: false, error: 'No active trip.' };
      const { id, ...rest } = s;
      const { error } = id
        ? await supabase.from('shipments').update(rest).eq('id', id)
        : await supabase.from('shipments').insert({ ...rest, trip_id: activeTrip.id });
      if (!error) {
        // Keep the linked packing item's bag status in step with the shipment.
        if (rest.packing_item_id && rest.status) {
          const map: Partial<Record<string, BagStatus>> = {
            order_placed: 'ordered',
            preparing: 'ordered',
            shipped: 'shipped',
            in_transit: 'shipped',
            out_for_delivery: 'shipped',
            delivered: 'delivered',
          };
          const bagStatus = map[rest.status];
          if (bagStatus)
            await supabase
              .from('packing_items')
              .update({ status: bagStatus })
              .eq('id', rest.packing_item_id);
        }
        await reloadTrip();
      }
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [activeTrip, reloadTrip]
  );

  const deleteShipment = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from('shipments').delete().eq('id', id);
      if (!error) await reloadTrip();
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [reloadTrip]
  );

  /* ── Notifications ── */

  const markNotificationRead = useCallback(
    async (id: string) => {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      await reloadNotifications();
    },
    [reloadNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!session) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .is('read_at', null);
    await reloadNotifications();
  }, [session, reloadNotifications]);

  const tripDays = useMemo(
    () => (activeTrip ? eachDay(activeTrip.start_date, activeTrip.end_date) : []),
    [activeTrip]
  );

  const unreadNotifications = notifications.filter((n) => !n.read_at).length;

  return (
    <TripContext.Provider
      value={{
        offline,
        trips,
        tripsLoading,
        activeTrip,
        setActiveTripId,
        loading,
        members,
        activities,
        items,
        outfits,
        themes,
        votes,
        photos,
        comments,
        reactions,
        shipments,
        feed,
        notifications,
        unreadNotifications,
        weather,
        tripDays,
        myMember,
        myRole,
        canOrganize,
        canContribute,
        reloadTrips,
        reloadTrip,
        createTrip,
        updateTrip,
        deleteTrip,
        seedDemo,
        inviteMember,
        updateMember,
        removeMember,
        redeemInvite,
        saveActivity,
        deleteActivity,
        addItem,
        updateItem,
        deleteItem,
        duplicateItem,
        setItemPacked,
        setItemStatus,
        saveOutfit,
        deleteOutfit,
        chooseOutfit,
        saveTheme,
        deleteTheme,
        toggleVote,
        addPhoto,
        deletePhoto,
        addComment,
        deleteComment,
        toggleReaction,
        saveShipment,
        deleteShipment,
        postFeed,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}
