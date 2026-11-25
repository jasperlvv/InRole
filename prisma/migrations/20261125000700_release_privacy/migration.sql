BEGIN;
ALTER TABLE inrole.app_users ADD COLUMN "retiredHandleHash" char(64);
CREATE UNIQUE INDEX "app_users_retiredHandleHash_key" ON inrole.app_users("retiredHandleHash");
CREATE TABLE inrole.user_blocks (
  "userId" uuid NOT NULL REFERENCES inrole.app_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "blockedId" uuid NOT NULL REFERENCES inrole.app_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId","blockedId"),
  CONSTRAINT blocks_no_self CHECK ("userId"<>"blockedId")
);
CREATE INDEX "user_blocks_blockedId_userId_idx" ON inrole.user_blocks("blockedId","userId");

-- Only the migration owner, inside the narrow erasure function, may alter identity.
CREATE OR REPLACE FUNCTION inrole.guard_account_security() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR (NEW.handle IS DISTINCT FROM OLD.handle AND NOT (
    current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='inrole.app_users'::regclass))
    AND current_setting('inrole.erasing_account',true)=OLD.id::text AND NEW.status='CLOSED'
    AND NEW.handle='d_'||left(replace(OLD.id::text,'-',''),18))) THEN
    RAISE EXCEPTION 'Account identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status='CLOSED' AND NEW.status<>'CLOSED' THEN RAISE EXCEPTION 'Closed account cannot reopen' USING ERRCODE='23514'; END IF;
  IF NEW."authVersion"<OLD."authVersion" THEN RAISE EXCEPTION 'Authentication version cannot decrease' USING ERRCODE='23514'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'ACTIVE' THEN NEW."authVersion":=greatest(NEW."authVersion",OLD."authVersion"+1); END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION inrole.reserve_retired_handle() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('handle:'||NEW.handle,0));
  IF EXISTS(SELECT 1 FROM inrole.app_users WHERE "retiredHandleHash"=encode(sha256(convert_to(NEW.handle,'UTF8')),'hex')) THEN
    RAISE EXCEPTION 'Handle is reserved' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reserve_retired_handle BEFORE INSERT ON inrole.app_users FOR EACH ROW EXECUTE FUNCTION inrole.reserve_retired_handle();

CREATE FUNCTION inrole.erasing_post(p_post uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,inrole AS $$
  SELECT current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='inrole.app_users'::regclass))
    AND EXISTS(SELECT 1 FROM inrole.posts p JOIN inrole.app_users u ON u.id=p."authorId"
      WHERE p.id=p_post AND u.status='CLOSED' AND u.id::text=current_setting('inrole.erasing_account',true))
$$;
CREATE OR REPLACE FUNCTION inrole.guard_poll_seal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF TG_OP='DELETE' AND inrole.erasing_post(OLD."postId") THEN RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND NOT OLD.sealed AND NEW.sealed AND (to_jsonb(NEW)-'sealed')=(to_jsonb(OLD)-'sealed') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Published poll is immutable' USING ERRCODE='23514';
END $$;
CREATE OR REPLACE FUNCTION inrole.reject_record_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF TG_TABLE_NAME='poll_options' AND TG_OP='DELETE' AND inrole.erasing_post((to_jsonb(OLD)->>'postId')::uuid) THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME='moderation_actions' AND TG_OP='UPDATE'
    AND current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='inrole.app_users'::regclass))
    AND current_setting('inrole.erasing_account',true)=to_jsonb(OLD)->>'actorId'
    AND (to_jsonb(OLD)-'reason'-'previousState'-'nextState')=(to_jsonb(NEW)-'reason'-'previousState'-'nextState')
    AND to_jsonb(NEW)->>'reason'='[账号已注销]' AND to_jsonb(NEW)->'previousState'='{}'::jsonb AND to_jsonb(NEW)->'nextState'='{}'::jsonb THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Record is immutable' USING ERRCODE='23514';
END $$;

