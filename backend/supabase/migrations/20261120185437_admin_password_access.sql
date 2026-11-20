-- Owner-requested password-only access. Keep allowlist and live-session validation.
begin;
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
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'at',v.occurred_at,'ip',host(v.ip)) order by v.id desc),'[]'::jsonb),
    case when count(*)=50 then min(v.id) else null end
  into v_visits,v_next
  from (select id,occurred_at,ip from portfolio_private.site_visits
    where occurred_at >= v_since and (p_before_id is null or id < p_before_id)
    order by id desc limit 50) v;
  return jsonb_build_object('total',v_total,'unique_ips',v_unique,'latest',v_latest,'visits',v_visits,'next_cursor',v_next);
end;
$$;
commit;
