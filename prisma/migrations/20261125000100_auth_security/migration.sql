BEGIN;

ALTER TABLE inrole.password_credentials ADD CONSTRAINT password_argon2id_format
  CHECK ("passwordHash" ~ '^\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]{16,}\$[A-Za-z0-9+/]{32,}$');

CREATE FUNCTION inrole.guard_account_security() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, inrole AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.handle IS DISTINCT FROM OLD.handle THEN
    RAISE EXCEPTION 'Account identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."authVersion" < OLD."authVersion" THEN
    RAISE EXCEPTION 'Authentication version cannot decrease' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'ACTIVE' THEN
    NEW."authVersion" := greatest(NEW."authVersion", OLD."authVersion" + 1);
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION inrole.revoke_changed_account_sessions() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, inrole AS $$
BEGIN
  IF NEW."authVersion" IS DISTINCT FROM OLD."authVersion" OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'ACTIVE') THEN
    UPDATE inrole.auth_sessions SET "revokedAt" = clock_timestamp()
      WHERE "userId" = NEW.id AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_security_guard BEFORE UPDATE ON inrole.app_users
  FOR EACH ROW EXECUTE FUNCTION inrole.guard_account_security();
CREATE TRIGGER account_security_revoke AFTER UPDATE ON inrole.app_users
  FOR EACH ROW EXECUTE FUNCTION inrole.revoke_changed_account_sessions();
REVOKE ALL ON FUNCTION inrole.guard_account_security(), inrole.revoke_changed_account_sessions() FROM PUBLIC;

COMMIT;
