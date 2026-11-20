begin;
do $test$
declare owner_id uuid;session_id uuid;current_doc jsonb;draft_doc jsonb;rev integer;token uuid:='b832b7d2-12be-4a6d-a3dc-a85ce20a758b';event_id uuid:='b832b7d2-12be-4a6d-a3dc-a85ce20a758c';n integer;seconds_before integer;initial_count integer;
begin
 select s.user_id,s.id into owner_id,session_id from auth.sessions s join portfolio_private.site_admins a on a.user_id=s.user_id where(s.not_after is null or s.not_after>now())order by s.created_at desc limit 1;
 if owner_id is null then raise exception 'Owner session required for integration test';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal1','session_id',session_id)::text,true);
 if not portfolio_private.is_site_admin()then raise exception 'Owner denied';end if;
 initial_count:=jsonb_array_length(public.get_portfolio_content()->'content'->'projects');current_doc:=public.admin_portfolio_content();rev:=(current_doc->>'revision')::integer;
 draft_doc:=jsonb_set(current_doc->'draft','{projects,0,title}','"DRAFT ONLY TEST"'::jsonb);
 perform public.save_portfolio_content(draft_doc,rev,false);
 if public.get_portfolio_content()->'content'->'projects'->0->>'title'='DRAFT ONLY TEST'then raise exception 'Draft leaked publicly';end if;
 begin perform public.save_portfolio_content(draft_doc,rev,false);raise exception 'Revision conflict not enforced';exception when serialization_failure then null;end;
 draft_doc:=jsonb_set(draft_doc,'{projects,0,link}','"javascript:alert(1)"'::jsonb);
 begin perform public.save_portfolio_content(draft_doc,rev+1,true);raise exception 'Unsafe URL accepted';exception when invalid_parameter_value then null;end;
 
 draft_doc:=jsonb_set(current_doc->'draft','{projects,0,title}','"PUBLISHED TEST"'::jsonb);
 perform public.save_portfolio_content(draft_doc,rev+1,true);
 if public.get_portfolio_content()->'content'->'projects'->0->>'title'<>'PUBLISHED TEST'then raise exception 'Publish did not update public catalog';end if;
 draft_doc:=jsonb_set(draft_doc,'{projects,0,visible}','false'::jsonb);
 perform public.save_portfolio_content(draft_doc,rev+2,true);
 if jsonb_array_length(public.get_portfolio_content()->'content'->'projects')<>initial_count-1 then raise exception 'Hidden project leaked';end if;
 perform public.save_portfolio_content(current_doc->'draft',rev+3,true);

 if not public.begin_site_visit('192.0.2.201','computer','Windows','Chrome','Instagram',token)then raise exception 'Visit start failed';end if;
 n:=public.record_site_events('192.0.2.201',token,jsonb_build_array(jsonb_build_object('id',event_id,'kind','project_open','subject','babacu','seconds',0),jsonb_build_object('id','b832b7d2-12be-4a6d-a3dc-a85ce20a758d','kind','engagement','subject','babacu','seconds',30)));
 if n<>2 then raise exception 'Events not accepted: %',n;end if;
 if public.record_site_events('192.0.2.201',token,jsonb_build_array(jsonb_build_object('id',event_id,'kind','project_open','subject','babacu','seconds',0)))<>0 then raise exception 'Duplicate event counted';end if;
 if public.record_site_events('192.0.2.202',token,'[]')<>0 then raise exception 'Wrong-IP token accepted';end if;
 select active_seconds into seconds_before from portfolio_private.site_visits where event_token=token;
 if seconds_before>15 then raise exception 'Duration exceeded wall clock cap';end if;
 if(public.admin_analytics_summary(30)->>'tracked_visits')::integer<1 then raise exception 'Summary missed tracked visit';end if;
 if jsonb_array_length(public.admin_analytics_summary(30)->'hourly')<>24 then raise exception 'Hour chart incomplete';end if;
 if not exists(select 1 from jsonb_array_elements(public.admin_analytics_summary(30)->'projects')p where p->>'id'='babacu'and(p->>'opens')::integer>=1)then raise exception 'Project opens missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal1','session_id','00000000-0000-4000-8000-000000000099')::text,true);
 if portfolio_private.is_site_admin()then raise exception 'Invalid session authorized';end if;
 begin perform public.admin_analytics_summary(30);raise exception 'Revoked session read summary';exception when insufficient_privilege then null;end;
 begin perform public.save_portfolio_content(current_doc->'draft',rev,false);raise exception 'Revoked session edited CMS';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims','{}',true);
 execute 'set local role anon';
 begin perform public.admin_portfolio_content();raise exception 'Anonymous draft read';exception when insufficient_privilege then null;end;
 begin perform public.admin_analytics_summary(30);raise exception 'Anonymous analytics read';exception when insufficient_privilege then null;end;
 begin perform public.save_portfolio_content('{}',1,true);raise exception 'Anonymous CMS write';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.get_portfolio_content()->'content'->'projects')<>initial_count then raise exception 'Public project catalog broken';end if;
 execute 'reset role';
end;$test$;
select 'PASS: private CMS, draft separation, revision conflicts, URL validation, project events, deduplication, duration cap, chart buckets, revoked sessions and anonymous denial' as tests;
rollback;