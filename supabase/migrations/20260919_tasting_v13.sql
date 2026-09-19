-- Apply before v1.3 deployment. Existing stars and legacy score values are preserved.
begin;
alter table public.tastings alter column stars type numeric(2,1) using stars::numeric(2,1);
alter table public.tastings add column if not exists critic_scores jsonb;
alter table public.tastings add column if not exists nose_development text;
comment on column public.tastings.stars is 'Personal rating /5, 0.1 steps. NULL means unrated. Legacy score /10 stays unchanged.';
comment on column public.tastings.critic_scores is 'Search/fetch-backed critic, score, vintage, HTTPS source and quoted evidence. Old manual ws/wa/js fields are not presented as verified.';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.tastings'::regclass and conname='tastings_stars_v13_range') then
    alter table public.tastings add constraint tastings_stars_v13_range check (stars is null or stars between 0 and 5) not valid;
  end if;
end $$;
commit;
