BEGIN;
ALTER TABLE inrole.polls ADD COLUMN sealed boolean NOT NULL DEFAULT false;
DROP TRIGGER polls_immutable ON inrole.polls;
CREATE FUNCTION inrole.guard_poll_seal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF TG_OP='UPDATE' AND NOT OLD.sealed AND NEW.sealed AND (to_jsonb(NEW)-'sealed')=(to_jsonb(OLD)-'sealed') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Published poll is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER polls_seal_guard BEFORE UPDATE OR DELETE ON inrole.polls FOR EACH ROW EXECUTE FUNCTION inrole.guard_poll_seal();
CREATE FUNCTION inrole.guard_poll_option_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
DECLARE closed boolean;
BEGIN
  SELECT sealed INTO closed FROM inrole.polls WHERE "postId"=NEW."postId" FOR UPDATE;
  IF closed THEN RAISE EXCEPTION 'Cannot append options to a published poll' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER poll_option_insert_guard BEFORE INSERT ON inrole.poll_options FOR EACH ROW EXECUTE FUNCTION inrole.guard_poll_option_insert();
CREATE FUNCTION inrole.check_community_post() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
DECLARE target uuid; item record; option_count integer; first_position integer; last_position integer;
BEGIN
  IF TG_TABLE_NAME='posts' THEN target:=COALESCE(NEW.id,OLD.id); ELSE target:=COALESCE(NEW."postId",OLD."postId"); END IF;
  SELECT * INTO item FROM inrole.posts WHERE id=target;
  IF NOT FOUND OR item.visibility<>'VISIBLE' THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM inrole.post_topics WHERE "postId"=target)>3 THEN RAISE EXCEPTION 'Too many topics' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM inrole.post_media WHERE "postId"=target)>6 THEN RAISE EXCEPTION 'Too many images' USING ERRCODE='23514'; END IF;
  IF btrim(item.body)='' AND item."quotePostId" IS NULL AND NOT EXISTS(SELECT 1 FROM inrole.post_media WHERE "postId"=target) AND NOT EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target) THEN RAISE EXCEPTION 'Empty post' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM inrole.post_media pm JOIN inrole.media_assets m ON m.id=pm."mediaId" WHERE pm."postId"=target AND (m."ownerId" IS DISTINCT FROM item."authorId" OR m.purpose<>'POST_IMAGE')) THEN RAISE EXCEPTION 'Media ownership or purpose mismatch' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target) THEN
    SELECT count(*),min(position),max(position) INTO option_count,first_position,last_position FROM inrole.poll_options WHERE "postId"=target;
    IF option_count NOT BETWEEN 2 AND 4 OR first_position<>0 OR last_position<>option_count-1 OR NOT EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target AND sealed) THEN RAISE EXCEPTION 'Poll must have 2-4 sealed options' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER post_complete AFTER INSERT OR UPDATE ON inrole.posts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_community_post();
CREATE CONSTRAINT TRIGGER topic_count_complete AFTER INSERT OR UPDATE OR DELETE ON inrole.post_topics DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_community_post();
CREATE CONSTRAINT TRIGGER media_count_complete AFTER INSERT OR UPDATE OR DELETE ON inrole.post_media DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_community_post();
CREATE CONSTRAINT TRIGGER poll_complete AFTER INSERT OR UPDATE ON inrole.polls DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_community_post();
CREATE CONSTRAINT TRIGGER poll_options_complete AFTER INSERT ON inrole.poll_options DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_community_post();
CREATE FUNCTION inrole.check_interest_count() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF (SELECT count(*) FROM inrole.user_interests WHERE "userId"=NEW."userId")>5 THEN RAISE EXCEPTION 'Too many interests' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER user_interest_count AFTER INSERT OR UPDATE ON inrole.user_interests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inrole.check_interest_count();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inrole FROM PUBLIC;
COMMIT;
