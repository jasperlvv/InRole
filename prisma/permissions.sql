-- Run as the migration owner after set_config('inrole.app_role', role, false).
-- S12 will add controlled ledger functions. Direct financial writes stay closed.
DO $$
DECLARE
  app_role text := current_setting('inrole.app_role');
  table_name text;
BEGIN
  IF app_role = current_user OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'Expected a separate restricted application role';
  END IF;
  EXECUTE format('REVOKE ALL ON SCHEMA inrole FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA inrole FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA inrole FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inrole FROM %I', app_role);
  EXECUTE format('GRANT USAGE ON SCHEMA inrole TO %I', app_role);
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'inrole' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('GRANT SELECT ON TABLE inrole.%I TO %I', table_name, app_role);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['password_credentials','auth_sessions','rate_limit_buckets','user_interests','user_recent_people','post_likes'] LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE inrole.%I TO %I', table_name, app_role);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['posts','comments','person_reviews','media_assets','character_requests','write_requests'] LOOP
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE inrole.%I TO %I', table_name, app_role);
  END LOOP;
  EXECUTE format('GRANT INSERT ON TABLE inrole.polls, inrole.poll_options, inrole.poll_votes, inrole.post_media, inrole.post_topics, inrole.content_reports, inrole.feed_events TO %I', app_role);
  EXECUTE format('GRANT INSERT (id, handle, "displayName", bio, "onboardingCompletedAt", "createdAt", "updatedAt") ON inrole.app_users TO %I', app_role);
  EXECUTE format('GRANT UPDATE ("displayName", bio, "onboardingCompletedAt", "authVersion", "updatedAt") ON inrole.app_users TO %I', app_role);
  EXECUTE format('GRANT INSERT ("userId", "updatedAt") ON inrole.wallets TO %I', app_role);
END $$;
