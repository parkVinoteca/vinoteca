-- Approval required before production application. Existing rows remain NULL.
begin;
alter table public.tastings add column drinking_place text
  constraint tastings_drinking_place_length check (char_length(drinking_place) <= 200);
comment on column public.tastings.drinking_place is 'Optional user-entered place of drinking; protected by existing owner RLS.';
commit;
