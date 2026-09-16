begin;
-- Additive: preserve all existing records.
alter table public.tastings add column if not exists palate_notes text;
create index if not exists tastings_user_created_idx on public.tastings (user_id, created_at desc);
create index if not exists tastings_session_wine_idx on public.tastings (blind_session_id, blind_wine_number);
create index if not exists ai_usage_user_feature_created_idx on public.ai_usage_logs (user_id, feature, created_at);

-- Quotas are counted in Japan time. Attempts, including failed provider calls, consume a reservation.
create or replace function public.reserve_ai_usage(p_feature text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  day_limit integer;
  month_limit integer;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_feature not in ('sommelier', 'label_scan') or p_feature is null then
    raise exception 'Invalid feature' using errcode = '22023';
  end if;
  -- Serialize quota reservations across server instances, including the project safety ceiling.
  perform pg_advisory_xact_lock(20260916);
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  day_limit := case when p_feature = 'sommelier' then 20 else 50 end;
  month_limit := case when p_feature = 'sommelier' then 100 else 300 end;
  if (select count(*) from public.ai_usage_logs where feature = p_feature and created_at >= month_start) >= (case when p_feature = 'sommelier' then 500 else 2000 end)
    or exists (select 1 from public.ai_usage_logs where user_id = uid and created_at > now() - interval '10 seconds')
    or (select count(*) from public.ai_usage_logs where user_id = uid and feature = p_feature and created_at >= day_start) >= day_limit
    or (select count(*) from public.ai_usage_logs where user_id = uid and feature = p_feature and created_at >= month_start) >= month_limit then
    return false;
  end if;
  insert into public.ai_usage_logs(user_id, feature) values (uid, p_feature);
  return true;
end;
$$;
revoke all on function public.reserve_ai_usage(text) from public, anon;
grant execute on function public.reserve_ai_usage(text) to authenticated;
-- Prevent clients from forging, deleting, or changing usage accounting.
drop policy if exists "Users can insert own usage logs" on public.ai_usage_logs;
revoke insert, update, delete on public.ai_usage_logs from anon, authenticated;

-- Preserve the verified owner-only deletion behavior, also on new installations.
drop policy if exists "Users can delete own images" on storage.objects;
create policy "Users can delete own images" on storage.objects for delete to authenticated
using (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Do not allow linking a tasting to another owner's blind session.
drop policy if exists "Users can manage own tastings" on public.tastings;
create policy "Users can manage own tastings" on public.tastings for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and (blind_session_id is null or exists (
  select 1 from public.blind_sessions s where s.id = blind_session_id and s.user_id = (select auth.uid())
)));
create unique index if not exists tastings_unique_blind_slot on public.tastings (blind_session_id, blind_wine_number) where blind_session_id is not null;
drop policy if exists "Label images are public" on storage.objects;
drop policy if exists "Users can view own label images" on storage.objects;
create policy "Users can view own label images" on storage.objects for select to authenticated
using (bucket_id = 'label-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
update storage.buckets set public = false, file_size_limit = 3000000, allowed_mime_types = array['image/jpeg','image/png'] where id = 'label-images';
commit;
