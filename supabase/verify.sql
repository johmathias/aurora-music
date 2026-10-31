-- Run this AFTER schema.sql to confirm the database is set up and locked down.
-- Every row in the result should say  OK.
select 'table ' || t as check,
       case when exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then 'OK' else 'MISSING - run schema.sql' end as result
from (values ('zero_records'), ('push_subscriptions'), ('push_queue')) v(t)
union all
select 'row level security on ' || t,
       case when (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then 'OK' else 'OFF - DANGEROUS, run schema.sql again' end
from (values ('zero_records'), ('push_subscriptions'), ('push_queue')) v(t)
union all
select 'policies on ' || t,
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = t) >= 1 then 'OK' else 'MISSING' end
from (values ('zero_records'), ('push_subscriptions'), ('push_queue')) v(t)
union all
select 'anon (signed-out) cannot read ' || t,
       case when has_table_privilege('anon', 'public.' || t, 'select') then 'EXPOSED - run schema.sql again' else 'OK' end
from (values ('zero_records'), ('push_subscriptions'), ('push_queue')) v(t)
union all
select 'extension pg_cron (needed for push)', case when exists (select 1 from pg_extension where extname = 'pg_cron') then 'OK' else 'not on yet - only needed for push, see cron.sql' end
union all
select 'extension pg_net (needed for push)',  case when exists (select 1 from pg_extension where extname = 'pg_net')  then 'OK' else 'not on yet - only needed for push, see cron.sql' end;
