BEGIN;
CREATE FUNCTION inrole.admin_user_status(p_actor uuid,p_target uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,inrole AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM inrole.app_users WHERE id=p_actor AND role='ADMIN' AND status='ACTIVE') OR p_actor=p_target OR p_status NOT IN ('ACTIVE','BANNED') THEN
    RAISE EXCEPTION 'Invalid administration request' USING ERRCODE='42501';
  END IF;
  UPDATE inrole.app_users SET status=p_status::inrole."UserStatus","updatedAt"=clock_timestamp() WHERE id=p_target AND role='USER';
  IF NOT FOUND THEN RAISE EXCEPTION 'Target unavailable' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION inrole.admin_user_status(uuid,uuid,text) FROM PUBLIC;
CREATE TRIGGER moderation_actions_immutable BEFORE UPDATE OR DELETE ON inrole.moderation_actions FOR EACH ROW EXECUTE FUNCTION inrole.reject_record_change();
COMMIT;
