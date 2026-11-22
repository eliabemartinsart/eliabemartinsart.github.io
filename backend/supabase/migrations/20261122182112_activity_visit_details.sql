begin;

create function portfolio_private.admin_activity_visits(
 p_kind text,p_subject text default '',p_days integer default 30,p_before_visit_id bigint default null
)returns jsonb language plpgsql security definer set search_path='' as $$
declare since_at timestamptz; result jsonb;
begin
 if not portfolio_private.is_site_admin()then raise exception 'Access denied'using errcode='42501';end if;
 if p_kind is null or p_kind not in('section','contact','source','day','hour','all','visit')
  or p_subject is null or char_length(p_subject)>100 or p_days is null or p_days not in(1,7,30)
  or p_before_visit_id<=0 then raise exception 'Invalid request'using errcode='22023';end if;
 if (p_kind='section'and p_subject not in('inicio','projetos','sobre','ferramentas','reconhecimentos','contato','competencias'))
  or(p_kind='contact'and p_subject not in('email','whatsapp','all'))
  or(p_kind='source'and p_subject='')
  or(p_kind='day'and p_subject!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  or(p_kind='hour'and p_subject!~'^([0-9]|1[0-9]|2[0-3])$')
  or(p_kind='visit'and p_subject!~'^[1-9][0-9]{0,14}$')
  then raise exception 'Invalid filter'using errcode='22023';end if;
 if p_kind='day'then
  begin perform p_subject::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Invalid date'using errcode='22023';end;
 end if;
 since_at:=now()-make_interval(days=>p_days);
 with selected_events as materialized(
  select e.* from portfolio_private.site_events e where e.occurred_at>=since_at and(
   (p_kind='section'and((e.kind='section_view'and e.subject=p_subject)or(e.kind='engagement'and e.subject='section:'||p_subject)))
   or(p_kind='contact'and e.kind='contact_click'and(p_subject='all'or e.subject=p_subject))
   or p_kind in('source','day','hour','all','visit'))
 ),activity as materialized(
  select v.id as visit_id,
   case when p_kind in('section','contact')then min(e.occurred_at)else v.occurred_at end as first_at,
   coalesce(max(e.occurred_at),v.occurred_at)as last_at,
   count(e.id)as events_count,
   count(e.id)filter(where e.kind='section_view')as views,
   count(e.id)filter(where e.kind='project_open')as opens,
   count(e.id)filter(where e.kind in('contact_click','project_link'))as clicks,
   sum(e.seconds)filter(where e.kind='engagement')as active_seconds
  from portfolio_private.site_visits v left join selected_events e on e.visit_id=v.id
  where case
   when p_kind in('section','contact')then e.id is not null
   when p_kind='visit'then v.id=p_subject::bigint and(v.occurred_at>=since_at or e.id is not null)
   else v.occurred_at>=since_at and case
    when p_kind='source'then coalesce(v.source,'Não registrado')=p_subject
    when p_kind='day'then(v.occurred_at at time zone 'America/Fortaleza')::date=p_subject::date
    when p_kind='hour'then extract(hour from(v.occurred_at at time zone 'America/Fortaleza'))=p_subject::integer
    else true end end
  group by v.id
 ),page as(
  select a.* from activity a where p_before_visit_id is null or a.visit_id<p_before_visit_id order by a.visit_id desc limit 50
 ),details as(
  select p.visit_id,jsonb_build_object(
   'visit_id',p.visit_id,'first_at',p.first_at,'last_at',p.last_at,
   'ip',host(v.ip),'city',l.city,'region',l.region,'country',l.country,
   'device',v.device_type,'os',v.os,'browser',v.browser,'source',v.source,
   'vpn',n.vpn,'proxy',n.proxy,'tor',n.tor,'network_checked_at',n.checked_at,
   'views',p.views,'opens',p.opens,'clicks',p.clicks,'active_seconds',p.active_seconds,'events_count',p.events_count
  )as item from page p join portfolio_private.site_visits v on v.id=p.visit_id
  left join portfolio_private.site_ip_locations l on l.ip=v.ip left join portfolio_private.site_ip_networks n on n.ip=v.ip
 )select jsonb_build_object(
  'kind',p_kind,'subject',p_subject,'total_visits',(select count(*)from activity),
  'unique_ips',(select count(distinct v.ip)from activity a join portfolio_private.site_visits v on v.id=a.visit_id),
  'views',(select coalesce(sum(views),0)from activity),'opens',(select coalesce(sum(opens),0)from activity),
  'clicks',(select coalesce(sum(clicks),0)from activity),'active_seconds',(select sum(active_seconds)from activity),
  'unmeasured_visits',(select count(*)from activity where active_seconds is null),
  'visits',coalesce((select jsonb_agg(item order by visit_id desc)from details),'[]'::jsonb),
  'next_cursor',(select case when count(*)=50 then min(visit_id)else null end from page)
 )into result;
 return result;
end;$$;
revoke all on function portfolio_private.admin_activity_visits(text,text,integer,bigint)from public,anon;
grant execute on function portfolio_private.admin_activity_visits(text,text,integer,bigint)to authenticated;
create function public.admin_activity_visits(p_kind text,p_subject text default '',p_days integer default 30,p_before_visit_id bigint default null)
returns jsonb language sql security invoker set search_path='' as $$select portfolio_private.admin_activity_visits(p_kind,p_subject,p_days,p_before_visit_id);$$;
revoke all on function public.admin_activity_visits(text,text,integer,bigint)from public,anon;
grant execute on function public.admin_activity_visits(text,text,integer,bigint)to authenticated;

create function portfolio_private.admin_visit_events(p_visit_id bigint,p_days integer default 30,p_before_event_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare since_at timestamptz; result jsonb;
begin
 if not portfolio_private.is_site_admin()then raise exception 'Access denied'using errcode='42501';end if;
 if p_visit_id is null or p_visit_id<=0 or p_days is null or p_days not in(1,7,30)or p_before_event_id<=0 then raise exception 'Invalid request'using errcode='22023';end if;
 since_at:=now()-make_interval(days=>p_days);
 with page as(
  select e.id,e.occurred_at,e.kind,e.subject,e.seconds from portfolio_private.site_events e
  where e.visit_id=p_visit_id and e.occurred_at>=since_at and(p_before_event_id is null or e.id<p_before_event_id)
  order by e.id desc limit 50
 )select jsonb_build_object(
  'visit',(select jsonb_build_object('visit_id',v.id,'ip',host(v.ip),'at',v.occurred_at,'device',v.device_type,'os',v.os,'browser',v.browser,'source',v.source)from portfolio_private.site_visits v where v.id=p_visit_id and(v.occurred_at>=since_at or exists(select 1 from page))),
  'total_events',(select count(*)from portfolio_private.site_events e where e.visit_id=p_visit_id and e.occurred_at>=since_at),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'at',occurred_at,'kind',kind,'subject',subject,'seconds',case when kind='engagement'then seconds else null end)order by id desc)from page),'[]'::jsonb),
  'next_cursor',(select case when count(*)=50 then min(id)else null end from page)
 )into result;
 return result;
end;$$;
revoke all on function portfolio_private.admin_visit_events(bigint,integer,bigint)from public,anon;
grant execute on function portfolio_private.admin_visit_events(bigint,integer,bigint)to authenticated;
create function public.admin_visit_events(p_visit_id bigint,p_days integer default 30,p_before_event_id bigint default null)
returns jsonb language sql security invoker set search_path='' as $$select portfolio_private.admin_visit_events(p_visit_id,p_days,p_before_event_id);$$;
revoke all on function public.admin_visit_events(bigint,integer,bigint)from public,anon;
grant execute on function public.admin_visit_events(bigint,integer,bigint)to authenticated;

commit;
