-- Master tasks stay on journal_entries. A null date means the task is unscheduled.
-- goal_ids already links a task to a goal. This migration adds the habit tables.

create index if not exists journal_entries_unscheduled_idx
  on public.journal_entries (user_id)
  where date is null and deleted_at is null;

create table if not exists public.habits (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null default '',
  description text not null default '',
  active_from date,
  inactive_from date,
  archived boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.habit_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  habit_id text not null,
  date date not null,
  completed boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, habit_id, date)
);

create table if not exists public.monthly_habit_selections (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  year integer not null,
  month integer not null,
  habit_id text not null,
  enabled boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, year, month, habit_id)
);

create index if not exists habit_logs_habit_date_idx on public.habit_logs (user_id, habit_id, date);
create index if not exists monthly_habit_selections_month_idx on public.monthly_habit_selections (user_id, year, month);

select public.protect_owner_table('habits');
select public.protect_owner_table('habit_logs');
select public.protect_owner_table('monthly_habit_selections');

grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_logs to authenticated;
grant select, insert, update, delete on public.monthly_habit_selections to authenticated;
