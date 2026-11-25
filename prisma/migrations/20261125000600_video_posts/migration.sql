BEGIN;
CREATE OR REPLACE FUNCTION inrole.check_community_post() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,inrole AS $$
DECLARE target uuid; item record; option_count integer; first_position integer; last_position integer;
BEGIN
  IF TG_TABLE_NAME='posts' THEN target:=COALESCE(NEW.id,OLD.id); ELSE target:=COALESCE(NEW."postId",OLD."postId"); END IF;
  SELECT * INTO item FROM inrole.posts WHERE id=target;
  IF NOT FOUND OR item.visibility<>'VISIBLE' THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM inrole.post_topics WHERE "postId"=target)>3 THEN RAISE EXCEPTION 'Too many topics' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM inrole.post_media WHERE "postId"=target)>6 THEN RAISE EXCEPTION 'Too many images' USING ERRCODE='23514'; END IF;
  IF btrim(item.body)='' AND item."quotePostId" IS NULL AND NOT EXISTS(SELECT 1 FROM inrole.post_media WHERE "postId"=target) AND NOT EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target) THEN RAISE EXCEPTION 'Empty post' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM inrole.post_media pm JOIN inrole.media_assets m ON m.id=pm."mediaId" WHERE pm."postId"=target AND (m."ownerId" IS DISTINCT FROM item."authorId" OR m.purpose NOT IN ('POST_IMAGE','POST_VIDEO'))) THEN RAISE EXCEPTION 'Media ownership or purpose mismatch' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM inrole.post_media pm JOIN inrole.media_assets m ON m.id=pm."mediaId" WHERE pm."postId"=target AND m.purpose='POST_VIDEO') AND (SELECT count(*) FROM inrole.post_media WHERE "postId"=target)<>1 THEN RAISE EXCEPTION 'Video must be single attachment' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target) THEN
    SELECT count(*),min(position),max(position) INTO option_count,first_position,last_position FROM inrole.poll_options WHERE "postId"=target;
    IF option_count NOT BETWEEN 2 AND 4 OR first_position<>0 OR last_position<>option_count-1 OR NOT EXISTS(SELECT 1 FROM inrole.polls WHERE "postId"=target AND sealed) THEN RAISE EXCEPTION 'Poll must have 2-4 sealed options' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;

COMMIT;
