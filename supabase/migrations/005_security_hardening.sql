-- MockPacker security hardening · run after 004_chat.sql.
--
-- ⚠ REVIEW BEFORE RUNNING. This file is the database half of the pre-release
-- security review (see SECURITY-REVIEW.md). Everything in it is safe to apply
-- on its own and needs no frontend change — the two findings that DO require a
-- coordinated frontend change (MP-02 invite-code exposure, MP-03 chat forgery)
-- are deliberately left out and are described at the bottom.
--
-- Safe to re-run: functions are create-or-replace, triggers and policies are
-- dropped first.

-- ───────────── MP-01 · trip takeover (critical) ─────────────
-- The "organizers edit trips" policy restricts WHICH ROWS an organizer may
-- update but not WHICH COLUMNS. An organizer could set owner_id to themselves
-- and then satisfy "owner deletes trip", destroying the trip and — through the
-- on-delete cascades — every member, item, photo, shipment and chat message.
-- Verified reproducible on PostgreSQL 16 against these exact policies.
--
-- RLS can't express a column constraint, so a trigger guards the transfer.

create or replace function public.trips_guard_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'Only the current owner can transfer ownership of a trip.';
  end if;
  return new;
end $$;

drop trigger if exists trips_guard_owner_update on trips;
create trigger trips_guard_owner_update
  before update on trips
  for each row execute function public.trips_guard_owner();

-- ───────────── MP-08 · organizer self-promotion ─────────────
-- Nothing stopped an organizer setting their own trip_members.role to 'owner'.
-- Trip deletion keys off trips.owner_id so the direct impact is limited, but
-- GroupPage hides the role selector and remove button for role = 'owner', so a
-- self-promoted organizer can no longer be demoted or removed through the UI.
-- Only the trip's actual owner may grant or revoke the 'owner' role.

create or replace function public.members_guard_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  trip_owner uuid;
begin
  if new.role is distinct from old.role
     and 'owner' in (new.role::text, old.role::text) then
    select owner_id into trip_owner from trips where id = new.trip_id;
    if trip_owner <> auth.uid() then
      raise exception 'Only the trip owner can grant or revoke the owner role.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists members_guard_role_update on trip_members;
create trigger members_guard_role_update
  before update on trip_members
  for each row execute function public.members_guard_role();

-- ───────────── MP-07 · notifications to arbitrary users ─────────────
-- The old policy checked that the CALLER belongs to the trip but never that the
-- RECIPIENT does, so any member could deliver a notification with an arbitrary
-- title and body into any user's feed. Require the recipient to be on the trip.

drop policy if exists "members create notifications" on notifications;
create policy "members create notifications" on notifications for insert
  with check (
    trip_id is not null
    and public.is_trip_member(trip_id)
    and (
      user_id = auth.uid()
      or exists (
        select 1 from trip_members m
        where m.trip_id = notifications.trip_id
          and m.user_id = notifications.user_id
          and m.joined
      )
      or exists (select 1 from trips t where t.id = notifications.trip_id and t.owner_id = notifications.user_id)
    )
  );

-- ───────────── MP-02 (partial) · invite codes never expire ─────────────
-- Codes stay valid forever and are not bound to the invited email. This adds an
-- expiry and enforces it. The other half of MP-02 — that every member, viewers
-- included, can READ every unclaimed seat's invite_code — needs a frontend
-- change too and is left for that follow-up (see the note at the bottom).

alter table trip_members
  add column if not exists invite_expires_at timestamptz not null default (now() + interval '14 days');

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
  -- New: refuse codes that have aged out. An unused invite is a standing
  -- credential, so it should not outlive the trip planning it was made for.
  if m.user_id is null and m.invite_expires_at < now() then
    raise exception 'That invitation has expired — ask the organizer for a new one.';
  end if;
  if m.user_id is not null and m.user_id <> auth.uid() then
    raise exception 'That invitation was already used by someone else.';
  end if;
  -- Already a member under a different row? Just return the trip. This is what
  -- stops a joined viewer from redeeming a higher-privilege seat's code to
  -- escalate their own account, and it is deliberately preserved.
  if exists (
    select 1 from trip_members
    where trip_id = m.trip_id and user_id = auth.uid() and id <> m.id
  ) then
    return m.trip_id;
  end if;
  update trip_members set user_id = auth.uid(), joined = true where id = m.id;
  return m.trip_id;
end $$;

-- ───────────── MP-09 · unbounded, unvalidated uploads ─────────────
-- Buckets were created with no size or MIME restriction; the client's
-- accept="image/*" is a UI hint, not a control. The avatars bucket is public,
-- so arbitrary content could be parked on the project's storage domain.

update storage.buckets
   set file_size_limit = 5242880,   -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id in ('trip-photos', 'avatars');

-- ───────────── Still outstanding after this migration ─────────────
--
-- MP-02 (rest) — invite_code is returned to every client that reads
--   trip_members, including viewers, for seats nobody has claimed. Fixing it
--   means serving members through a view without the column (or revoking the
--   column grant) and fetching a single code on demand via a definer function
--   that checks can_organize(). GroupPage.tsx reads m.invite_code directly, so
--   both sides have to land together.
--
-- MP-03 — chat_messages accepts any author_id, so messages can be forged from
--   another member. The policy cannot simply be tightened to
--   author_id = auth.uid(): ImportChatModal.tsx legitimately inserts rows with
--   author_id = null and kind = 'system' when seeding an imported thread. Move
--   that seeding into a security-definer function first, then tighten.
--
-- MP-04 / MP-05 — frontend and deploy config: allowlist URL schemes before
--   putting user-supplied links in href, and add security headers in
--   netlify.toml.
