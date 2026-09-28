/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Looking up a user by google_id happens BEFORE we know their internal user
  // id, so it can't go through the normal RLS-protected app_user queries (RLS
  // would hide the row since app.current_user_id isn't set yet). This function
  // is the one deliberate, tightly-scoped bypass: SECURITY DEFINER runs it
  // with the owner's privileges, and it only ever touches the row matching the
  // google_id it was called with.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION find_or_create_google_user(
      p_google_id text, p_email text, p_name text, p_picture text
    ) RETURNS TABLE(user_id uuid, organization_id uuid) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
    BEGIN
      SELECT id, organization_id INTO v_user_id, v_org_id FROM users WHERE google_id = p_google_id;
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
        SELECT id, organization_id INTO v_user_id, v_org_id FROM users WHERE google_id = p_google_id;
      END;

      RETURN QUERY SELECT v_user_id, v_org_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`GRANT EXECUTE ON FUNCTION find_or_create_google_user(text, text, text, text) TO app_user;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP FUNCTION IF EXISTS find_or_create_google_user(text, text, text, text);`);
};
