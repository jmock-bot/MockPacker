-- MockPacker schema · run first in the Supabase SQL editor.
--
-- Access model: a trip is visible only to its members. Roles:
--   owner      — full control, can delete the trip and manage permissions
--   organizer  — edits itinerary, themes, assignments, moderates comments
--   traveler   — manages own packing list, outfits, photos, comments, votes
--   viewer     — read-only
-- Enforced by Postgres Row Level Security, not just hidden in the UI.

create extension if not exists pgcrypto;

-- ───────────────────────── enums ─────────────────────────

create type trip_role as enum ('owner', 'organizer', 'traveler', 'viewer');
create type trip_kind as enum ('personal', 'family', 'business', 'romantic', 'group', 'event');
-- The Bag pipeline: where an item stands between "we need one" and "it's here".
create type bag_status as enum ('need', 'considering', 'own', 'ordered', 'shipped', 'delivered');
create type shipment_status as enum (
  'order_placed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery',
  'delivered', 'delayed', 'exception', 'returned'
);
create type theme_status as enum ('proposed', 'voting', 'approved');

-- ───────────────────────── profiles ─────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  home_location text,
  shirt_size text,
  pants_size text,
  dress_size text,
  shoe_size text,
  preferred_fit text,          -- e.g. slim / regular / relaxed
  gender_neutral boolean not null default false,
  favorite_colors text,
  style_prefs text,
  travel_prefs text,
  accessibility_notes text,
  care_notes text,             -- allergies / personal-care requirements (optional)
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- The select policy ("read own profile or co-travelers") is created in the
-- trips section below — it references trip_members, which must exist first.
create policy "update own profile" on profiles for update using (id = auth.uid());
create policy "insert own profile" on profiles for insert with check (id = auth.uid());

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',
                           new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── trips ─────────────────────────

create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  trip_type trip_kind not null default 'personal',
  city text not null default '',
  region text not null default '',
  country text not null default '',
  lodging_type text,           -- hotel / resort / cruise / campground / rental / venue
  lodging_name text,
  address text,
  depart_location text,
  transport text,              -- flight / car / train / cruise / bus
  start_date date not null,
  end_date date not null,
  travelers_count int not null default 1,
  laundry_available boolean not null default false,
  lat double precision,
  lon double precision,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint trips_dates check (end_date >= start_date)
);

create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text,
  role trip_role not null default 'traveler',
  color text not null default '#6e1423',
  invite_code text not null unique default encode(gen_random_bytes(9), 'hex'),
  joined boolean not null default false,
  created_at timestamptz not null default now()
);

create index trip_members_trip on trip_members (trip_id);
create index trip_members_user on trip_members (user_id);
create unique index trip_members_trip_user on trip_members (trip_id, user_id)
  where user_id is not null;

-- Membership helpers (security definer so policies can consult trip_members
-- without recursing into its own policies).
create or replace function public.is_trip_member(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from trip_members
    where trip_id = t and user_id = auth.uid() and joined
  ) or exists (select 1 from trips where id = t and owner_id = auth.uid());
$$;

create or replace function public.trip_role_of(t uuid)
returns trip_role language sql security definer stable set search_path = public as $$
  select coalesce(
    (select role from trip_members where trip_id = t and user_id = auth.uid() and joined limit 1),
    (select 'owner'::trip_role from trips where id = t and owner_id = auth.uid())
  );
$$;

-- Owner or organizer.
create or replace function public.can_organize(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.trip_role_of(t) in ('owner', 'organizer');
$$;

-- Any member who is not a viewer.
create or replace function public.can_contribute(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.trip_role_of(t) in ('owner', 'organizer', 'traveler');
$$;

alter table trips enable row level security;
create policy "members read trips" on trips for select using (public.is_trip_member(id));
create policy "create own trips" on trips for insert with check (owner_id = auth.uid());
create policy "organizers edit trips" on trips for update using (public.can_organize(id));
create policy "owner deletes trip" on trips for delete using (owner_id = auth.uid());

alter table trip_members enable row level security;
create policy "members read members" on trip_members for select using (public.is_trip_member(trip_id));
create policy "organizers add members" on trip_members for insert with check (public.can_organize(trip_id));
create policy "organizers edit members" on trip_members for update using (public.can_organize(trip_id));
create policy "organizers remove members" on trip_members for delete using (public.can_organize(trip_id));

-- Profiles are visible to yourself and to people who share a trip with you.
-- create policy resolves referenced tables immediately, so this must come
-- after trip_members exists (not in the profiles section above).
create policy "read own profile or co-travelers" on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from trip_members a
      join trip_members b on a.trip_id = b.trip_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );

-- The trip owner automatically becomes a joined member.
create or replace function public.handle_new_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into trip_members (trip_id, user_id, name, role, joined)
  values (
    new.id, new.owner_id,
    coalesce((select nullif(display_name, '') from profiles where id = new.owner_id), 'Organizer'),
    'owner', true
  );
  return new;
end $$;

create trigger on_trip_created after insert on trips
  for each row execute function public.handle_new_trip();

-- Redeem an invitation code: claims the placeholder member row for the
-- signed-in user. Security definer — the user is not yet a member, so RLS
-- would otherwise block the update.
create or replace function public.redeem_trip_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m trip_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select * into m from trip_members where invite_code = p_code;
  if m.id is null then
    raise exception 'That invitation code is not valid.';
  end if;
  if m.user_id is not null and m.user_id <> auth.uid() then
    raise exception 'That invitation was already used by someone else.';
  end if;
  -- Already a member under a different row? Just mark joined.
  if exists (
    select 1 from trip_members
    where trip_id = m.trip_id and user_id = auth.uid() and id <> m.id
  ) then
    return m.trip_id;
  end if;
  update trip_members set user_id = auth.uid(), joined = true where id = m.id;
  return m.trip_id;
end $$;

-- ───────────────────────── destinations (multi-stop trips) ─────────────────────────

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  city text not null default '',
  region text not null default '',
  country text not null default '',
  arrive_date date,
  depart_date date,
  lat double precision,
  lon double precision,
  sort int not null default 0
);

