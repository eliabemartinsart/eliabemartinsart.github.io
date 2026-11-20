begin;
alter table portfolio_private.site_visits add column source text, add column event_token uuid, add column active_seconds integer not null default 0 check(active_seconds between 0 and 7200);
create unique index site_visits_event_token_idx on portfolio_private.site_visits(event_token) where event_token is not null;
create table portfolio_private.site_events(
 id bigint generated always as identity primary key,event_id uuid unique not null,
 visit_id bigint not null references portfolio_private.site_visits(id) on delete cascade,
 occurred_at timestamptz not null default now(),kind text not null,subject text not null,seconds smallint not null default 0 check(seconds between 0 and 30)
);
create index site_events_visit_idx on portfolio_private.site_events(visit_id);
create index site_events_time_idx on portfolio_private.site_events(occurred_at,kind);
alter table portfolio_private.site_events enable row level security;
revoke all on portfolio_private.site_events from public,anon,authenticated;
revoke all on sequence portfolio_private.site_events_id_seq from public,anon,authenticated;
create table portfolio_private.content_state(
 id boolean primary key default true check(id),draft jsonb not null,published jsonb not null,
 revision integer not null default 1,published_revision integer not null default 1,
 updated_at timestamptz not null default now(),published_at timestamptz not null default now(),analytics_started_at timestamptz not null default now()
);
alter table portfolio_private.content_state enable row level security;
revoke all on portfolio_private.content_state from public,anon,authenticated;

create function portfolio_private.is_site_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','') in('aal1','aal2')
 and exists(select 1 from portfolio_private.site_admins a where a.user_id=auth.uid())
 and exists(select 1 from auth.sessions s where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid() and s.aal in('aal1','aal2') and(s.not_after is null or s.not_after>now()));
$$;
revoke all on function portfolio_private.is_site_admin() from public,anon;
grant execute on function portfolio_private.is_site_admin() to authenticated;
create function public.portfolio_admin_access() returns boolean language sql stable security invoker set search_path='' as $$ select portfolio_private.is_site_admin(); $$;
revoke all on function public.portfolio_admin_access() from public,anon;
grant execute on function public.portfolio_admin_access() to authenticated;

create function portfolio_private.validate_content(c jsonb) returns void
language plpgsql set search_path='' as $$
declare p jsonb; k text; n integer; required boolean; ids text[]:='{}';
begin
 if jsonb_typeof(c) is distinct from 'object' or c->>'version' is distinct from '1' or jsonb_typeof(c->'projects') is distinct from 'array' or jsonb_typeof(c->'site') is distinct from 'object' or octet_length(c::text)>200000 then raise exception 'Invalid content' using errcode='22023';end if;
 if c-array['version','projects','site'] <> '{}'::jsonb or jsonb_array_length(c->'projects')>50 then raise exception 'Invalid content' using errcode='22023';end if;
 for p in select value from jsonb_array_elements(c->'projects') loop
  if jsonb_typeof(p) is distinct from 'object' or coalesce(p->>'id','')!~'^[a-z0-9][a-z0-9-]{0,63}$' or(p->>'id')=any(ids) then raise exception 'Invalid project identifier' using errcode='22023';end if;
  ids:=array_append(ids,p->>'id');
  if p-array['id','title','category','year','role','function','production','description','image','alt','link','linkLabel','portrait','group','visible','featured','cardKicker','cardCredit','award']<>'{}'::jsonb then raise exception 'Invalid project fields' using errcode='22023';end if;
  for k,n,required in select * from(values('title',160,true),('category',100,true),('year',30,false),('role',200,false),('function',500,false),('production',240,false),('description',3000,false),('alt',240,true),('linkLabel',80,true),('cardKicker',160,false),('cardCredit',240,false),('award',80,false)) x(key,max_length,is_required) loop
   if jsonb_typeof(p->k) is distinct from 'string' or char_length(p->>k)>n or(required and trim(p->>k)='') then raise exception 'Invalid project text: %',k using errcode='22023';end if;
  end loop;
  if coalesce(p->>'group','') not in('animacao','direcao edicao','editorial') or jsonb_typeof(p->'visible') is distinct from 'boolean' or jsonb_typeof(p->'featured') is distinct from 'boolean' or jsonb_typeof(p->'portrait') is distinct from 'boolean' then raise exception 'Invalid project options' using errcode='22023';end if;
  if(p->>'featured')::boolean and((p->>'group')='editorial' or(p->>'portrait')::boolean)then raise exception 'Editorial projects cannot be featured in the video panel' using errcode='22023';end if;
  if char_length(p->>'link')>1000 or coalesce(p->>'link','')!~'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]<>"]*)?$' then raise exception 'Invalid project link' using errcode='22023';end if;
  if char_length(p->>'image')>1000 or not(coalesce(p->>'image','')~'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]<>"]*)?$' or(coalesce(p->>'image','')~'^\./assets/[A-Za-z0-9_./% -]+$' and position('..' in(p->>'image'))=0)) then raise exception 'Invalid project image' using errcode='22023';end if;
 end loop;
 if(c->'site')-array['heroIntro','aboutDescription','contactDescription','email','whatsapp']<>'{}'::jsonb then raise exception 'Invalid site fields' using errcode='22023';end if;
 foreach k in array array['heroIntro','aboutDescription','contactDescription'] loop if jsonb_typeof(c->'site'->k) is distinct from 'string' or char_length(c->'site'->>k)>1500 then raise exception 'Invalid site text' using errcode='22023';end if;end loop;
 if char_length(c->'site'->>'email')>254 or coalesce(c->'site'->>'email','')!~'^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or coalesce(c->'site'->>'whatsapp','')!~'^[0-9]{10,15}$' then raise exception 'Invalid contact' using errcode='22023';end if;
