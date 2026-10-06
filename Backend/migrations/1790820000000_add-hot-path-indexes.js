/**
 * Indexes for foreign keys that real queries filter on. Postgres doesn't
 * index foreign keys automatically; without these, these lookups scan the
 * whole table once data grows:
 *
 *   expenses(room_id)            every room page, balances, monthly views
 *   room_members(user_id)        "my rooms" and the RLS helpers
 *                                (is_room_member, shares_room_with) on every request.
 *                                The existing UNIQUE (room_id, user_id) only
 *                                helps lookups that start with room_id.
 *   expense_splits(user_id)      "my share" in balances and monthly summaries
 *   refresh_tokens(user_id)      revoking every session (password reset, suspension)
 *   fund_participants(user_id)   funds a user is part of
 *
 * Deliberately NOT indexed: created_by / resolved_by / admin_id style columns.
 * Nothing filters on them, and every extra index slows down writes.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createIndex("expenses", ["room_id", { name: "created_at", sort: "DESC" }]);
  pgm.createIndex("room_members", "user_id");
  pgm.createIndex("expense_splits", "user_id");
  pgm.createIndex("refresh_tokens", "user_id");
  pgm.createIndex("fund_participants", "user_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("fund_participants", "user_id");
  pgm.dropIndex("refresh_tokens", "user_id");
  pgm.dropIndex("expense_splits", "user_id");
  pgm.dropIndex("room_members", "user_id");
  pgm.dropIndex("expenses", ["room_id", "created_at"]);
};
