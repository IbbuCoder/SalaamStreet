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
returns bigint language sql stable as $$ select floor(extract(epoch from now()) / 600)::bigint; $$;

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
--  AI Testing Lab (private; not part of any public release)
--  Used only by the ai-lab Edge Function (backend/functions/ai-lab), which
--  runs with the service role and checks the admin on every request. Nothing
--  here is reachable from the app's public key: no table or function is
--  granted to anon or authenticated.
--  • ai_settings: one row — the emergency switch, the model, limits and the
--    prices used for cost estimates. Changed from the Lab page or here.
--  • ai_usage: one row per request — counts, tokens, estimated cost, status.
--    Never the conversation itself.
--  • ai_security_log: refused requests (who and why, never tokens or text).
--  • ai_reserve(): the daily and per-minute limits, checked and counted in
--    one step so two requests at once can't both slip past the limit.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ai_settings (
    id                  boolean primary key default true check (id),
    enabled             boolean not null default true,
    model               text not null default 'gemini-3.5-flash-lite' check (model ~ '^[a-z0-9][a-z0-9.-]{1,63}$'),
    daily_limit         integer not null default 50 check (daily_limit between 0 and 2000),
    minute_limit        integer not null default 5 check (minute_limit between 1 and 60),
    max_input_chars     integer not null default 6000 check (max_input_chars between 200 and 30000),
    max_output_tokens   integer not null default 2048 check (max_output_tokens between 64 and 8192),
    input_usd_per_mtok  numeric(10, 4) not null default 0.30 check (input_usd_per_mtok >= 0),
    output_usd_per_mtok numeric(10, 4) not null default 2.50 check (output_usd_per_mtok >= 0),
    updated_at          timestamptz not null default now(),
    updated_by          uuid
);
insert into public.ai_settings (id) values (true) on conflict (id) do nothing;

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
revoke all on public.ai_settings, public.ai_usage, public.ai_security_log from anon, authenticated;

/** Check the switch and the limits, and count the request, in one step.
    Chats count towards the daily limit; connection tests only towards the
    per-minute limit. The daily limit is for the whole project (a cost cap),
    not per person. Days are UTC, like Google's own quotas. */
create or replace function public.ai_reserve(p_user uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.ai_settings; used integer; recent integer; rid bigint;
begin
    if p_user is null or p_kind not in ('chat', 'test') then raise exception 'bad request' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtext('ai_reserve'));
    select * into s from public.ai_settings where id;
    select count(*) into used from public.ai_usage
        where kind = 'chat' and at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    if not s.enabled then
        return jsonb_build_object('ok', false, 'reason', 'disabled', 'used', used, 'limit', s.daily_limit);
    end if;
    if p_kind = 'chat' and used >= s.daily_limit then
        return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'used', used, 'limit', s.daily_limit);
    end if;
    select count(*) into recent from public.ai_usage where at > now() - interval '1 minute';
    if recent >= s.minute_limit then
        return jsonb_build_object('ok', false, 'reason', 'rate_limit', 'used', used, 'limit', s.daily_limit);
    end if;
    insert into public.ai_usage (user_id, kind, model) values (p_user, p_kind, s.model) returning id into rid;
    -- Keep the logs small: usage for a year, refusals for 90 days.
    delete from public.ai_usage where at < now() - interval '365 days';
    delete from public.ai_security_log where at < now() - interval '90 days';
    return jsonb_build_object('ok', true, 'id', rid, 'model', s.model,
        'used', used + case when p_kind = 'chat' then 1 else 0 end, 'limit', s.daily_limit,
        'max_input_chars', s.max_input_chars, 'max_output_tokens', s.max_output_tokens,
        'input_usd_per_mtok', s.input_usd_per_mtok, 'output_usd_per_mtok', s.output_usd_per_mtok);
end;
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
        'resets_at', (select day.start + interval '1 day' from day));
$$;

revoke all on function public.ai_reserve(uuid, text), public.ai_usage_summary() from public, anon, authenticated;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant select, insert, update, delete on public.ai_settings, public.ai_usage, public.ai_security_log to service_role;
        grant execute on function public.ai_reserve(uuid, text), public.ai_usage_summary() to service_role;
    end if;
end;
$$;
