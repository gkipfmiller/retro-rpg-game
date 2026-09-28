-- Shared leaderboard table for Dungeon 30. Paste into the Supabase SQL editor and run once.
--
-- Only the Vercel function (api/scores.js) touches this table, using the service-role key. Row level
-- security is on with no policies, so the public anon key can't read or write it at all; the
-- service role bypasses RLS. The checks mirror the ones the function makes, as a second guard.

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

create index if not exists scores_rank_idx on public.scores (score desc, floor desc, kills desc, recorded_at asc);

alter table public.scores enable row level security;

-- Projects that don't auto-expose new tables to the API need this so the service role can use it.
grant select, insert on public.scores to service_role;

-- Tell Supabase's REST API to pick up the new table right away.
notify pgrst, 'reload schema';
