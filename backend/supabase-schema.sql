-- ════════════════════════════════════════════════════════════════════════
--  SalaamStreet — Supabase schema
--  One account system for the website (JS) and the Windows app (C#).
--  Run this in the Supabase SQL editor after creating a project.
--  Auth is handled by Supabase Auth (auth.users); these tables hang off it.
--  Row-Level Security ensures each user can only read/write their own rows.
-- ════════════════════════════════════════════════════════════════════════

-- ── Profiles: one row per user, created automatically on sign-up ──────────
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    locale       text default 'en',
    is_premium   boolean not null default false,
    premium_plan text,                       -- 'monthly' | 'yearly' | 'lifetime' | null
    premium_since timestamptz,
    premium_expires timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ── Preferences: synced settings (method, madhhab, reciter, theme, …) ─────
create table if not exists public.preferences (
    user_id      uuid primary key references auth.users(id) on delete cascade,
    method       int   not null default 3,
    school       int   not null default 0,
    reciter      text  not null default 'ar.alafasy',
    theme        text  not null default 'system',
    show_translation     boolean not null default true,
    show_transliteration boolean not null default false,
    location_label text,
    location_lat   double precision,
    location_lng   double precision,
    updated_at   timestamptz not null default now()
);

-- ── Qur'an bookmarks ──────────────────────────────────────────────────────
create table if not exists public.bookmarks (
    user_id    uuid not null references auth.users(id) on delete cascade,
    surah      int  not null,
    ayah       int  not null,
    note       text,
    created_at timestamptz not null default now(),
    primary key (user_id, surah, ayah)
);

-- ── Progress: Qur'an reading + Arabic learning ────────────────────────────
create table if not exists public.progress (
    user_id    uuid not null references auth.users(id) on delete cascade,
    kind       text not null,               -- 'quran' | 'arabic'
    key        text not null,               -- e.g. surah number, lesson id
    value      jsonb not null,              -- { lastAyah, percent, streak, … }
    updated_at timestamptz not null default now(),
    primary key (user_id, kind, key)
);

-- ── Favorites: mosques + halal locations ──────────────────────────────────
create table if not exists public.favorites (
    user_id    uuid not null references auth.users(id) on delete cascade,
    kind       text not null,               -- 'mosque' | 'halal'
    place_id   text not null,               -- provider id
    name       text,
    data       jsonb,                       -- address, coords, etc.
    created_at timestamptz not null default now(),
    primary key (user_id, kind, place_id)
);

-- ════════════════════════════════════════════════════════════════════════
--  Auto-create a profile + preferences row when a user signs up
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
    insert into public.preferences (user_id) values (new.id);
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
--  Row-Level Security — each user only sees their own data
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles    enable row level security;
alter table public.preferences enable row level security;
alter table public.bookmarks   enable row level security;
alter table public.progress    enable row level security;
alter table public.favorites   enable row level security;

-- profiles
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- preferences
create policy "own prefs all" on public.preferences
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bookmarks
create policy "own bookmarks all" on public.bookmarks
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- progress
create policy "own progress all" on public.progress
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- favorites
create policy "own favorites all" on public.favorites
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Note: is_premium must only ever be set by a trusted server (Supabase Edge
-- Function verifying PayPal), never by the client. RLS above allows a user to
-- update their profile row; in Session 5 we lock premium columns down with a
-- column-level policy / trigger so only the service role can flip is_premium.