end;$$;
revoke all on function portfolio_private.validate_content(jsonb) from public,anon,authenticated;

create function portfolio_private.get_portfolio_content() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('content',jsonb_build_object('version',1,'site',published->'site','projects',coalesce((select jsonb_agg(p order by ord) from jsonb_array_elements(published->'projects') with ordinality e(p,ord) where(p->>'visible')::boolean),'[]'::jsonb)),'revision',published_revision,'published_at',published_at) from portfolio_private.content_state where id;
$$;
revoke all on function portfolio_private.get_portfolio_content() from public;
grant usage on schema portfolio_private to anon;
grant execute on function portfolio_private.get_portfolio_content() to anon,authenticated,service_role;
create function public.get_portfolio_content() returns jsonb language sql stable security invoker set search_path='' as $$ select portfolio_private.get_portfolio_content(); $$;
revoke all on function public.get_portfolio_content() from public;
grant execute on function public.get_portfolio_content() to anon,authenticated,service_role;

create function portfolio_private.admin_portfolio_content() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not portfolio_private.is_site_admin() then raise exception 'Access denied' using errcode='42501';end if;
 return(select jsonb_build_object('draft',draft,'published',published,'revision',revision,'published_revision',published_revision,'updated_at',updated_at,'published_at',published_at)from portfolio_private.content_state where id);
end;$$;
revoke all on function portfolio_private.admin_portfolio_content() from public,anon;
grant execute on function portfolio_private.admin_portfolio_content() to authenticated;
create function public.admin_portfolio_content() returns jsonb language sql security invoker set search_path='' as $$ select portfolio_private.admin_portfolio_content(); $$;
revoke all on function public.admin_portfolio_content() from public,anon;
grant execute on function public.admin_portfolio_content() to authenticated;

