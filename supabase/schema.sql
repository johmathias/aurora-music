-- ZERO OS — Supabase database setup.
-- Run this ONCE: Supabase dashboard → SQL Editor → New query → paste everything → Run.
-- It creates one table that holds every record, and locks it so each person can only touch their own rows.

create table if not exists public.zero_records (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  col         text        not null,                 -- which collection: habits, tasks, transactions, ...
  id          text        not null,                 -- record id (generated on the device)
  data        jsonb       not null,                 -- the record itself
  deleted     boolean     not null default false,   -- deletions are kept as markers so other devices can follow
  rec_updated bigint      not null default 0,       -- device timestamp of the last edit
  synced_at   timestamptz not null default now(),   -- server time; used to download only what changed
  primary key (user_id, col, id)
);

create index if not exists zero_records_sync_idx on public.zero_records (user_id, synced_at);

-- Server stamps synced_at on every write (devices cannot fake it) and always forces user_id to the caller.
create or replace function public.zero_records_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.synced_at := now();
  new.user_id   := auth.uid();
  return new;
end $$;

drop trigger if exists zero_records_touch_trg on public.zero_records;
create trigger zero_records_touch_trg before insert or update on public.zero_records
  for each row execute function public.zero_records_touch();

-- Row Level Security: nobody can read or change anyone else's records.
alter table public.zero_records enable row level security;

drop policy if exists "own rows select" on public.zero_records;
drop policy if exists "own rows insert" on public.zero_records;
drop policy if exists "own rows update" on public.zero_records;
drop policy if exists "own rows delete" on public.zero_records;

create policy "own rows select" on public.zero_records for select to authenticated using (user_id = auth.uid());
create policy "own rows insert" on public.zero_records for insert to authenticated with check (user_id = auth.uid());
create policy "own rows update" on public.zero_records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.zero_records for delete to authenticated using (user_id = auth.uid());

-- The public (anon) key can do nothing without signing in.
revoke all on public.zero_records from anon;
grant select, insert, update, delete on public.zero_records to authenticated;

-- ==========================================================================
-- PUSH NOTIFICATIONS (alerts that arrive even when the app is closed)
-- ==========================================================================

-- One row per phone/browser that turned push on.
create table if not exists public.push_subscriptions (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

-- Upcoming alerts. The app fills this (next 14 days) and a scheduled function sends them on time.
create table if not exists public.push_queue (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key     text not null,                 -- unique id of the alert (includes its time, so edits create a new row)
  fire_at timestamptz not null,
  title   text not null,
  body    text not null default '',
  sent_at timestamptz,
  primary key (user_id, key)
);
create index if not exists push_queue_due_idx on public.push_queue (fire_at) where sent_at is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_queue enable row level security;

drop policy if exists "own subs all"  on public.push_subscriptions;
drop policy if exists "own queue all" on public.push_queue;
create policy "own subs all"  on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own queue all" on public.push_queue         for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
revoke all on public.push_queue from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_queue to authenticated;
