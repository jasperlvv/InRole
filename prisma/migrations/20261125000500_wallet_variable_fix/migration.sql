BEGIN;
CREATE OR REPLACE FUNCTION inrole.spend_coins(p_actor uuid,p_person varchar,p_post uuid,p_amount bigint,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,inrole AS $$
DECLARE op uuid:=gen_random_uuid(); recipient uuid; actor_balance bigint;
BEGIN
  IF p_amount<1 OR p_amount>1000000 OR (p_person IS NULL)=(p_post IS NULL) THEN RAISE EXCEPTION 'Invalid spend' USING ERRCODE='23514'; END IF;
  PERFORM id FROM inrole.app_users WHERE id=p_actor AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='23514'; END IF;
  PERFORM id FROM inrole.write_requests WHERE id=p_request AND "userId"=p_actor AND status='IN_PROGRESS';
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing request' USING ERRCODE='23514'; END IF;
  IF p_person IS NOT NULL THEN
    PERFORM p.id FROM inrole.people p JOIN inrole.interest_tags i ON i.id=p."primaryInterestId" WHERE p.id=p_person AND p.active AND i.active FOR SHARE OF p,i;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable person' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT "authorId" INTO recipient FROM inrole.posts WHERE id=p_post AND visibility='VISIBLE' FOR SHARE;
    IF recipient IS NULL OR recipient=p_actor THEN RAISE EXCEPTION 'Unavailable recipient' USING ERRCODE='23514'; END IF;
  END IF;
  -- Consistent order prevents opposite-direction gift deadlocks.
  PERFORM "userId" FROM inrole.wallets WHERE "userId"=p_actor OR "userId"=recipient ORDER BY "userId" FOR UPDATE;
  SELECT w.balance INTO actor_balance FROM inrole.wallets w WHERE "userId"=p_actor;
  IF actor_balance IS NULL OR actor_balance<p_amount THEN RAISE EXCEPTION 'Insufficient balance' USING ERRCODE='P0002'; END IF;
  INSERT INTO inrole.coin_operations(id,kind,"actorId","recipientId","personId","postId",amount,"requestId")
    VALUES(op,CASE WHEN p_person IS NULL THEN 'POST_GIFT'::inrole."CoinOperationKind" ELSE 'PERSON_TIP'::inrole."CoinOperationKind" END,p_actor,recipient,p_person,p_post,p_amount,p_request);
  UPDATE inrole.wallets SET balance=balance-p_amount,"updatedAt"=clock_timestamp() WHERE "userId"=p_actor;
  INSERT INTO inrole.coin_entries(id,"operationId","userId",delta) VALUES(gen_random_uuid(),op,p_actor,-p_amount);
  IF recipient IS NOT NULL THEN
    UPDATE inrole.wallets SET balance=balance+p_amount,"updatedAt"=clock_timestamp() WHERE "userId"=recipient;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing recipient wallet' USING ERRCODE='23514'; END IF;
    INSERT INTO inrole.coin_entries(id,"operationId","userId",delta) VALUES(gen_random_uuid(),op,recipient,p_amount);
  END IF;
  RETURN op;
END $$;

COMMIT;