create function portfolio_private.save_portfolio_content(p_content jsonb,p_expected_revision integer,p_publish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
 if not portfolio_private.is_site_admin() then raise exception 'Access denied' using errcode='42501';end if;
 perform portfolio_private.validate_content(p_content);
 if p_publish and not exists(select 1 from jsonb_array_elements(p_content->'projects') p where(p->>'visible')::boolean)then raise exception 'Keep at least one visible project' using errcode='22023';end if;
 update portfolio_private.content_state set draft=p_content,revision=revision+1,updated_at=now(),published=case when p_publish then p_content else published end,published_revision=case when p_publish then revision+1 else published_revision end,published_at=case when p_publish then now() else published_at end where id and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise exception 'Content changed in another session; reload before saving' using errcode='40001';end if;
 return portfolio_private.admin_portfolio_content();
end;$$;
revoke all on function portfolio_private.save_portfolio_content(jsonb,integer,boolean) from public,anon;
grant execute on function portfolio_private.save_portfolio_content(jsonb,integer,boolean) to authenticated;
create function public.save_portfolio_content(p_content jsonb,p_expected_revision integer,p_publish boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select portfolio_private.save_portfolio_content(p_content,p_expected_revision,p_publish); $$;
revoke all on function public.save_portfolio_content(jsonb,integer,boolean) from public,anon;
grant execute on function public.save_portfolio_content(jsonb,integer,boolean) to authenticated;

create function portfolio_private.begin_site_visit(p_ip inet,p_device text,p_os text,p_browser text,p_source text,p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
 if p_token is null then return false;end if;
 if not portfolio_private.record_site_visit_details(p_ip,p_device,p_os,p_browser)then return false;end if;
 v_id:=currval(pg_get_serial_sequence('portfolio_private.site_visits','id')::regclass);
 update portfolio_private.site_visits set event_token=p_token,source=case when p_source in('Direto / não informado','Instagram','Google','Bing','WhatsApp','Facebook','YouTube','LinkedIn','TikTok','Outro site','Outro link de campanha')then p_source else null end where id=v_id;
 return true;
end;$$;
revoke all on function portfolio_private.begin_site_visit(inet,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function portfolio_private.begin_site_visit(inet,text,text,text,text,uuid) to service_role;
create function public.begin_site_visit(p_ip inet,p_device text,p_os text,p_browser text,p_source text,p_token uuid) returns boolean language sql security invoker set search_path='' as $$ select portfolio_private.begin_site_visit(p_ip,p_device,p_os,p_browser,p_source,p_token); $$;
revoke all on function public.begin_site_visit(inet,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.begin_site_visit(inet,text,text,text,text,uuid) to service_role;

create function portfolio_private.record_site_events(p_ip inet,p_token uuid,p_events jsonb)returns integer
language plpgsql security definer set search_path='' as $$
declare v_visit bigint;v_start timestamptz;v_active integer;v_hits integer;v_count integer;v_total integer:=0;e jsonb;k text;s text;v_seconds integer;v_inserted bigint;v_bucket timestamptz:=date_trunc('minute',now());
begin
 if jsonb_typeof(p_events) is distinct from 'array' then raise exception 'Invalid events' using errcode='22023';end if;
 if jsonb_array_length(p_events)>20 or octet_length(p_events::text)>12000 then raise exception 'Too many events' using errcode='22023';end if;
 select id,occurred_at,active_seconds into v_visit,v_start,v_active from portfolio_private.site_visits where event_token=p_token and ip=p_ip and occurred_at>=now()-interval '2 hours' for update;
 if v_visit is null then return 0;end if;
 insert into portfolio_private.visit_rate_buckets(bucket_key,bucket_start,hits)values('events:'||host(p_ip),v_bucket,1)on conflict(bucket_key,bucket_start)do update set hits=least(portfolio_private.visit_rate_buckets.hits+1,301)returning hits into v_hits;
 if v_hits>300 then return 0;end if;
 select count(*) into v_count from portfolio_private.site_events where visit_id=v_visit;
 for e in select value from jsonb_array_elements(p_events) loop
  if v_count>=600 then exit;end if;
  if jsonb_typeof(e) is distinct from 'object' or coalesce(e->>'id','')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then continue;end if;
  k:=e->>'kind';s:=e->>'subject';
  if k is null or k not in('project_open','project_link','contact_click','section_view','engagement')or s is null or char_length(s)>80 then continue;end if;
  if k='contact_click' and s not in('email','whatsapp') then continue;end if;
  if k='section_view' and s not in('inicio','projetos','sobre','ferramentas','reconhecimentos','contato','competencias')then continue;end if;
  if k in('project_open','project_link')or(k='engagement' and s not like 'section:%')then
   if not exists(select 1 from portfolio_private.content_state c,jsonb_array_elements(c.published->'projects') p where c.id and p->>'id'=s)then continue;end if;
  end if;
  if k='engagement' and s like 'section:%' and substring(s from 9)not in('inicio','projetos','sobre','ferramentas','reconhecimentos','contato','competencias')then continue;end if;
  v_seconds:=0;
  if k='engagement' then
   if coalesce(e->>'seconds','')!~'^[0-9]{1,2}$' then continue;end if;
   v_seconds:=least(30,(e->>'seconds')::integer,greatest(0,floor(extract(epoch from(now()-v_start)))::integer+15-v_active),7200-v_active);
   if v_seconds<=0 then continue;end if;
  end if;
  v_inserted:=null;
  insert into portfolio_private.site_events(event_id,visit_id,kind,subject,seconds)values((e->>'id')::uuid,v_visit,k,s,v_seconds)on conflict(event_id)do nothing returning id into v_inserted;
  if v_inserted is not null then v_total:=v_total+1;v_count:=v_count+1;v_active:=v_active+v_seconds;end if;
 end loop;
 update portfolio_private.site_visits set active_seconds=v_active where id=v_visit;
 return v_total;
end;$$;
revoke all on function portfolio_private.record_site_events(inet,uuid,jsonb)from public,anon,authenticated;
grant execute on function portfolio_private.record_site_events(inet,uuid,jsonb)to service_role;
create function public.record_site_events(p_ip inet,p_token uuid,p_events jsonb)returns integer language sql security invoker set search_path='' as $$select portfolio_private.record_site_events(p_ip,p_token,p_events);$$;
revoke all on function public.record_site_events(inet,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.record_site_events(inet,uuid,jsonb)to service_role;

create or replace function portfolio_private.admin_visit_report(p_days integer default 30,p_before_id bigint default null)returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_since timestamptz;v_visits jsonb;v_next bigint;v_total bigint;v_unique bigint;v_latest timestamptz;
begin
 if not portfolio_private.is_site_admin()then raise exception 'Access denied' using errcode='42501';end if;
 if p_days not in(1,7,30)or p_days is null or p_before_id<=0 then raise exception 'Invalid request' using errcode='22023';end if;
 v_since:=now()-make_interval(days=>p_days);
 select count(*),count(distinct ip),max(occurred_at)into v_total,v_unique,v_latest from portfolio_private.site_visits where occurred_at>=v_since;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'at',v.occurred_at,'ip',host(v.ip),'city',l.city,'region',l.region,'country',l.country,'device',v.device_type,'os',v.os,'browser',v.browser,'vpn',n.vpn,'proxy',n.proxy,'tor',n.tor,'network_checked_at',n.checked_at,'source',v.source,'active_seconds',case when v.event_token is not null then v.active_seconds else null end)order by v.id desc),'[]'::jsonb),case when count(*)=50 then min(v.id)else null end into v_visits,v_next
 from(select id,occurred_at,ip,device_type,os,browser,source,event_token,active_seconds from portfolio_private.site_visits where occurred_at>=v_since and(p_before_id is null or id<p_before_id)order by id desc limit 50)v left join portfolio_private.site_ip_locations l on l.ip=v.ip left join portfolio_private.site_ip_networks n on n.ip=v.ip;
 return jsonb_build_object('total',v_total,'unique_ips',v_unique,'latest',v_latest,'visits',v_visits,'next_cursor',v_next);
end;$$;

create function portfolio_private.admin_analytics_summary(p_days integer default 30)returns jsonb
language plpgsql security definer set search_path='' as $$
declare since_at timestamptz;data jsonb;project_data jsonb;contact_data jsonb;source_data jsonb;daily_data jsonb;hour_data jsonb;section_data jsonb;
begin
 if not portfolio_private.is_site_admin()then raise exception 'Access denied' using errcode='42501';end if;
 if p_days is null or p_days not in(1,7,30)then raise exception 'Invalid period' using errcode='22023';end if;
 since_at:=now()-make_interval(days=>p_days);
 select jsonb_build_object('tracked_visits',count(*)filter(where event_token is not null),'active_seconds',coalesce(sum(active_seconds)filter(where event_token is not null),0),'average_active_seconds',coalesce(round(avg(active_seconds)filter(where event_token is not null)),0),'previous_visits',(select count(*)from portfolio_private.site_visits where occurred_at>=since_at-make_interval(days=>p_days)and occurred_at<since_at),'measurement_started_at',(select analytics_started_at from portfolio_private.content_state where id))into data from portfolio_private.site_visits where occurred_at>=since_at;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'opens',opens,'clicks',clicks,'seconds',seconds)order by opens desc,clicks desc,title),'[]'::jsonb)into project_data from(
  select p->>'id' as id,p->>'title' as title,count(e.id)filter(where e.kind='project_open')as opens,count(e.id)filter(where e.kind='project_link')as clicks,coalesce(sum(e.seconds)filter(where e.kind='engagement'),0)as seconds
  from portfolio_private.content_state c cross join lateral jsonb_array_elements(c.published->'projects')p left join portfolio_private.site_events e on e.subject=p->>'id'and e.occurred_at>=since_at where c.id group by p->>'id',p->>'title')q;
 select jsonb_build_object('email',count(*)filter(where subject='email'),'whatsapp',count(*)filter(where subject='whatsapp'))into contact_data from portfolio_private.site_events where kind='contact_click'and occurred_at>=since_at;
 select coalesce(jsonb_agg(jsonb_build_object('source',source,'visits',visits)order by visits desc,source),'[]'::jsonb)into source_data from(select coalesce(source,'Não registrado')as source,count(*)as visits from portfolio_private.site_visits where occurred_at>=since_at group by coalesce(source,'Não registrado'))q;
 select coalesce(jsonb_agg(jsonb_build_object('date',day::date,'visits',visits)order by day),'[]'::jsonb)into daily_data from(
  select d.day,count(v.id)as visits from generate_series((since_at at time zone 'America/Fortaleza')::date::timestamp,(now()at time zone 'America/Fortaleza')::date::timestamp,interval '1 day')d(day)
  left join portfolio_private.site_visits v on v.occurred_at>=since_at and(v.occurred_at at time zone 'America/Fortaleza')::date=d.day::date group by d.day)q;
 select jsonb_agg(jsonb_build_object('hour',hour,'visits',visits)order by hour)into hour_data from(
  select h.hour,count(v.id)as visits from generate_series(0,23)h(hour)left join portfolio_private.site_visits v on v.occurred_at>=since_at and extract(hour from(v.occurred_at at time zone 'America/Fortaleza'))=h.hour group by h.hour)q;
 select jsonb_agg(jsonb_build_object('id',s.id,'views',(select count(*)from portfolio_private.site_events e where e.kind='section_view'and e.subject=s.id and e.occurred_at>=since_at),'seconds',(select coalesce(sum(e.seconds),0)from portfolio_private.site_events e where e.kind='engagement'and e.subject='section:'||s.id and e.occurred_at>=since_at)))into section_data from unnest(array['inicio','projetos','sobre','ferramentas','reconhecimentos','contato','competencias'])s(id);
 return data||jsonb_build_object('projects',project_data,'contacts',contact_data,'sources',source_data,'daily',daily_data,'hourly',hour_data,'sections',section_data);