create index trip_stops_trip on trip_stops (trip_id);
alter table trip_stops enable row level security;
create policy "members read stops" on trip_stops for select using (public.is_trip_member(trip_id));
create policy "organizers write stops" on trip_stops for all
  using (public.can_organize(trip_id)) with check (public.can_organize(trip_id));

-- ───────────────────────── activities ─────────────────────────

create table activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  kind text not null default 'custom',      -- catalog key, see src/lib/activities.ts
  date date,
  start_time time,
  end_time time,
  location text,
  dress_code text,                          -- casual / smart casual / business / formal / themed
  setting text not null default 'mixed',    -- indoor / outdoor / mixed
  intensity text not null default 'low',    -- low / moderate / high
  equipment text,
  notes text,
  created_at timestamptz not null default now()
);

create index activities_trip on activities (trip_id);
alter table activities enable row level security;
create policy "members read activities" on activities for select using (public.is_trip_member(trip_id));
create policy "organizers write activities" on activities for all
  using (public.can_organize(trip_id)) with check (public.can_organize(trip_id));

-- ───────────────────────── packing items (the Bag) ─────────────────────────
-- One table backs both the packing checklist and the Bag inventory: an item's
-- bag status says whether it is owned / needed / ordered / delivered, and
-- `packed` says whether it made it into the luggage.

create table packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  member_id uuid references trip_members (id) on delete set null,  -- null = shared/group item
  name text not null,
  category text not null default 'Clothing',
  qty int not null default 1 check (qty between 1 and 99),
  required boolean not null default true,
  packed boolean not null default false,
  status bag_status not null default 'own',
  day date,                                  -- recommended day
  activity_id uuid references activities (id) on delete set null,
  last_minute boolean not null default false,
  notes text,
  photo_path text,                           -- storage path in trip-photos bucket
  external_image_url text,                   -- e.g. product thumbnail
  product_url text,
  store text,
  est_price numeric(10, 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index packing_items_trip on packing_items (trip_id);
alter table packing_items enable row level security;
create policy "members read items" on packing_items for select using (public.is_trip_member(trip_id));
create policy "contributors write items" on packing_items for all
  using (public.can_contribute(trip_id)) with check (public.can_contribute(trip_id));

-- ───────────────────────── outfits ─────────────────────────

create table outfits (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  member_id uuid not null references trip_members (id) on delete cascade,
  date date not null,
  title text not null default '',
  top_item text,
  bottom_item text,
  shoes text,
  outerwear text,
  accessories text,
  notes text,
  product_links text,
  photo_path text,
  external_image_url text,
  chosen boolean not null default false,     -- the outfit the traveler will wear that day
  approved boolean not null default false,   -- group/theme approval
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index outfits_trip on outfits (trip_id);
alter table outfits enable row level security;
create policy "members read outfits" on outfits for select using (public.is_trip_member(trip_id));
create policy "contributors write outfits" on outfits for all
  using (public.can_contribute(trip_id)) with check (public.can_contribute(trip_id));

-- ───────────────────────── themed days ─────────────────────────

create table themes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  date date,
  description text,
  colors text,                               -- comma-separated palette, e.g. "white, gold"
  dress_code text,
  suggested_clothing text,
  required_accessories text,
  status theme_status not null default 'proposed',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index themes_trip on themes (trip_id);
alter table themes enable row level security;
create policy "members read themes" on themes for select using (public.is_trip_member(trip_id));
create policy "contributors write themes" on themes for all
  using (public.can_contribute(trip_id)) with check (public.can_contribute(trip_id));

-- Votes on themes and outfit options.
create table votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  target_kind text not null check (target_kind in ('theme', 'outfit')),
  target_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (target_kind, target_id, user_id)
);

create index votes_trip on votes (trip_id);
alter table votes enable row level security;
create policy "members read votes" on votes for select using (public.is_trip_member(trip_id));
create policy "contributors vote" on votes for insert
  with check (public.can_contribute(trip_id) and user_id = auth.uid());
create policy "remove own vote" on votes for delete using (user_id = auth.uid());

-- ───────────────────────── photos, comments, reactions ─────────────────────────

create table photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  member_id uuid references trip_members (id) on delete set null,   -- associated traveler
  uploaded_by uuid references auth.users (id) on delete set null,
  uploader_name text not null default '',
  storage_path text,                          -- private trip-photos bucket
  external_url text,                          -- e.g. product screenshot URL (demo data uses this)
  caption text,
  date date,
  activity_id uuid references activities (id) on delete set null,
  kind text not null default 'inspiration',   -- inspiration / owned / product / theme / luggage / packed / memory
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index photos_trip on photos (trip_id);
alter table photos enable row level security;
create policy "members read photos" on photos for select using (public.is_trip_member(trip_id));
create policy "contributors add photos" on photos for insert
  with check (public.can_contribute(trip_id));
create policy "edit own photos or organizer" on photos for update
  using (uploaded_by = auth.uid() or public.can_organize(trip_id));
create policy "delete own photos or organizer" on photos for delete
  using (uploaded_by = auth.uid() or public.can_organize(trip_id));

create table comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  target_kind text not null check (target_kind in ('photo', 'theme', 'outfit', 'trip')),
  target_id uuid,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_trip on comments (trip_id);
alter table comments enable row level security;
create policy "members read comments" on comments for select using (public.is_trip_member(trip_id));
create policy "contributors add comments" on comments for insert
  with check (public.can_contribute(trip_id) and author_id = auth.uid());
create policy "delete own comments or organizer" on comments for delete
  using (author_id = auth.uid() or public.can_organize(trip_id));

create table reactions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  target_kind text not null check (target_kind in ('photo', 'comment', 'outfit', 'theme')),
  target_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now(),
  unique (target_kind, target_id, user_id, emoji)
);

