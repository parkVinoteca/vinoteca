const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
test('Fresh schema, migration, owner RLS, private storage and atomic AI quotas', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
      grant usage on schema public, auth, storage to authenticated;
      grant select, insert, delete on storage.objects to authenticated;`)
    for (const file of ['supabase_schema.sql','supabase_schema_v2.sql','supabase/migrations/20260916_reliability.sql','supabase/migrations/20260918_product_foundation.sql']) await db.exec(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'))
    await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
      grant select, insert, update, delete on public.tastings, public.blind_sessions to authenticated;
      grant select on public.ai_usage_logs to authenticated;
      insert into public.tastings(user_id,wine_name,palate_notes) values ('00000000-0000-0000-0000-000000000001','Private wine','Saved palate note');
      set role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`)
    assert.equal((await db.query('select * from public.tastings')).rows.length,0)
    await assert.rejects(db.query(`insert into public.tastings(user_id) values ('00000000-0000-0000-0000-000000000001')`))
    await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`)
    assert.equal((await db.query('select palate_notes from public.tastings')).rows[0].palate_notes,'Saved palate note')
    assert.ok((await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='tastings' and column_name='mousse'")).rows.length)
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,true)
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,false)
    await assert.rejects(db.query("insert into public.ai_usage_logs(user_id,feature) values (auth.uid(),'sommelier')"))
    await assert.rejects(db.query("select public.reserve_ai_usage('unknown')"))
    await db.exec(`reset role; update public.ai_usage_logs set created_at = now() - interval '1 minute';
      insert into public.ai_usage_logs(user_id,feature,created_at) select '00000000-0000-0000-0000-000000000001','sommelier',now()-interval '1 minute' from generate_series(1,19);
      set role authenticated;`)
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,false)
    await db.exec('reset role')
    assert.equal((await db.query("select public from storage.buckets where id='label-images'")).rows[0].public,false)
  } finally { await db.close() }
})
