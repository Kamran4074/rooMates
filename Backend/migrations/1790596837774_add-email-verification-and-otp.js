/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn("users", {
    email_verified: { type: "boolean", notNull: true, default: false },
  });
  // Google already verifies email ownership as part of its own OAuth flow -
  // no reason to make a Google user re-verify with us.
  pgm.sql(`UPDATE users SET email_verified = true WHERE google_id IS NOT NULL;`);

  // One table, not two: signup verification and password reset are the same
  // shape (a short-lived, single-use, hashed code tied to a user), so
  // "purpose" is a discriminant column instead of a duplicated table.
  pgm.createTable("otp_codes", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    purpose: { type: "text", notNull: true },
    code_hash: { type: "text", notNull: true },
    attempts: { type: "integer", notNull: true, default: 0 },
    expires_at: { type: "timestamptz", notNull: true },
    consumed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint(
    "otp_codes",
    "otp_codes_purpose_check",
    "CHECK (purpose IN ('email_verification', 'password_reset'))"
  );
  pgm.createIndex("otp_codes", ["user_id", "purpose"]);

  // find_or_create_google_user: mark Google signups as already verified.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION find_or_create_google_user(
      p_google_id text, p_email text, p_name text, p_picture text
    ) RETURNS TABLE(user_id uuid, organization_id uuid, onboarding_completed boolean) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
      v_onboarding_completed boolean;
    BEGIN
      SELECT users.id, users.organization_id, users.onboarding_completed
        INTO v_user_id, v_org_id, v_onboarding_completed
        FROM users WHERE google_id = p_google_id;

      IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_org_id, v_onboarding_completed;
        RETURN;
      END IF;

      v_org_id := gen_random_uuid();
      v_user_id := gen_random_uuid();

      BEGIN
        INSERT INTO organizations (id, name) VALUES (v_org_id, p_name || '''s organization');
        INSERT INTO users (id, organization_id, google_id, email, name, picture, email_verified)
          VALUES (v_user_id, v_org_id, p_google_id, p_email, p_name, p_picture, true);
      EXCEPTION WHEN unique_violation THEN
        SELECT users.id, users.organization_id, users.onboarding_completed
          INTO v_user_id, v_org_id, v_onboarding_completed
          FROM users WHERE google_id = p_google_id;
      END;

      RETURN QUERY SELECT v_user_id, v_org_id, COALESCE(v_onboarding_completed, false);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);

  // get_user_by_email_for_login now also reports email_verified, so login can
  // block unverified accounts and OTP flows can look up a user_id by email.
  pgm.sql(`DROP FUNCTION IF EXISTS get_user_by_email_for_login(text);`);
  pgm.sql(`
    CREATE FUNCTION get_user_by_email_for_login(p_email text)
    RETURNS TABLE(user_id uuid, organization_id uuid, name text, password_hash text, onboarding_completed boolean, email_verified boolean) AS $$
      SELECT id, organization_id, name, password_hash, users.onboarding_completed, users.email_verified
      FROM users WHERE email = p_email;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION get_user_by_email_for_login(text) TO app_user;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP FUNCTION IF EXISTS get_user_by_email_for_login(text);`);
  pgm.sql(`
    CREATE FUNCTION get_user_by_email_for_login(p_email text)
    RETURNS TABLE(user_id uuid, organization_id uuid, name text, password_hash text, onboarding_completed boolean) AS $$
      SELECT id, organization_id, name, password_hash, users.onboarding_completed
      FROM users WHERE email = p_email;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION get_user_by_email_for_login(text) TO app_user;`);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION find_or_create_google_user(
      p_google_id text, p_email text, p_name text, p_picture text
    ) RETURNS TABLE(user_id uuid, organization_id uuid, onboarding_completed boolean) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
      v_onboarding_completed boolean;
    BEGIN
      SELECT users.id, users.organization_id, users.onboarding_completed
        INTO v_user_id, v_org_id, v_onboarding_completed
        FROM users WHERE google_id = p_google_id;

      IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_org_id, v_onboarding_completed;
        RETURN;
      END IF;

      v_org_id := gen_random_uuid();
      v_user_id := gen_random_uuid();

      BEGIN
        INSERT INTO organizations (id, name) VALUES (v_org_id, p_name || '''s organization');
        INSERT INTO users (id, organization_id, google_id, email, name, picture)
          VALUES (v_user_id, v_org_id, p_google_id, p_email, p_name, p_picture);
      EXCEPTION WHEN unique_violation THEN
        SELECT users.id, users.organization_id, users.onboarding_completed
          INTO v_user_id, v_org_id, v_onboarding_completed
          FROM users WHERE google_id = p_google_id;
      END;

      RETURN QUERY SELECT v_user_id, v_org_id, COALESCE(v_onboarding_completed, false);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);

  pgm.dropTable("otp_codes", { ifExists: true, cascade: true });
  pgm.dropColumn("users", ["email_verified"]);
};
