-- Execute as a project administrator. No object or file is retained: all changes are rolled back.
begin;
do $test$
declare owner_id uuid;sid uuid;
begin
 select s.user_id,s.id into owner_id,sid from auth.sessions s join portfolio_private.site_admins a on a.user_id=s.user_id where(s.not_after is null or s.not_after>now())order by s.created_at desc limit 1;
 if owner_id is null then raise exception 'Owner session required';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal1','session_id',sid)::text,true);
 execute 'set local role authenticated';
 insert into storage.objects(bucket_id,name)values('portfolio-media',owner_id::text||'/01234567-89ab-4cde-8fab-0123456789ab.webp');
 begin insert into storage.objects(bucket_id,name)values('portfolio-media','00000000-0000-4000-8000-000000000001/01234567-89ab-4cde-8fab-0123456789ab.webp');raise exception 'Wrong folder allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';perform set_config('request.jwt.claims','{}',true);execute 'set local role anon';
 begin insert into storage.objects(bucket_id,name)values('portfolio-media','00000000-0000-4000-8000-000000000001/01234567-89ab-4cde-8fab-0123456789ab.webp');raise exception 'Anonymous upload allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
end;$test$;
select 'PASS: owner-only uploads and namespace isolation' as tests;
rollback;
