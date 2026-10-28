-- ════════════════════════════════════════════════════════════════════════
--  SalaamStreet — the whole Supabase database, in one file
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this ENTIRE file →
--  Run. That's all. It is safe to run again at any time (on a new project or
--  to upgrade an existing one); nothing you've saved is deleted, except the
--  one-time MSA admin reset noted in section 7.
--
--  What it sets up, in order:
--    1. Accounts: profiles, created automatically on sign-up (Supabase Auth:
--       Google, Apple, phone, email)
--    2. Sync: bookmarks, streaks, Qur'an progress and settings across devices,
--       with Row-Level Security (each person sees only their own rows)
--    3. Realtime: devices hear about changes instantly
--    4. Reminders when the app is closed (Web Push)          — 2.8
--    5. Family & Kids Mode                                    — 2.10
--    6. NVHS MSA announcements, membership and roster        — 2.11–2.11.7
--    7. One list of MSA admins (the two owners are added)    — 2.11.8
--    8. AI Testing Lab: settings, limits, usage, security log (private;
--       only the ai-lab Edge Function can use it)
--
--  Not in this file (each needs a secret, so it can't be in a public file):
--    • GEMINI_API_KEY → Supabase → Edge Functions → Secrets (README-ai.md)
--    • the every-5-minutes reminder job → README-push.md step 4 (only once
--      the reminder server is set up)
--  Sign-in providers, redirect URLs and email templates are set in the
--  Supabase dashboard: README-backend.md.
--
--  Nothing here is secret: the only emails are stored as SHA-256 hashes.
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
returns trigger language plpgsql set search_path = public as $$
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
-- Only the sign-up trigger runs it; it isn't part of the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

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
-- 3.1: the daily Qur'an goal reminder — the time chosen in Settings ("HH:MM",
-- device time) and the day the goal was last met (no reminder that day).
alter table public.push_subscriptions add column if not exists quran_time text check (quran_time ~ '^[0-2][0-9]:[0-5][0-9]$');
alter table public.push_subscriptions add column if not exists quran_done date;

create or replace function public.push_register(sub jsonb, prefs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.push_subscriptions as p
        (endpoint, p256dh, auth, lat, lng, tz, method, school, offset_min, prayers, kahf, adhkar, lang, quran_time, quran_done, updated_at)
    values (
        sub->>'endpoint', sub->'keys'->>'p256dh', sub->'keys'->>'auth',
        round((prefs->>'lat')::numeric, 2), round((prefs->>'lng')::numeric, 2),
        coalesce(prefs->>'tz', 'UTC'),
        coalesce((prefs->>'method')::smallint, 3), coalesce((prefs->>'school')::smallint, 0),
        coalesce((prefs->>'offset')::smallint, 0),
        coalesce((prefs->>'prayers')::boolean, true), coalesce((prefs->>'kahf')::boolean, true),
        coalesce((prefs->>'adhkar')::boolean, false), coalesce(left(prefs->>'lang', 5), 'en'),
        nullif(prefs->>'quranTime', ''), nullif(prefs->>'quranDone', '')::date, now()
    )
    on conflict (endpoint) do update set
        p256dh = excluded.p256dh, auth = excluded.auth, lat = excluded.lat, lng = excluded.lng, tz = excluded.tz,
        method = excluded.method, school = excluded.school, offset_min = excluded.offset_min,
        prayers = excluded.prayers, kahf = excluded.kahf, adhkar = excluded.adhkar, lang = excluded.lang,
        quran_time = excluded.quran_time, quran_done = excluded.quran_done,
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

-- The reminder server's keys, made inside Supabase so nobody ever handles
-- them: send-reminders creates the VAPID key pair on its first run, and the
-- secret the schedule uses to call it is random. Only the server can read
-- this table (the public VAPID key also goes in js/config.js).
create table if not exists public.push_keys (
    id            boolean primary key default true check (id),
    vapid_public  text,
    vapid_private text,
    cron_secret   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    created_at    timestamptz not null default now()
);
insert into public.push_keys (id) values (true) on conflict (id) do nothing;
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant select, update on public.push_keys to service_role;
    end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  Earlier draft (pre-2.5, never connected to the website): the tables
--  preferences, bookmarks, progress and favorites are superseded by
--  sync_records. If you created them from the old draft, you can drop them:
--
--    drop table if exists public.preferences, public.bookmarks,
--                         public.progress, public.favorites;
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
--  2.10 — Family & Kids Mode
--
--  A parent (an ordinary SalaamStreet account) manages child profiles.
--  Children never sign in and never get the parent's credentials: a device
--  is given a random DEVICE TOKEN that belongs to exactly one child, either
--  directly by the signed-in parent ("use on this device") or by redeeming a
--  one-time PAIRING CODE the parent created (15 minutes, single use). Only
--  SHA-256 hashes of tokens and codes are stored.
--
--  Nothing here is reachable through the table API except a parent reading
--  their own children (RLS). Every change goes through the functions below:
--    family_*  — for the signed-in parent; each checks parent_id = auth.uid()
--    kid_*     — for a child's device; each takes the device token and can
--                only touch that one child's progress. Restrictions set by
--                the parent (which sections are on) are enforced here.
--  Data kept about a child: a first name or nickname, an age range, an avatar
--  choice and learning progress. Deleting a child removes all of it at once.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.family_children (
    id            uuid primary key default gen_random_uuid(),
    parent_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name          text not null check (char_length(btrim(name)) between 1 and 24),
    age_range     text not null default '7-9' check (age_range in ('4-6', '7-9', '10-12')),
    avatar        text not null default 'star'
                  check (avatar in ('star', 'moon', 'sun', 'tree', 'flower', 'book', 'camel', 'bird', 'fish', 'leaf')),
    sections      text[] not null default array['prayer', 'quran', 'duas', 'stories', 'learn', 'quiz']
                  check (sections <@ array['prayer', 'quran', 'duas', 'stories', 'learn', 'quiz']),
    show_progress boolean not null default true,   -- the child sees their own progress and achievements
    allow_audio   boolean not null default true,   -- recitation audio (streams from the Qur'an audio CDN)
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists family_children_parent on public.family_children (parent_id);

-- One row per lesson/dua/surah/story/quiz: "<section>:<id>", e.g. duas:before-eating.
create table if not exists public.child_progress (
    child_id   uuid not null references public.family_children(id) on delete cascade,
    item       text not null check (item ~ '^(prayer|quran|duas|stories|learn|quiz):[a-z0-9-]{1,40}$'),
    status     text not null default 'done' check (status in ('started', 'done')),
    score      smallint check (score between 0 and 100),
    updated_at timestamptz not null default now(),
    primary key (child_id, item)
);
create table if not exists public.child_achievements (
    child_id  uuid not null references public.family_children(id) on delete cascade,
    code      text not null check (code in ('first_dua', 'first_quiz', 'first_surah', 'first_story',
                                            'prayer_basics', 'wudu_basics', 'five_lessons')),
    earned_at timestamptz not null default now(),
    primary key (child_id, code)
);
create table if not exists public.child_devices (
    id           uuid primary key default gen_random_uuid(),
    child_id     uuid not null references public.family_children(id) on delete cascade,
    token_hash   bytea not null unique,
    label        text check (char_length(label) <= 40),
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index if not exists child_devices_child on public.child_devices (child_id);
create table if not exists public.child_pair_codes (
    code_hash  bytea primary key,
    child_id   uuid not null references public.family_children(id) on delete cascade,
    expires_at timestamptz not null
);

alter table public.family_children    enable row level security;
alter table public.child_progress     enable row level security;
alter table public.child_achievements enable row level security;
alter table public.child_devices      enable row level security;
alter table public.child_pair_codes   enable row level security;

-- Parents may read (only) their own children's rows directly; all writes go
-- through the functions. Devices and pairing codes have no policies at all.
drop policy if exists "parent reads own children" on public.family_children;
create policy "parent reads own children" on public.family_children
    for select to authenticated using (parent_id = auth.uid());
drop policy if exists "parent reads own children's progress" on public.child_progress;
create policy "parent reads own children's progress" on public.child_progress
    for select to authenticated using (exists (select 1 from public.family_children c where c.id = child_id and c.parent_id = auth.uid()));
drop policy if exists "parent reads own children's achievements" on public.child_achievements;
create policy "parent reads own children's achievements" on public.child_achievements
    for select to authenticated using (exists (select 1 from public.family_children c where c.id = child_id and c.parent_id = auth.uid()));
revoke all on public.family_children, public.child_progress, public.child_achievements,
              public.child_devices, public.child_pair_codes from anon;
revoke insert, update, delete, truncate on public.family_children, public.child_progress, public.child_achievements,
              public.child_devices, public.child_pair_codes from authenticated;
revoke all on public.child_devices, public.child_pair_codes from authenticated;

-- ── Internal helpers (not callable through the API) ──────────────────────
create or replace function public.family_parent()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    return uid;
end;
$$;

/** The child a parent owns, or an error (never another parent's child). */
create or replace function public.family_own_child(p_child uuid)
returns public.family_children language plpgsql security definer set search_path = public as $$
declare c public.family_children;
begin
    select * into c from public.family_children where id = p_child and parent_id = public.family_parent();
    if not found then raise exception 'child not found' using errcode = 'P0002'; end if;
    return c;
end;
$$;

create or replace function public.family_child_json(c public.family_children)
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('id', c.id, 'name', c.name, 'age_range', c.age_range, 'avatar', c.avatar,
        'sections', to_jsonb(c.sections), 'show_progress', c.show_progress, 'allow_audio', c.allow_audio);
$$;

/** A new random secret: 64 hex characters (244 random bits from two v4 UUIDs). */
create or replace function public.family_secret()
returns text language sql volatile security definer set search_path = public as $$
    select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.family_hash(secret text)
returns bytea language sql immutable security definer set search_path = public as $$
    select sha256(convert_to(coalesce(secret, ''), 'UTF8'));
$$;

/** Give a device a token for one child. Returns the token (shown once, never stored). */
create or replace function public.family_new_device(p_child uuid, p_label text)
returns text language plpgsql security definer set search_path = public as $$
declare tok text := 'kid_' || public.family_secret();
begin
    if (select count(*) from public.child_devices where child_id = p_child) >= 10 then
        raise exception 'too many devices for this child' using errcode = '54000';
    end if;
    insert into public.child_devices (child_id, token_hash, label)
    values (p_child, public.family_hash(tok), nullif(left(btrim(coalesce(p_label, '')), 40), ''));
    return tok;
end;
$$;

/** The child a device token belongs to (refreshes last-seen at most hourly). */
create or replace function public.kid_child(p_token text)
returns public.family_children language plpgsql security definer set search_path = public as $$
declare c public.family_children; dev uuid; kid uuid;
begin
    select d.id, d.child_id into dev, kid from public.child_devices d where d.token_hash = public.family_hash(p_token);
    if dev is null then raise exception 'invalid or revoked device' using errcode = '28000'; end if;
    select * into c from public.family_children where id = kid;
    update public.child_devices set last_seen_at = now() where id = dev and last_seen_at < now() - interval '1 hour';
    return c;
end;
$$;

/** Award achievements from saved progress (children can't write them). */
create or replace function public.family_award(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
declare done text[];
begin
    select coalesce(array_agg(item), '{}') into done from public.child_progress where child_id = p_child and status = 'done';
    insert into public.child_achievements (child_id, code)
    select p_child, a.code from (values
        ('first_dua',     exists (select 1 from unnest(done) i where i like 'duas:%')),
        ('first_quiz',    exists (select 1 from unnest(done) i where i like 'quiz:%')),
        ('first_surah',   exists (select 1 from unnest(done) i where i like 'quran:%')),
        ('first_story',   exists (select 1 from unnest(done) i where i like 'stories:%')),
        ('prayer_basics', array['prayer:names', 'prayer:rakahs', 'prayer:steps'] <@ done),
        ('wudu_basics',   'prayer:wudu' = any (done)),
        ('five_lessons',  (select count(*) from unnest(done) i where i not like 'quiz:%') >= 5)
    ) as a(code, earned)
    where a.earned
    on conflict do nothing;
end;
$$;

create or replace function public.kid_progress_json(p_child uuid)
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'progress', coalesce((select jsonb_agg(jsonb_build_object('item', item, 'status', status, 'score', score, 'at', updated_at) order by updated_at)
                              from public.child_progress where child_id = p_child), '[]'::jsonb),
        'achievements', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'at', earned_at) order by earned_at)
                                  from public.child_achievements where child_id = p_child), '[]'::jsonb));
$$;

-- ── For the signed-in parent ─────────────────────────────────────────────
create or replace function public.family_children_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.family_parent();
begin
    return coalesce((
        select jsonb_agg(public.family_child_json(c) || jsonb_build_object(
            'done',         (select count(*) from public.child_progress p where p.child_id = c.id and p.status = 'done'),
            'achievements', (select count(*) from public.child_achievements a where a.child_id = c.id),
            'devices',      (select count(*) from public.child_devices d where d.child_id = c.id))
            order by c.created_at)
        from public.family_children c where c.parent_id = uid), '[]'::jsonb);
end;
$$;

/** Create (no id) or update (id) a child. Returns the saved child. */
create or replace function public.family_child_save(p_child jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.family_parent(); c public.family_children; secs text[];
begin
    if jsonb_typeof(p_child) <> 'object' then raise exception 'child must be an object' using errcode = '22023'; end if;
    if p_child ? 'sections' then
        if jsonb_typeof(p_child->'sections') <> 'array' then raise exception 'sections must be an array' using errcode = '22023'; end if;
        select coalesce(array_agg(distinct s), '{}') into secs from jsonb_array_elements_text(p_child->'sections') s;
    end if;
    if nullif(p_child->>'id', '') is null then
        if (select count(*) from public.family_children where parent_id = uid) >= 10 then
            raise exception 'a family can have at most 10 children' using errcode = '54000';
        end if;
        insert into public.family_children (parent_id, name, age_range, avatar, sections, show_progress, allow_audio)
        values (uid, btrim(p_child->>'name'), coalesce(p_child->>'age_range', '7-9'), coalesce(p_child->>'avatar', 'star'),
            coalesce(secs, array['prayer', 'quran', 'duas', 'stories', 'learn', 'quiz']),
            coalesce((p_child->>'show_progress')::boolean, true), coalesce((p_child->>'allow_audio')::boolean, true))
        returning * into c;
    else
        perform public.family_own_child((p_child->>'id')::uuid);
        update public.family_children set
            name          = coalesce(btrim(p_child->>'name'), name),
            age_range     = coalesce(p_child->>'age_range', age_range),
            avatar        = coalesce(p_child->>'avatar', avatar),
            sections      = coalesce(secs, sections),
            show_progress = coalesce((p_child->>'show_progress')::boolean, show_progress),
            allow_audio   = coalesce((p_child->>'allow_audio')::boolean, allow_audio),
            updated_at    = now()
        where id = (p_child->>'id')::uuid and parent_id = uid
        returning * into c;
    end if;
    return public.family_child_json(c);
end;
$$;

/** Remove a child and everything about them (progress, achievements, devices, codes). */
create or replace function public.family_child_delete(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    perform public.family_own_child(p_child);
    delete from public.family_children where id = p_child and parent_id = auth.uid();
end;
$$;

/** One child's progress, achievements and paired devices. */
create or replace function public.family_child_detail(p_child uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.family_children := public.family_own_child(p_child);
begin
    return public.family_child_json(c) || public.kid_progress_json(c.id) || jsonb_build_object('devices',
        coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'created_at', created_at, 'last_seen_at', last_seen_at)
                  order by created_at) from public.child_devices where child_id = c.id), '[]'::jsonb));
end;
$$;

