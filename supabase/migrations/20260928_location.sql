-- Approval required. Existing owner RLS protects location as part of the record.
begin;
alter table public.tastings
 add column drinking_latitude double precision,
 add column drinking_longitude double precision,
 add column drinking_accuracy double precision,
 add constraint tastings_location_valid check (
  (drinking_latitude is null and drinking_longitude is null and drinking_accuracy is null)
  or (drinking_latitude is not null and drinking_longitude is not null
   and drinking_latitude between -90 and 90 and drinking_longitude between -180 and 180
   and (drinking_accuracy is null or drinking_accuracy between 0 and 20040000))
 );
commit;
