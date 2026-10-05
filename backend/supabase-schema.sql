-- ════════════════════════════════════════════════════════════════════════
--  SalaamStreet — Supabase schema (Update 2.5: Accounts + Guest Mode)
--
--  Optional free accounts. The website works fully without them (guest
--  mode); signed-in people get their bookmarks, streaks, Qur'an progress and
--  settings synced across devices.
--
--  Auth is Supabase Auth (auth.users) with Apple, Google, phone (SMS) and
--  email sign-in. Row-Level Security ensures each person can only ever read
--  or write their own rows. Safe to re-run.
--
--  Run this whole file in Supabase → SQL Editor. See README-backend.md.
-- ════════════════════════════════════════════════════════════════════════

-- ── Profiles: one row per account, created automatically on sign-up ──────
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text check (char_length(display_name) <= 80),
    locale       text default 'en',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ── Synced records ────────────────────────────────────────────────────────
-- Everything that syncs is stored as small records — one per bookmark, per
-- setting, per day of the prayer log, … — so edits on two devices to
-- different things never overwrite each other. `t` is the time (ms since
-- epoch) the record last changed on the device that changed it; the newest
-- write wins. `deleted` marks a removal (e.g. an unbookmarked ayah) so it
-- reaches the other devices. `server_at` is the server's change cursor that
-- devices use to pull only what changed since their last sync.
--
--   col       key             value (examples)
--   pref      theme           "dark"
--   bm        2:255           {"at":1759600000000,"note":"…","folder":"…"}
--   prayers   2026-10-04      {"Fajr":1,"Dhuhr":1}
--   v         quran:lastRead  {"surah":18,"ayah":10,"at":1759600000000}
create table if not exists public.sync_records (
    user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
    col        text not null check (char_length(col) between 1 and 64),
    key        text not null check (char_length(key) between 1 and 200),
    value      jsonb check (pg_column_size(value) <= 65536),
    t          bigint not null default 0,
    deleted    boolean not null default false,
    server_at  timestamptz not null default clock_timestamp(),
    primary key (user_id, col, key)
);
create index if not exists sync_records_cursor on public.sync_records (user_id, server_at);

-- The server, not the client, stamps the change cursor.
create or replace function public.sync_records_stamp()
returns trigger language plpgsql as $$
begin
    new.server_at := clock_timestamp();
    return new;
end;
$$;
drop trigger if exists sync_records_stamp on public.sync_records;
create trigger sync_records_stamp
    before insert or update on public.sync_records
    for each row execute function public.sync_records_stamp();

-- ── sync_push: upload a batch; newest write wins ─────────────────────────
-- Applies each record only if it is at least as new as the stored one, and
-- returns the stored rows that were NOT applied (the server already had a
-- newer copy from another device) so the client can merge them.
create or replace function public.sync_push(items jsonb)
returns setof public.sync_records
language plpgsql
security invoker
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'not signed in' using errcode = '28000';
    end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 1000 then
        raise exception 'items must be an array of at most 1000 records' using errcode = '22023';
    end if;

    return query
    with inc as (
        select x.col, x.key, x.value, coalesce(x.t, 0) as t, coalesce(x.deleted, false) as deleted
        from jsonb_to_recordset(items) as x(col text, key text, value jsonb, t bigint, deleted boolean)
    ),
    up as (
        insert into public.sync_records as s (user_id, col, key, value, t, deleted)
        select uid, inc.col, inc.key, case when inc.deleted then null else inc.value end, inc.t, inc.deleted
        from inc
        on conflict (user_id, col, key) do update
            set value = excluded.value, t = excluded.t, deleted = excluded.deleted
            where excluded.t >= s.t
        returning s.col, s.key
    )
    select s.*
    from public.sync_records s
    join inc on s.user_id = uid and s.col = inc.col and s.key = inc.key
    where not exists (select 1 from up where up.col = inc.col and up.key = inc.key);
end;
$$;