/** Start over: clear one child's progress and achievements. */
create or replace function public.family_child_reset(p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    perform public.family_own_child(p_child);
    delete from public.child_progress where child_id = p_child;
    delete from public.child_achievements where child_id = p_child;
end;
$$;

/** A one-time code (8 letters/digits, 15 minutes) to pair a child's own device. */
create or replace function public.family_pair_code(p_child uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    c public.family_children := public.family_own_child(p_child);
    alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    raw bytea := uuid_send(gen_random_uuid()); code text := ''; i int; exp timestamptz := now() + interval '15 minutes';
begin
    -- bytes 0-5 and 10-15 of a v4 UUID are fully random; 256 is a multiple of 32, so no bias
    foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
        code := code || substr(alphabet, get_byte(raw, i) % 32 + 1, 1);
    end loop;
    delete from public.child_pair_codes where child_id = c.id or expires_at < now();
    insert into public.child_pair_codes (code_hash, child_id, expires_at) values (public.family_hash(code), c.id, exp);
    return jsonb_build_object('code', code, 'expires_at', exp);
end;
$$;

/** Use Kids Mode for this child on the parent's current device. */
create or replace function public.family_device_token(p_child uuid, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.family_children := public.family_own_child(p_child);
begin
    return jsonb_build_object('token', public.family_new_device(c.id, p_label), 'child', public.family_child_json(c));
end;
$$;

create or replace function public.family_device_revoke(p_device uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public.family_parent();
begin
    delete from public.child_devices d using public.family_children c
    where d.id = p_device and c.id = d.child_id and c.parent_id = uid;
    if not found then raise exception 'device not found' using errcode = 'P0002'; end if;
end;
$$;

-- ── For a child's device (token only; no account) ────────────────────────
/** Redeem a pairing code. Returns this device's token and the child's profile. */
create or replace function public.kid_pair(p_code text, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pc public.child_pair_codes; c public.family_children; norm text;
begin
    norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    delete from public.child_pair_codes where code_hash = public.family_hash(norm) and expires_at > now() returning * into pc;
    if pc.child_id is null then raise exception 'invalid or expired code' using errcode = '22023'; end if;
    select * into c from public.family_children where id = pc.child_id;
    return jsonb_build_object('token', public.family_new_device(c.id, p_label), 'child', public.family_child_json(c));
end;
$$;

create or replace function public.kid_session(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    return public.family_child_json(public.kid_child(p_token));
end;
$$;

create or replace function public.kid_progress(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.family_children := public.kid_child(p_token);
begin
    return jsonb_build_object('child', public.family_child_json(c)) || public.kid_progress_json(c.id);
end;
$$;

/** Save learning progress: [{item, status, score}] (at most 50). Items in a
    section the parent switched off are not saved and come back as `rejected`.
    "done" is never downgraded; a quiz keeps its best score. */
create or replace function public.kid_save(p_token text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.family_children := public.kid_child(p_token); rejected jsonb;
begin
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
        raise exception 'items must be an array of at most 50' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(x.item), '[]'::jsonb) into rejected
    from jsonb_to_recordset(p_items) as x(item text)
    where not (split_part(coalesce(x.item, ''), ':', 1) = any (c.sections));

    insert into public.child_progress as p (child_id, item, status, score)
    select c.id, x.item, coalesce(x.status, 'done'), x.score
    from jsonb_to_recordset(p_items) as x(item text, status text, score smallint)
    where split_part(coalesce(x.item, ''), ':', 1) = any (c.sections)
    on conflict (child_id, item) do update set
        status = case when p.status = 'done' then 'done' else excluded.status end,
        score = greatest(p.score, excluded.score),
        updated_at = now();

    perform public.family_award(c.id);
    return jsonb_build_object('child', public.family_child_json(c), 'rejected', rejected) || public.kid_progress_json(c.id);
end;
$$;

/** Forget this device (the child's own "unpair"). */
create or replace function public.kid_unpair(p_token text)
returns void language sql security definer set search_path = public as $$
    delete from public.child_devices where token_hash = public.family_hash(p_token);
$$;

-- Only the entry points are callable; the helpers are internal.
revoke all on function public.family_parent(), public.family_own_child(uuid), public.family_child_json(public.family_children),
    public.family_secret(), public.family_hash(text), public.family_new_device(uuid, text), public.kid_child(text),
    public.family_award(uuid), public.kid_progress_json(uuid) from public, anon, authenticated;
revoke all on function public.family_children_list(), public.family_child_save(jsonb), public.family_child_delete(uuid),
    public.family_child_detail(uuid), public.family_child_reset(uuid), public.family_pair_code(uuid),
    public.family_device_token(uuid, text), public.family_device_revoke(uuid) from public, anon;
grant execute on function public.family_children_list(), public.family_child_save(jsonb), public.family_child_delete(uuid),
    public.family_child_detail(uuid), public.family_child_reset(uuid), public.family_pair_code(uuid),
    public.family_device_token(uuid, text), public.family_device_revoke(uuid) to authenticated;
revoke all on function public.kid_pair(text, text), public.kid_session(text), public.kid_progress(text),
    public.kid_save(text, jsonb), public.kid_unpair(text) from public;
grant execute on function public.kid_pair(text, text), public.kid_session(text), public.kid_progress(text),
    public.kid_save(text, jsonb), public.kid_unpair(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  2.11 — NVHS MSA announcements
--  Anyone (signed in or not) can read the MSA's current announcements.
--  Only the MSA's posters can write them: a signed-in account whose email is
--  on the list below. The list stores SHA-256 hashes of the lower-cased
--  emails, never the emails themselves (this file is public). Since 2.11.8
--  admins add and remove admins on the MSA Manage page; the SQL editor
--  still works too:
--    insert into public.msa_admins (email_hash)
--    values (sha256(convert_to(lower('name@example.org'), 'UTF8')));
--  and to remove one, delete that row.
--
--  Images are stored in the post itself as a small JPEG/WebP/PNG data URL
--  that the poster's device has already shrunk (and, by redrawing it, stripped
--  of camera and location metadata). The feed lists posts without images;
--  each image is fetched on its own with msa_image().
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.msa_admins (
    email_hash bytea primary key check (octet_length(email_hash) = 32),
    added_at   timestamptz not null default now()
);
-- The admins themselves are set in the 2.11.8 section below (and managed in the app).

create table if not exists public.msa_posts (
    id         uuid primary key default gen_random_uuid(),
    title      text not null check (char_length(btrim(title)) between 1 and 120),
    body       text not null default '' check (char_length(body) <= 4000),
    image      text check (image is null or (char_length(image) <= 700000
                   and image ~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/]+=*$')),
    on_home    boolean not null default false,   -- also shown on everyone's Home
    pinned     boolean not null default false,   -- kept at the top of the MSA page
    expires_at timestamptz,                      -- hidden from everyone after this
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists msa_posts_order on public.msa_posts (pinned desc, created_at desc);

-- No policies: nothing is reachable through the table API. Reading and
-- writing go through the functions below.
alter table public.msa_admins enable row level security;
alter table public.msa_posts  enable row level security;
revoke all on public.msa_admins, public.msa_posts from anon, authenticated;

/** The signed-in poster's id, or an error for anyone else. */
create or replace function public.msa_poster()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text;
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    select lower(btrim(email)) into mail from auth.users where id = uid;
    if mail is null or mail = '' or not exists (
        select 1 from public.msa_admins where email_hash = sha256(convert_to(mail, 'UTF8'))
    ) then
        raise exception 'not an MSA poster' using errcode = '42501';
    end if;
    return uid;
end;
$$;

create or replace function public.msa_post_json(p public.msa_posts)
returns jsonb language sql immutable set search_path = public as $$
    select jsonb_build_object('id', p.id, 'title', p.title, 'body', p.body, 'has_image', p.image is not null,
        'on_home', p.on_home, 'pinned', p.pinned, 'expires_at', p.expires_at,
        'created_at', p.created_at, 'updated_at', p.updated_at);
$$;

/** Current announcements, pinned first, then newest (at most 30). */
create or replace function public.msa_feed()
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(public.msa_post_json(p) order by p.pinned desc, p.created_at desc), '[]'::jsonb)
    from (select * from public.msa_posts
          where expires_at is null or expires_at > now()
          order by pinned desc, created_at desc limit 30) p;
$$;

/** One announcement's image (a data URL), or null. */
create or replace function public.msa_image(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
    select image from public.msa_posts where id = p_id and (expires_at is null or expires_at > now());
$$;

/** Is the signed-in account allowed to post? */
create or replace function public.msa_is_poster()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_poster();
    return true;
exception when others then
    return false;
end;
$$;

/**
 * Create (no id) or edit (with id) an announcement.
 * p: { id?, title, body, image?: data URL | null | "keep", on_home, pinned, expires_at? }
 */
create or replace function public.msa_post_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.msa_poster(); r public.msa_posts; pid uuid; img text;
begin
    if jsonb_typeof(p) is distinct from 'object' then raise exception 'a post is an object' using errcode = '22023'; end if;
    pid := nullif(p->>'id', '')::uuid;
    img := case when p ? 'image' then p->>'image' else 'keep' end;
    if (select count(*) from public.msa_posts where created_at > now() - interval '1 hour') >= 30 and pid is null then
        raise exception 'too many posts this hour' using errcode = '54000';
    end if;
    if pid is null then
        insert into public.msa_posts (title, body, image, on_home, pinned, expires_at, created_by)
        values (btrim(p->>'title'), btrim(coalesce(p->>'body', '')), nullif(img, 'keep'),
                coalesce((p->>'on_home')::boolean, false), coalesce((p->>'pinned')::boolean, false),
                nullif(p->>'expires_at', '')::timestamptz, uid)
        returning * into r;
    else
        update public.msa_posts set
            title = btrim(p->>'title'),
            body = btrim(coalesce(p->>'body', '')),
            image = case when img = 'keep' then image else img end,
            on_home = coalesce((p->>'on_home')::boolean, on_home),
            pinned = coalesce((p->>'pinned')::boolean, pinned),
            expires_at = nullif(p->>'expires_at', '')::timestamptz,
            updated_at = now()
        where id = pid
        returning * into r;
        if r.id is null then raise exception 'no such post' using errcode = 'P0002'; end if;
    end if;
    return public.msa_post_json(r);
end;
$$;

create or replace function public.msa_post_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    perform public.msa_poster();
    delete from public.msa_posts where id = p_id;
end;
$$;

revoke all on function public.msa_poster(), public.msa_post_json(public.msa_posts) from public, anon, authenticated;
revoke all on function public.msa_feed(), public.msa_image(uuid), public.msa_is_poster(),
    public.msa_post_save(jsonb), public.msa_post_delete(uuid) from public;
grant execute on function public.msa_feed(), public.msa_image(uuid) to anon, authenticated;
grant execute on function public.msa_is_poster(), public.msa_post_save(jsonb), public.msa_post_delete(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  2.11.6 — NVHS MSA membership
--  Members see "members only" announcements. To become a member, a signed-in
--  person types their full name and either:
--    • enters the live meeting code (6 digits, changes every 10 minutes, shown
--      only to the MSA approver, so it proves they were at a meeting), or
--    • sends a request that the approver approves or denies.
--  The approver also keeps the roster (the MSA's member list from Google
--  Classroom). It lives only in this database — never in the code, which is
--  public — and tells the approver whether a requested name is on it.
--  One account per name: if a name already belongs to an approved member,
--  any other account asking for it is FLAGGED and told to see the approver in
--  person; the approver settles it face to face.
--  Membership ends every 1 July (the end of the school year).
--  Approvers are listed like posters, as SHA-256 hashes of lower-cased emails:
--    insert into public.msa_approvers (email_hash)
--    values (sha256(convert_to(lower('name@example.org'), 'UTF8')));
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.msa_approvers (
    email_hash bytea primary key check (octet_length(email_hash) = 32),
    added_at   timestamptz not null default now()
);
insert into public.msa_approvers (email_hash) values
    ('\x0359ef19e11b6941875be3039743b7d627855fa162b587982a5142cf558e6276')
on conflict do nothing;

create table if not exists public.msa_roster (
    name_key text primary key check (char_length(name_key) between 2 and 80),
    name     text not null check (char_length(name) between 2 and 80)
);

create table if not exists public.msa_members (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    name       text not null check (char_length(btrim(name)) between 2 and 80),
    name_key   text not null,
    status     text not null check (status in ('pending', 'approved', 'flagged', 'denied')),
    via        text not null check (via in ('request', 'code', 'approver')),
    on_roster  boolean not null default false,
    created_at timestamptz not null default now(),
    decided_at timestamptz,
    expires_at timestamptz
);
-- One approved account per name.
create unique index if not exists msa_members_one_per_name on public.msa_members (name_key) where status = 'approved';

-- The meeting code's secret, and wrong-code tries (to stop guessing).
create table if not exists public.msa_secret (
    id     int primary key default 1 check (id = 1),
    secret text not null
);
insert into public.msa_secret (id, secret)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict do nothing;
create table if not exists public.msa_code_tries (
    user_id uuid not null references auth.users(id) on delete cascade,
    at      timestamptz not null default now()
);
create index if not exists msa_code_tries_user on public.msa_code_tries (user_id, at);

alter table public.msa_posts add column if not exists members_only boolean not null default false;

alter table public.msa_approvers  enable row level security;
alter table public.msa_roster     enable row level security;
alter table public.msa_members    enable row level security;
alter table public.msa_secret     enable row level security;
alter table public.msa_code_tries enable row level security;
revoke all on public.msa_approvers, public.msa_roster, public.msa_members, public.msa_secret, public.msa_code_tries
    from anon, authenticated;

/** "Yusuf  Abdullah " → "yusuf abdullah": how names are compared. */
create or replace function public.msa_name_key(n text)
returns text language sql immutable set search_path = public as $$
    select btrim(regexp_replace(regexp_replace(lower(coalesce(n, '')), '[^[:alpha:]'' -]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

/** The signed-in account's email, lower-cased (or null). */
create or replace function public.msa_my_email()
returns text language sql stable security definer set search_path = public as $$
    select lower(btrim(email)) from auth.users where id = auth.uid();
$$;
create or replace function public.msa_is_approver_now()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.msa_my_email() <> '' and exists (
        select 1 from public.msa_approvers where email_hash = sha256(convert_to(public.msa_my_email(), 'UTF8'))), false);
$$;
/** The signed-in approver's id, or an error for anyone else. */
create or replace function public.msa_approver()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    if not public.msa_is_approver_now() then raise exception 'not the MSA approver' using errcode = '42501'; end if;
    return uid;
end;
$$;
/** Members, posters and the approver may see members-only posts. */
create or replace function public.msa_can_see_all()
returns boolean language sql stable security definer set search_path = public as $$
    select auth.uid() is not null and (
        exists (select 1 from public.msa_members m where m.user_id = auth.uid() and m.status = 'approved' and m.expires_at > now())
        or public.msa_is_approver_now()
        or exists (select 1 from public.msa_admins where email_hash = sha256(convert_to(coalesce(public.msa_my_email(), ''), 'UTF8'))));
$$;
/** The end of this school year: the next 1 July, Chicago time. */
create or replace function public.msa_year_end()
returns timestamptz language sql stable set search_path = public as $$
    select make_timestamptz(
        extract(year from now() at time zone 'America/Chicago')::int
          + case when extract(month from now() at time zone 'America/Chicago') >= 7 then 1 else 0 end,
        7, 1, 0, 0, 0, 'America/Chicago');
$$;
/** The meeting code for a 10-minute window: 6 digits from the secret. */
create or replace function public.msa_code_for(w bigint)
returns text language sql stable security definer set search_path = public as $$
    select lpad(((('x' || substr(encode(sha256(convert_to(s.secret || ':' || w::text, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
    from public.msa_secret s where s.id = 1;
$$;
create or replace function public.msa_window()
returns bigint language sql stable set search_path = public as $$ select floor(extract(epoch from now()) / 600)::bigint; $$;

/* ── Posts: members-only ones only reach members ── */
create or replace function public.msa_post_json(p public.msa_posts)
returns jsonb language sql immutable set search_path = public as $$
    select jsonb_build_object('id', p.id, 'title', p.title, 'body', p.body, 'has_image', p.image is not null,
        'on_home', p.on_home, 'pinned', p.pinned, 'members_only', p.members_only, 'expires_at', p.expires_at,
        'created_at', p.created_at, 'updated_at', p.updated_at);
$$;
create or replace function public.msa_feed()
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(public.msa_post_json(p) order by p.pinned desc, p.created_at desc), '[]'::jsonb)
    from (select * from public.msa_posts
          where (expires_at is null or expires_at > now()) and (not members_only or public.msa_can_see_all())
          order by pinned desc, created_at desc limit 30) p;
$$;
create or replace function public.msa_image(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
    select image from public.msa_posts
    where id = p_id and (expires_at is null or expires_at > now()) and (not members_only or public.msa_can_see_all());
$$;
create or replace function public.msa_post_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.msa_poster(); r public.msa_posts; pid uuid; img text;
begin
    if jsonb_typeof(p) is distinct from 'object' then raise exception 'a post is an object' using errcode = '22023'; end if;
    pid := nullif(p->>'id', '')::uuid;
    img := case when p ? 'image' then p->>'image' else 'keep' end;
    if (select count(*) from public.msa_posts where created_at > now() - interval '1 hour') >= 30 and pid is null then
        raise exception 'too many posts this hour' using errcode = '54000';
    end if;
    if pid is null then
        insert into public.msa_posts (title, body, image, on_home, pinned, members_only, expires_at, created_by)
        values (btrim(p->>'title'), btrim(coalesce(p->>'body', '')), nullif(img, 'keep'),
                coalesce((p->>'on_home')::boolean, false), coalesce((p->>'pinned')::boolean, false),
                coalesce((p->>'members_only')::boolean, false),
                nullif(p->>'expires_at', '')::timestamptz, uid)
        returning * into r;
    else
        update public.msa_posts set
            title = btrim(p->>'title'),
            body = btrim(coalesce(p->>'body', '')),
            image = case when img = 'keep' then image else img end,
            on_home = coalesce((p->>'on_home')::boolean, on_home),
            pinned = coalesce((p->>'pinned')::boolean, pinned),
            members_only = coalesce((p->>'members_only')::boolean, members_only),
            expires_at = nullif(p->>'expires_at', '')::timestamptz,
            updated_at = now()
        where id = pid
        returning * into r;
        if r.id is null then raise exception 'no such post' using errcode = 'P0002'; end if;
    end if;
    return public.msa_post_json(r);
end;
$$;

/* ── For everyone signed in ── */
create or replace function public.msa_member_json(m public.msa_members)
returns jsonb language sql immutable set search_path = public as $$
    select case when m.user_id is null then jsonb_build_object('status', 'none')
        else jsonb_build_object('status', case when m.status = 'approved' and m.expires_at <= now() then 'none' else m.status end,
            'name', m.name, 'expires_at', m.expires_at) end;
$$;
/** Where the signed-in person stands: their membership, and what they may do. */
create or replace function public.msa_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.msa_members;
begin
    if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
    select * into m from public.msa_members where user_id = auth.uid();
    return public.msa_member_json(m) || jsonb_build_object(
        'approver', public.msa_is_approver_now(),
        'poster', exists (select 1 from public.msa_admins where email_hash = sha256(convert_to(coalesce(public.msa_my_email(), ''), 'UTF8'))));
end;
$$;
/**
 * Ask to join with a full name, and optionally the meeting code.
 * Right code → approved at once (unless the name is taken). Otherwise the
 * request waits for the approver. A name that already belongs to another
 * member is flagged: see the approver in person.
 */
create or replace function public.msa_join(p_name text, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
    k text := public.msa_name_key(p_name); cur public.msa_members; w bigint := public.msa_window();
    code_ok boolean := false; taken boolean; st text; r public.msa_members; code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    if char_length(k) < 2 or char_length(nm) > 80 or position(' ' in k) = 0 then
        raise exception 'type your first and last name' using errcode = '22023';
    end if;
    select * into cur from public.msa_members where user_id = uid;
    if cur.status = 'approved' and cur.expires_at > now() then return public.msa_member_json(cur); end if;
    if code <> '' then
        if (select count(*) from public.msa_code_tries where user_id = uid and at > now() - interval '15 minutes') >= 5 then
            raise exception 'too many tries' using errcode = '54000';
        end if;
        -- The code just replaced still works for its first minute.
        code_ok := code = public.msa_code_for(w)
            or (code = public.msa_code_for(w - 1) and extract(epoch from now()) - w * 600 < 60);
        if not code_ok then
            -- Returned, not raised: an error would undo the record of this try.
            insert into public.msa_code_tries (user_id) values (uid);
            return public.msa_member_json(cur) || jsonb_build_object('error', 'wrong-code');
        end if;
    end if;
    taken := exists (select 1 from public.msa_members where name_key = k and status = 'approved' and expires_at > now() and user_id <> uid);
    -- An approval that has run out frees its name.
    delete from public.msa_members where name_key = k and status = 'approved' and expires_at <= now() and user_id <> uid;
    st := case when taken then 'flagged' when code_ok then 'approved' else 'pending' end;
    insert into public.msa_members as m (user_id, name, name_key, status, via, on_roster, created_at, decided_at, expires_at)
    values (uid, nm, k, st, case when code_ok then 'code' else 'request' end,
            exists (select 1 from public.msa_roster where name_key = k), now(),
            case when st = 'approved' then now() end, case when st = 'approved' then public.msa_year_end() end)
    on conflict (user_id) do update set name = excluded.name, name_key = excluded.name_key, status = excluded.status,
        via = excluded.via, on_roster = excluded.on_roster, created_at = now(),
        decided_at = excluded.decided_at, expires_at = excluded.expires_at
    returning * into r;
    return public.msa_member_json(r);
end;
$$;
/** Leave the MSA (or withdraw a request). */
create or replace function public.msa_leave()
returns void language sql security definer set search_path = public as $$
    delete from public.msa_members where user_id = auth.uid();
$$;

/* ── For the approver ── */
/** The live meeting code and when it changes. */
create or replace function public.msa_live_code()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w bigint;
begin
    perform public.msa_approver();
    w := public.msa_window();
    return jsonb_build_object('code', public.msa_code_for(w), 'changes_at', to_timestamp((w + 1) * 600));
end;
$$;
/** Everyone who asked or joined: flagged first, then waiting, then members. */
create or replace function public.msa_people()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_approver();
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.name, 'status', m.status, 'via', m.via,
            'on_roster', exists (select 1 from public.msa_roster r where r.name_key = m.name_key),
            'email', u.email, 'created_at', m.created_at, 'expires_at', m.expires_at)
        order by case m.status when 'flagged' then 0 when 'pending' then 1 when 'approved' then 2 else 3 end, m.created_at desc)
        from public.msa_members m join auth.users u on u.id = m.user_id
        where not (m.status = 'approved' and m.expires_at <= now())), '[]'::jsonb);
end;
$$;
/** approve | deny | remove one person. */
create or replace function public.msa_decide(p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.msa_members;
begin
    perform public.msa_approver();
    select * into m from public.msa_members where user_id = p_user;
    if m.user_id is null then raise exception 'no such person' using errcode = 'P0002'; end if;
    if p_action = 'remove' then
        delete from public.msa_members where user_id = p_user;
    elsif p_action = 'deny' then
        update public.msa_members set status = 'denied', decided_at = now(), expires_at = null where user_id = p_user;
    elsif p_action = 'approve' then
        if exists (select 1 from public.msa_members where name_key = m.name_key and status = 'approved' and expires_at > now() and user_id <> p_user) then
            raise exception 'name already belongs to another member' using errcode = '23505';
        end if;
        delete from public.msa_members where name_key = m.name_key and status = 'approved' and expires_at <= now() and user_id <> p_user;
        update public.msa_members set status = 'approved', via = case when via = 'code' then 'code' else 'approver' end,
            decided_at = now(), expires_at = public.msa_year_end() where user_id = p_user;
    else
        raise exception 'unknown action' using errcode = '22023';
    end if;
end;
$$;
create or replace function public.msa_roster_get()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_approver();
    return coalesce((select jsonb_agg(name order by name) from public.msa_roster), '[]'::jsonb);
end;
$$;
/** Replace the roster with these names (one per line or an array). */
create or replace function public.msa_roster_set(p_names text[])
returns int language plpgsql security definer set search_path = public as $$
begin
    perform public.msa_approver();
    if coalesce(array_length(p_names, 1), 0) > 2000 then raise exception 'too many names' using errcode = '54000'; end if;
    delete from public.msa_roster where true;
    insert into public.msa_roster (name_key, name)
    select distinct on (public.msa_name_key(n)) public.msa_name_key(n), left(btrim(regexp_replace(n, '\s+', ' ', 'g')), 80)
    from unnest(coalesce(p_names, '{}')) n
    where char_length(public.msa_name_key(n)) between 2 and 80
    on conflict do nothing;
    return (select count(*) from public.msa_roster);
end;
$$;

revoke all on function public.msa_name_key(text), public.msa_my_email(), public.msa_is_approver_now(), public.msa_approver(),
    public.msa_can_see_all(), public.msa_year_end(), public.msa_code_for(bigint), public.msa_window(),
    public.msa_member_json(public.msa_members), public.msa_post_json(public.msa_posts) from public, anon, authenticated;
revoke all on function public.msa_status(), public.msa_join(text, text), public.msa_leave(), public.msa_live_code(),
    public.msa_people(), public.msa_decide(uuid, text), public.msa_roster_get(), public.msa_roster_set(text[]) from public, anon;
grant execute on function public.msa_status(), public.msa_join(text, text), public.msa_leave(), public.msa_live_code(),
    public.msa_people(), public.msa_decide(uuid, text), public.msa_roster_get(), public.msa_roster_set(text[]) to authenticated;
revoke all on function public.msa_feed(), public.msa_image(uuid), public.msa_post_save(jsonb) from public;
grant execute on function public.msa_feed(), public.msa_image(uuid) to anon, authenticated;
grant execute on function public.msa_post_save(jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  2.11.7 — School accounts join automatically
--  NVHS school emails look like  <first name><first 3 letters of last
--  name><4 digits>@k12.ipsd.org. Signing in with the emailed code proves the
--  person owns that address, so when a signed-in, CONFIRMED school email
--  matches exactly one roster name, msa_status() makes them a member at once
--  (via 'school'), under the roster's spelling of their name. If another
--  account had claimed that name, the school account wins and the other is
--  flagged. Addresses that fit two roster names wait for the approver.
-- ════════════════════════════════════════════════════════════════════════
alter table public.msa_roster add column if not exists keys text[] not null default '{}';
alter table public.msa_members drop constraint if exists msa_members_via_check;
alter table public.msa_members add constraint msa_members_via_check check (via in ('request', 'code', 'approver', 'school'));

/**
 * The school-email beginnings a roster name can have: first name + first 3
 * letters of the last name. "Adam Al Jallad" → {adamal, adamjal};
 * "Zayd Faiz-balagam" → {zaydfai}; "Aasiya Syed Osman" → {aasiyasye, aasiyaosm}.
 */
create or replace function public.msa_email_keys(n text)
returns text[] language sql immutable set search_path = public as $$
    with w as (
        select array_remove(regexp_split_to_array(regexp_replace(lower(coalesce(n, '')), '[^a-z ]+', '', 'g'), '\s+'), '') as a
    ), c as (
        select a[1] as first, a[2:] as rest from w where coalesce(array_length(a, 1), 0) >= 2
    )
    select coalesce(array_agg(distinct first || left(part, 3)), '{}')
    from c, lateral (select unnest(rest) as part union select array_to_string(rest, '')) p
    where part <> '';
$$;
update public.msa_roster set keys = public.msa_email_keys(name) where keys = '{}';

create or replace function public.msa_roster_set(p_names text[])
returns int language plpgsql security definer set search_path = public as $$
begin
    perform public.msa_approver();
    if coalesce(array_length(p_names, 1), 0) > 2000 then raise exception 'too many names' using errcode = '54000'; end if;
    delete from public.msa_roster where true;
    insert into public.msa_roster (name_key, name, keys)
    select distinct on (public.msa_name_key(n)) public.msa_name_key(n), left(btrim(regexp_replace(n, '\s+', ' ', 'g')), 80), public.msa_email_keys(n)
    from unnest(coalesce(p_names, '{}')) n
    where char_length(public.msa_name_key(n)) between 2 and 80
    on conflict do nothing;
    return (select count(*) from public.msa_roster);
end;
$$;

/** The one roster name a confirmed school email belongs to (or nothing). */
create or replace function public.msa_school_match()
returns public.msa_roster language plpgsql stable security definer set search_path = public as $$
declare u jsonb; mail text; local text; r public.msa_roster; n int;
begin
    select to_jsonb(x) into u from auth.users x where x.id = auth.uid();
    mail := lower(btrim(coalesce(u->>'email', '')));
    if mail !~ '^[a-z]+[0-9]*@k12\.ipsd\.org$' or coalesce(u->>'email_confirmed_at', '') = '' then return null; end if;
    local := regexp_replace(split_part(mail, '@', 1), '[0-9]+$', '');
    select count(*) into n from public.msa_roster where local = any(keys);
    if n <> 1 then return null; end if;
    select * into r from public.msa_roster where local = any(keys);
    return r;
end;
$$;

/** Where the signed-in person stands — a matching school account joins here. */
create or replace function public.msa_status()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.msa_members; r public.msa_roster; mail text := coalesce(public.msa_my_email(), '');
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    select * into m from public.msa_members where user_id = uid;
    if not coalesce(m.status = 'approved' and m.expires_at > now(), false) then
        r := public.msa_school_match();
        if r.name_key is not null then
            -- The school account is the real owner of the name.
            update public.msa_members set status = 'flagged', decided_at = now(), expires_at = null
            where name_key = r.name_key and user_id <> uid and status = 'approved';
            insert into public.msa_members as x (user_id, name, name_key, status, via, on_roster, created_at, decided_at, expires_at)
            values (uid, r.name, r.name_key, 'approved', 'school', true, now(), now(), public.msa_year_end())
            on conflict (user_id) do update set name = excluded.name, name_key = excluded.name_key, status = 'approved',
                via = 'school', on_roster = true, decided_at = now(), expires_at = excluded.expires_at
            returning * into m;
        end if;
    end if;
    return public.msa_member_json(m) || jsonb_build_object(
        'approver', public.msa_is_approver_now(),
        'poster', exists (select 1 from public.msa_admins where email_hash = sha256(convert_to(mail, 'UTF8'))),
        'email', mail,
        'school', mail ~ '@k12\.ipsd\.org$');
end;
$$;

/** The roster with who has joined (for the approver). */
create or replace function public.msa_roster_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_approver();
    return coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'user_id', m.user_id, 'via', m.via, 'email', u.email) order by r.name)
        from public.msa_roster r
        left join public.msa_members m on m.name_key = r.name_key and m.status = 'approved' and m.expires_at > now()
        left join auth.users u on u.id = m.user_id), '[]'::jsonb);
end;
$$;

revoke all on function public.msa_email_keys(text), public.msa_school_match() from public, anon, authenticated;
revoke all on function public.msa_status(), public.msa_roster_status() from public, anon;
grant execute on function public.msa_status(), public.msa_roster_status() to authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  2.11.8 — One list of MSA admins, managed in the app
--  Admins post announcements AND run the Manage page (members, the roster,
--  the meeting code, and the admin list itself). There is no separate
--  poster or approver list any more: msa_admins is the only one.
--  • The two OWNERS below always stay admins (they can't be removed in the
--    app). They are stored as hashes, like before — this file is public.
--  • The first run of this file removes every admin except the owners once,
--    then re-adds the owners (recorded in msa_meta as 'admins-2.11.8', so
--    admins added later in the app survive re-running this file).
--  • Admins add and remove other admins by email on the Manage page. Those
--    emails are kept in the database (never in this file).
--  • Admins add students one at a time — a name, and optionally the email
--    they sign in with. A student added with an email becomes a member as
--    soon as that (confirmed) account signs in, whatever the email's domain.
--  msa_approvers (2.11.6) is no longer read.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.msa_meta (
    key text primary key,
    at  timestamptz not null default now()
);
alter table public.msa_meta enable row level security;
revoke all on public.msa_meta from anon, authenticated;

alter table public.msa_admins add column if not exists email    text;
alter table public.msa_admins add column if not exists owner    boolean not null default false;
alter table public.msa_admins add column if not exists added_by text;

do $$
begin
    if not exists (select 1 from public.msa_meta where key = 'admins-2.11.8') then
        delete from public.msa_admins where email_hash not in (
            '\x0d1d4d8e54dba5abd774586630868a3c078c4d7171be9292f4451b54bfd2c0a5'::bytea,
            '\x0359ef19e11b6941875be3039743b7d627855fa162b587982a5142cf558e6276'::bytea);
        insert into public.msa_meta (key) values ('admins-2.11.8');
    end if;
end;
$$;
insert into public.msa_admins (email_hash, owner) values
    ('\x0d1d4d8e54dba5abd774586630868a3c078c4d7171be9292f4451b54bfd2c0a5', true),
    ('\x0359ef19e11b6941875be3039743b7d627855fa162b587982a5142cf558e6276', true)
on conflict (email_hash) do update set owner = true;

alter table public.msa_roster add column if not exists email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
create unique index if not exists msa_roster_email on public.msa_roster (email) where email is not null;

/** "An admin" is now one list: the signed-in account's email is on msa_admins. */
create or replace function public.msa_is_approver_now()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.msa_my_email() <> '' and exists (
        select 1 from public.msa_admins where email_hash = sha256(convert_to(public.msa_my_email(), 'UTF8'))), false);
$$;
create or replace function public.msa_approver()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    if not public.msa_is_approver_now() then raise exception 'not an MSA admin' using errcode = '42501'; end if;
    return uid;
end;
$$;

/** A normalised email address, or an error. */
create or replace function public.msa_clean_email(p text)
returns text language plpgsql immutable set search_path = public as $$
declare e text := lower(btrim(coalesce(p, '')));
begin
    if e !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' or char_length(e) > 254 then
        raise exception 'that isn''t an email address' using errcode = '22023';
    end if;
    return e;
end;
$$;

/** The roster row a confirmed account was added with, by its email. */
create or replace function public.msa_invite_match()
returns public.msa_roster language plpgsql stable security definer set search_path = public as $$
declare u jsonb; mail text; r public.msa_roster;
begin
    select to_jsonb(x) into u from auth.users x where x.id = auth.uid();
    mail := lower(btrim(coalesce(u->>'email', '')));
    if mail = '' or coalesce(u->>'email_confirmed_at', '') = '' then return null; end if;
    select * into r from public.msa_roster where email = mail;
    return r;
end;
$$;

/**
 * Where the signed-in person stands. A student an admin added by email, or
 * a matching school account, joins here. An admin's own email is remembered
 * so the admin list can show it.
 */
create or replace function public.msa_status()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.msa_members; r public.msa_roster; how text := 'approver';
    mail text := coalesce(public.msa_my_email(), ''); admin boolean;
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    admin := mail <> '' and exists (select 1 from public.msa_admins where email_hash = sha256(convert_to(mail, 'UTF8')));
    if admin then
        update public.msa_admins set email = mail where email_hash = sha256(convert_to(mail, 'UTF8')) and email is distinct from mail;
    end if;
    select * into m from public.msa_members where user_id = uid;
    if not coalesce(m.status = 'approved' and m.expires_at > now(), false) then
        r := public.msa_invite_match();
        if r.name_key is null then r := public.msa_school_match(); how := 'school'; end if;
        if r.name_key is not null then
            -- The account the roster names is the real owner of the name.
            update public.msa_members set status = 'flagged', decided_at = now(), expires_at = null
            where name_key = r.name_key and user_id <> uid and status = 'approved';
            insert into public.msa_members as x (user_id, name, name_key, status, via, on_roster, created_at, decided_at, expires_at)
            values (uid, r.name, r.name_key, 'approved', how, true, now(), now(), public.msa_year_end())
            on conflict (user_id) do update set name = excluded.name, name_key = excluded.name_key, status = 'approved',
                via = excluded.via, on_roster = true, decided_at = now(), expires_at = excluded.expires_at
            returning * into m;
        end if;
    end if;
    return public.msa_member_json(m) || jsonb_build_object(
        'approver', admin,
        'poster', admin,
        'admin', admin,
        'email', mail,
        'school', mail ~ '@k12\.ipsd\.org$');
end;
$$;

/** Everyone who asked or joined (now with when they were let in). */
create or replace function public.msa_people()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_approver();
    return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.name, 'status', m.status, 'via', m.via,
            'on_roster', exists (select 1 from public.msa_roster r where r.name_key = m.name_key),
            'email', u.email, 'created_at', m.created_at, 'decided_at', m.decided_at, 'expires_at', m.expires_at)
        order by case m.status when 'flagged' then 0 when 'pending' then 1 when 'approved' then 2 else 3 end, m.created_at desc)
        from public.msa_members m join auth.users u on u.id = m.user_id
        where not (m.status = 'approved' and m.expires_at <= now())), '[]'::jsonb);
end;
$$;

/** Replace the roster, keeping the emails of names that stay on it. */
create or replace function public.msa_roster_set(p_names text[])
returns int language plpgsql security definer set search_path = public as $$
begin
    perform public.msa_approver();
    if coalesce(array_length(p_names, 1), 0) > 2000 then raise exception 'too many names' using errcode = '54000'; end if;
    with n as (
        select distinct on (public.msa_name_key(x)) public.msa_name_key(x) as name_key,
            left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 80) as name, public.msa_email_keys(x) as keys
        from unnest(coalesce(p_names, '{}')) x
        where char_length(public.msa_name_key(x)) between 2 and 80
    ), gone as (
        delete from public.msa_roster r where not exists (select 1 from n where n.name_key = r.name_key)
    )
    insert into public.msa_roster (name_key, name, keys)
    select name_key, name, keys from n
    on conflict (name_key) do update set name = excluded.name, keys = excluded.keys;
    return (select count(*) from public.msa_roster);
end;
$$;

/** The roster with who has joined, and the email each student was added with. */
create or replace function public.msa_roster_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.msa_approver();
    return coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'user_id', m.user_id, 'via', m.via, 'email', u.email,
            'invite', r.email, 'joined_at', m.decided_at) order by r.name)
        from public.msa_roster r
        left join public.msa_members m on m.name_key = r.name_key and m.status = 'approved' and m.expires_at > now()
        left join auth.users u on u.id = m.user_id), '[]'::jsonb);
end;
$$;

/**
 * Add one student to the roster (or change their email). With an email, the
 * account that signs in with it becomes a member — at once, if it exists.
 */
create or replace function public.msa_student_add(p_name text, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := public.msa_name_key(p_name); nm text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
    mail text; target uuid; joined boolean := false;
begin
    perform public.msa_approver();
    if char_length(k) < 2 or char_length(nm) > 80 or position(' ' in k) = 0 then
        raise exception 'type your first and last name' using errcode = '22023';
    end if;
    if (select count(*) from public.msa_roster) >= 2000 then raise exception 'too many names' using errcode = '54000'; end if;
    if nullif(btrim(coalesce(p_email, '')), '') is not null then
        mail := public.msa_clean_email(p_email);
        update public.msa_roster set email = null where email = mail and name_key <> k;
    end if;
    insert into public.msa_roster (name_key, name, keys, email)
    values (k, nm, public.msa_email_keys(nm), mail)
    on conflict (name_key) do update set name = excluded.name, keys = excluded.keys, email = coalesce(excluded.email, public.msa_roster.email);
    if mail is not null then
        select id into target from auth.users where lower(btrim(email)) = mail limit 1;
        if target is not null then
            update public.msa_members set status = 'flagged', decided_at = now(), expires_at = null
            where name_key = k and user_id <> target and status = 'approved';
            insert into public.msa_members as x (user_id, name, name_key, status, via, on_roster, created_at, decided_at, expires_at)
            values (target, nm, k, 'approved', 'approver', true, now(), now(), public.msa_year_end())
            on conflict (user_id) do update set name = excluded.name, name_key = excluded.name_key, status = 'approved',
                via = 'approver', on_roster = true, decided_at = now(), expires_at = excluded.expires_at;
            joined := true;
        end if;
    end if;
    update public.msa_members set on_roster = true where name_key = k;
    return jsonb_build_object('name', nm, 'email', mail, 'joined', joined);
end;
$$;

/** Take a student off the roster; their membership (if any) ends too. */
create or replace function public.msa_student_remove(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := public.msa_name_key(p_name);
begin
    perform public.msa_approver();
    delete from public.msa_roster where name_key = k;
    delete from public.msa_members where name_key = k and status = 'approved';
    update public.msa_members set on_roster = false where name_key = k;
end;
$$;

/** Approve every waiting request whose name is on the roster (and free). Returns how many. */
create or replace function public.msa_approve_listed()
returns int language plpgsql security definer set search_path = public as $$
declare m public.msa_members; n int := 0;
begin
    perform public.msa_approver();
    for m in select * from public.msa_members x where x.status = 'pending'
            and exists (select 1 from public.msa_roster r where r.name_key = x.name_key) order by x.created_at loop
        continue when exists (select 1 from public.msa_members o where o.name_key = m.name_key and o.status = 'approved'
            and o.expires_at > now() and o.user_id <> m.user_id);
        delete from public.msa_members where name_key = m.name_key and status = 'approved' and expires_at <= now() and user_id <> m.user_id;
        update public.msa_members set status = 'approved', via = 'approver', decided_at = now(), expires_at = public.msa_year_end()
        where user_id = m.user_id;
        n := n + 1;
    end loop;
    return n;
end;
$$;

/** The admins: email (once known), owner, who added them, and which one is you. */
create or replace function public.msa_admin_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mine bytea;
begin
    perform public.msa_approver();
    mine := sha256(convert_to(public.msa_my_email(), 'UTF8'));
    return coalesce((select jsonb_agg(jsonb_build_object('id', encode(a.email_hash, 'hex'), 'email', a.email, 'owner', a.owner,
            'added_by', a.added_by, 'added_at', a.added_at, 'me', a.email_hash = mine)
        order by a.owner desc, a.added_at) from public.msa_admins a), '[]'::jsonb);
end;
$$;

/** Make an email an admin (posts, members, roster, code, admins). */
create or replace function public.msa_admin_add(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mail text;
begin
    perform public.msa_approver();
    mail := public.msa_clean_email(p_email);
    if (select count(*) from public.msa_admins) >= 25 then raise exception 'too many admins' using errcode = '54000'; end if;
    insert into public.msa_admins (email_hash, email, added_by)
    values (sha256(convert_to(mail, 'UTF8')), mail, public.msa_my_email())
    on conflict (email_hash) do update set email = excluded.email;
    return public.msa_admin_list();
end;
$$;

/** Remove an admin by id (the hash in hex). Owners and yourself can't be removed. */
create or replace function public.msa_admin_remove(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.msa_admins;
begin
    perform public.msa_approver();
    select * into a from public.msa_admins where encode(email_hash, 'hex') = lower(coalesce(p_id, ''));
    if a.email_hash is null then raise exception 'no such admin' using errcode = 'P0002'; end if;
    if a.owner then raise exception 'owners can''t be removed' using errcode = '42501'; end if;
    if a.email_hash = sha256(convert_to(public.msa_my_email(), 'UTF8')) then
        raise exception 'you can''t remove yourself' using errcode = '42501';
    end if;
    delete from public.msa_admins where email_hash = a.email_hash;
    return public.msa_admin_list();
end;
$$;

revoke all on function public.msa_clean_email(text), public.msa_invite_match() from public, anon, authenticated;
revoke all on function public.msa_student_add(text, text), public.msa_student_remove(text), public.msa_approve_listed(),
    public.msa_admin_list(), public.msa_admin_add(text), public.msa_admin_remove(text) from public, anon;
grant execute on function public.msa_student_add(text, text), public.msa_student_remove(text), public.msa_approve_listed(),
    public.msa_admin_list(), public.msa_admin_add(text), public.msa_admin_remove(text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
--  SalaamStreet AI (3.0) and the admin's AI Testing Lab
--  Used only by the ai-lab Edge Function (backend/functions/ai-lab), which
--  runs with the service role and checks every request's account: anyone
--  signed in (with a confirmed email) may chat; only the
--  admin may use the Lab's status, settings and stats. Nothing
--  here is reachable from the app's public key: no table or function is
--  granted to anon or authenticated.
--  • ai_settings: one row — the emergency switch, the model, limits and the
--    prices used for cost estimates. Changed from the Lab page or here.
--  • ai_usage: one row per request — counts, tokens, estimated cost, status,
--    and whether the person found the answer helpful (3.0). Never the
--    conversation itself.
--  • ai_security_log: refused requests (who and why, never tokens or text).
--  • ai_queue: the waiting list — who's waiting for the AI while it's busy.
--  • ai_members: per person — which version of the AI Terms they accepted
--    and when, their off-topic strikes, and any ban (3 strikes → 7 days).
--  • ai_reserve(): the switches, the project's daily and per-minute limits,
--    each person's daily allowance and the waiting list, checked and counted
--    in one step so two requests at once can't both slip past a limit.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_settings (
    id                  boolean primary key default true check (id),
    enabled             boolean not null default true,
    model               text not null default 'gemini-3.5-flash-lite' check (model ~ '^[a-z0-9][a-z0-9.-]{1,63}$'),
    daily_limit         integer not null default 50 check (daily_limit between 0 and 100000),
    minute_limit        integer not null default 5 check (minute_limit between 1 and 600),
    max_input_chars     integer not null default 6000 check (max_input_chars between 200 and 30000),
    max_output_tokens   integer not null default 2048 check (max_output_tokens between 64 and 8192),
    input_usd_per_mtok  numeric(10, 4) not null default 0.30 check (input_usd_per_mtok >= 0),
    output_usd_per_mtok numeric(10, 4) not null default 2.50 check (output_usd_per_mtok >= 0),
    updated_at          timestamptz not null default now(),
    updated_by          uuid
);
insert into public.ai_settings (id) values (true) on conflict (id) do nothing;

-- 3.0 Beta: open to every account. beta_open closes it to everyone but the
-- admin (the emergency switch, enabled, stops everyone). user_daily_limit is
-- each person's questions per UTC day.
alter table public.ai_settings add column if not exists beta_open boolean not null default true;
alter table public.ai_settings add column if not exists user_daily_limit integer not null default 20;
alter table public.ai_settings add column if not exists beta_started boolean not null default false;
alter table public.ai_settings drop constraint if exists ai_settings_daily_limit_check;
alter table public.ai_settings add constraint ai_settings_daily_limit_check check (daily_limit between 0 and 100000);
alter table public.ai_settings drop constraint if exists ai_settings_minute_limit_check;
alter table public.ai_settings add constraint ai_settings_minute_limit_check check (minute_limit between 1 and 600);
alter table public.ai_settings drop constraint if exists ai_settings_user_daily_limit_check;
alter table public.ai_settings add constraint ai_settings_user_daily_limit_check check (user_daily_limit between 0 and 1000);
-- Once, when the beta starts: the Lab's limits were sized for one person.
-- Raise them to a starting point for everyone (change them in the Lab).
update public.ai_settings set daily_limit = greatest(daily_limit, 1000), minute_limit = greatest(minute_limit, 15),
    beta_started = true where id and not beta_started;

create table if not exists public.ai_usage (
    id             bigint generated always as identity primary key,
    user_id        uuid not null,
    at             timestamptz not null default now(),
    kind           text not null check (kind in ('chat', 'test')),
    status         text not null default 'pending' check (status in ('pending', 'ok', 'error')),
    model          text,
    prompt_tokens  integer,
    output_tokens  integer,
    thought_tokens integer,
    total_tokens   integer,
    cost_usd       numeric(12, 6),
    latency_ms     integer,
    error          text check (error is null or char_length(error) <= 80)
);
create index if not exists ai_usage_at on public.ai_usage (at);
-- 3.0: "Was this helpful?" — 1 (yes) or -1 (no), set by the person who asked. Only the number.
alter table public.ai_usage add column if not exists rating smallint check (rating is null or rating in (-1, 1));
create index if not exists ai_usage_user_at on public.ai_usage (user_id, at);

-- The waiting list. A person stays in line while their page keeps checking
-- in (every few seconds); after 30 seconds without one they've left.
create table if not exists public.ai_queue (
    user_id   uuid primary key,
    joined_at timestamptz not null default now(),
    seen_at   timestamptz not null default now()
);

create table if not exists public.ai_security_log (
    id      bigint generated always as identity primary key,
    at      timestamptz not null default now(),
    user_id uuid,
    event   text not null check (char_length(event) <= 40),
    detail  text check (detail is null or char_length(detail) <= 120)
);
create index if not exists ai_security_log_at on public.ai_security_log (at);

alter table public.ai_settings enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_security_log enable row level security;
alter table public.ai_queue enable row level security;
revoke all on public.ai_settings, public.ai_usage, public.ai_security_log, public.ai_queue from anon, authenticated;

/** Check the switches and the limits, and count the request, in one step.
    Chats count towards the daily limits; connection tests only towards the
    per-minute limit. daily_limit is for the whole project (a cost cap);
    user_daily_limit is each person's (failed requests don't use it up).
    The admin (p_admin) skips the beta switch, the personal allowance and the
    waiting list. Everyone else waits in line when the per-minute capacity is
    used up, and newcomers join behind the people already waiting. Days are
    UTC, like Google's own quotas. */
drop function if exists public.ai_reserve(uuid, text);
create or replace function public.ai_reserve(p_user uuid, p_kind text, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.ai_settings; used integer; mine integer := 0; recent integer; rid bigint; q jsonb;
begin
    if p_user is null or p_kind not in ('chat', 'test') then raise exception 'bad request' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtext('ai_reserve'));
    select * into s from public.ai_settings where id;
    delete from public.ai_queue where seen_at < now() - interval '30 seconds';
    select count(*) into used from public.ai_usage
        where kind = 'chat' and at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    if not s.enabled then
        return jsonb_build_object('ok', false, 'reason', 'disabled', 'used', used, 'limit', s.daily_limit);
    end if;
    if p_kind = 'chat' and not p_admin and not s.beta_open then
        return jsonb_build_object('ok', false, 'reason', 'closed');
    end if;
    if p_kind = 'chat' and used >= s.daily_limit then
        return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'used', used, 'limit', s.daily_limit);
    end if;
    if p_kind = 'chat' and not p_admin then
        select count(*) into mine from public.ai_usage
            where user_id = p_user and kind = 'chat' and status <> 'error'
              and at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
        if mine >= s.user_daily_limit then
            delete from public.ai_queue where user_id = p_user; -- out of questions: don't hold up the line
            return jsonb_build_object('ok', false, 'reason', 'user_limit', 'used', mine, 'limit', s.user_daily_limit);
        end if;
        -- Requests Google refused as too busy aren't the person's doing, so they don't count here.
        if (select count(*) from public.ai_usage where user_id = p_user and status <> 'error' and at > now() - interval '1 minute') >= 3 then
            delete from public.ai_queue where user_id = p_user;
            return jsonb_build_object('ok', false, 'reason', 'user_rate_limit');
        end if;
    end if;
    select count(*) into recent from public.ai_usage where at > now() - interval '1 minute';
    if p_kind = 'chat' and not p_admin then
        -- Room for this person only after everyone who joined the line before them.
        if s.minute_limit - recent <= (select count(*) from public.ai_queue a where a.user_id <> p_user
                and a.joined_at < coalesce((select b.joined_at from public.ai_queue b where b.user_id = p_user), 'infinity')) then
            q := public.ai_enqueue(p_user);
            return q || jsonb_build_object('ok', false, 'reason', 'queued');
        end if;
        delete from public.ai_queue where user_id = p_user;
    elsif recent >= s.minute_limit then
        return jsonb_build_object('ok', false, 'reason', 'rate_limit', 'used', used, 'limit', s.daily_limit);
    end if;
    insert into public.ai_usage (user_id, kind, model) values (p_user, p_kind, s.model) returning id into rid;
    -- Keep the logs small: usage for a year, refusals for 90 days.
    delete from public.ai_usage where at < now() - interval '365 days';
    delete from public.ai_security_log where at < now() - interval '90 days';
    return jsonb_build_object('ok', true, 'id', rid, 'model', s.model,
        'used', used + case when p_kind = 'chat' then 1 else 0 end, 'limit', s.daily_limit,
        'user_used', mine + case when p_kind = 'chat' and not p_admin then 1 else 0 end, 'user_limit', s.user_daily_limit,
        'max_input_chars', s.max_input_chars, 'max_output_tokens', s.max_output_tokens,
        'input_usd_per_mtok', s.input_usd_per_mtok, 'output_usd_per_mtok', s.output_usd_per_mtok);
end;
$$;

/** Join the waiting list (or check in, keeping your place). Returns your
    position, how many are waiting, and a rough wait in seconds. Also used when
    Google itself is too busy, so the person keeps a fair place in line. */
create or replace function public.ai_enqueue(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.ai_settings; me timestamptz; pos integer; total integer;
begin
    if p_user is null then raise exception 'bad request' using errcode = '22023'; end if;
    select * into s from public.ai_settings where id;
    insert into public.ai_queue (user_id) values (p_user)
        on conflict (user_id) do update set seen_at = now()
        returning joined_at into me;
    select count(*) into pos from public.ai_queue where seen_at >= now() - interval '30 seconds' and joined_at <= me;
    select count(*) into total from public.ai_queue where seen_at >= now() - interval '30 seconds';
    return jsonb_build_object('position', pos, 'waiting', total,
        'wait_seconds', greatest(5, ceil(pos * 60.0 / greatest(s.minute_limit, 1)))::integer);
end;
$$;

/* The AI Terms and the off-topic rule. One row per person who has used
   SalaamStreet AI: the Terms version they accepted (and when — the record
   that they agreed), and their off-topic strikes. The third strike within
   30 days pauses their access for 7 days and starts the count again.
   Never the conversation itself. */
create table if not exists public.ai_members (
    user_id           uuid primary key,
    terms_version     text check (terms_version is null or char_length(terms_version) <= 20),
    terms_accepted_at timestamptz,
    strikes           integer not null default 0 check (strikes between 0 and 10),
    last_strike_at    timestamptz,
    banned_until      timestamptz,
    bans              integer not null default 0 check (bans >= 0)
);
alter table public.ai_members enable row level security;
revoke all on public.ai_members from anon, authenticated;

/** One person's beta status: their allowance today, whether the beta is open,
    which Terms they accepted, their strikes and any ban. */
create or replace function public.ai_user_status(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'enabled', s.enabled, 'beta_open', s.beta_open, 'user_limit', s.user_daily_limit,
        'max_input_chars', s.max_input_chars,
        'used_today', (select count(*) from public.ai_usage where user_id = p_user and kind = 'chat' and status <> 'error'
            and at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'),
        'waiting', (select count(*) from public.ai_queue where seen_at >= now() - interval '30 seconds'),
        'resets_at', date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '1 day',
        'terms_version', m.terms_version,
        'strikes', case when m.last_strike_at > now() - interval '30 days' then m.strikes else 0 end,
        'banned_until', case when m.banned_until > now() then m.banned_until end)
    from public.ai_settings s left join public.ai_members m on m.user_id = p_user where s.id;
$$;

/** Record that the person accepted this version of the AI Terms. */
create or replace function public.ai_accept_terms(p_user uuid, p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if p_user is null or p_version is null or char_length(p_version) not between 1 and 20 then
        raise exception 'bad request' using errcode = '22023';
    end if;
    insert into public.ai_members (user_id, terms_version, terms_accepted_at) values (p_user, p_version, now())
        on conflict (user_id) do update set terms_version = excluded.terms_version, terms_accepted_at = excluded.terms_accepted_at;
    return jsonb_build_object('ok', true, 'terms_version', p_version);
end;
$$;

/** One off-topic request. Strikes older than 30 days are forgotten; the third
    one pauses SalaamStreet AI for this person for 7 days. */
create or replace function public.ai_strike(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.ai_members; n integer;
begin
    if p_user is null then raise exception 'bad request' using errcode = '22023'; end if;
    insert into public.ai_members (user_id) values (p_user) on conflict (user_id) do nothing;
    select * into m from public.ai_members where user_id = p_user for update;
    n := case when m.last_strike_at > now() - interval '30 days' then m.strikes else 0 end + 1;
    if n >= 3 then
        update public.ai_members set strikes = 0, last_strike_at = now(), banned_until = now() + interval '7 days', bans = bans + 1
            where user_id = p_user returning * into m;
        delete from public.ai_queue where user_id = p_user;
        insert into public.ai_security_log (user_id, event, detail) values (p_user, 'banned', 'third off-topic request: 7 days');
        return jsonb_build_object('strikes', 3, 'limit', 3, 'banned_until', m.banned_until);
    end if;
    update public.ai_members set strikes = n, last_strike_at = now() where user_id = p_user;
    insert into public.ai_security_log (user_id, event, detail) values (p_user, 'off_topic', 'strike ' || n || ' of 3');
    return jsonb_build_object('strikes', n, 'limit', 3, 'banned_until', null);
end;
$$;

/** "Was this helpful?" on one of the person's own answers from the last day
    (1, -1, or 0 to take it back). Returns ok false for anyone else's. */
create or replace function public.ai_rate(p_user uuid, p_id bigint, p_rating integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n integer;
begin
    if p_user is null or p_id is null or p_rating not in (-1, 0, 1) then raise exception 'bad request' using errcode = '22023'; end if;
    update public.ai_usage set rating = nullif(p_rating, 0)::smallint
        where id = p_id and user_id = p_user and kind = 'chat' and status = 'ok' and at > now() - interval '1 day';
    get diagnostics n = row_count;
    return jsonb_build_object('ok', n = 1);
end;
$$;

/** Leave the waiting list (the person cancelled or left the page). */
create or replace function public.ai_dequeue(p_user uuid)
returns void language sql security definer set search_path = public as $$
    delete from public.ai_queue where user_id = p_user;
$$;

/** Today's and the last 7 days' usage (UTC days), for the Lab page. */
create or replace function public.ai_usage_summary()
returns jsonb language sql stable security definer set search_path = public as $$
    with day as (select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' as start)
    select jsonb_build_object(
        'today_requests', (select count(*) from public.ai_usage, day where kind = 'chat' and at >= day.start),
        'today_errors', (select count(*) from public.ai_usage, day where kind = 'chat' and status = 'error' and at >= day.start),
        'today_tokens', (select coalesce(sum(total_tokens), 0) from public.ai_usage, day where at >= day.start),
        'today_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_usage, day where at >= day.start),
        'week_requests', (select count(*) from public.ai_usage, day where kind = 'chat' and at >= day.start - interval '6 days'),
        'week_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_usage, day where at >= day.start - interval '6 days'),
        'refused_today', (select count(*) from public.ai_security_log, day where at >= day.start),
        'people_today', (select count(distinct user_id) from public.ai_usage, day where kind = 'chat' and at >= day.start),
        'waiting_now', (select count(*) from public.ai_queue where seen_at >= now() - interval '30 seconds'),
        'off_topic_today', (select count(*) from public.ai_security_log, day where event in ('off_topic', 'banned') and at >= day.start),
        'banned_now', (select count(*) from public.ai_members where banned_until > now()),
        'helpful_7d', (select count(*) from public.ai_usage, day where rating = 1 and at >= day.start - interval '6 days'),
        'unhelpful_7d', (select count(*) from public.ai_usage, day where rating = -1 and at >= day.start - interval '6 days'),
        'resets_at', (select day.start + interval '1 day' from day));
$$;

/** App-wide counts for the admin (the Lab's "App stats" card). Numbers only —
    no names, emails or anyone's data. */
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    return jsonb_build_object(
        'accounts', (select count(*) from auth.users),
        'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
        'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
        'by_provider', (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb) from (
            select coalesce(raw_app_meta_data->>'provider', 'other') as p, count(*) as n from auth.users group by 1) x),
        'synced_items', (select count(*) from public.sync_records where not deleted),
        'reminder_devices', (select count(*) from public.push_subscriptions),
        'family_children', (select count(*) from public.family_children),
        'msa_members', (select count(*) from public.msa_members where status = 'approved'),
        'msa_pending', (select count(*) from public.msa_members where status in ('pending', 'flagged')),
        'msa_posts', (select count(*) from public.msa_posts));
end;
$$;

revoke all on function public.ai_reserve(uuid, text, boolean), public.ai_enqueue(uuid), public.ai_user_status(uuid), public.ai_dequeue(uuid),
    public.ai_accept_terms(uuid, text), public.ai_strike(uuid), public.ai_rate(uuid, bigint, integer), public.ai_usage_summary(), public.admin_stats() from public, anon, authenticated;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant select, insert, update, delete on public.ai_settings, public.ai_usage, public.ai_security_log, public.ai_queue, public.ai_members to service_role;
        grant execute on function public.ai_reserve(uuid, text, boolean), public.ai_enqueue(uuid), public.ai_user_status(uuid), public.ai_dequeue(uuid),
            public.ai_accept_terms(uuid, text), public.ai_strike(uuid), public.ai_rate(uuid, bigint, integer), public.ai_usage_summary(), public.admin_stats() to service_role;
    end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  3.0.1 — Admin Panel (#/admin; on the website and in the iPhone app)
--  One place for the people who run SalaamStreet to see the app's numbers,
--  find accounts, deal with abuse and keep a record of what they did.
--  Only the admin Edge Function (backend/functions/admin) calls these, with
--  the service role, after checking the person's session. Every function
--  also checks, itself, that p_admin is on the admin list (defence in depth).
--  Nothing here is reachable with the app's public key.
--  • app_admins: SHA-256 hashes of the admins' lower-cased emails (this file
--    is public). Starts with the owner; more are added in the panel.
--  • admin_settings: one row — whether flagged sign-ups are refused outright.
--  • admin_words: words that flag a new account's email or name (checked on
--    every sign-up). Starts with a short list of slurs; edited in the panel.
--  • admin_flags: accounts waiting for an admin to look at them.
--  • admin_audit: every admin action — who, when, to which account.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.app_admins (
    email_hash bytea primary key check (octet_length(email_hash) = 32),
    email      text check (email is null or char_length(email) <= 320), -- filled in the first time they open the panel
    added_at   timestamptz not null default now(),
    added_by   uuid
);
insert into public.app_admins (email_hash) values
    ('\x0359ef19e11b6941875be3039743b7d627855fa162b587982a5142cf558e6276') -- the owner
on conflict (email_hash) do nothing;

create table if not exists public.admin_settings (
    id            boolean primary key default true check (id),
    block_signups boolean not null default false, -- refuse sign-ups that match a word (otherwise only flag them)
    words_seeded  boolean not null default false,
    updated_at    timestamptz not null default now(),
    updated_by    uuid
);
insert into public.admin_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.admin_words (
    word     text primary key check (word ~ '^[a-z]{3,40}$'),
    added_at timestamptz not null default now()
);
-- Seeded once, so a word an admin removes stays removed when this file is run again.
-- Words are matched anywhere inside a name, so ones hiding in ordinary names are left
-- out ("paki" is in Pakistani, "nazi" in Nazia and Nazir, "rape" in grape).
do $$
begin
    if not (select words_seeded from public.admin_settings where id) then
        insert into public.admin_words (word) values
            ('nigger'), ('nigga'), ('faggot'), ('kike'), ('chink'), ('wetback'), ('raghead'), ('towelhead'),
            ('tranny'), ('fuck'), ('porn'), ('hitler')
        on conflict (word) do nothing;
        update public.admin_settings set words_seeded = true where id;
    end if;
end;
$$;

create table if not exists public.admin_flags (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    source      text not null default 'signup' check (source in ('signup', 'admin')),
    word        text,
    note        text check (note is null or char_length(note) <= 200),
    status      text not null default 'open' check (status in ('open', 'dismissed')),
    flagged_at  timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid
);

create table if not exists public.admin_audit (
    id        bigint generated always as identity primary key,
    at        timestamptz not null default now(),
    admin_id  uuid,
    action    text not null check (char_length(action) <= 40),
    target_id uuid,
    target    text check (target is null or char_length(target) <= 120), -- masked email, e.g. na***@example.org
    detail    text check (detail is null or char_length(detail) <= 200)
);
create index if not exists admin_audit_at on public.admin_audit (at desc);
create index if not exists admin_audit_target on public.admin_audit (target_id, at desc);

alter table public.app_admins     enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_words    enable row level security;
alter table public.admin_flags    enable row level security;
alter table public.admin_audit    enable row level security;
revoke all on public.app_admins, public.admin_settings, public.admin_words, public.admin_flags, public.admin_audit from anon, authenticated;

/** "name@example.org" → "na***@example.org" (for the audit log, which outlives deleted accounts). */
create or replace function public.admin_mask(p_email text)
returns text language sql immutable set search_path = public as $$
    select case when p_email is null or btrim(p_email) = '' then null
        when position('@' in p_email) = 0 then left(btrim(p_email), 2) || '***'
        else left(split_part(lower(btrim(p_email)), '@', 1), 2) || '***@' || split_part(lower(btrim(p_email)), '@', 2) end;
$$;

/** Letters only, lower case, common look-alikes undone ("n1gg@" → "nigga"). */
create or replace function public.admin_norm(p_text text)
returns text language sql immutable set search_path = public as $$
    select regexp_replace(translate(lower(coalesce(p_text, '')), '013457@$!|', 'oieastasii'), '[^a-z]', '', 'g');
$$;

/** The first listed word in an email's name part or a sign-up name, or null. */
create or replace function public.admin_screen(p_email text, p_meta jsonb)
returns text language plpgsql stable security definer set search_path = public as $$
declare hay text; w text;
begin
    hay := public.admin_norm(split_part(coalesce(p_email, ''), '@', 1)) || ' ' ||
           public.admin_norm(coalesce(p_meta->>'full_name', '')) || ' ' ||
           public.admin_norm(coalesce(p_meta->>'name', '')) || ' ' ||
           public.admin_norm(coalesce(p_meta->>'display_name', ''));
    select word into w from public.admin_words where position(word in hay) > 0 order by length(word) desc, word limit 1;
    return w;
end;
$$;

/** On every sign-up (and email or name change): flag a match for an admin
    to look at, or — with "refuse" on — stop the sign-up. Never breaks a
    sign-up for any other reason. */
create or replace function public.admin_screen_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare w text; block boolean := false;
begin
    begin
        w := public.admin_screen(new.email, new.raw_user_meta_data);
        select block_signups into block from public.admin_settings where id;
    exception when others then
        return new;
    end;
    if w is null then return new; end if;
    if tg_op = 'INSERT' and coalesce(block, false) then
        raise exception 'This email address or name can''t be used on SalaamStreet.' using errcode = '22023';
    end if;
    begin
        insert into public.admin_flags (user_id, source, word) values (new.id, 'signup', w) on conflict (user_id) do nothing;
    exception when others then
        null;
    end;
    return new;
end;
$$;
drop trigger if exists on_auth_user_screen on auth.users;
create trigger on_auth_user_screen
    after insert or update of email, raw_user_meta_data on auth.users
    for each row execute function public.admin_screen_user();
revoke all on function public.admin_screen_user() from public, anon, authenticated;

-- Accounts made before 3.0.1 are checked once, too.
insert into public.admin_flags (user_id, source, word)
    select id, 'signup', public.admin_screen(email, raw_user_meta_data) from auth.users
    where public.admin_screen(email, raw_user_meta_data) is not null
on conflict (user_id) do nothing;

/** Is this account an admin? Decided from the account's own email in auth.users. */
create or replace function public.admin_check(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare mail text;
begin
    select lower(btrim(email)) into mail from auth.users where id = p_user;
    return coalesce(mail, '') <> '' and exists (select 1 from public.app_admins where email_hash = sha256(convert_to(mail, 'UTF8')));
end;
$$;

create or replace function public.admin_require(p_admin uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
    if p_admin is null or not public.admin_check(p_admin) then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

create or replace function public.admin_log(p_admin uuid, p_action text, p_target uuid, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
    insert into public.admin_audit (admin_id, action, target_id, target, detail)
        values (p_admin, left(p_action, 40), p_target,
            (select public.admin_mask(coalesce(email, phone)) from auth.users where id = p_target), left(p_detail, 200));
    delete from public.admin_audit where at < now() - interval '2 years';
end;
$$;

/** Someone who isn't an admin tried an admin action (kept with the log). */
create or replace function public.admin_denied(p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
    insert into public.admin_audit (admin_id, action, detail) values (p_user, 'denied', left('tried: ' || coalesce(p_action, '?'), 200));
end;
$$;

/** Opening the panel: confirms the admin and remembers their email for the Admins list. */
create or replace function public.admin_hello(p_admin uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mail text;
begin
    perform public.admin_require(p_admin);
    select lower(btrim(email)) into mail from auth.users where id = p_admin;
    update public.app_admins set email = mail where email_hash = sha256(convert_to(mail, 'UTF8')) and email is distinct from mail;
    return jsonb_build_object('admin', true, 'email', mail,
        'open_flags', (select count(*) from public.admin_flags where status = 'open'),
        'open_appeals', (select count(*) from public.account_appeals where status = 'open'));
end;
$$;

/** Overview: the app's numbers, sign-ups by day, and what needs attention. */
create or replace function public.admin_overview(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d0 timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
    perform public.admin_require(p_admin);
    return public.admin_stats() || jsonb_build_object(
        'new_today', (select count(*) from auth.users where created_at >= d0),
        'active_today', (select count(*) from auth.users where last_sign_in_at >= d0),
        'active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
        'never_signed_in', (select count(*) from auth.users where last_sign_in_at is null),
        'banned', (select count(*) from auth.users where banned_until > now()),
        'open_flags', (select count(*) from public.admin_flags where status = 'open'),
        'open_appeals', (select count(*) from public.account_appeals where status = 'open'),
        'blocked_emails', (select count(*) from public.blocked_emails),
        'warnings_7d', (select count(*) from public.account_warnings where created_at > now() - interval '7 days'),
        'rules_accepted', (select count(*) from public.profiles where rules_version is not null),
        'notice', public.app_notice_get(),
        'admins', (select count(*) from public.app_admins),
        'signups_14d', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'n',
                (select count(*) from auth.users where created_at >= d and created_at < d + interval '1 day')) order by d), '[]'::jsonb)
            from generate_series(d0 - interval '13 days', d0, interval '1 day') d),
        'recent', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
            select u.id, u.email, u.phone, u.created_at, u.last_sign_in_at, coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
                exists (select 1 from public.admin_flags f where f.user_id = u.id and f.status = 'open') as flagged
            from auth.users u order by u.created_at desc limit 5) x),
        'ai', public.ai_usage_summary(),
        'ai_enabled', (select enabled and beta_open from public.ai_settings where id),
        'block_signups', (select block_signups from public.admin_settings where id),
        'at', now());
end;
$$;

/** One row of the Users list. */
create or replace function public.admin_user_row(u auth.users)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    return jsonb_build_object('id', u.id, 'email', u.email, 'phone', u.phone,
        'name', (select display_name from public.profiles where id = u.id),
        'provider', coalesce(u.raw_app_meta_data->>'provider', 'email'),
        'providers', coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb),
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'confirmed', u.email_confirmed_at is not null or u.phone_confirmed_at is not null,
        'banned_until', case when u.banned_until > now() then u.banned_until end,
        'flagged', exists (select 1 from public.admin_flags f where f.user_id = u.id and f.status = 'open'),
        'ban_reason', case when u.banned_until > now() then (select reason from public.account_bans b where b.user_id = u.id) end,
        'warnings', (select count(*) from public.account_warnings w where w.user_id = u.id),
        'appeal_open', exists (select 1 from public.account_appeals ap where ap.user_id = u.id and ap.status = 'open'),
        'admin', coalesce(u.email, '') <> '' and exists (select 1 from public.app_admins a where a.email_hash = sha256(convert_to(lower(btrim(u.email)), 'UTF8'))));
end;
$$;

/** Users: search (email, phone, name or id) and filter, newest first, 50 at a time. */
create or replace function public.admin_users(p_admin uuid, p_search text, p_filter text, p_offset integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := lower(btrim(coalesce(p_search, ''))); f text := coalesce(p_filter, 'all'); total integer; rows jsonb;
begin
    perform public.admin_require(p_admin);
    if f not in ('all', 'flagged', 'banned', 'new', 'never', 'unconfirmed', 'admins') or char_length(q) > 200 then
        raise exception 'bad request' using errcode = '22023';
    end if;
    with m as (
        select u.* from auth.users u
        where (q = '' or lower(coalesce(u.email, '')) like '%' || q || '%' or coalesce(u.phone, '') like '%' || q || '%'
               or u.id::text = q or exists (select 1 from public.profiles p where p.id = u.id and lower(coalesce(p.display_name, '')) like '%' || q || '%'))
          and case f
            when 'flagged' then exists (select 1 from public.admin_flags fl where fl.user_id = u.id and fl.status = 'open')
            when 'banned' then u.banned_until > now()
            when 'new' then u.created_at > now() - interval '7 days'
            when 'never' then u.last_sign_in_at is null
            when 'unconfirmed' then u.email_confirmed_at is null and u.phone_confirmed_at is null
            when 'admins' then coalesce(u.email, '') <> '' and exists (select 1 from public.app_admins a where a.email_hash = sha256(convert_to(lower(btrim(u.email)), 'UTF8')))
            else true end
    )
    select (select count(*) from m),
           coalesce((select jsonb_agg(public.admin_user_row(x) order by x.created_at desc)
               from (select * from m order by created_at desc offset greatest(coalesce(p_offset, 0), 0) limit 50) x), '[]'::jsonb)
      into total, rows;
    return jsonb_build_object('total', total, 'users', rows, 'offset', greatest(coalesce(p_offset, 0), 0));
end;
$$;

/** Everything about one account an admin may need — what they use, never what they wrote. */
create or replace function public.admin_user(p_admin uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u auth.users; mail text; m public.ai_members; res jsonb;
begin
    perform public.admin_require(p_admin);
    select * into u from auth.users where id = p_id;
    if u.id is null then return null; end if;
    mail := lower(btrim(coalesce(u.email, '')));
    select * into m from public.ai_members where user_id = u.id;
    res := public.admin_user_row(u) || jsonb_build_object(
        'locale', (select locale from public.profiles where id = u.id),
        'email_confirmed_at', u.email_confirmed_at,
        'sync', jsonb_build_object(
            'items', (select count(*) from public.sync_records where user_id = u.id and not deleted),
            'last', (select max(server_at) from public.sync_records where user_id = u.id)),
        'family_children', (select count(*) from public.family_children where parent_id = u.id),
        'msa', (select jsonb_build_object('name', name, 'status', status, 'via', via, 'joined', created_at)
            from public.msa_members where user_id = u.id),
        'msa_admin', mail <> '' and exists (select 1 from public.msa_admins where email_hash = sha256(convert_to(mail, 'UTF8'))),
        'msa_posts', (select count(*) from public.msa_posts where created_by = u.id),
        'ai', jsonb_build_object(
            'questions', (select count(*) from public.ai_usage where user_id = u.id and kind = 'chat'),
            'questions_7d', (select count(*) from public.ai_usage where user_id = u.id and kind = 'chat' and at > now() - interval '7 days'),
            'last', (select max(at) from public.ai_usage where user_id = u.id and kind = 'chat'),
            'helpful', (select count(*) from public.ai_usage where user_id = u.id and rating = 1),
            'unhelpful', (select count(*) from public.ai_usage where user_id = u.id and rating = -1),
            'refused_30d', (select count(*) from public.ai_security_log where user_id = u.id and at > now() - interval '30 days'),
            'terms_version', m.terms_version, 'terms_accepted_at', m.terms_accepted_at,
            'strikes', case when m.last_strike_at > now() - interval '30 days' then m.strikes else 0 end,
            'paused_until', case when m.banned_until > now() then m.banned_until end,
            'pauses', coalesce(m.bans, 0)),
        'flag', (select jsonb_build_object('source', source, 'word', word, 'note', note, 'status', status, 'flagged_at', flagged_at, 'reviewed_at', reviewed_at)
            from public.admin_flags where user_id = u.id),
        'ban', (select jsonb_build_object('reason', b.reason, 'message', b.message, 'note', b.note, 'until', b.until, 'banned_at', b.banned_at,
                'email_blocked', b.email_blocked, 'by', (select public.admin_mask(email) from auth.users where id = b.banned_by))
            from public.account_bans b where b.user_id = u.id and u.banned_until > now()),
        'email_blocked', mail <> '' and exists (select 1 from public.blocked_emails e where e.email_hash = sha256(convert_to(mail, 'UTF8'))),
        'warning_list', (select coalesce(jsonb_agg(jsonb_build_object('reason', w.reason, 'message', w.message, 'at', w.created_at, 'seen_at', w.seen_at)
                order by w.created_at desc), '[]'::jsonb) from public.account_warnings w where w.user_id = u.id),
        'appeals', (select coalesce(jsonb_agg(jsonb_build_object('id', ap.id, 'text', ap.text, 'status', ap.status, 'reply', ap.reply, 'at', ap.created_at)
                order by ap.created_at desc), '[]'::jsonb) from public.account_appeals ap where ap.user_id = u.id),
        'rules_version', (select rules_version from public.profiles where id = u.id),
        'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'detail', a.detail,
                'by', (select public.admin_mask(email) from auth.users where id = a.admin_id)) order by a.at desc), '[]'::jsonb)
            from (select * from public.admin_audit where target_id = u.id order by at desc limit 20) a));
    return res;
end;
$$;

/** Admins can't act on themselves or on other admins. */
create or replace function public.admin_target(p_admin uuid, p_id uuid)
returns auth.users language plpgsql stable security definer set search_path = public as $$
declare u auth.users;
begin
    perform public.admin_require(p_admin);
    select * into u from auth.users where id = p_id;
    if u.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
    if u.id = p_admin then raise exception 'not yourself' using errcode = '42501'; end if;
    if public.admin_check(u.id) then raise exception 'an admin' using errcode = '42501'; end if;
    return u;
end;
$$;

/** Sign the account out on every device (their sessions end at once; any open page loses access within the hour). */
create or replace function public.admin_sign_out(p_admin uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users; n integer := 0;
begin
    u := public.admin_target(p_admin, p_id);
    delete from auth.sessions where user_id = u.id;
    get diagnostics n = row_count;
    perform public.admin_log(p_admin, 'sign_out', u.id, n || ' session(s) ended');
    return jsonb_build_object('ok', true, 'sessions', n);
end;
$$;

/** Ban (3.0.2): one of the Community Rules reasons, an optional message the
    person sees and a private note for admins. They can't sign in, every
    request from their account is refused at once (public.am_blocked), and
    their device shows the ban, its reason and an Appeal button. Their
    sign-in tokens are kept (not deleted) so that device can still prove who
    it was to read the ban and appeal (public.account_notice). p_block also
    stops the email making a new account. p_days null = until unbanned. */
drop function if exists public.admin_ban(uuid, uuid, integer, text);
create or replace function public.admin_ban(p_admin uuid, p_id uuid, p_days integer, p_reason text, p_message text, p_note text, p_block boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users; v_until timestamptz; mail text;
begin
    u := public.admin_target(p_admin, p_id);
    if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'bad request' using errcode = '22023'; end if;
    if p_reason is null or not (p_reason = any (public.ban_reasons())) then raise exception 'bad reason' using errcode = '22023'; end if;
    if p_reason = 'other' and nullif(btrim(coalesce(p_message, '')), '') is null then raise exception 'other needs message' using errcode = '22023'; end if;
    v_until := now() + coalesce(make_interval(days => p_days), interval '100 years');
    update auth.users set banned_until = v_until where id = u.id;
    insert into public.account_bans (user_id, reason, message, note, until, banned_by, email_blocked)
        values (u.id, p_reason, left(nullif(btrim(p_message), ''), 500), left(nullif(btrim(p_note), ''), 500), v_until, p_admin, coalesce(p_block, false))
    on conflict (user_id) do update set reason = excluded.reason, message = excluded.message, note = excluded.note,
        until = excluded.until, banned_at = now(), banned_by = excluded.banned_by, email_blocked = excluded.email_blocked;
    mail := lower(btrim(coalesce(u.email, '')));
    if coalesce(p_block, false) and mail <> '' then
        insert into public.blocked_emails (email_hash, masked, reason, added_by, from_ban)
            values (sha256(convert_to(mail, 'UTF8')), public.admin_mask(mail), p_reason, p_admin, u.id)
        on conflict (email_hash) do nothing;
    end if;
    delete from public.ai_queue where user_id = u.id;
    update public.account_appeals set status = 'denied', reply = coalesce(reply, 'Replaced by a new ban.'), decided_at = now(), decided_by = p_admin
        where user_id = u.id and status = 'open';
    update public.admin_flags set status = 'dismissed', reviewed_at = now(), reviewed_by = p_admin where user_id = u.id and status = 'open';
    perform public.admin_log(p_admin, 'ban', u.id,
        public.ban_reason_label(p_reason) || ' · ' || coalesce(p_days || ' day(s)', 'until unbanned') ||
        case when coalesce(p_block, false) then ' · email blocked' else '' end || coalesce(' — ' || nullif(btrim(p_note), ''), ''));
    return jsonb_build_object('ok', true, 'banned_until', v_until);
end;
$$;

/** Unban: they can sign in again; the ban's email block (if any) is lifted too. */
create or replace function public.admin_unban(p_admin uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users;
begin
    u := public.admin_target(p_admin, p_id);
    perform public.account_lift_ban(u.id, p_admin);
    perform public.admin_log(p_admin, 'unban', u.id, null);
    return jsonb_build_object('ok', true);
end;
$$;

/** Delete the account and everything that belongs to it (like "Delete my account"). p_confirm must be its email (or phone). */
create or replace function public.admin_delete_user(p_admin uuid, p_id uuid, p_confirm text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users;
begin
    u := public.admin_target(p_admin, p_id);
    if lower(btrim(coalesce(p_confirm, ''))) is distinct from lower(btrim(coalesce(u.email, u.phone, ''))) or btrim(coalesce(p_confirm, '')) = '' then
        raise exception 'confirm' using errcode = '22023';
    end if;
    perform public.admin_log(p_admin, 'delete', u.id, coalesce(nullif(btrim(p_reason), ''), 'account deleted'));
    delete from public.ai_members where user_id = u.id;
    delete from public.ai_queue where user_id = u.id;
    delete from auth.users where id = u.id;
    return jsonb_build_object('ok', true);
end;
$$;

/** Flags: dismiss (looked at, fine), reopen, or flag an account by hand with a note. */
create or replace function public.admin_flag(p_admin uuid, p_id uuid, p_action text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users;
begin
    perform public.admin_require(p_admin);
    select * into u from auth.users where id = p_id;
    if u.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
    if p_action = 'dismiss' then
        update public.admin_flags set status = 'dismissed', reviewed_at = now(), reviewed_by = p_admin where user_id = u.id;
    elsif p_action = 'reopen' then
        update public.admin_flags set status = 'open', reviewed_at = null, reviewed_by = null where user_id = u.id;
    elsif p_action = 'add' then
        insert into public.admin_flags (user_id, source, note) values (u.id, 'admin', left(nullif(btrim(p_note), ''), 200))
            on conflict (user_id) do update set status = 'open', note = coalesce(excluded.note, public.admin_flags.note), reviewed_at = null, reviewed_by = null;
    else
        raise exception 'bad request' using errcode = '22023';
    end if;
    perform public.admin_log(p_admin, 'flag_' || p_action, u.id, nullif(btrim(coalesce(p_note, '')), ''));
    return jsonb_build_object('ok', true);
end;
$$;

/** The Flags tab: open flags, recently reviewed ones, and people with SalaamStreet AI warnings or pauses. */
create or replace function public.admin_flags_list(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return jsonb_build_object(
        'open', (select coalesce(jsonb_agg(public.admin_user_row(u) || jsonb_build_object('word', f.word, 'note', f.note, 'source', f.source, 'flagged_at', f.flagged_at)
                order by f.flagged_at desc), '[]'::jsonb)
            from public.admin_flags f join auth.users u on u.id = f.user_id where f.status = 'open'),
        'reviewed', (select coalesce(jsonb_agg(x order by x.reviewed_at desc), '[]'::jsonb) from (
            select f.user_id as id, u.email, u.phone, f.word, f.note, f.reviewed_at from public.admin_flags f join auth.users u on u.id = f.user_id
            where f.status = 'dismissed' order by f.reviewed_at desc nulls last limit 20) x),
        'ai', (select coalesce(jsonb_agg(x order by x.paused_until desc nulls last, x.strikes desc), '[]'::jsonb) from (
            select m.user_id as id, u.email, u.phone,
                case when m.last_strike_at > now() - interval '30 days' then m.strikes else 0 end as strikes,
                case when m.banned_until > now() then m.banned_until end as paused_until, m.bans as pauses
            from public.ai_members m join auth.users u on u.id = m.user_id
            where m.banned_until > now() or (m.strikes > 0 and m.last_strike_at > now() - interval '30 days')
            limit 50) x));
end;
$$;

/** SalaamStreet AI for one person: pause (p_days) or restore (clears the pause and the warnings). */
create or replace function public.admin_ai_member(p_admin uuid, p_id uuid, p_action text, p_days integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users;
begin
    u := public.admin_target(p_admin, p_id);
    if p_action = 'pause' then
        if p_days is null or p_days < 1 or p_days > 3650 then raise exception 'bad request' using errcode = '22023'; end if;
        insert into public.ai_members (user_id) values (u.id) on conflict (user_id) do nothing;
        update public.ai_members set banned_until = now() + make_interval(days => p_days), bans = bans + 1 where user_id = u.id;
        delete from public.ai_queue where user_id = u.id;
        perform public.admin_log(p_admin, 'ai_pause', u.id, p_days || ' day(s)');
    elsif p_action = 'restore' then
        update public.ai_members set banned_until = null, strikes = 0, last_strike_at = null where user_id = u.id;
        perform public.admin_log(p_admin, 'ai_restore', u.id, null);
    else
        raise exception 'bad request' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true);
end;
$$;

/** Sign-up screening: the word list and the "refuse" switch. */
create or replace function public.admin_screening(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return jsonb_build_object('block_signups', (select block_signups from public.admin_settings where id),
        'words', (select coalesce(jsonb_agg(word order by word), '[]'::jsonb) from public.admin_words));
end;
$$;

create or replace function public.admin_screening_set(p_admin uuid, p_block boolean, p_add text, p_remove text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w text;
begin
    perform public.admin_require(p_admin);
    if p_block is not null then
        update public.admin_settings set block_signups = p_block, updated_at = now(), updated_by = p_admin where id;
        perform public.admin_log(p_admin, 'screening', null, case when p_block then 'refuse matching sign-ups' else 'only flag matching sign-ups' end);
    end if;
    if p_add is not null then
        w := public.admin_norm(p_add);
        if w !~ '^[a-z]{3,40}$' then raise exception 'bad word' using errcode = '22023'; end if;
        if (select count(*) from public.admin_words) >= 500 then raise exception 'too many words' using errcode = '54000'; end if;
        insert into public.admin_words (word) values (w) on conflict (word) do nothing;
        perform public.admin_log(p_admin, 'word_add', null, null);
        -- Flag existing accounts that match the new word.
        insert into public.admin_flags (user_id, source, word)
            select id, 'signup', w from auth.users where position(w in
                public.admin_norm(split_part(coalesce(email, ''), '@', 1)) || ' ' || public.admin_norm(coalesce(raw_user_meta_data->>'full_name', '')) || ' ' ||
                public.admin_norm(coalesce(raw_user_meta_data->>'name', ''))) > 0
        on conflict (user_id) do nothing;
    end if;
    if p_remove is not null then
        delete from public.admin_words where word = public.admin_norm(p_remove);
        perform public.admin_log(p_admin, 'word_remove', null, null);
    end if;
    return public.admin_screening(p_admin);
end;
$$;

/** The admin list: emails are shown for admins who have opened the panel; the rest by hash. */
create or replace function public.admin_admins(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return (select coalesce(jsonb_agg(jsonb_build_object('id', encode(a.email_hash, 'hex'),
            'email', coalesce(a.email, (select lower(btrim(u.email)) from auth.users u
                where coalesce(u.email, '') <> '' and sha256(convert_to(lower(btrim(u.email)), 'UTF8')) = a.email_hash limit 1)),
            'added_at', a.added_at, 'me', a.email_hash = (select sha256(convert_to(lower(btrim(email)), 'UTF8')) from auth.users where id = p_admin))
        order by a.added_at), '[]'::jsonb) from public.app_admins a);
end;
$$;

create or replace function public.admin_admins_set(p_admin uuid, p_add_email text, p_remove_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mail text := lower(btrim(coalesce(p_add_email, ''))); h bytea;
begin
    perform public.admin_require(p_admin);
    if p_add_email is not null then
        if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 320 then raise exception 'bad email' using errcode = '22023'; end if;
        if (select count(*) from public.app_admins) >= 20 then raise exception 'too many admins' using errcode = '54000'; end if;
        insert into public.app_admins (email_hash, email, added_by) values (sha256(convert_to(mail, 'UTF8')), mail, p_admin)
            on conflict (email_hash) do update set email = excluded.email;
        perform public.admin_log(p_admin, 'admin_add', (select id from auth.users where lower(btrim(email)) = mail limit 1), public.admin_mask(mail));
    end if;
    if p_remove_id is not null then
        if lower(p_remove_id) !~ '^[0-9a-f]{64}$' then raise exception 'bad request' using errcode = '22023'; end if;
        h := decode(lower(p_remove_id), 'hex');
        if h = (select sha256(convert_to(lower(btrim(email)), 'UTF8')) from auth.users where id = p_admin) then
            raise exception 'not yourself' using errcode = '42501';
        end if;
        if (select count(*) from public.app_admins) <= 1 then raise exception 'last admin' using errcode = '42501'; end if;
        perform public.admin_log(p_admin, 'admin_remove', null, (select public.admin_mask(email) from public.app_admins where email_hash = h));
        delete from public.app_admins where email_hash = h;
    end if;
    return public.admin_admins(p_admin);
end;
$$;

/** The SalaamStreet AI tab: the main switches and today's numbers (the Lab has the rest). */
create or replace function public.admin_ai(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return (select jsonb_build_object('enabled', enabled, 'beta_open', beta_open, 'user_daily_limit', user_daily_limit,
        'daily_limit', daily_limit, 'minute_limit', minute_limit, 'model', model, 'updated_at', updated_at)
        from public.ai_settings where id) || jsonb_build_object('usage', public.ai_usage_summary());
end;
$$;

create or replace function public.admin_ai_set(p_admin uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    update public.ai_settings set
        enabled = coalesce((p_patch->>'enabled')::boolean, enabled),
        beta_open = coalesce((p_patch->>'beta_open')::boolean, beta_open),
        user_daily_limit = coalesce((p_patch->>'user_daily_limit')::integer, user_daily_limit),
        daily_limit = coalesce((p_patch->>'daily_limit')::integer, daily_limit),
        updated_at = now(), updated_by = p_admin
    where id;
    perform public.admin_log(p_admin, 'ai_settings', null, left(p_patch::text, 200));
    return public.admin_ai(p_admin);
end;
$$;

/** The NVHS MSA tab: numbers and the latest announcements (the MSA's own admins run it day to day). */
create or replace function public.admin_msa(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return jsonb_build_object(
        'members', (select count(*) from public.msa_members where status = 'approved'),
        'pending', (select count(*) from public.msa_members where status in ('pending', 'flagged')),
        'admins', (select count(*) from public.msa_admins),
        'roster', (select count(*) from public.msa_roster),
        'posts', (select coalesce(jsonb_agg(x order by x.pinned desc, x.created_at desc), '[]'::jsonb) from (
            select p.id, p.title, p.created_at, p.pinned, p.on_home, p.expires_at, p.image is not null as has_image,
                (select public.admin_mask(email) from auth.users where id = p.created_by) as author
            from public.msa_posts p order by p.created_at desc limit 30) x));
end;
$$;

create or replace function public.admin_msa_delete_post(p_admin uuid, p_post uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text;
begin
    perform public.admin_require(p_admin);
    delete from public.msa_posts where id = p_post returning title into t;
    if t is null then raise exception 'not found' using errcode = 'P0002'; end if;
    perform public.admin_log(p_admin, 'msa_post_delete', null, left(t, 200));
    return jsonb_build_object('ok', true);
end;
$$;

/** The activity log, newest first, 50 at a time. */
create or replace function public.admin_audit_list(p_admin uuid, p_offset integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return jsonb_build_object('total', (select count(*) from public.admin_audit),
        'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'action', a.action, 'target', a.target, 'target_id', a.target_id,
                'detail', a.detail, 'by', (select public.admin_mask(email) from auth.users where id = a.admin_id)) order by a.at desc), '[]'::jsonb)
            from (select * from public.admin_audit order by at desc offset greatest(coalesce(p_offset, 0), 0) limit 50) a));
end;
$$;

do $$
declare fns text := 'public.admin_mask(text), public.admin_norm(text), public.admin_screen(text, jsonb), public.admin_check(uuid), public.admin_require(uuid),
    public.admin_log(uuid, text, uuid, text), public.admin_denied(uuid, text), public.admin_hello(uuid), public.admin_overview(uuid),
    public.admin_user_row(auth.users), public.admin_users(uuid, text, text, integer), public.admin_user(uuid, uuid), public.admin_target(uuid, uuid),
    public.admin_sign_out(uuid, uuid), public.admin_ban(uuid, uuid, integer, text, text, text, boolean), public.admin_unban(uuid, uuid),
    public.admin_delete_user(uuid, uuid, text, text), public.admin_flag(uuid, uuid, text, text), public.admin_flags_list(uuid),
    public.admin_ai_member(uuid, uuid, text, integer), public.admin_screening(uuid), public.admin_screening_set(uuid, boolean, text, text),
    public.admin_admins(uuid), public.admin_admins_set(uuid, text, text), public.admin_ai(uuid), public.admin_ai_set(uuid, jsonb),
    public.admin_msa(uuid), public.admin_msa_delete_post(uuid, uuid), public.admin_audit_list(uuid, integer)';
begin
    execute 'revoke all on function ' || fns || ' from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute 'grant execute on function ' || fns || ' to service_role';
        grant select, insert, update, delete on public.app_admins, public.admin_settings, public.admin_words, public.admin_flags, public.admin_audit to service_role;
    end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  3.0.2 — Bans people can see, warnings, appeals and the Community Rules
--  • A ban has a reason from the Community Rules (ban_reasons), an optional
--    message the person sees and a private note. Every request from a banned
--    account — or from a session an admin ended — is refused at once
--    (am_blocked, in the sync policies, MSA and the Edge Functions), and the
--    person's device shows the ban with its reason and an Appeal button.
--  • A banned person's device proves who it was with the sign-in token it
--    kept (account_notice / account_appeal), so it can read the ban and
--    appeal even though it can no longer sign in. Nobody else can look up a
--    ban.
--  • Warnings: shown to the person the next time they open SalaamStreet.
--  • Appeals: one open at a time, up to 3 per ban; admins answer them.
--  • Blocked emails can't make a new account (also after deletion).
--  • The Community Rules: everyone with an account agrees once per version
--    (profiles.rules_version), before signing in and on their next visit.
--  • app_notice: one short banner admins can show on everyone's Home.
-- ════════════════════════════════════════════════════════════════════════

/** The Community Rules' ban reasons (the app shows them in every language). */
create or replace function public.ban_reasons()
returns text[] language sql immutable set search_path = public as $$
    select array['offensive_name', 'ai_abuse', 'ai_rules', 'impersonation', 'msa_post', 'fake_accounts', 'hacking', 'other'];
$$;
/** English labels, for the log. */
create or replace function public.ban_reason_label(p_reason text)
returns text language sql immutable set search_path = public as $$
    select case p_reason
        when 'offensive_name' then 'Offensive name or email'
        when 'ai_abuse' then 'Hateful, sexual or disrespectful use of SalaamStreet AI'
        when 'ai_rules' then 'Repeatedly breaking SalaamStreet AI''s rules'
        when 'impersonation' then 'Impersonation'
        when 'msa_post' then 'Inappropriate MSA posts'
        when 'fake_accounts' then 'Extra or fake accounts'
        when 'hacking' then 'Hacking or abusing the app'
        when 'other' then 'Other'
        else coalesce(p_reason, '?') end;
$$;

create table if not exists public.account_bans (
    user_id       uuid primary key references auth.users(id) on delete cascade,
    reason        text not null,
    message       text check (message is null or char_length(message) <= 500), -- shown to the person
    note          text check (note is null or char_length(note) <= 500),       -- admins only
    until         timestamptz not null,
    banned_at     timestamptz not null default now(),
    banned_by     uuid,
    email_blocked boolean not null default false
);
create table if not exists public.account_warnings (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references auth.users(id) on delete cascade,
    reason     text not null,
    message    text check (message is null or char_length(message) <= 500),
    created_at timestamptz not null default now(),
    created_by uuid,
    seen_at    timestamptz
);
create index if not exists account_warnings_user on public.account_warnings (user_id, created_at desc);
create table if not exists public.account_appeals (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references auth.users(id) on delete cascade,
    ban_at     timestamptz not null,                      -- which ban (account_bans.banned_at)
    text       text not null check (char_length(btrim(text)) between 10 and 1000),
    status     text not null default 'open' check (status in ('open', 'accepted', 'denied')),
    reply      text check (reply is null or char_length(reply) <= 500),
    created_at timestamptz not null default now(),
    decided_at timestamptz,
    decided_by uuid
);
create unique index if not exists account_appeals_one_open on public.account_appeals (user_id) where status = 'open';
create table if not exists public.blocked_emails (
    email_hash bytea primary key check (octet_length(email_hash) = 32),
    masked     text,
    reason     text,
    added_at   timestamptz not null default now(),
    added_by   uuid,
    from_ban   uuid -- the account whose ban added it (lifted with the ban)
);
create table if not exists public.app_notice (
    id         boolean primary key default true check (id),
    text       text check (text is null or char_length(text) <= 280),
    tone       text not null default 'info' check (tone in ('info', 'warn', 'celebrate')),
    active     boolean not null default false,
    until      timestamptz,
    updated_at timestamptz not null default now(),
    updated_by uuid
);
insert into public.app_notice (id) values (true) on conflict (id) do nothing;
alter table public.profiles add column if not exists rules_version text check (rules_version is null or char_length(rules_version) <= 20);
alter table public.profiles add column if not exists rules_accepted_at timestamptz;

alter table public.account_bans     enable row level security;
alter table public.account_warnings enable row level security;
alter table public.account_appeals  enable row level security;
alter table public.blocked_emails   enable row level security;
alter table public.app_notice       enable row level security;
revoke all on public.account_bans, public.account_warnings, public.account_appeals, public.blocked_emails, public.app_notice from anon, authenticated;

/** The session id in the caller's sign-in token (null when there is none). */
create or replace function public.jwt_session_id()
returns uuid language plpgsql stable set search_path = public as $$
begin
    return nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id', '')::uuid;
exception when others then
    return null;
end;
$$;

/** Is the signed-in account banned, or is this a session an admin ended?
    Used by the sync policies and the MSA and AI checks, so a ban or
    "sign out everywhere" takes effect at once, not when the token expires. */
create or replace function public.am_blocked()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid;
begin
    if uid is null then return false; end if;
    begin
        if exists (select 1 from auth.users where id = uid and banned_until > now()) then return true; end if;
    exception when undefined_column then null; -- a database without Supabase Auth's ban column (tests)
    end;
    sid := public.jwt_session_id();
    if sid is not null then
        begin
            return not exists (select 1 from auth.sessions where id = sid);
        exception when undefined_table then return false;
        end;
    end if;
    return false;
end;
$$;
grant execute on function public.am_blocked(), public.jwt_session_id() to authenticated, anon;

-- Sync: a banned account (or an ended session) can't read or write anything.
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select to authenticated using (auth.uid() = id and not (select public.am_blocked()));
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id and not (select public.am_blocked()));
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id and not (select public.am_blocked())) with check (auth.uid() = id);
drop policy if exists "own records" on public.sync_records;
create policy "own records" on public.sync_records
    for all to authenticated using (auth.uid() = user_id and not (select public.am_blocked())) with check (auth.uid() = user_id and not (select public.am_blocked()));

-- MSA: a blocked account has no email as far as the MSA is concerned (can't post, approve or manage).
create or replace function public.msa_my_email()
returns text language plpgsql stable security definer set search_path = public as $$
begin
    if public.am_blocked() then return ''; end if;
    return (select lower(btrim(email)) from auth.users where id = auth.uid());
end;
$$;

/** A blocked email can't make a new account (or move an account to it). */
create or replace function public.account_block_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare mail text := lower(btrim(coalesce(new.email, '')));
begin
    if mail <> '' and exists (select 1 from public.blocked_emails where email_hash = sha256(convert_to(mail, 'UTF8'))) then
        raise exception 'This email address can''t be used on SalaamStreet.' using errcode = '22023';
    end if;
    return new;
end;
$$;
drop trigger if exists on_auth_user_block_check on auth.users;
create trigger on_auth_user_block_check
    before insert or update of email on auth.users
    for each row execute function public.account_block_check();
revoke all on function public.account_block_check() from public, anon, authenticated;

/** Lift a ban (unban, or an accepted appeal). */
create or replace function public.account_lift_ban(p_id uuid, p_admin uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    update auth.users set banned_until = null where id = p_id;
    delete from public.blocked_emails where from_ban = p_id;
    delete from public.account_bans where user_id = p_id;
end;
$$;

/** What a banned account sees: the reason, the message, until when, and its appeal. */
create or replace function public.account_ban_info(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.account_bans; u timestamptz; ap public.account_appeals; n integer;
begin
    select banned_until into u from auth.users where id = p_id;
    if u is null or u <= now() then return jsonb_build_object('banned', false); end if;
    select * into b from public.account_bans where user_id = p_id;
    select * into ap from public.account_appeals where user_id = p_id and ban_at >= coalesce(b.banned_at, '-infinity') order by created_at desc limit 1;
    select count(*) into n from public.account_appeals where user_id = p_id and ban_at >= coalesce(b.banned_at, '-infinity');
    return jsonb_build_object('banned', true, 'reason', coalesce(b.reason, 'other'), 'message', b.message,
        'until', case when u > now() + interval '50 years' then null else u end, 'banned_at', b.banned_at,
        'appeal', case when ap.id is null then null else jsonb_build_object('status', ap.status, 'reply', ap.reply, 'at', ap.created_at) end,
        'appeals_left', greatest(0, 3 - n), 'can_appeal', b.user_id is not null and (ap.id is null or ap.status <> 'open') and n < 3);
end;
$$;

/** The device that was signed in: its saved sign-in token says which account it was. */
create or replace function public.account_from_token(p_token text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid text;
begin
    if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,128}$' then return null; end if;
    begin
        select user_id into uid from auth.refresh_tokens where token = p_token and created_at > now() - interval '120 days' limit 1;
    exception when undefined_table then return null;
    end;
    return nullif(uid, '')::uuid;
end;
$$;

/** For a device whose account was banned (it can no longer sign in): the ban, from the token it kept. */
create or replace function public.account_notice(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.account_from_token(p_token);
begin
    if uid is null then return jsonb_build_object('banned', false, 'known', false); end if;
    return public.account_ban_info(uid) || jsonb_build_object('known', true);
end;
$$;

/** Appeal a ban: from the signed-in account, or from the device's saved token. */
create or replace function public.account_appeal(p_token text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := coalesce(auth.uid(), public.account_from_token(p_token)); info jsonb; b public.account_bans;
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    info := public.account_ban_info(uid);
    if not (info->>'banned')::boolean then raise exception 'not banned' using errcode = '22023'; end if;
    if not coalesce((info->>'can_appeal')::boolean, false) then raise exception 'appeal limit' using errcode = '54000'; end if;
    if char_length(btrim(coalesce(p_text, ''))) not between 10 and 1000 then raise exception 'appeal length' using errcode = '22023'; end if;
    select * into b from public.account_bans where user_id = uid;
    insert into public.account_appeals (user_id, ban_at, text) values (uid, b.banned_at, btrim(p_text));
    insert into public.admin_audit (admin_id, action, target_id, target, detail)
        values (uid, 'appeal', uid, (select public.admin_mask(coalesce(email, phone)) from auth.users where id = uid), left(btrim(p_text), 200));
    return public.account_ban_info(uid);
end;
$$;

/** The signed-in person's standing: ban, ended session, unseen warnings and which Community Rules they agreed to. */
create or replace function public.account_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid := public.jwt_session_id(); ended boolean := false;
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    if sid is not null then
        begin
            ended := not exists (select 1 from auth.sessions where id = sid);
        exception when undefined_table then ended := false;
        end;
    end if;
    return public.account_ban_info(uid) || jsonb_build_object(
        'session_ended', ended,
        'warnings', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'reason', reason, 'message', message, 'at', created_at) order by created_at), '[]'::jsonb)
            from public.account_warnings where user_id = uid and seen_at is null),
        'rules_version', (select rules_version from public.profiles where id = uid));
end;
$$;

create or replace function public.account_warning_seen(p_id bigint)
returns void language sql security definer set search_path = public as $$
    update public.account_warnings set seen_at = now() where id = p_id and user_id = auth.uid() and seen_at is null;
$$;

/** Agree to this version of the Community Rules (recorded with the date). */
create or replace function public.account_accept_rules(p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
    if p_version is null or p_version !~ '^[0-9A-Za-z.-]{1,20}$' then raise exception 'bad request' using errcode = '22023'; end if;
    insert into public.profiles (id, rules_version, rules_accepted_at) values (uid, p_version, now())
        on conflict (id) do update set rules_version = excluded.rules_version, rules_accepted_at = excluded.rules_accepted_at;
    return jsonb_build_object('ok', true, 'rules_version', p_version);
end;
$$;

/** The banner on everyone's Home, if one is showing. */
create or replace function public.app_notice_get()
returns jsonb language sql stable security definer set search_path = public as $$
    select case when active and coalesce(btrim(text), '') <> '' and (until is null or until > now())
        then jsonb_build_object('text', text, 'tone', tone, 'until', until, 'updated_at', updated_at) end
    from public.app_notice where id;
$$;

revoke all on function public.ban_reasons(), public.ban_reason_label(text), public.account_lift_ban(uuid, uuid), public.account_ban_info(uuid),
    public.account_from_token(text) from public, anon, authenticated;
revoke all on function public.account_notice(text), public.account_appeal(text, text), public.account_status(), public.account_warning_seen(bigint),
    public.account_accept_rules(text), public.app_notice_get() from public;
grant execute on function public.account_notice(text), public.account_appeal(text, text), public.app_notice_get() to anon, authenticated;
grant execute on function public.account_status(), public.account_warning_seen(bigint), public.account_accept_rules(text) to authenticated;

/* ── The Admin Panel's side ─────────────────────────────────────── */

/** Warn: the person sees it (reason and message) the next time they open SalaamStreet. */
create or replace function public.admin_warn(p_admin uuid, p_id uuid, p_reason text, p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u auth.users;
begin
    u := public.admin_target(p_admin, p_id);
    if p_reason is null or not (p_reason = any (public.ban_reasons())) then raise exception 'bad reason' using errcode = '22023'; end if;
    if p_reason = 'other' and nullif(btrim(coalesce(p_message, '')), '') is null then raise exception 'other needs message' using errcode = '22023'; end if;
    insert into public.account_warnings (user_id, reason, message, created_by) values (u.id, p_reason, left(nullif(btrim(p_message), ''), 500), p_admin);
    perform public.admin_log(p_admin, 'warn', u.id, public.ban_reason_label(p_reason) || coalesce(' — ' || nullif(btrim(p_message), ''), ''));
    return jsonb_build_object('ok', true);
end;
$$;

/** Appeals, open ones first. */
create or replace function public.admin_appeals(p_admin uuid, p_status text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    if coalesce(p_status, 'open') not in ('open', 'decided') then raise exception 'bad request' using errcode = '22023'; end if;
    return (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select ap.id, ap.text, ap.status, ap.reply, ap.created_at, ap.decided_at,
            (select public.admin_mask(email) from auth.users where id = ap.decided_by) as decided_by,
            public.admin_user_row(u) as user,
            (select jsonb_build_object('reason', b.reason, 'message', b.message, 'note', b.note, 'until', b.until, 'banned_at', b.banned_at,
                'by', (select public.admin_mask(email) from auth.users where id = b.banned_by)) from public.account_bans b where b.user_id = ap.user_id) as ban
        from public.account_appeals ap join auth.users u on u.id = ap.user_id
        where case when coalesce(p_status, 'open') = 'open' then ap.status = 'open' else ap.status <> 'open' end
        order by ap.created_at desc limit 100) x);
end;
$$;

/** Answer an appeal: accept (lifts the ban) or deny, with a reply the person sees. */
create or replace function public.admin_appeal_decide(p_admin uuid, p_appeal bigint, p_accept boolean, p_reply text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ap public.account_appeals;
begin
    perform public.admin_require(p_admin);
    select * into ap from public.account_appeals where id = p_appeal;
    if ap.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
    if ap.status <> 'open' then raise exception 'already decided' using errcode = '22023'; end if;
    update public.account_appeals set status = case when p_accept then 'accepted' else 'denied' end,
        reply = left(nullif(btrim(p_reply), ''), 500), decided_at = now(), decided_by = p_admin where id = ap.id;
    if p_accept then perform public.account_lift_ban(ap.user_id, p_admin); end if;
    perform public.admin_log(p_admin, case when p_accept then 'appeal_accept' else 'appeal_deny' end, ap.user_id, nullif(btrim(p_reply), ''));
    return jsonb_build_object('ok', true);
end;
$$;

/** Blocked emails: list, block one by hand, or unblock. */
create or replace function public.admin_blocked(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return (select coalesce(jsonb_agg(jsonb_build_object('id', encode(email_hash, 'hex'), 'masked', masked, 'reason', reason, 'added_at', added_at,
            'by', (select public.admin_mask(email) from auth.users where id = added_by), 'from_ban', from_ban is not null) order by added_at desc), '[]'::jsonb)
        from public.blocked_emails);
end;
$$;
create or replace function public.admin_blocked_set(p_admin uuid, p_add_email text, p_reason text, p_remove_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare mail text := lower(btrim(coalesce(p_add_email, '')));
begin
    perform public.admin_require(p_admin);
    if p_add_email is not null then
        if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 320 then raise exception 'bad email' using errcode = '22023'; end if;
        if exists (select 1 from public.app_admins where email_hash = sha256(convert_to(mail, 'UTF8'))) then raise exception 'an admin' using errcode = '42501'; end if;
        insert into public.blocked_emails (email_hash, masked, reason, added_by)
            values (sha256(convert_to(mail, 'UTF8')), public.admin_mask(mail), coalesce(p_reason, 'other'), p_admin)
        on conflict (email_hash) do nothing;
        perform public.admin_log(p_admin, 'email_block', (select id from auth.users where lower(btrim(email)) = mail limit 1), public.admin_mask(mail));
    end if;
    if p_remove_id is not null then
        if lower(p_remove_id) !~ '^[0-9a-f]{64}$' then raise exception 'bad request' using errcode = '22023'; end if;
        perform public.admin_log(p_admin, 'email_unblock', null, (select masked from public.blocked_emails where email_hash = decode(lower(p_remove_id), 'hex')));
        delete from public.blocked_emails where email_hash = decode(lower(p_remove_id), 'hex');
    end if;
    return public.admin_blocked(p_admin);
end;
$$;

/** The Home banner. */
create or replace function public.admin_notice_set(p_admin uuid, p_text text, p_tone text, p_active boolean, p_until timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    if coalesce(p_tone, 'info') not in ('info', 'warn', 'celebrate') or char_length(coalesce(p_text, '')) > 280 then
        raise exception 'bad request' using errcode = '22023';
    end if;
    if coalesce(p_active, false) and nullif(btrim(coalesce(p_text, '')), '') is null then raise exception 'bad request' using errcode = '22023'; end if;
    update public.app_notice set text = nullif(btrim(p_text), ''), tone = coalesce(p_tone, 'info'), active = coalesce(p_active, false),
        until = p_until, updated_at = now(), updated_by = p_admin where id;
    perform public.admin_log(p_admin, case when coalesce(p_active, false) then 'banner_on' else 'banner_off' end, null, left(nullif(btrim(p_text), ''), 200));
    return (select jsonb_build_object('text', text, 'tone', tone, 'active', active, 'until', until, 'updated_at', updated_at) from public.app_notice where id);
end;
$$;
create or replace function public.admin_notice(p_admin uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public.admin_require(p_admin);
    return (select jsonb_build_object('text', text, 'tone', tone, 'active', active, 'until', until, 'updated_at', updated_at,
        'showing', public.app_notice_get() is not null) from public.app_notice where id);
end;
$$;

/** Users as a list for a CSV download (up to 10,000, same search and filter). */
create or replace function public.admin_users_export(p_admin uuid, p_search text, p_filter text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; n integer := 0; total integer; res jsonb := '[]'::jsonb;
begin
    perform public.admin_require(p_admin);
    loop
        r := public.admin_users(p_admin, p_search, p_filter, n);
        res := res || (r->'users');
        total := (r->>'total')::integer;
        n := n + 50;
        exit when n >= total or n >= 10000;
    end loop;
    return res;
end;
$$;

do $$
declare fns text := 'public.admin_warn(uuid, uuid, text, text), public.admin_appeals(uuid, text), public.admin_appeal_decide(uuid, bigint, boolean, text),
    public.admin_blocked(uuid), public.admin_blocked_set(uuid, text, text, text), public.admin_notice_set(uuid, text, text, boolean, timestamptz),
    public.admin_notice(uuid), public.admin_users_export(uuid, text, text), public.ban_reasons(), public.ban_reason_label(text),
    public.account_lift_ban(uuid, uuid), public.account_ban_info(uuid), public.account_from_token(text)';
begin
    execute 'revoke all on function ' || fns || ' from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute 'grant execute on function ' || fns || ' to service_role';
        grant select, insert, update, delete on public.account_bans, public.account_warnings, public.account_appeals, public.blocked_emails, public.app_notice to service_role;
    end if;
end;
$$;

-- Bans made before 3.0.2 (no reason recorded) get one, so their device can show it.
do $$
begin
    insert into public.account_bans (user_id, reason, until, banned_at)
        select u.id, 'other', u.banned_until, now() from auth.users u where u.banned_until > now()
    on conflict (user_id) do nothing;
exception when undefined_column then null; -- a database without Supabase Auth's ban column (tests)
end;
$$;
