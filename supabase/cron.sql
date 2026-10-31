-- Makes Supabase check for due alerts every minute and call the send-push function.
-- Run this ONCE, after you have deployed the send-push function (see README, step 4).
--
-- BEFORE RUNNING: replace the two placeholders below
--     YOUR_PROJECT_REF   -> the part of your Supabase URL before ".supabase.co"
--     YOUR_CRON_SECRET   -> any long random text you made up (the SAME text you saved as the CRON_SECRET secret)
-- Do this in the SQL editor only. Do not save the edited version into the project or GitHub.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'zero-os-send-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- To stop it later:   select cron.unschedule('zero-os-send-push');
-- To see it running:  select * from cron.job_run_details order by start_time desc limit 10;
