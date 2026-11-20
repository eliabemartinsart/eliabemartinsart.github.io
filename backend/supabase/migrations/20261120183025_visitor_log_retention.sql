create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('portfolio-visit-retention','0 6 * * *','select portfolio_private.purge_site_visits();');
