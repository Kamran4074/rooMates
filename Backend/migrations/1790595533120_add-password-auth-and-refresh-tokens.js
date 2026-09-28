/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // google_id was NOT NULL - password-based accounts won't have one.
  pgm.sql(`ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;`);
  pgm.addColumn("users", {
    password_hash: { type: "text" },
  });

  // Refresh tokens are pure auth infrastructure, not tenant/room data - no RLS
  // here. Only the raw token value (never stored - we store its hash) proves
  // the right to use a row, the same trust model as a password reset token.
  pgm.createTable("refresh_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    token_hash: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" },
  });
  pgm.createIndex("refresh_tokens", "token_hash");

  // Pre-identity lookups (same bootstrap problem as Google login): checking
  // "is this email taken" and "does this password match" both have to happen
  // before we know who's asking, so RLS can't apply - these are the two
  // narrow, deliberate SECURITY DEFINER bypasses for password auth.
  pgm.sql(`
    CREATE FUNCTION create_password_user(p_email text, p_password_hash text, p_name text)
    RETURNS TABLE(user_id uuid, organization_id uuid) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RAISE EXCEPTION 'email already registered' USING ERRCODE = 'unique_violation';
      END IF;

      v_org_id := gen_random_uuid();
      v_user_id := gen_random_uuid();

      INSERT INTO organizations (id, name) VALUES (v_org_id, p_name || '''s organization');
      INSERT INTO users (id, organization_id, email, name, password_hash)
        VALUES (v_user_id, v_org_id, p_email, p_name, p_password_hash);

      RETURN QUERY SELECT v_user_id, v_org_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION create_password_user(text, text, text) TO app_user;`);

  pgm.sql(`
    CREATE FUNCTION get_user_by_email_for_login(p_email text)
    RETURNS TABLE(user_id uuid, organization_id uuid, name text, password_hash text, onboarding_completed boolean) AS $$
      SELECT id, organization_id, name, password_hash, users.onboarding_completed
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
  pgm.sql(`DROP FUNCTION IF EXISTS create_password_user(text, text, text);`);
  pgm.dropTable("refresh_tokens", { ifExists: true, cascade: true });
  pgm.dropColumn("users", ["password_hash"]);
  pgm.sql(`ALTER TABLE users ALTER COLUMN google_id SET NOT NULL;`);
};