create index reactions_trip on reactions (trip_id);
alter table reactions enable row level security;
create policy "members read reactions" on reactions for select using (public.is_trip_member(trip_id));
create policy "contributors react" on reactions for insert
  with check (public.can_contribute(trip_id) and user_id = auth.uid());
create policy "remove own reaction" on reactions for delete using (user_id = auth.uid());

-- ───────────────────────── shipments ─────────────────────────

create table shipments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  member_id uuid references trip_members (id) on delete set null,
  packing_item_id uuid references packing_items (id) on delete set null,
  carrier text not null default 'other',      -- usps / ups / fedex / dhl / amazon / other
  tracking_number text,
  tracking_url text,                          -- manual override link
  retailer text,
  order_number text,
  status shipment_status not null default 'order_placed',
  eta_date date,
  last_scan text,
  last_scan_at timestamptz,
  created_at timestamptz not null default now()
);

create index shipments_trip on shipments (trip_id);
alter table shipments enable row level security;
create policy "members read shipments" on shipments for select using (public.is_trip_member(trip_id));
create policy "contributors write shipments" on shipments for all
  using (public.can_contribute(trip_id)) with check (public.can_contribute(trip_id));

-- ───────────────────────── notifications & activity feed ─────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references trips (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user on notifications (user_id);
alter table notifications enable row level security;
create policy "read own notifications" on notifications for select using (user_id = auth.uid());
create policy "update own notifications" on notifications for update using (user_id = auth.uid());
-- Members may notify each other inside a shared trip (invites, assignments…).
create policy "members create notifications" on notifications for insert
  with check (trip_id is not null and public.is_trip_member(trip_id));

-- Lightweight "recent trip activity" stream shown on Group + Home.
create table trip_feed (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  actor_name text not null default '',
  kind text not null default 'update',        -- packed / comment / photo / outfit / purchase / shipping / theme / member
  message text not null,
  created_at timestamptz not null default now()
);

create index trip_feed_trip on trip_feed (trip_id, created_at desc);
alter table trip_feed enable row level security;
create policy "members read feed" on trip_feed for select using (public.is_trip_member(trip_id));
create policy "contributors write feed" on trip_feed for insert
  with check (public.can_contribute(trip_id));

-- ───────────────────────── storage ─────────────────────────
-- trip-photos: PRIVATE. Objects live under <trip_id>/<file>. Only trip
-- members can read or write, and the app displays them via signed URLs.
-- avatars: public profile pictures under <user_id>/<file>.

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "trip members read photos" on storage.objects for select
  using (bucket_id = 'trip-photos' and public.is_trip_member((split_part(name, '/', 1))::uuid));
create policy "trip members upload photos" on storage.objects for insert
  with check (bucket_id = 'trip-photos' and public.can_contribute((split_part(name, '/', 1))::uuid));
create policy "trip members delete photos" on storage.objects for delete
  using (bucket_id = 'trip-photos' and public.can_contribute((split_part(name, '/', 1))::uuid));

create policy "anyone reads avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "user writes own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "user updates own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "user deletes own avatar" on storage.objects for delete
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
