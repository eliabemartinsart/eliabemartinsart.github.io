begin;
create table portfolio_private.site_ip_locations (
  ip inet primary key,
  city text check(char_length(city)<=120),
  region text check(char_length(region)<=120),
  country text check(char_length(country)<=120),
  country_code text check(country_code ~ '^[A-Z]{2}$'),
  checked_at timestamptz,
  retry_after timestamptz not null
);
create table portfolio_private.geo_daily_usage (
  day date primary key,
  hits integer not null
);
alter table portfolio_private.site_ip_locations enable row level security;
alter table portfolio_private.geo_daily_usage enable row level security;
revoke all on portfolio_private.site_ip_locations,portfolio_private.geo_daily_usage from public,anon,authenticated;

create function portfolio_private.claim_ip_location(p_ip inet)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_claimed boolean; v_hits integer; v_day date := (now() at time zone 'UTC')::date;
begin
  if not exists(select 1 from portfolio_private.site_visits where ip=p_ip and occurred_at>=now()-interval '30 days') then return false; end if;
  insert into portfolio_private.site_ip_locations(ip,retry_after) values(p_ip,now()+interval '10 minutes')
  on conflict(ip) do update set retry_after=excluded.retry_after
  where portfolio_private.site_ip_locations.retry_after<=now()
  returning true into v_claimed;
  if not coalesce(v_claimed,false) then return false; end if;
  insert into portfolio_private.geo_daily_usage(day,hits) values(v_day,1)
  on conflict(day) do update set hits=least(portfolio_private.geo_daily_usage.hits+1,501)
  returning hits into v_hits;
  if v_hits>500 then
    update portfolio_private.site_ip_locations set retry_after=(v_day+1)::timestamp at time zone 'UTC' where ip=p_ip;
    return false;
  end if;
  return true;
end;
$$;
revoke all on function portfolio_private.claim_ip_location(inet) from public,anon,authenticated;
grant execute on function portfolio_private.claim_ip_location(inet) to service_role;

create function portfolio_private.finish_ip_location(p_ip inet,p_city text default null,p_region text default null,p_country text default null,p_country_code text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  update portfolio_private.site_ip_locations set
    city=coalesce(nullif(left(trim(p_city),120),''),city),
    region=coalesce(nullif(left(trim(p_region),120),''),region),
    country=coalesce(nullif(left(trim(p_country),120),''),country),
    country_code=case when p_country_code ~ '^[A-Z]{2}$' then p_country_code else country_code end,
    checked_at=now(),
    retry_after=now()+case when nullif(trim(p_country),'') is not null then interval '7 days' else interval '6 hours' end
  where ip=p_ip;
end;
$$;
revoke all on function portfolio_private.finish_ip_location(inet,text,text,text,text) from public,anon,authenticated;
grant execute on function portfolio_private.finish_ip_location(inet,text,text,text,text) to service_role;
create function public.claim_ip_location(p_ip inet) returns boolean
language sql security invoker set search_path='' as $$ select portfolio_private.claim_ip_location(p_ip); $$;
revoke all on function public.claim_ip_location(inet) from public,anon,authenticated;
grant execute on function public.claim_ip_location(inet) to service_role;
create function public.finish_ip_location(p_ip inet,p_city text default null,p_region text default null,p_country text default null,p_country_code text default null) returns void
language sql security invoker set search_path='' as $$ select portfolio_private.finish_ip_location(p_ip,p_city,p_region,p_country,p_country_code); $$;
revoke all on function public.finish_ip_location(inet,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_ip_location(inet,text,text,text,text) to service_role;

create or replace function portfolio_private.purge_site_visits()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from portfolio_private.site_visits where occurred_at<now()-interval '30 days';
  delete from portfolio_private.site_ip_locations l where not exists(select 1 from portfolio_private.site_visits v where v.ip=l.ip and v.occurred_at>=now()-interval '30 days');
  delete from portfolio_private.geo_daily_usage where day<(now() at time zone 'UTC')::date-2;
end;
$$;
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
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'at',v.occurred_at,'ip',host(v.ip),'city',l.city,'region',l.region,'country',l.country) order by v.id desc),'[]'::jsonb),
    case when count(*)=50 then min(v.id) else null end
  into v_visits,v_next
  from (select id,occurred_at,ip from portfolio_private.site_visits
    where occurred_at >= v_since and (p_before_id is null or id < p_before_id)
    order by id desc limit 50) v left join portfolio_private.site_ip_locations l on l.ip=v.ip;
  return jsonb_build_object('total',v_total,'unique_ips',v_unique,'latest',v_latest,'visits',v_visits,'next_cursor',v_next);
end;
$$;

commit;