-- ── delete_account: a signed-in person can delete their own account ──────
-- Removes the auth user; profiles and sync_records cascade with it.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'not signed in' using errcode = '28000';
    end if;
    delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  Auto-create a profile when someone signs up (any method)
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        left(coalesce(
            nullif(new.raw_user_meta_data->>'display_name', ''),
            nullif(new.raw_user_meta_data->>'full_name', ''),
            nullif(new.raw_user_meta_data->>'name', ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), '')
        ), 80)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
--  Row-Level Security — each person only sees their own data
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles     enable row level security;
alter table public.sync_records enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own records" on public.sync_records;
create policy "own records" on public.sync_records
    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
--  Realtime: devices are told about changes instantly (RLS still applies)
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_records'
    ) then
        alter publication supabase_realtime add table public.sync_records;
    end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  2.8 — Reminders that arrive when SalaamStreet is closed (Web Push)
--  One row per device that opted in (guests too — no account needed).
--  Only what's needed to send the reminders: the browser's push address,
--  an approximate location (2 decimals ≈ 1 km), time zone and reminder
--  choices. Nobody can read the table through the API: devices add, update
--  and remove their own row through the two functions below (the push
--  address works as the device's secret), and only the send-reminders
--  function (service role) reads it. Turning reminders off deletes the row.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.push_subscriptions (
    endpoint    text primary key check (endpoint like 'https://%' and length(endpoint) < 1000),
    p256dh      text not null check (length(p256dh) < 200),
    auth        text not null check (length(auth) < 100),
    lat         numeric(5,2) not null check (lat between -90 and 90),
    lng         numeric(6,2) not null check (lng between -180 and 180),
    tz          text not null check (length(tz) < 64),
    method      smallint not null default 3,
    school      smallint not null default 0 check (school in (0, 1)),
    offset_min  smallint not null default 0 check (offset_min between 0 and 60),
    prayers     boolean not null default true,
    kahf        boolean not null default true,
    adhkar      boolean not null default false,
    lang        text not null default 'en' check (length(lang) <= 5),
    sent        jsonb not null default '{}'::jsonb,   -- what was already sent today (no doubles)
    updated_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
-- No policies on purpose: the API can't select, insert, update or delete directly.

create or replace function public.push_register(sub jsonb, prefs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.push_subscriptions as p
        (endpoint, p256dh, auth, lat, lng, tz, method, school, offset_min, prayers, kahf, adhkar, lang, updated_at)
    values (
        sub->>'endpoint', sub->'keys'->>'p256dh', sub->'keys'->>'auth',
        round((prefs->>'lat')::numeric, 2), round((prefs->>'lng')::numeric, 2),
        coalesce(prefs->>'tz', 'UTC'),
        coalesce((prefs->>'method')::smallint, 3), coalesce((prefs->>'school')::smallint, 0),
        coalesce((prefs->>'offset')::smallint, 0),
        coalesce((prefs->>'prayers')::boolean, true), coalesce((prefs->>'kahf')::boolean, true),
        coalesce((prefs->>'adhkar')::boolean, false), coalesce(left(prefs->>'lang', 5), 'en'), now()
    )
    on conflict (endpoint) do update set
        p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat, lng = excluded.lng, tz = excluded.tz,
        method = excluded.method, school = excluded.school, offset_min = excluded.offset_min,
        prayers = excluded.prayers, kahf = excluded.kahf, adhkar = excluded.adhkar, lang = excluded.lang,
        updated_at = now();
end;
$$;

create or replace function public.push_unregister(endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
    delete from public.push_subscriptions p where p.endpoint = push_unregister.endpoint;
$$;

revoke all on public.push_subscriptions from anon, authenticated;
revoke execute on function public.push_register(jsonb, jsonb) from public;
revoke execute on function public.push_unregister(text) from public;
grant execute on function public.push_register(jsonb, jsonb) to anon, authenticated;
grant execute on function public.push_unregister(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  Earlier draft (pre-2.5, never connected to the website): the tables
--  preferences, bookmarks, progress and favorites are superseded by
--  sync_records. If you created them from the old draft, you can drop them:
--
--    drop table if exists public.preferences, public.bookmarks,
--                         public.progress, public.favorites;
-- ════════════════════════════════════════════════════════════════════════
