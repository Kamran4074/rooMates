/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn("users", {
    phone: { type: "text" },
    onboarding_completed: { type: "boolean", notNull: true, default: false },
  });

  // find_or_create_google_user now also reports onboarding_completed so the
  // frontend knows whether to send a first-time user to /onboarding. The
  // return type is changing, so CREATE OR REPLACE won't work - drop first.
  pgm.sql(`DROP FUNCTION IF EXISTS find_or_create_google_user(text, text, text, text);`);
  pgm.sql(`
    CREATE FUNCTION find_or_create_google_user(
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
  // Dropping the old function also dropped its grant - a new function object needs its own.
  pgm.sql(`GRANT EXECUTE ON FUNCTION find_or_create_google_user(text, text, text, text) TO app_user;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP FUNCTION IF EXISTS find_or_create_google_user(text, text, text, text);`);
  pgm.sql(`
    CREATE FUNCTION find_or_create_google_user(
      p_google_id text, p_email text, p_name text, p_picture text
    ) RETURNS TABLE(user_id uuid, organization_id uuid) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
    BEGIN
      SELECT users.id, users.organization_id INTO v_user_id, v_org_id FROM users WHERE google_id = p_google_id;
      IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_org_id;
        RETURN;
      END IF;

      v_org_id := gen_random_uuid();
      v_user_id := gen_random_uuid();

      BEGIN
        INSERT INTO organizations (id, name) VALUES (v_org_id, p_name || '''s organization');
        INSERT INTO users (id, organization_id, google_id, email, name, picture)
          VALUES (v_user_id, v_org_id, p_google_id, p_email, p_name, p_picture);
      EXCEPTION WHEN unique_violation THEN
        SELECT users.id, users.organization_id INTO v_user_id, v_org_id FROM users WHERE google_id = p_google_id;
      END;

      RETURN QUERY SELECT v_user_id, v_org_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION find_or_create_google_user(text, text, text, text) TO app_user;`);

  pgm.dropColumn("users", ["phone", "onboarding_completed"]);
};
