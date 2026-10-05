/**
 * Platform-level roles, separate from per-room roles (room_members.role):
 *   user        - everyone
 *   super_admin - moderates listings, suspends accounts, can view any room
 * Nobody can make themselves admin through the API: the role is only ever
 * set from the server (scripts/make-admin.ts), and admin checks read it from
 * this table on every admin request - never from the request body or JWT.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("users", {
    role: { type: "text", notNull: true, default: "user" },
    // Set = can't sign in or refresh a session; existing refresh tokens are
    // revoked at the same time.
    suspended_at: { type: "timestamptz" },
  });
  pgm.addConstraint("users", "users_role_check", "CHECK (role IN ('user', 'super_admin'))");

  // Basic accountability for admin actions. Written in the same transaction
  // as the action itself, so an action can't happen without its log row.
  pgm.createTable("audit_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    admin_id: { type: "uuid", notNull: true, references: "users" },
    action: { type: "text", notNull: true },
    entity_type: { type: "text", notNull: true },
    entity_id: { type: "uuid", notNull: true },
    details: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("audit_logs", [{ name: "created_at", sort: "DESC" }]);

  // Only the admin module touches this table, through the owner connection;
  // with RLS on and no policies, app_user can't read or write it at all.
  pgm.sql(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("audit_logs", { ifExists: true });
  pgm.dropConstraint("users", "users_role_check");
  pgm.dropColumns("users", ["role", "suspended_at"]);
};
