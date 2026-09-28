-- Apply only after approval. No provider names, addresses or coordinates stored.
begin;
alter table public.tastings add column drinking_place_id text check (char_length(drinking_place_id) <= 255);
create table public.places_usage_logs (id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create index places_usage_created on public.places_usage_logs(created_at);
create index places_usage_user_created on public.places_usage_logs(user_id,created_at);
alter table public.places_usage_logs enable row level security;
revoke all on public.places_usage_logs from anon,authenticated;
create function public.reserve_places_usage() returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(728194420);
 if (select count(*) from public.places_usage_logs where created_at>=date_trunc('month',now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') >= 4500 then return false; end if;
 if (select count(*) from public.places_usage_logs where user_id=uid and created_at>now()-interval '1 minute') >= 5 then return false; end if;
 insert into public.places_usage_logs(user_id) values(uid);
 return true;
end $$;
revoke all on function public.reserve_places_usage() from public,anon;
grant execute on function public.reserve_places_usage() to authenticated;
commit;
