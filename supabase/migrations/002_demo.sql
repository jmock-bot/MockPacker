-- MockPacker demo data · run after 001_schema.sql.
--
-- seed_demo_trip() builds a complete sample trip owned by the CALLING user:
-- four travelers, five days, a formal dinner, an approved all-white theme day,
-- packing progress, saved products, one delivered + one delayed shipment,
-- outfit photos, comments, and a live activity feed. The trip is flagged
-- is_demo so the UI labels it, and it can be deleted like any other trip.
-- The app calls this from the "Load a demo trip" button.

create or replace function public.seed_demo_trip()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my_name text;
  t uuid;            -- trip id
  me uuid;           -- caller's member id
  maya uuid; jordan uuid; nia uuid;
  d0 date := current_date + 12;   -- departure ~2 weeks out so countdowns look real
  act_flight uuid; act_beach uuid; act_dinner uuid; act_photo uuid; act_kayak uuid;
  th uuid;           -- theme id
  item_dress uuid; item_sandals uuid;
  ph1 uuid; ph2 uuid; ph3 uuid;
  o1 uuid;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  select coalesce(nullif(display_name, ''), 'You') into my_name from profiles where id = uid;

  insert into trips (owner_id, name, trip_type, city, region, country, lodging_type,
                     lodging_name, depart_location, transport, start_date, end_date,
                     travelers_count, laundry_available, lat, lon, is_demo, notes)
  values (uid, 'Cousins'' Beach Week', 'group', 'Hilton Head Island', 'South Carolina', 'United States',
          'rental', 'Sea Oats Beach House', 'Atlanta, GA', 'car', d0, d0 + 4,
          4, true, 32.2163, -80.7526, true,
          'Annual cousins trip — beach house sleeps 8, formal dinner Thursday, family photos Friday.')
  returning id into t;

  -- The trigger already added the caller as owner; fetch that member row.
  select id into me from trip_members where trip_id = t and user_id = uid;
  update trip_members set color = '#6e1423' where id = me;

  insert into trip_members (trip_id, name, email, role, color, joined) values
    (t, 'Maya', 'maya@example.com', 'organizer', '#0e7490', false) returning id into maya;
  insert into trip_members (trip_id, name, email, role, color, joined) values
    (t, 'Jordan', 'jordan@example.com', 'traveler', '#a16207', false) returning id into jordan;
  insert into trip_members (trip_id, name, email, role, color, joined) values
    (t, 'Nia', 'nia@example.com', 'traveler', '#15803d', false) returning id into nia;

  -- ── itinerary ──
  insert into activities (trip_id, name, kind, date, start_time, end_time, location, dress_code, setting, intensity, notes)
  values (t, 'Drive down + check-in', 'road_trip', d0, '09:00', '14:00', 'I-16 → Hilton Head', 'casual', 'mixed', 'low', 'Pack car snacks; Publix run after check-in.')
  returning id into act_flight;
  insert into activities (trip_id, name, kind, date, start_time, end_time, location, dress_code, setting, intensity, notes)
  values (t, 'Beach + pool day', 'beach', d0 + 1, '10:00', '17:00', 'Coligny Beach', 'swim', 'outdoor', 'moderate', 'Umbrella rental reserved.')
  returning id into act_beach;
  insert into activities (trip_id, name, kind, date, start_time, end_time, location, dress_code, setting, intensity, notes)
  values (t, 'Kayak eco tour', 'outdoor', d0 + 2, '08:30', '11:30', 'Broad Creek Marina', 'athletic', 'outdoor', 'high', 'Water shoes required; dry bag for phones.')
  returning id into act_kayak;
  insert into activities (trip_id, name, kind, date, start_time, end_time, location, dress_code, setting, intensity, notes)
  values (t, 'Formal dinner', 'formal_dinner', d0 + 3, '19:00', '22:00', 'The Ocean Room', 'formal', 'indoor', 'low', 'Reservation for 4 at 7pm — jackets required.')
  returning id into act_dinner;
  insert into activities (trip_id, name, kind, date, start_time, end_time, location, dress_code, setting, intensity, notes)
  values (t, 'Family beach photos', 'photography', d0 + 4, '18:00', '19:30', 'Folly Field Beach', 'themed', 'outdoor', 'low', 'Golden hour session with photographer.')
  returning id into act_photo;

  -- ── themed day ──
  insert into themes (trip_id, name, date, description, colors, dress_code,
                      suggested_clothing, required_accessories, status, created_by)
  values (t, 'All-White Beach Photos', d0 + 4,
          'Everyone in white and cream for the golden-hour family photo session.',
          'white, cream, tan', 'All-white resort wear',
          'White linen shirts or dresses, khaki or white bottoms', 'Barefoot or tan sandals — no logos',
          'approved', uid)
  returning id into th;
  insert into votes (trip_id, target_kind, target_id, user_id) values (t, 'theme', th, uid);

  -- ── packing list (mixed progress across travelers) ──
  insert into packing_items (trip_id, member_id, name, category, qty, required, packed, status, day, activity_id, notes, last_minute) values
    (t, me,     'Driver''s license',        'Travel documents', 1, true,  true,  'own', d0, null, null, true),
    (t, me,     'Beach house confirmation', 'Travel documents', 1, true,  true,  'own', d0, null, 'Saved offline in email', false),
    (t, me,     'T-shirts',                 'Clothing', 5, true, true,  'own', null, null, null, false),
    (t, me,     'Shorts',                   'Clothing', 3, true, true,  'own', null, null, null, false),
    (t, me,     'Swimsuit',                 'Clothing', 2, true, true,  'own', d0 + 1, null, null, false),
    (t, me,     'White linen outfit',       'Clothing', 1, true, false, 'own', d0 + 4, null, 'Theme day', false),
    (t, me,     'Toiletry kit',             'Toiletries', 1, true, false, 'own', null, null, null, true),
    (t, me,     'Phone charger',            'Electronics', 1, true, false, 'own', null, null, null, true),
    (t, maya,   'Sundresses',               'Clothing', 3, true, true,  'own', null, null, null, false),
    (t, maya,   'Swimsuit + cover-up',      'Clothing', 2, true, true,  'own', d0 + 1, null, null, false),
    (t, maya,   'Formal dress',             'Clothing', 1, true, true,  'own', d0 + 3, null, 'For The Ocean Room', false),
    (t, maya,   'Sunscreen SPF 50',         'Toiletries', 2, true, false, 'need', d0 + 1, null, 'Reef-safe', false),
    (t, jordan, 'Polo shirts',              'Clothing', 3, true, false, 'own', null, null, null, false),
    (t, jordan, 'Navy blazer',              'Clothing', 1, true, false, 'own', d0 + 3, null, 'Required for dinner', false),
    (t, jordan, 'Water shoes',              'Shoes', 1, true, false, 'need', d0 + 2, null, 'For kayak tour', false),
    (t, nia,    'White maxi dress',         'Clothing', 1, true, false, 'ordered', d0 + 4, null, 'Theme day photos', false),
    (t, nia,    'Sandals',                  'Shoes', 1, true, true, 'delivered', null, null, 'Arrived Tuesday', false),
    (t, null,   'First-aid kit',            'Emergency supplies', 1, true, false, 'own', null, null, 'Shared — anyone can pack it', false),
    (t, null,   'Beach umbrella + chairs',  'Outdoor equipment', 1, false, false, 'own', d0 + 1, null, 'Fits in the cargo box', false),
    (t, null,   'Car snacks + cooler',      'Food and snacks', 1, true, false, 'need', d0, null, 'Publix run before departure', true);

  select id into item_dress   from packing_items where trip_id = t and name = 'White maxi dress';
  select id into item_sandals from packing_items where trip_id = t and name = 'Sandals';

  -- Saved products (Bag entries with store/link/price)
  update packing_items set
    store = 'Nordstrom', est_price = 89.00,
    product_url = 'https://www.nordstrom.com/browse/women/clothing/dresses',
    external_image_url = 'https://picsum.photos/seed/whitedress/400/500'
  where id = item_dress;
  update packing_items set
    store = 'DSW', est_price = 39.99,
    product_url = 'https://www.dsw.com/en/us/category/womens-sandals',
    external_image_url = 'https://picsum.photos/seed/sandals/400/400'
  where id = item_sandals;
  update packing_items set
    store = 'REI', est_price = 24.95,
    product_url = 'https://www.rei.com/c/water-shoes',
    external_image_url = 'https://picsum.photos/seed/watershoe/400/400'
  where trip_id = t and name = 'Water shoes';

  -- ── shipments: one delivered, one delayed ──
  insert into shipments (trip_id, member_id, packing_item_id, carrier, tracking_number, retailer,
                         order_number, status, eta_date, last_scan, last_scan_at)
  values
    (t, nia, item_sandals, 'ups', '1Z999AA10123456784', 'DSW', 'DSW-88213',
     'delivered', current_date - 1, 'Delivered — front porch', now() - interval '1 day'),
    (t, nia, item_dress, 'fedex', '449044304137821', 'Nordstrom', 'NORD-51042',
     'delayed', d0 - 1, 'Shipment exception — weather delay in Memphis hub', now() - interval '6 hours');

  -- ── outfits ──
  insert into outfits (trip_id, member_id, date, title, top_item, bottom_item, shoes, accessories, notes, external_image_url, chosen, approved, created_by)
  values (t, me, d0 + 4, 'All-white linen', 'White linen shirt', 'Cream chinos', 'Tan sandals',
          'No watch — photographer''s request', 'Matches the group palette', 'https://picsum.photos/seed/linenfit/400/500', true, true, uid)
  returning id into o1;
  insert into outfits (trip_id, member_id, date, title, top_item, bottom_item, shoes, notes, chosen, approved, created_by) values
    (t, maya, d0 + 3, 'Ocean Room formal', 'Emerald midi dress', null, 'Nude heels', 'Bringing a wrap — restaurant runs cold', true, false, uid),
    (t, jordan, d0 + 3, 'Dinner classic', 'White dress shirt + navy blazer', 'Gray slacks', 'Brown loafers', null, true, false, uid);
  insert into votes (trip_id, target_kind, target_id, user_id) values (t, 'outfit', o1, uid);

  -- ── photos + comments + reactions ──
  insert into photos (trip_id, member_id, uploaded_by, uploader_name, external_url, caption, date, kind, approved)
  values (t, nia, uid, 'Nia', 'https://picsum.photos/seed/maxidress/600/750',
          'Found the white maxi for photo day — thoughts?', d0 + 4, 'inspiration', true)
  returning id into ph1;
  insert into photos (trip_id, member_id, uploaded_by, uploader_name, external_url, caption, date, kind)
  values (t, jordan, uid, 'Jordan', 'https://picsum.photos/seed/blazerfit/600/750',
          'Dinner fit check — blazer or no blazer?', d0 + 3, 'inspiration')
  returning id into ph2;
  insert into photos (trip_id, member_id, uploaded_by, uploader_name, external_url, caption, kind)
  values (t, maya, uid, 'Maya', 'https://picsum.photos/seed/luggage/600/450',
          'One suitcase. That''s the whole challenge.', 'luggage')
  returning id into ph3;

  insert into comments (trip_id, target_kind, target_id, author_id, author_name, body) values
    (t, 'photo', ph1, uid, 'Maya', 'That''s the one — it photographs so well at golden hour.'),
    (t, 'photo', ph1, uid, 'Jordan', 'Love it. Ordering my white linen shirt tonight.'),
    (t, 'photo', ph2, uid, 'Nia', 'Blazer, 100%. The Ocean Room requires jackets anyway.'),
    (t, 'theme', th, uid, my_name, 'All-white is approved — sunscreen before, not after, photos please 😅');

  insert into reactions (trip_id, target_kind, target_id, user_id, emoji) values
    (t, 'photo', ph1, uid, '❤️'),
    (t, 'photo', ph3, uid, '😂');

  -- ── recent activity feed ──
  insert into trip_feed (trip_id, actor_name, kind, message, created_at) values
    (t, 'Nia',    'shipping', 'Sandals were delivered (UPS)', now() - interval '1 day'),
    (t, 'Nia',    'photo',    'added an outfit photo for photo day', now() - interval '20 hours'),
    (t, 'Maya',   'comment',  'commented on Nia''s outfit photo', now() - interval '19 hours'),
    (t, my_name,  'theme',    'approved the All-White Beach Photos theme', now() - interval '12 hours'),
    (t, 'Jordan', 'packed',   'marked 3 items packed', now() - interval '8 hours'),
    (t, 'Nia',    'shipping', 'White maxi dress shipment is delayed (FedEx)', now() - interval '6 hours');

  return t;
end $$;
