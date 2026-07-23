-- Hotfix: creating a trip failed with
--   new row violates row-level security policy for table "trips"
--
-- Why: the app inserts a trip with a RETURNING clause (.insert(...).select()),
-- and Postgres applies the trips SELECT policy to the returned row. The old
-- policy was only is_trip_member(id) — but at RETURNING time the
-- on_trip_created trigger hasn't yet added the owner's trip_members row, and
-- the statement can't see its own in-flight trips row through the function's
-- subquery. The policy evaluated false, so the whole INSERT was rejected.
--
-- Fix: also accept a direct owner_id match, which is evaluated against the
-- new row itself. Run this once in the SQL editor (001 now includes it for
-- fresh installs; safe to re-run).

drop policy if exists "members read trips" on trips;
create policy "members read trips" on trips for select
  using (owner_id = auth.uid() or public.is_trip_member(id));