CREATE FUNCTION inrole.erase_own_account(p_actor uuid,p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,inrole AS $$
DECLARE old_handle text;
BEGIN
  SELECT handle INTO old_handle FROM inrole.app_users WHERE id=p_actor AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM inrole.auth_sessions s JOIN inrole.app_users u ON u.id=s."userId"
    WHERE s."userId"=p_actor AND s."tokenHash"=p_hash AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."authVersion"=u."authVersion") THEN
    RAISE EXCEPTION 'Invalid erasure session' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('handle:'||old_handle,0));
  PERFORM set_config('inrole.erasing_account',p_actor::text,true);
  UPDATE inrole.app_users SET status='CLOSED',handle='d_'||left(replace(id::text,'-',''),18),"retiredHandleHash"=encode(sha256(convert_to(old_handle,'UTF8')),'hex'),"displayName"='已注销用户',bio='',"onboardingCompletedAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=p_actor;
  DELETE FROM inrole.password_credentials WHERE "userId"=p_actor;
  DELETE FROM inrole.auth_sessions WHERE "userId"=p_actor;
  DELETE FROM inrole.recovery_codes WHERE "userId"=p_actor;
  DELETE FROM inrole.user_interests WHERE "userId"=p_actor;
  DELETE FROM inrole.user_recent_people WHERE "userId"=p_actor;
  DELETE FROM inrole.user_blocks WHERE "userId"=p_actor OR "blockedId"=p_actor;
  DELETE FROM inrole.post_likes WHERE "userId"=p_actor;
  DELETE FROM inrole.poll_votes WHERE "userId"=p_actor OR "postId" IN (SELECT id FROM inrole.posts WHERE "authorId"=p_actor);
  DELETE FROM inrole.poll_options WHERE "postId" IN (SELECT id FROM inrole.posts WHERE "authorId"=p_actor);
  DELETE FROM inrole.polls WHERE "postId" IN (SELECT id FROM inrole.posts WHERE "authorId"=p_actor);
  UPDATE inrole.posts SET visibility='DELETED',body='',"quotePostId"=NULL,"updatedAt"=clock_timestamp() WHERE "authorId"=p_actor;
  UPDATE inrole.comments SET visibility='DELETED',body='[账号已注销]',"updatedAt"=clock_timestamp() WHERE "authorId"=p_actor;
  UPDATE inrole.person_reviews SET visibility='DELETED',body='' WHERE "userId"=p_actor;
  DELETE FROM inrole.post_topics WHERE "postId" IN (SELECT id FROM inrole.posts WHERE "authorId"=p_actor);
  DELETE FROM inrole.post_media WHERE "postId" IN (SELECT id FROM inrole.posts WHERE "authorId"=p_actor);
  UPDATE inrole.media_assets SET "ownerId"=NULL,status='DELETED',"originalName"='[已删除]',"updatedAt"=clock_timestamp() WHERE "ownerId"=p_actor AND purpose<>'PERSON_AVATAR';
  UPDATE inrole.media_assets SET "ownerId"=NULL,"originalName"='公共人物头像' WHERE "ownerId"=p_actor AND purpose='PERSON_AVATAR';
  UPDATE inrole.character_requests SET name='[已删除]',bio='[已删除]',"sourceUrl"=NULL,"reviewNote"=NULL WHERE "userId"=p_actor;
  UPDATE inrole.content_reports SET reason='[账号已注销]' WHERE "reporterId"=p_actor;
  UPDATE inrole.moderation_actions SET reason='[账号已注销]',"previousState"='{}',"nextState"='{}' WHERE "actorId"=p_actor;
  DELETE FROM inrole.feed_events WHERE "userId"=p_actor;
  DELETE FROM inrole.write_requests WHERE "userId"=p_actor;
  PERFORM set_config('inrole.erasing_account','',true);
END $$;
REVOKE ALL ON FUNCTION inrole.erase_own_account(uuid,text),inrole.erasing_post(uuid),inrole.reserve_retired_handle() FROM PUBLIC;
COMMIT;
