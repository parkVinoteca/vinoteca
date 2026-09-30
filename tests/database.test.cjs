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
    for (const file of ['supabase_schema.sql','supabase_schema_v2.sql','supabase/migrations/20260916_reliability.sql','supabase/migrations/20260918_product_foundation.sql','supabase/migrations/20260919_tasting_v13.sql','supabase/migrations/20260920_affordable_sommelier.sql','supabase/migrations/20260927_membership_ai_limits.sql']) await db.exec(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'))
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
    await db.exec(`update public.tastings set stars=4.1, score=8, critic_scores='[{"critic":"JS","score":92,"source":"https://example.com/wine"}]' where wine_name='Private wine';`)
    const savedRating = (await db.query("select stars::text, score, critic_scores from public.tastings where wine_name='Private wine'")).rows[0]
    assert.equal(savedRating.stars, '4.1'); assert.equal(savedRating.score, 8); assert.equal(savedRating.critic_scores[0].score, 92)
    await assert.rejects(db.exec("update public.tastings set stars=5.1"))
    // Paid users can make their twentieth request, but not a twenty-first.
    assert.equal((await db.query("select sommelier_monthly_limit from public.subscription_limits where plan='paid'")).rows[0].sommelier_monthly_limit,20)
    assert.equal((await db.query("select sommelier_monthly_limit from public.subscription_limits where plan='free'")).rows[0].sommelier_monthly_limit,20)
    await db.exec(`update public.profiles set plan='paid' where id='00000000-0000-0000-0000-000000000002';
      insert into public.ai_usage_logs(user_id,feature,created_at) select '00000000-0000-0000-0000-000000000002','sommelier',now()-interval '1 minute' from generate_series(1,19);
      set role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`)
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,true)
    await db.exec("reset role; update public.ai_usage_logs set created_at=now()-interval '1 minute'; set role authenticated;")
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,false)
    await db.exec('reset role')
    // Beta free identities also have unlimited manual notes and 20/day access.
    assert.equal((await db.query("select tasting_monthly_limit from public.subscription_limits where plan='free'")).rows[0].tasting_monthly_limit,null)
    await db.exec("update public.profiles set plan='free' where id='00000000-0000-0000-0000-000000000002'; delete from public.ai_usage_logs where user_id='00000000-0000-0000-0000-000000000002'; set role authenticated;")
    for(let i=0;i<20;i++){
      assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,true)
      await db.exec("reset role; update public.ai_usage_logs set created_at=now()-interval '1 minute' where user_id='00000000-0000-0000-0000-000000000002'; set role authenticated;")
    }
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,false)
    await db.exec('reset role')
    // Blind answers live in the same tasting row alongside original observations.
    await db.exec(`insert into public.blind_sessions(id,user_id,title,wine_count) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Blind',1);
      insert into public.tastings(user_id,mode,blind_session_id,blind_wine_number,wine_name,producer,answer_wine,answer_producer,stars,aromas,deduction_grape)
      values ('00000000-0000-0000-0000-000000000002','blind','00000000-0000-0000-0000-000000000003',1,'Chablis','Domaine','Chablis','Domaine',3.7,ARRAY['lemon'],'Riesling');`)
    const blindRows = (await db.query("select * from public.tastings where blind_session_id='00000000-0000-0000-0000-000000000003'")).rows
    assert.equal(blindRows.length,1)
    assert.equal(blindRows[0].wine_name,'Chablis')
    assert.equal(Number(blindRows[0].stars),3.7)
    assert.deepEqual(blindRows[0].aromas,['lemon'])
    assert.equal(blindRows[0].deduction_grape,'Riesling')
    // AI-only caps: 50th scan allowed, 51st blocked; manual notes remain writable.
    await db.exec("delete from public.ai_usage_logs where user_id='00000000-0000-0000-0000-000000000002'; insert into public.ai_usage_logs(user_id,feature,created_at) select '00000000-0000-0000-0000-000000000002','label_scan',now()-interval '1 minute' from generate_series(1,49); set role authenticated;")
    assert.equal((await db.query("select public.reserve_ai_usage('label_scan') as allowed")).rows[0].allowed,true)
    await db.exec("reset role; update public.ai_usage_logs set created_at=now()-interval '1 minute'; set role authenticated;")
    assert.equal((await db.query("select public.reserve_ai_usage('label_scan') as allowed")).rows[0].allowed,false)
    await db.exec("insert into public.tastings(user_id,wine_name) values (auth.uid(),'Manual after limit'); reset role;")
    // Simulate launch policy locally only: free AI scans denied, three sommelier uses.
    await db.exec("update public.subscription_limits set label_monthly_limit=0,sommelier_monthly_limit=3 where plan='free'; delete from public.ai_usage_logs where user_id='00000000-0000-0000-0000-000000000002'; set role authenticated;")
    assert.equal((await db.query("select public.reserve_ai_usage('label_scan') as allowed")).rows[0].allowed,false)
    for(let i=0;i<3;i++) {
      assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,true)
      await db.exec("reset role; update public.ai_usage_logs set created_at=now()-interval '1 minute'; set role authenticated;")
    }
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,false)
    await db.exec("insert into public.tastings(user_id,wine_name) values (auth.uid(),'Free manual'); reset role;")
    // Beta unlimited still logs usage; alert threshold informs operators without blocking.
    await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260928_beta_unlimited.sql'),'utf8'))
    await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260928_drinking_place.sql'),'utf8'))
    assert.equal((await db.query('select drinking_place from public.tastings limit 1')).rows[0].drinking_place,null)
    await db.exec("delete from public.ai_usage_logs where user_id='00000000-0000-0000-0000-000000000002'; insert into public.ai_usage_logs(user_id,feature) select '00000000-0000-0000-0000-000000000002','label_scan' from generate_series(1,99); set role authenticated;")
    assert.equal((await db.query("select public.reserve_ai_usage('label_scan') as allowed")).rows[0].allowed,true)
    assert.equal((await db.query("select public.reserve_ai_usage('sommelier') as allowed")).rows[0].allowed,true)
    assert.equal((await db.query('select * from public.ai_usage_alerts')).rows.length,0)
    await assert.rejects(db.query("insert into public.usage_monitor_admins values(auth.uid())"))
    await db.exec("update public.tastings set wine_name='Edited wine',stars=4.2,drinking_place='Wine shop XX' where user_id=auth.uid() and wine_name='Chablis';")
    assert.equal((await db.query("select drinking_place from public.tastings where wine_name='Edited wine'")).rows[0].drinking_place,'Wine shop XX')
    await assert.rejects(db.query("update public.tastings set drinking_place=repeat('a',201) where user_id=auth.uid()"))
    const edited=(await db.query("select stars,aromas,deduction_grape from public.tastings where wine_name='Edited wine'")).rows[0]
    assert.equal(Number(edited.stars),4.2);assert.deepEqual(edited.aromas,['lemon']);assert.equal(edited.deduction_grape,'Riesling')
    assert.equal((await db.query("update public.tastings set wine_name='Forbidden' where user_id='00000000-0000-0000-0000-000000000001' returning id")).rows.length,0)
    await db.exec("reset role; insert into public.usage_monitor_admins values('00000000-0000-0000-0000-000000000001'); set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);")
    const alerts=(await db.query('select * from public.ai_usage_alerts')).rows
    assert.equal(alerts.length,1);assert.equal(alerts[0].request_count,101)
    await db.exec('reset role')
    assert.equal((await db.query("select public from storage.buckets where id='label-images'")).rows[0].public,false)
    await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20260928_location.sql'),'utf8'))
    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)")
    await db.exec("update public.tastings set drinking_latitude=35.68,drinking_longitude=139.76,drinking_accuracy=20 where user_id=auth.uid()")
    assert.equal((await db.query('select drinking_latitude from public.tastings limit 1')).rows[0].drinking_latitude,35.68)
    await assert.rejects(db.query("update public.tastings set drinking_latitude=91 where user_id=auth.uid()"))
    await assert.rejects(db.query("update public.tastings set drinking_longitude=null where user_id=auth.uid()"))
    assert.equal((await db.query("update public.tastings set drinking_latitude=0 where user_id='00000000-0000-0000-0000-000000000002' returning id")).rows.length,0)
    await db.exec('reset role')
  } finally { await db.close() }
})
