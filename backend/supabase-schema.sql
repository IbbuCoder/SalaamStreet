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

-- ════════════════════════════════════════════════════════════════════════
--  3.0 — Family & Kids Mode
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