end;$$;
revoke all on function portfolio_private.admin_analytics_summary(integer)from public,anon;
grant execute on function portfolio_private.admin_analytics_summary(integer)to authenticated;
create function public.admin_analytics_summary(p_days integer default 30)returns jsonb language sql security invoker set search_path='' as $$select portfolio_private.admin_analytics_summary(p_days);$$;
revoke all on function public.admin_analytics_summary(integer)from public,anon;
grant execute on function public.admin_analytics_summary(integer)to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('portfolio-media','portfolio-media',true,4194304,array['image/webp','image/png','image/jpeg'])on conflict(id)do nothing;
create policy portfolio_media_owner_upload on storage.objects for insert to authenticated with check(bucket_id='portfolio-media'and(storage.foldername(name))[1]=auth.uid()::text and public.portfolio_admin_access()and name~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$');

insert into portfolio_private.content_state(id,draft,published)values(true,'{"version":1,"site":{"heroIntro":"Histórias desenhadas quadro a quadro, da primeira ideia ao movimento final.","aboutDescription":"Trabalho em diferentes etapas da produção: desenvolvimento visual, criação de personagens, storyboard, animação, composição e edição. Também escrevo e dirijo curtas-metragens autorais, combinando narrativa e imagem para construir histórias com identidade.","contactDescription":"Estou disponível para projetos de animação 2D, direção, roteiro, storyboard e ilustração.","email":"eliabemartins363@gmail.com","whatsapp":"5588992569904"},"projects":[{"id":"babacu","title":"Babaçu","category":"Animação 2D","year":"2024—2026","role":"Animador 2D e artista de VFX","function":"Animação cut-out e frame a frame; VFX do elemento fogo","production":"Muirak Studio","description":"Curta de aventura e fantasia ambientado em uma Belém encantada. Eliabe atuou em animação cut-out e frame a frame, além dos efeitos visuais do elemento fogo.","image":"./assets/covers/babacu.webp","alt":"Cena do projeto de animação Babaçu","link":"https://muirak.com/projetos-autorais/projeto-baba%C3%A7u.html","linkLabel":"Conhecer o projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação 2D · 2024—2026","cardCredit":"Muirak Studio","award":""},{"id":"menino-toquinho","title":"Menino Toquinho","category":"Animação 2D","year":"2024","role":"Animador 2D e animador VFX","function":"Animação de cenas e VFX do elemento fogo","production":"Muirak Studio / Búfalos TV / Warner Bros.","description":"Trabalho realizado como integrante da equipe de animação da Muirak Studio, com animação 2D de cenas e efeitos visuais do elemento fogo.","image":"./assets/covers/menino-toquinho.jpg","alt":"Cena de Menino Toquinho","link":"https://www.youtube.com/watch?v=91d01xD2i7A","linkLabel":"Assistir ao projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação 2D & VFX · 2024","cardCredit":"Muirak Studio / Búfalos TV / Warner Bros.","award":""},{"id":"mundo-das-cores","title":"Mundo das Cores","category":"Animação 2D","year":"2024","role":"Animador 2D e artista de rig","function":"Animação cut-out e rig de personagens e props","production":"Muirak Studio","description":"Série de animação infantil que combina música, humor e aventura para explorar emoções, criatividade e cooperação. Eliabe atuou na animação 2D cut-out e na criação de rigs de personagens e props.","image":"./assets/covers/mundo-das-cores.webp","alt":"Cena do projeto Mundo das Cores","link":"https://muirak.com/projetos-autorais/projeto-mundo-das-cores.html","linkLabel":"Conhecer o projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação cut-out & rig · 2024","cardCredit":"Muirak Studio","award":""},{"id":"caminho-deserto","title":"Caminho Deserto","category":"Animação 2D","year":"2024—2025","role":"Animador 2D e artista de cenários","function":"Animação frame a frame e arte de cenários","production":"Pós-graduação em Animação 2D da Méliès","description":"Projeto desenvolvido no contexto da pós-graduação em Animação 2D da Méliès, com atuação em animação frame a frame e criação de cenários.","image":"./assets/covers/caminho-deserto.jpg","alt":"Cena da animação Caminho Deserto","link":"https://www.youtube.com/watch?v=u6c-n8CChHw","linkLabel":"Assistir ao projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Frame a frame & cenários · 2024—2025","cardCredit":"Pós-graduação Méliès","award":""},{"id":"uma-nova-luz","title":"Uma Nova Luz","category":"Documentário narrativo","year":"2025","role":"Diretor, roteirista e animador","function":"Direção, roteiro, pós-produção, edição, animação e storyboard","production":"Festival Alunos que Inspiram — FAQI","description":"Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2025.","image":"./assets/covers/uma-nova-luz.jpg","alt":"Cena do curta Uma Nova Luz: A Arte da Reciclagem de Ideias","link":"https://youtu.be/rYfqIQjrDZI?si=gAroUOVr_0E_SImB","linkLabel":"Assistir ao curta","portrait":false,"group":"direcao edicao","visible":true,"featured":true,"cardKicker":"Documentário narrativo · 2025","cardCredit":"Festival Alunos que Inspiram","award":"Vencedor regional"},{"id":"escuta","title":"Escuta","category":"Documentário narrativo","year":"2026","role":"Diretor, roteirista e animador","function":"Direção, roteiro, pós-produção, edição, animação e storyboard","production":"Festival Alunos que Inspiram — FAQI","description":"Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2026.","image":"./assets/covers/escuta.jpg","alt":"Cena do curta-metragem Escuta","link":"https://www.youtube.com/watch?v=tfWpcs5rXh8","linkLabel":"Assistir ao curta","portrait":false,"group":"direcao edicao","visible":true,"featured":true,"cardKicker":"Documentário narrativo · 2026","cardCredit":"Festival Alunos que Inspiram","award":"Vencedor regional"},{"id":"crianca-telas","title":"A Criança Presa no Mundo das Telas","category":"Ilustração editorial","year":"2024","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autora: Elis Nunes","description":"Livro infantil sobre Luca, um menino que redescobre experiências, talentos, amizades e a conexão com a natureza para além das telas.","image":"./assets/covers/crianca-telas.webp","alt":"Capa do livro A Criança Presa no Mundo das Telas","link":"https://bibliotecamundial.com.br/a-crianca-presa-no-mundo-das-telas-the-child-trapped-in-the-screens-elis-nunes/","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2024","cardCredit":"Elis Nunes","award":""},{"id":"atos-amor","title":"A Criança que Fazia Muitos Atos de Amor","category":"Ilustração editorial","year":"2024","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autora: Maitê Nunes","description":"Livro infantil sobre empatia, solidariedade e pequenos gestos capazes de transformar a escola, a família e a comunidade.","image":"./assets/covers/atos-amor.webp","alt":"Capa do livro A Criança que Fazia Muitos Atos de Amor","link":"https://bibliotecamundial.com.br/a-crianca-que-fazia-muitos-atos-de-amor-maite-nunes/","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2024","cardCredit":"Maitê Nunes","award":""},{"id":"criancas-rio","title":"As Crianças que Salvaram o Rio","category":"Ilustração editorial","year":"2025","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autoras: Elis Nunes e Maitê Nunes","description":"Obra infantil que retrata a vida nas comunidades ribeirinhas e apresenta o uso responsável dos recursos naturais por meio de uma aventura ilustrada.","image":"./assets/covers/criancas-rio.jpeg","alt":"Capa do livro As Crianças que Salvaram o Rio","link":"https://www.magazineluiza.com.br/as-criancas-que-salvarm-o-rio-the-children-who-the-river-nacional/p/cjd7a4fddf/li/ldic/?seller_id=livrariagraopara","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2025","cardCredit":"Elis Nunes & Maitê Nunes","award":""}]}'::jsonb,'{"version":1,"site":{"heroIntro":"Histórias desenhadas quadro a quadro, da primeira ideia ao movimento final.","aboutDescription":"Trabalho em diferentes etapas da produção: desenvolvimento visual, criação de personagens, storyboard, animação, composição e edição. Também escrevo e dirijo curtas-metragens autorais, combinando narrativa e imagem para construir histórias com identidade.","contactDescription":"Estou disponível para projetos de animação 2D, direção, roteiro, storyboard e ilustração.","email":"eliabemartins363@gmail.com","whatsapp":"5588992569904"},"projects":[{"id":"babacu","title":"Babaçu","category":"Animação 2D","year":"2024—2026","role":"Animador 2D e artista de VFX","function":"Animação cut-out e frame a frame; VFX do elemento fogo","production":"Muirak Studio","description":"Curta de aventura e fantasia ambientado em uma Belém encantada. Eliabe atuou em animação cut-out e frame a frame, além dos efeitos visuais do elemento fogo.","image":"./assets/covers/babacu.webp","alt":"Cena do projeto de animação Babaçu","link":"https://muirak.com/projetos-autorais/projeto-baba%C3%A7u.html","linkLabel":"Conhecer o projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação 2D · 2024—2026","cardCredit":"Muirak Studio","award":""},{"id":"menino-toquinho","title":"Menino Toquinho","category":"Animação 2D","year":"2024","role":"Animador 2D e animador VFX","function":"Animação de cenas e VFX do elemento fogo","production":"Muirak Studio / Búfalos TV / Warner Bros.","description":"Trabalho realizado como integrante da equipe de animação da Muirak Studio, com animação 2D de cenas e efeitos visuais do elemento fogo.","image":"./assets/covers/menino-toquinho.jpg","alt":"Cena de Menino Toquinho","link":"https://www.youtube.com/watch?v=91d01xD2i7A","linkLabel":"Assistir ao projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação 2D & VFX · 2024","cardCredit":"Muirak Studio / Búfalos TV / Warner Bros.","award":""},{"id":"mundo-das-cores","title":"Mundo das Cores","category":"Animação 2D","year":"2024","role":"Animador 2D e artista de rig","function":"Animação cut-out e rig de personagens e props","production":"Muirak Studio","description":"Série de animação infantil que combina música, humor e aventura para explorar emoções, criatividade e cooperação. Eliabe atuou na animação 2D cut-out e na criação de rigs de personagens e props.","image":"./assets/covers/mundo-das-cores.webp","alt":"Cena do projeto Mundo das Cores","link":"https://muirak.com/projetos-autorais/projeto-mundo-das-cores.html","linkLabel":"Conhecer o projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Animação cut-out & rig · 2024","cardCredit":"Muirak Studio","award":""},{"id":"caminho-deserto","title":"Caminho Deserto","category":"Animação 2D","year":"2024—2025","role":"Animador 2D e artista de cenários","function":"Animação frame a frame e arte de cenários","production":"Pós-graduação em Animação 2D da Méliès","description":"Projeto desenvolvido no contexto da pós-graduação em Animação 2D da Méliès, com atuação em animação frame a frame e criação de cenários.","image":"./assets/covers/caminho-deserto.jpg","alt":"Cena da animação Caminho Deserto","link":"https://www.youtube.com/watch?v=u6c-n8CChHw","linkLabel":"Assistir ao projeto","portrait":false,"group":"animacao","visible":true,"featured":true,"cardKicker":"Frame a frame & cenários · 2024—2025","cardCredit":"Pós-graduação Méliès","award":""},{"id":"uma-nova-luz","title":"Uma Nova Luz","category":"Documentário narrativo","year":"2025","role":"Diretor, roteirista e animador","function":"Direção, roteiro, pós-produção, edição, animação e storyboard","production":"Festival Alunos que Inspiram — FAQI","description":"Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2025.","image":"./assets/covers/uma-nova-luz.jpg","alt":"Cena do curta Uma Nova Luz: A Arte da Reciclagem de Ideias","link":"https://youtu.be/rYfqIQjrDZI?si=gAroUOVr_0E_SImB","linkLabel":"Assistir ao curta","portrait":false,"group":"direcao edicao","visible":true,"featured":true,"cardKicker":"Documentário narrativo · 2025","cardCredit":"Festival Alunos que Inspiram","award":"Vencedor regional"},{"id":"escuta","title":"Escuta","category":"Documentário narrativo","year":"2026","role":"Diretor, roteirista e animador","function":"Direção, roteiro, pós-produção, edição, animação e storyboard","production":"Festival Alunos que Inspiram — FAQI","description":"Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2026.","image":"./assets/covers/escuta.jpg","alt":"Cena do curta-metragem Escuta","link":"https://www.youtube.com/watch?v=tfWpcs5rXh8","linkLabel":"Assistir ao curta","portrait":false,"group":"direcao edicao","visible":true,"featured":true,"cardKicker":"Documentário narrativo · 2026","cardCredit":"Festival Alunos que Inspiram","award":"Vencedor regional"},{"id":"crianca-telas","title":"A Criança Presa no Mundo das Telas","category":"Ilustração editorial","year":"2024","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autora: Elis Nunes","description":"Livro infantil sobre Luca, um menino que redescobre experiências, talentos, amizades e a conexão com a natureza para além das telas.","image":"./assets/covers/crianca-telas.webp","alt":"Capa do livro A Criança Presa no Mundo das Telas","link":"https://bibliotecamundial.com.br/a-crianca-presa-no-mundo-das-telas-the-child-trapped-in-the-screens-elis-nunes/","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2024","cardCredit":"Elis Nunes","award":""},{"id":"atos-amor","title":"A Criança que Fazia Muitos Atos de Amor","category":"Ilustração editorial","year":"2024","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autora: Maitê Nunes","description":"Livro infantil sobre empatia, solidariedade e pequenos gestos capazes de transformar a escola, a família e a comunidade.","image":"./assets/covers/atos-amor.webp","alt":"Capa do livro A Criança que Fazia Muitos Atos de Amor","link":"https://bibliotecamundial.com.br/a-crianca-que-fazia-muitos-atos-de-amor-maite-nunes/","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2024","cardCredit":"Maitê Nunes","award":""},{"id":"criancas-rio","title":"As Crianças que Salvaram o Rio","category":"Ilustração editorial","year":"2025","role":"Ilustrador, line artist e colorista","function":"Colorização, ilustrações e line art","production":"Autoras: Elis Nunes e Maitê Nunes","description":"Obra infantil que retrata a vida nas comunidades ribeirinhas e apresenta o uso responsável dos recursos naturais por meio de uma aventura ilustrada.","image":"./assets/covers/criancas-rio.jpeg","alt":"Capa do livro As Crianças que Salvaram o Rio","link":"https://www.magazineluiza.com.br/as-criancas-que-salvarm-o-rio-the-children-who-the-river-nacional/p/cjd7a4fddf/li/ldic/?seller_id=livrariagraopara","linkLabel":"Ver publicação","portrait":true,"group":"editorial","visible":true,"featured":false,"cardKicker":"Ilustração editorial · 2025","cardCredit":"Elis Nunes & Maitê Nunes","award":""}]}'::jsonb);
commit;
