BEGIN;

ALTER TABLE inrole.app_users
  ADD CONSTRAINT users_handle_format CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
  ADD CONSTRAINT users_profile_bounds CHECK (char_length(btrim("displayName")) BETWEEN 1 AND 20 AND char_length(bio) <= 200),
  ADD CONSTRAINT users_auth_version_positive CHECK ("authVersion" > 0);

ALTER TABLE inrole.auth_sessions
  ADD CONSTRAINT sessions_token_hash CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT sessions_version_positive CHECK ("authVersion" > 0),
  ADD CONSTRAINT sessions_time_bounds CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '7 days'
    AND "lastSeenAt" >= "createdAt" AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
  );

ALTER TABLE inrole.recovery_codes ADD CONSTRAINT recovery_hash_format CHECK ("codeHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE inrole.rate_limit_buckets
  ADD CONSTRAINT rate_limit_bounds CHECK (count >= 0 AND "expiresAt" > "windowStart" AND char_length(scope) > 0),
  ADD CONSTRAINT rate_limit_hash_format CHECK ("keyHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE inrole.posts
  ADD CONSTRAINT posts_body_bounds CHECK (char_length(body) <= 500),
  ADD CONSTRAINT posts_no_self_quote CHECK ("quotePostId" IS NULL OR "quotePostId" <> id);
ALTER TABLE inrole.comments ADD CONSTRAINT comments_body_bounds CHECK (char_length(body) BETWEEN 1 AND 500 AND char_length(btrim(body)) > 0);
ALTER TABLE inrole.person_reviews
  ADD CONSTRAINT reviews_score_bounds CHECK (score BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_body_bounds CHECK (char_length(body) <= 500);
ALTER TABLE inrole.media_assets
  ADD CONSTRAINT media_size_type CHECK (
    (purpose IN ('POST_IMAGE', 'PERSON_AVATAR') AND "byteSize" BETWEEN 1 AND 5242880 AND mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
    OR (purpose = 'POST_VIDEO' AND "byteSize" BETWEEN 1 AND 31457280 AND mime IN ('video/mp4', 'video/webm'))
  ),
  ADD CONSTRAINT media_dimensions CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0) AND ("durationMs" IS NULL OR "durationMs" > 0));
ALTER TABLE inrole.post_media ADD CONSTRAINT post_media_position CHECK (position BETWEEN 0 AND 5);
ALTER TABLE inrole.polls
  ADD CONSTRAINT polls_question_bounds CHECK (char_length(btrim(question)) BETWEEN 1 AND 100),
  ADD CONSTRAINT polls_duration CHECK ("endsAt" - "createdAt" IN (interval '1 day', interval '3 days', interval '7 days'));
ALTER TABLE inrole.poll_options
  ADD CONSTRAINT poll_option_bounds CHECK (position BETWEEN 0 AND 3 AND char_length(btrim(text)) BETWEEN 1 AND 60 AND char_length(btrim("normalizedText")) BETWEEN 1 AND 60);
ALTER TABLE inrole.character_requests
  ADD CONSTRAINT character_request_input CHECK ((char_length(btrim(name)) > 0 AND char_length(btrim(bio)) > 0) OR "sourceUrl" IS NOT NULL),
  ADD CONSTRAINT character_request_url CHECK ("sourceUrl" IS NULL OR (char_length("sourceUrl") <= 2048 AND "sourceUrl" ~ '^https://(([a-z-]+[.]){0,2}wikipedia[.]org|baike[.]baidu[.]com)/[^[:space:]\\]+$')),
  ADD CONSTRAINT character_request_hash CHECK ("dedupeKey" ~ '^[0-9a-f]{64}$');
ALTER TABLE inrole.content_reports
  ADD CONSTRAINT report_one_target CHECK (num_nonnulls("postId", "commentId", "reviewId") = 1),
  ADD CONSTRAINT report_reason_bounds CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500);
ALTER TABLE inrole.write_requests
  ADD CONSTRAINT write_request_hash CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT write_request_key CHECK (char_length(scope) > 0 AND char_length(key) > 0);
ALTER TABLE inrole.wallets ADD CONSTRAINT wallet_nonnegative CHECK (balance >= 0);
ALTER TABLE inrole.coin_operations
  ADD CONSTRAINT coin_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT coin_operation_shape CHECK (
    (kind = 'DAILY_GRANT' AND amount = 10 AND "recipientId" IS NULL AND "personId" IS NULL AND "postId" IS NULL AND "requestId" IS NULL AND "grantDay" IS NOT NULL AND "grantDay" = ("createdAt" AT TIME ZONE 'Asia/Shanghai')::date)
    OR (kind = 'PERSON_TIP' AND "recipientId" IS NULL AND "personId" IS NOT NULL AND "postId" IS NULL AND "grantDay" IS NULL AND "requestId" IS NOT NULL)
    OR (kind = 'POST_GIFT' AND "recipientId" IS NOT NULL AND "recipientId" <> "actorId" AND "personId" IS NULL AND "postId" IS NOT NULL AND "grantDay" IS NULL AND "requestId" IS NOT NULL)
  );
ALTER TABLE inrole.coin_entries ADD CONSTRAINT coin_delta_nonzero CHECK (delta <> 0);
ALTER TABLE inrole.feed_events ADD CONSTRAINT feed_event_bounds CHECK (position >= 0 AND char_length(kind) > 0 AND char_length("algorithmVersion") > 0);

CREATE FUNCTION inrole.preserve_content_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, inrole AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."authorId" IS DISTINCT FROM OLD."authorId"
     OR NEW."personId" IS DISTINCT FROM OLD."personId" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Published content identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'comments' AND to_jsonb(NEW)->>'postId' IS DISTINCT FROM to_jsonb(OLD)->>'postId' THEN
    RAISE EXCEPTION 'Comment parent is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_preserve_identity BEFORE UPDATE ON inrole.posts FOR EACH ROW EXECUTE FUNCTION inrole.preserve_content_identity();
CREATE TRIGGER comments_preserve_identity BEFORE UPDATE ON inrole.comments FOR EACH ROW EXECUTE FUNCTION inrole.preserve_content_identity();

CREATE FUNCTION inrole.reject_record_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, inrole AS $$
BEGIN
  RAISE EXCEPTION 'This record is immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER polls_immutable BEFORE UPDATE OR DELETE ON inrole.polls FOR EACH ROW EXECUTE FUNCTION inrole.reject_record_change();
CREATE TRIGGER poll_options_immutable BEFORE UPDATE OR DELETE ON inrole.poll_options FOR EACH ROW EXECUTE FUNCTION inrole.reject_record_change();
CREATE TRIGGER coin_operations_immutable BEFORE UPDATE OR DELETE ON inrole.coin_operations FOR EACH ROW EXECUTE FUNCTION inrole.reject_record_change();
CREATE TRIGGER coin_entries_immutable BEFORE UPDATE OR DELETE ON inrole.coin_entries FOR EACH ROW EXECUTE FUNCTION inrole.reject_record_change();

REVOKE ALL ON SCHEMA inrole FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA inrole FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA inrole FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inrole FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA inrole REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA inrole REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA inrole REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA inrole FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA inrole FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA inrole FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inrole FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
