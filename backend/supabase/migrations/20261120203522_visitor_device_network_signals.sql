begin;
alter table portfolio_private.site_visits add column device_type text check(device_type in ('computer','mobile','tablet','bot','unknown')), add column os text check(char_length(os)<=32), add column browser text check(char_length(browser)<=32);
create table portfolio_private.site_ip_networks (ip inet primary key,vpn boolean,proxy boolean,tor boolean,checked_at timestamptz not null default now());
alter table portfolio_private.site_ip_networks enable row level security;
revoke all on portfolio_private.site_ip_networks from public,anon,authenticated;
create function portfolio_private.record_site_visit_details(p_ip inet,p_device text,p_os text,p_browser text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hits integer; v_global integer; v_bucket timestamptz := date_trunc('minute', now());
begin
  if p_ip is null or masklen(p_ip) <> (case family(p_ip) when 4 then 32 else 128 end) then
    return false;
  end if;
  insert into portfolio_private.visit_rate_buckets(bucket_key,bucket_start,hits)
  values ('global',v_bucket,1)
  on conflict (bucket_key,bucket_start) do update
  set hits=least(portfolio_private.visit_rate_buckets.hits+1,5001)
  returning hits into v_global;
  if v_global=1 then
    delete from portfolio_private.site_visits where occurred_at < now()-interval '30 days';
    delete from portfolio_private.visit_rate_buckets where bucket_start < v_bucket-interval '2 minutes';
  end if;
  if v_global>5000 then return false; end if;
  insert into portfolio_private.visit_rate_buckets(bucket_key,bucket_start,hits)
  values ('ip:'||host(p_ip),v_bucket,1)
  on conflict (bucket_key,bucket_start) do update
  set hits=least(portfolio_private.visit_rate_buckets.hits+1,21)
  returning hits into v_hits;
  if v_hits>20 then return false; end if;
  insert into portfolio_private.site_visits(ip,device_type,os,browser) values(p_ip,p_device,p_os,p_browser);
  return true;
end;
$$;
revoke all on function portfolio_private.record_site_visit_details(inet,text,text,text) from public,anon,authenticated;
grant execute on function portfolio_private.record_site_visit_details(inet,text,text,text) to service_role;
create or replace function portfolio_private.record_site_visit(p_ip inet) returns boolean language sql security invoker set search_path='' as $$ select portfolio_private.record_site_visit_details(p_ip,null,null,null); $$;
create function public.record_site_visit_details(p_ip inet,p_device text,p_os text,p_browser text) returns boolean language sql security invoker set search_path='' as $$ select portfolio_private.record_site_visit_details(p_ip,p_device,p_os,p_browser); $$;
revoke all on function public.record_site_visit_details(inet,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_visit_details(inet,text,text,text) to service_role;
create or replace function portfolio_private.admin_visit_report(p_days integer default 30,p_before_id bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_since timestamptz; v_visits jsonb; v_next bigint; v_total bigint; v_unique bigint; v_latest timestamptz;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') not in ('aal1','aal2')
    or not exists(select 1 from portfolio_private.site_admins a where a.user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if not exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid() and s.aal in ('aal1','aal2') and (s.not_after is null or s.not_after>now())) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if p_days not in (1,7,30) or p_days is null or p_before_id <= 0 then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  v_since := now()-make_interval(days=>p_days);
  select count(*),count(distinct ip),max(occurred_at) into v_total,v_unique,v_latest
    from portfolio_private.site_visits where occurred_at >= v_since;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'at',v.occurred_at,'ip',host(v.ip),'city',l.city,'region',l.region,'country',l.country,'device',v.device_type,'os',v.os,'browser',v.browser,'vpn',n.vpn,'proxy',n.proxy,'tor',n.tor,'network_checked_at',n.checked_at) order by v.id desc),'[]'::jsonb),
    case when count(*)=50 then min(v.id) else null end
  into v_visits,v_next
  from (select id,occurred_at,ip,device_type,os,browser from portfolio_private.site_visits
    where occurred_at >= v_since and (p_before_id is null or id < p_before_id)
    order by id desc limit 50) v left join portfolio_private.site_ip_locations l on l.ip=v.ip left join portfolio_private.site_ip_networks n on n.ip=v.ip;
  return jsonb_build_object('total',v_total,'unique_ips',v_unique,'latest',v_latest,'visits',v_visits,'next_cursor',v_next);
end;
$$;

create function portfolio_private.save_network_signals(p_records jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)>50 then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_records) e where jsonb_typeof(e)<>'object'
    or jsonb_typeof(e->'ip') is distinct from 'string'
    or jsonb_typeof(e->'vpn') not in ('boolean','null')
    or jsonb_typeof(e->'proxy') not in ('boolean','null')
    or jsonb_typeof(e->'tor') not in ('boolean','null')) then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  insert into portfolio_private.site_ip_networks(ip,vpn,proxy,tor,checked_at)
  select (r->>'ip')::inet,(r->>'vpn')::boolean,(r->>'proxy')::boolean,(r->>'tor')::boolean,now()
  from (select distinct on (e->>'ip') e as r from jsonb_array_elements(p_records) e) items
  where exists(select 1 from portfolio_private.site_visits v where v.ip=(r->>'ip')::inet and v.occurred_at>=now()-interval '30 days')
  on conflict(ip) do update set vpn=excluded.vpn,proxy=excluded.proxy,tor=excluded.tor,checked_at=excluded.checked_at;
end;
$$;
revoke all on function portfolio_private.save_network_signals(jsonb) from public,anon,authenticated;
grant execute on function portfolio_private.save_network_signals(jsonb) to service_role;
create function public.save_network_signals(p_records jsonb) returns void
language sql security invoker set search_path='' as $$ select portfolio_private.save_network_signals(p_records); $$;
revoke all on function public.save_network_signals(jsonb) from public,anon,authenticated;
grant execute on function public.save_network_signals(jsonb) to service_role;

create or replace function portfolio_private.purge_site_visits()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from portfolio_private.site_visits where occurred_at<now()-interval '30 days';
  delete from portfolio_private.site_ip_locations l where not exists(select 1 from portfolio_private.site_visits v where v.ip=l.ip and v.occurred_at>=now()-interval '30 days');
  delete from portfolio_private.site_ip_networks n where not exists(select 1 from portfolio_private.site_visits v where v.ip=n.ip and v.occurred_at>=now()-interval '30 days');
  delete from portfolio_private.geo_daily_usage where day<(now() at time zone 'UTC')::date-2;
end;
$$;

commit;
