-- MockPacker chat · run after 001_schema.sql (and 002/003 if applying fresh).
--
-- Per-trip group chat, the same shape as trip_feed (messages instead of
-- activity lines) plus a 'system' kind for auto-posted milestones like
-- "trip created from an imported chat". RLS mirrors trip_feed exactly:
-- any trip member can read, only contributors (owner/organizer/traveler)
-- can write.

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  body text not null,
  kind text not null default 'message',   -- message | system
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_trip on chat_messages (trip_id, created_at);

alter table chat_messages enable row level security;

drop policy if exists "members read chat" on chat_messages;
create policy "members read chat" on chat_messages for select using (public.is_trip_member(trip_id));

drop policy if exists "contributors write chat" on chat_messages;
create policy "contributors write chat" on chat_messages for insert
  with check (public.can_contribute(trip_id));
