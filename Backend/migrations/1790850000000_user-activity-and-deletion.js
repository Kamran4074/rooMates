/**
 * For the super admin's user management:
 *
 * 1. users.last_active_at: when the account last signed in or refreshed its
 *    session (the app refreshes about every 15 minutes while open), so admins
 *    can see who actually uses the app. Not written on every request.
 *    Existing rows: their newest session, else their signup time.
 *
 * 2. users.deleted_at: an admin "deletes" an account by anonymising it, not
 *    by removing the row. Other people's expenses and payments point at this
 *    user; removing the row would break their history and balances. The name
 *    becomes "Deleted user"; email, phone, photo, Google link and password are
 *    wiped, so nothing personal is left and nobody can sign in to it.
 *
 * 3. Indexes for the admin users list, sorted/filtered by signup date and
 *    last activity.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("users", {
    last_active_at: { type: "timestamptz" },
    deleted_at: { type: "timestamptz" },
  });
  pgm.sql(`
    UPDATE users u SET last_active_at = COALESCE(
      (SELECT max(rt.created_at) FROM refresh_tokens rt WHERE rt.user_id = u.id),
      u.created_at
    );
  `);
  // A deleted account keeps no personal data and has no way to sign in.
  pgm.addConstraint("users", "users_deleted_is_anonymous", {
    check: "deleted_at IS NULL OR (phone IS NULL AND google_id IS NULL AND password_hash IS NULL AND picture IS NULL)",
  });
  pgm.createIndex("users", [{ name: "created_at", sort: "DESC" }]);
  pgm.createIndex("users", [{ name: "last_active_at", sort: "DESC NULLS LAST" }]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("users", [], { name: "users_last_active_at_index" });
  pgm.dropIndex("users", [], { name: "users_created_at_index" });
  pgm.dropConstraint("users", "users_deleted_is_anonymous");
  pgm.dropColumns("users", ["last_active_at", "deleted_at"]);
};
