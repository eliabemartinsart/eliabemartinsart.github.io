begin;
create schema if not exists portfolio_private;
revoke all on schema portfolio_private from public, anon, authenticated;

create table portfolio_private.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table portfolio_private.site_visits (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  ip inet not null
);
create index site_visits_time_idx on portfolio_private.site_visits(occurred_at);
create table portfolio_private.visit_rate_buckets (
  bucket_key text not null,
  bucket_start timestamptz not null,
  hits integer not null,
  primary key(bucket_key, bucket_start)
);
alter table portfolio_private.site_admins enable row level security;
alter table portfolio_private.site_visits enable row level security;
alter table portfolio_private.visit_rate_buckets enable row level security;
revoke all on all tables in schema portfolio_private from public, anon, authenticated;
revoke all on all sequences in schema portfolio_private from public, anon, authenticated;

-- This write path can only be called by the collector's server credential.
create function public.record_site_visit(p_ip inet)
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
  insert into portfolio_private.site_visits(ip) values(p_ip);
  return true;
end;
$$;
revoke all on function public.record_site_visit(inet) from public, anon, authenticated;
grant execute on function public.record_site_visit(inet) to service_role;

-- Knowing the public project key, a password, or an unrelated account is not enough.
create function public.admin_visit_report(p_days integer default 30,p_before_id bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_since timestamptz; v_visits jsonb; v_next bigint; v_total bigint; v_unique bigint; v_latest timestamptz;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
    or not exists(select 1 from portfolio_private.site_admins a where a.user_id=auth.uid()) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if p_days not in (1,7,30) or p_days is null or p_before_id <= 0 then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  v_since := now()-make_interval(days=>p_days);
  select count(*),count(distinct ip),max(occurred_at) into v_total,v_unique,v_latest
    from portfolio_private.site_visits where occurred_at >= v_since;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'at',v.occurred_at,'ip',host(v.ip)) order by v.id desc),'[]'::jsonb),
    case when count(*)=50 then min(v.id) else null end
  into v_visits,v_next
  from (select id,occurred_at,ip from portfolio_private.site_visits
    where occurred_at >= v_since and (p_before_id is null or id < p_before_id)
    order by id desc limit 50) v;
  return jsonb_build_object('total',v_total,'unique_ips',v_unique,'latest',v_latest,'visits',v_visits,'next_cursor',v_next);
end;
$$;
revoke all on function public.admin_visit_report(integer,bigint) from public,anon;
grant execute on function public.admin_visit_report(integer,bigint) to authenticated;

-- A daily server-side job must execute this even on days without visits.
create function public.purge_site_visits()
returns void language sql security definer set search_path='' as $$
  delete from portfolio_private.site_visits where occurred_at < now()-interval '30 days';
$$;
revoke all on function public.purge_site_visits() from public,anon,authenticated;
grant execute on function public.purge_site_visits() to service_role;
commit;
