-- Vinoteca product foundation. Safe for existing records.
-- Apply in Supabase SQL Editor only after reviewing the application deployment.

alter table public.tastings
  add column if not exists mousse text;

alter table public.tastings
  drop constraint if exists tastings_mousse_check;

alter table public.tastings
  add constraint tastings_mousse_check
  check (mousse is null or mousse in ('繊細', 'クリーミー', '荒い', '섬세함', '크리미함', '거침'));

comment on column public.tastings.mousse is
  'Sparkling-wine mousse texture. Localized legacy-safe values; null for non-sparkling wine.';

create table if not exists public.subscription_limits (
  plan text primary key check (plan in ('free', 'paid')),
  tasting_monthly_limit integer check (tasting_monthly_limit is null or tasting_monthly_limit > 0),
  sommelier_monthly_limit integer not null check (sommelier_monthly_limit > 0)
);

insert into public.subscription_limits(plan, tasting_monthly_limit, sommelier_monthly_limit)
values ('free', 10, 5), ('paid', null, 50)
on conflict (plan) do update set
  tasting_monthly_limit = excluded.tasting_monthly_limit,
  sommelier_monthly_limit = excluded.sommelier_monthly_limit;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles(id)
select id from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.subscription_limits enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Authenticated users can view plan limits" on public.subscription_limits;
create policy "Authenticated users can view plan limits" on public.subscription_limits
  for select to authenticated using (true);

revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.subscription_limits from anon, authenticated;
grant select on public.profiles, public.subscription_limits to authenticated;

create or replace function public.create_default_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, plan) values (new.id, 'free') on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users for each row execute function public.create_default_profile();

-- AI reservations are atomic and always checked before a paid provider call.
-- Limits are read from subscription_limits, so they can be changed without an app release.
create or replace function public.reserve_ai_usage(p_feature text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  user_plan text;
  month_limit integer;
  day_limit integer;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feature not in ('sommelier', 'label_scan') or p_feature is null then
    raise exception 'Invalid feature' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(20260918);
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_feature, 0));
  select coalesce(p.plan, 'free') into user_plan from public.profiles p where p.id = uid;
  user_plan := coalesce(user_plan, 'free');

  if p_feature = 'sommelier' then
    select l.sommelier_monthly_limit into month_limit from public.subscription_limits l where l.plan = user_plan;
    day_limit := case when user_plan = 'paid' then 20 else 5 end;
  else
    month_limit := 300;
    day_limit := 50;
  end if;

  if (select count(*) from public.ai_usage_logs where feature = p_feature and created_at >= month_start) >= (case when p_feature = 'sommelier' then 500 else 2000 end)
    or exists (select 1 from public.ai_usage_logs where user_id = uid and feature = p_feature and created_at > now() - interval '10 seconds')
    or (select count(*) from public.ai_usage_logs where user_id = uid and feature = p_feature and created_at >= day_start) >= day_limit
    or (select count(*) from public.ai_usage_logs where user_id = uid and feature = p_feature and created_at >= month_start) >= month_limit then
    return false;
  end if;
  insert into public.ai_usage_logs(user_id, feature) values (uid, p_feature);
  return true;
end;
$$;

-- Direct browser inserts are protected in the database. Paid accounts are unlimited.
create or replace function public.enforce_tasting_monthly_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  user_plan text;
  month_limit integer;
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
begin
  -- Authenticated browser writes must match the row owner. Direct SQL maintenance
  -- has no JWT and is still governed by database privileges.
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':tasting_sheet', 0));
  select coalesce(p.plan, 'free') into user_plan from public.profiles p where p.id = new.user_id;
  user_plan := coalesce(user_plan, 'free');
  select l.tasting_monthly_limit into month_limit from public.subscription_limits l where l.plan = user_plan;
  if month_limit is not null and
    (select count(*) from public.ai_usage_logs where user_id = new.user_id and feature = 'tasting_sheet' and created_at >= month_start) >= month_limit then
    raise exception 'tasting_limit' using errcode = 'P0001';
  end if;
  insert into public.ai_usage_logs(user_id, feature) values (new.user_id, 'tasting_sheet');
  return new;
end;
$$;

drop trigger if exists enforce_tasting_limit_before_insert on public.tastings;
create trigger enforce_tasting_limit_before_insert
before insert on public.tastings for each row execute function public.enforce_tasting_monthly_limit();
