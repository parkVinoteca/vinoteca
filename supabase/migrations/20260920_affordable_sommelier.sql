-- Beta access: all existing/new accounts get paid-level limits without altering plan identities.
-- Launch: restore free limits explicitly after beta; never reset usage records.
begin;
update public.subscription_limits set sommelier_monthly_limit=20, tasting_monthly_limit=null where plan in ('free','paid');
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
    day_limit := least(coalesce(month_limit,20),20);
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
commit;
