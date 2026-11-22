begin;

-- Read existing event-to-visit links; no visitor data is backfilled or inferred.
create function portfolio_private.admin_project_visits(
 p_project_id text,p_days integer default 30,p_before_visit_id bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare since_at timestamptz; result jsonb;
begin
 if not portfolio_private.is_site_admin() then
  raise exception 'Access denied' using errcode='42501';
 end if;
 if p_project_id is null or p_project_id !~ '^[a-z0-9-]{1,64}$'
  or p_days is null or p_days not in(1,7,30) or p_before_visit_id<=0 then
  raise exception 'Invalid request' using errcode='22023';
 end if;
 since_at:=now()-make_interval(days=>p_days);
 with activity as materialized (
  select e.visit_id,min(e.occurred_at) as first_at,max(e.occurred_at) as last_at,
   count(*)filter(where e.kind='project_open') as opens,
   count(*)filter(where e.kind='project_link') as clicks,
   sum(e.seconds)filter(where e.kind='engagement') as active_seconds
  from portfolio_private.site_events e
  where e.subject=p_project_id and e.occurred_at>=since_at
   and e.kind in('project_open','project_link','engagement')
  group by e.visit_id
 ), page as (
  select a.* from activity a where p_before_visit_id is null or a.visit_id<p_before_visit_id
  order by a.visit_id desc limit 50
 ), details as (
  select p.visit_id,jsonb_build_object(
   'visit_id',p.visit_id,'visit_at',v.occurred_at,'first_at',p.first_at,'last_at',p.last_at,
   'ip',host(v.ip),'city',l.city,'region',l.region,'country',l.country,
   'device',v.device_type,'os',v.os,'browser',v.browser,'source',v.source,
   'vpn',n.vpn,'proxy',n.proxy,'tor',n.tor,'network_checked_at',n.checked_at,
   'opens',p.opens,'clicks',p.clicks,'active_seconds',p.active_seconds
  ) as item
  from page p join portfolio_private.site_visits v on v.id=p.visit_id
   left join portfolio_private.site_ip_locations l on l.ip=v.ip
   left join portfolio_private.site_ip_networks n on n.ip=v.ip
 )
 select jsonb_build_object(
  'project_id',p_project_id,
  'measurement_started_at',(select analytics_started_at from portfolio_private.content_state where id),
  'total_visits',(select count(*)from activity),
  'unique_ips',(select count(distinct v.ip)from activity a join portfolio_private.site_visits v on v.id=a.visit_id),
  'opens',(select coalesce(sum(opens),0)from activity),
  'clicks',(select coalesce(sum(clicks),0)from activity),
  'active_seconds',(select sum(active_seconds)from activity),
  'unmeasured_visits',(select count(*)from activity where active_seconds is null),
  'visits',coalesce((select jsonb_agg(item order by visit_id desc)from details),'[]'::jsonb),
  'next_cursor',(select case when count(*)=50 then min(visit_id)else null end from page)
 ) into result;
 return result;
end;$$;
revoke all on function portfolio_private.admin_project_visits(text,integer,bigint) from public,anon;
grant execute on function portfolio_private.admin_project_visits(text,integer,bigint) to authenticated;

create function public.admin_project_visits(
 p_project_id text,p_days integer default 30,p_before_visit_id bigint default null
) returns jsonb language sql security invoker set search_path='' as $$
 select portfolio_private.admin_project_visits(p_project_id,p_days,p_before_visit_id);
$$;
revoke all on function public.admin_project_visits(text,integer,bigint) from public,anon;
grant execute on function public.admin_project_visits(text,integer,bigint) to authenticated;

commit;
