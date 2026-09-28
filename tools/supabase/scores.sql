-- Dungeon 30's shared tables. Paste into the Supabase SQL editor and run. Safe to run again: it only
-- adds what's missing, so re-running it after an update upgrades an existing database in place.
--
-- Only the Vercel functions (api/scores.js, api/fallen.js) touch these tables, using the service-role
-- key. Row level security is on with no policies, so the public anon key can't read or write them at
-- all; the service role bypasses RLS. The checks mirror the ones the functions make, as a second guard.

-- ── High scores ──
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 18),
  score integer not null check (score >= 0),
  floor integer not null check (floor between 0 and 30),
  level integer not null check (level between 1 and 10),
  kills integer not null check (kills between 0 and 3000),
  gold integer not null check (gold between 0 and 50000),
  turns integer not null check (turns between 0 and 500000),
  class_name text not null check (class_name in ('Warrior', 'Sorceress', 'Ranger')),
  cause text not null default '' check (char_length(cause) <= 120),
  result text not null check (result in ('death', 'victory'))
);

-- The UTC date of the Daily Descent a score came from (null for ordinary runs).
alter table public.scores add column if not exists daily_date date;

create index if not exists scores_rank_idx on public.scores (score desc, floor desc, kills desc, recorded_at asc);
create index if not exists scores_daily_idx on public.scores (daily_date, score desc) where daily_date is not null;

alter table public.scores enable row level security;

-- ── Fallen adventurers: where delvers died, so others find their remains ──
create table if not exists public.fallen (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  name text not null default '' check (char_length(name) <= 18),
  class_name text not null check (class_name in ('Warrior', 'Sorceress', 'Ranger')),
  level integer not null check (level between 1 and 10),
  floor integer not null check (floor between 1 and 30),
  x integer not null check (x between 0 and 255),
  y integer not null check (y between 0 and 255),
  cause text not null default '' check (char_length(cause) <= 120),
  daily_date date
);

create index if not exists fallen_floor_idx on public.fallen (floor, recorded_at desc);
create index if not exists fallen_daily_idx on public.fallen (daily_date, floor) where daily_date is not null;

alter table public.fallen enable row level security;

-- Projects that don't auto-expose new tables to the API need this so the service role can use them.
grant select, insert on public.scores to service_role;
grant select, insert on public.fallen to service_role;

-- Tell Supabase's REST API to pick up the changes right away.
notify pgrst, 'reload schema';
