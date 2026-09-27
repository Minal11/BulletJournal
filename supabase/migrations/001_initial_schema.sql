-- My Bullet Journal
-- Run this in the Supabase SQL editor, or with the Supabase CLI.
-- Browser clients must use the publishable/anon key. Never put the service role key in the app.

create extension if not exists pgcrypto;

create or replace function public.keep_client_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is null then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  date date,
  entry_time text,
  entry_type text,
  content text,
  task_status text,
  signifiers jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  collection_ids jsonb not null default '[]'::jsonb,
  goal_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.day_pages (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  date date,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.monthly_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  year integer,
  month integer,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.goals (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  title text,
  category text,
  quarter integer,
  year integer,
  goal_text text,
  why text,
  measures jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  status text,
  notes text,
  start_date date,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.quarterly_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  year integer,
  quarter integer,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.monthly_reflections (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  year integer,
  month integer,
  big_moments jsonb not null default '[]'::jsonb,
  went_well text,
  felt_heavy text,
  learned text,
  goal_check_ins jsonb not null default '[]'::jsonb,
  time_energy_notes text,
  memories jsonb not null default '[]'::jsonb,
  more_of jsonb not null default '[]'::jsonb,
  less_of jsonb not null default '[]'::jsonb,
  migration_decisions jsonb not null default '[]'::jsonb,
  month_in_one_sentence text,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.collections (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  title text,
  description text,
  content jsonb not null default '{}'::jsonb,
  linked_entry_ids jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.future_log_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  target_year integer,
  target_month integer,
  entry_type text,
  content text,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.index_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.app_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists journal_entries_user_date on public.journal_entries (user_id, date);
create index if not exists goals_user_quarter on public.goals (user_id, year, quarter);
create index if not exists monthly_reflections_user_month on public.monthly_reflections (user_id, year, month);
create index if not exists monthly_logs_user_month on public.monthly_logs (user_id, year, month);
create index if not exists collections_user on public.collections (user_id);
create index if not exists future_log_items_user_month on public.future_log_items (user_id, target_year, target_month);

create or replace function public.protect_owner_table(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', table_name);
  execute format('drop policy if exists owner_select on public.%I', table_name);
  execute format('create policy owner_select on public.%I for select to authenticated using (auth.uid() = user_id)', table_name);
  execute format('drop policy if exists owner_insert on public.%I', table_name);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check (auth.uid() = user_id)', table_name);
  execute format('drop policy if exists owner_update on public.%I', table_name);
  execute format('create policy owner_update on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
  execute format('drop policy if exists owner_delete on public.%I', table_name);
  execute format('create policy owner_delete on public.%I for delete to authenticated using (auth.uid() = user_id)', table_name);
  execute format('drop trigger if exists keep_updated_at on public.%I', table_name);
  execute format('create trigger keep_updated_at before insert or update on public.%I for each row execute function public.keep_client_updated_at()', table_name);
end;
$$;

select public.protect_owner_table('journal_entries');
select public.protect_owner_table('day_pages');
select public.protect_owner_table('monthly_logs');
select public.protect_owner_table('goals');
select public.protect_owner_table('quarterly_reviews');
select public.protect_owner_table('monthly_reflections');
select public.protect_owner_table('collections');
select public.protect_owner_table('future_log_items');
select public.protect_owner_table('index_overrides');
select public.protect_owner_table('app_settings');

alter table public.profiles enable row level security;
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop trigger if exists keep_updated_at on public.profiles;
create trigger keep_updated_at before insert or update on public.profiles
for each row execute function public.keep_client_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.protect_owner_table(text) from public, anon, authenticated;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.day_pages to authenticated;
grant select, insert, update, delete on public.monthly_logs to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.quarterly_reviews to authenticated;
grant select, insert, update, delete on public.monthly_reflections to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.future_log_items to authenticated;
grant select, insert, update, delete on public.index_overrides to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
