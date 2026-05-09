-- Enable scheduled jobs + async HTTP for invoking Edge Functions from the DB
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule reminder check every 30 minutes.
-- The service role key is stored in supabase_vault under the name 'service_role_key'
-- (created out-of-band via vault.create_secret(); see project notes — NOT in this migration
-- because the secret value must not be committed to the repo).
select cron.schedule(
  'send-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://buwndwwnnamyjzpcoyih.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
