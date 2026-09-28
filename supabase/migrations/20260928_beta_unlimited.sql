-- Approval required. Beta only; existing usage/tastings remain untouched.
begin;
alter table public.subscription_limits alter column label_monthly_limit drop not null;
alter table public.subscription_limits alter column sommelier_monthly_limit drop not null;
update public.subscription_limits set label_monthly_limit=null,sommelier_monthly_limit=null,tasting_monthly_limit=null;
create table public.usage_monitor_admins(user_id uuid primary key references auth.users(id));
alter table public.usage_monitor_admins enable row level security;
create policy monitor_admin_self on public.usage_monitor_admins for select to authenticated using(user_id=auth.uid());
revoke all on public.usage_monitor_admins from anon, authenticated;
grant select on public.usage_monitor_admins to authenticated;
create table public.ai_usage_alerts(user_id uuid references auth.users(id),usage_day date,request_count integer not null,updated_at timestamptz not null default now(),primary key(user_id,usage_day));
alter table public.ai_usage_alerts enable row level security;
create policy monitor_admin_alerts on public.ai_usage_alerts for select to authenticated using(exists(select 1 from public.usage_monitor_admins a where a.user_id=auth.uid()));
revoke all on public.ai_usage_alerts from anon,authenticated;
grant select on public.ai_usage_alerts to authenticated;
-- Add the operator's verified auth.users.id to usage_monitor_admins separately.
-- Never use email text or client-side checks as administrator authorization.
create or replace function public.reserve_ai_usage(p_feature text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); user_plan text; month_limit integer; daily_count integer;
 today date := (now() at time zone 'Asia/Tokyo')::date;
 month_start timestamptz := date_trunc('month',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_feature is null or p_feature not in ('label_scan','sommelier') then raise exception 'Invalid feature' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select coalesce(p.plan,'free') into user_plan from public.profiles p where p.id=uid;
 select case when p_feature='label_scan' then l.label_monthly_limit else l.sommelier_monthly_limit end into month_limit
 from public.subscription_limits l where l.plan=coalesce(user_plan,'free');
 if not found then return false; end if;
 if month_limit is not null and (select count(*) from public.ai_usage_logs where user_id=uid and feature=p_feature and created_at>=month_start)>=month_limit then return false; end if;
 insert into public.ai_usage_logs(user_id,feature) values(uid,p_feature);
 select count(*) into daily_count from public.ai_usage_logs where user_id=uid and feature in ('label_scan','sommelier') and created_at >= (today::timestamp at time zone 'Asia/Tokyo');
 if daily_count>=100 then
  insert into public.ai_usage_alerts(user_id,usage_day,request_count) values(uid,today,daily_count)
  on conflict(user_id,usage_day) do update set request_count=excluded.request_count,updated_at=now();
 end if;
 return true;
end;
$$;
commit;
