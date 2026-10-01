/**
 * 1. Emails are stored lowercase, so "Kamran@Gmail.com" and "kamran@gmail.com"
 *    are one account. The API normalises input; the CHECK makes the database
 *    refuse anything that slips past it. (If two existing accounts differ only
 *    by case, the UPDATE fails on the unique index - merge them by hand first.)
 *
 * 2. Google sign-in links to an existing email/password account instead of
 *    failing on the unique email. When the account being linked was never
 *    verified, its password is dropped: someone may have registered that
 *    email without owning the inbox ("pre-account takeover"), and Google has
 *    just proved who the real owner is.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));`);
  pgm.addConstraint("users", "users_email_lowercase", "CHECK (email = lower(email))");

  pgm.sql(`
    CREATE OR REPLACE FUNCTION find_or_create_google_user(
      p_google_id text, p_email text, p_name text, p_picture text
    ) RETURNS TABLE(user_id uuid, organization_id uuid, onboarding_completed boolean) AS $$
    DECLARE
      v_user_id uuid;
      v_org_id uuid;
      v_onboarding_completed boolean;
      v_existing_google_id text;
    BEGIN
      SELECT users.id, users.organization_id, users.onboarding_completed
        INTO v_user_id, v_org_id, v_onboarding_completed
        FROM users WHERE google_id = p_google_id;

      IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT v_user_id, v_org_id, v_onboarding_completed;
        RETURN;
      END IF;

      -- Same email, first time with Google: link the accounts.
      SELECT users.id, users.organization_id, users.onboarding_completed, users.google_id
        INTO v_user_id, v_org_id, v_onboarding_completed, v_existing_google_id
        FROM users WHERE email = p_email
        FOR UPDATE;

      IF v_user_id IS NOT NULL THEN
        IF v_existing_google_id IS NOT NULL THEN
          RAISE EXCEPTION 'email linked to a different Google account' USING ERRCODE = 'unique_violation';
        END IF;
        UPDATE users SET
          google_id = p_google_id,
          picture = COALESCE(users.picture, p_picture),
          password_hash = CASE WHEN users.email_verified THEN users.password_hash ELSE NULL END,
          email_verified = true
        WHERE users.id = v_user_id;
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
        -- A concurrent request created it first.
        SELECT users.id, users.organization_id, users.onboarding_completed
          INTO v_user_id, v_org_id, v_onboarding_completed
          FROM users WHERE google_id = p_google_id;
        IF v_user_id IS NULL THEN
          RAISE;
        END IF;
      END;

      RETURN QUERY SELECT v_user_id, v_org_id, COALESCE(v_onboarding_completed, false);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("users", "users_email_lowercase");

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
};
