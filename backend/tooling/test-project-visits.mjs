import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003';
await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,aal text,not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 insert into auth.users values('${owner}'),('${other}');
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text)returns text[] language sql as $$select string_to_array($1,'/')$$;`);
for(const file of ['20261120181601_admin_visit_privacy.sql','20261120185437_admin_password_access.sql','20261120190711_admin_ip_geolocation.sql','20261120203522_visitor_device_network_signals.sql','20261120210238_portfolio_editor_analytics.sql','20261122180953_project_visit_details.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
await db.query('insert into portfolio_private.site_admins values($1)',[owner]);
await db.query('insert into auth.sessions values($1,$2,$3,null)',[session,owner,'aal1']);
async function visit(ip,project,seconds=null,age=0){
 const {rows}=await db.query("insert into portfolio_private.site_visits(ip,occurred_at,device_type,os,browser,source)values($1::inet,now()-make_interval(days=>$2),'mobile','Android','Chrome','Instagram')returning id",[ip,age]);
 const id=rows[0].id;
 await db.query("insert into portfolio_private.site_events(event_id,visit_id,occurred_at,kind,subject)values(gen_random_uuid(),$1,now()-make_interval(days=>$2),'project_open',$3)",[id,age,project]);
 if(seconds!==null)await db.query("insert into portfolio_private.site_events(event_id,visit_id,occurred_at,kind,subject,seconds)values(gen_random_uuid(),$1,now()-make_interval(days=>$2),'engagement',$3,$4)",[id,age,project,seconds]);
 return id;
}
for(let i=0;i<52;i++)await visit('198.51.100.'+(i%3+1),'babacu',i===0?7:null);
await visit('198.51.100.1','escuta',25);
const historicalId=await visit('2001:db8::1','babacu',9,2);
await db.query("insert into portfolio_private.site_ip_locations(ip,city,region,country,retry_after)values('198.51.100.1','Tarrafas','Ceará','Brasil',now())");
async function role(name,sub=owner,sid=session){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub,aal:'aal1',session_id:sid})]);await db.exec('set role '+name);
}
const report=async(days=30,before=null)=>(await db.query("select public.admin_project_visits('babacu',$1,$2)as data",[days,before])).rows[0].data;
await role('anon');await assert.rejects(report(),e=>e.code==='42501');
await role('authenticated',other);await assert.rejects(report(),e=>e.code==='42501');
await role('authenticated',owner,'00000000-0000-4000-8000-000000000099');await assert.rejects(report(),e=>e.code==='42501');
await role('authenticated');const first=await report();
assert.equal(first.total_visits,53);assert.equal(first.unique_ips,4);assert.equal(first.opens,53);assert.equal(first.active_seconds,16);assert.equal(first.unmeasured_visits,51);
assert.equal(first.visits.length,50);assert.equal(first.visits[0].visit_id,historicalId);
assert.ok(first.visits.some(v=>v.active_seconds===null));
assert.ok(first.visits.some(v=>v.ip==='198.51.100.1'&&v.city==='Tarrafas'&&v.os==='Android'&&v.source==='Instagram'));
const second=await report(30,first.next_cursor);assert.equal(second.visits.length,3);assert.equal(second.next_cursor,null);
assert.ok(second.visits.every(v=>!first.visits.some(p=>p.visit_id===v.visit_id)));
assert.equal((await report(1)).total_visits,52);assert.equal((await report(1)).active_seconds,7);
const empty=(await db.query("select public.admin_project_visits('no-events')as data")).rows[0].data;
assert.equal(empty.total_visits,0);assert.deepEqual(empty.visits,[]);assert.equal(empty.active_seconds,null);
await assert.rejects(report(365),e=>e.code==='22023');await assert.rejects(report(30,0),e=>e.code==='22023');
await assert.rejects(db.query("select public.admin_project_visits('../bad')"),e=>e.code==='22023');
await assert.rejects(db.query('select * from portfolio_private.site_events'),e=>e.code==='42501');
await db.close();
console.log('PASS: historical project/IP/time joins, shared IP visits, IPv6, missing measurements, per-project isolation, period filtering, pagination, owner session checks and anonymous denial.');

