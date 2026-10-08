/**
 * Schema review (2026-10-08): the gaps that get expensive once the app grows.
 *
 * 1. settlements: "Aman paid Chirag Rs 285" is now recorded, so balances can
 *    actually reach zero. Before this there was nowhere to put a settle-up
 *    payment.
 * 2. expenses: soft delete (deleted_at, deleted_by) + updated_at. Money
 *    records are never physically removed: if someone deletes a wrong
 *    expense, the room can still see who did it and when.
 * 3. room_ledger view: every balance in the app (room balances, the dashboard's
 *    per-room net, "is this member settled?") reads from this one view, so
 *    expenses, splits, settlements and soft deletes are counted the same way
 *    everywhere. security_invoker = RLS still applies to whoever queries it.
 * 4. fund_entries.confirmed_by / confirmed_at: who approved a payment, and when.
 * 5. updated_at on users, rooms, room_funds (+ expenses), maintained by one
 *    shared trigger so no code path can forget it.
 * 6. Length limits in the database, matching the API's Zod limits, so a
 *    script or future tool that writes directly still can't store a 1 MB name.
 * 7. Indexes: rooms(organization_id) for the room-quota count on every room
 *    create; expenses(paid_by) for per-user balances; the duplicate
 *    refresh_tokens(token_hash) index goes (the UNIQUE constraint already has one).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // ---- shared updated_at trigger ---------------------------------------------
  pgm.sql(`
    CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  for (const table of ["users", "rooms", "room_funds", "expenses"]) {
    pgm.addColumn(table, { updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") } });
  }
  for (const table of ["users", "rooms", "room_funds", "expenses", "listings", "listing_requests"]) {
    pgm.sql(`CREATE TRIGGER ${table}_set_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);
  }

  // ---- expenses: soft delete ---------------------------------------------------
  pgm.addColumns("expenses", {
    deleted_at: { type: "timestamptz" },
    deleted_by: { type: "uuid", references: "users" },
  });
  pgm.addConstraint("expenses", "expenses_deleted_pair", { check: "(deleted_at IS NULL) = (deleted_by IS NULL)" });
  // Only live expenses are ever listed, so the list index skips deleted ones.
  pgm.dropIndex("expenses", [], { name: "expenses_room_date_index" });
  pgm.createIndex("expenses", ["room_id", { name: "expense_date", sort: "DESC" }, { name: "created_at", sort: "DESC" }], {
    name: "expenses_room_date_live_index",
    where: "deleted_at IS NULL",
  });
  pgm.createIndex("expenses", "paid_by", { name: "expenses_paid_by_live_index", where: "deleted_at IS NULL" });
  // Deleting (= setting deleted_at) is for whoever added it or the room admin,
  // enforced here and not only in the service. Before, any member could update any expense.
  pgm.sql(`DROP POLICY expenses_update ON expenses;`);
  pgm.sql(`
    CREATE POLICY expenses_update ON expenses FOR UPDATE
      USING (is_room_member(room_id) AND (created_by = app_current_user_id() OR is_room_admin(room_id)))
      WITH CHECK (is_room_member(room_id));
  `);

  // ---- settlements ----------------------------------------------------------------
  pgm.createTable("settlements", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    from_user_id: { type: "uuid", notNull: true, references: "users" },
    to_user_id: { type: "uuid", notNull: true, references: "users" },
    amount_paise: { type: "bigint", notNull: true, check: "amount_paise > 0" },
    settled_on: { type: "date", notNull: true, default: pgm.func("(now() AT TIME ZONE 'Asia/Kolkata')::date") },
    note: { type: "text", check: "char_length(note) <= 200" },
    created_by: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    deleted_at: { type: "timestamptz" },
    deleted_by: { type: "uuid", references: "users" },
  });
  pgm.addConstraint("settlements", "settlements_two_people", { check: "from_user_id <> to_user_id" });
  pgm.addConstraint("settlements", "settlements_deleted_pair", { check: "(deleted_at IS NULL) = (deleted_by IS NULL)" });
  pgm.createIndex("settlements", ["room_id", { name: "settled_on", sort: "DESC" }, { name: "created_at", sort: "DESC" }], {
    name: "settlements_room_live_index",
    where: "deleted_at IS NULL",
  });
  pgm.createIndex("settlements", "from_user_id", { name: "settlements_from_live_index", where: "deleted_at IS NULL" });
  pgm.createIndex("settlements", "to_user_id", { name: "settlements_to_live_index", where: "deleted_at IS NULL" });

  pgm.sql(`ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY settlements_select ON settlements FOR SELECT USING (is_room_member(room_id));`);
  // Recorded by one of the two people involved, or the room admin.
  pgm.sql(`
    CREATE POLICY settlements_insert ON settlements FOR INSERT
      WITH CHECK (
        is_room_member(room_id) AND created_by = app_current_user_id()
        AND (app_current_user_id() IN (from_user_id, to_user_id) OR is_room_admin(room_id))
      );
  `);
  pgm.sql(`
    CREATE POLICY settlements_update ON settlements FOR UPDATE
      USING (is_room_member(room_id) AND (created_by = app_current_user_id() OR is_room_admin(room_id)))
      WITH CHECK (is_room_member(room_id));
  `);

  // ---- one ledger for every balance --------------------------------------------
  // Positive amount = this person is owed more; negative = they owe more.
  //   paying an expense         +amount     your share of it  -share
  //   paying someone back       +amount     being paid back   -amount
  pgm.sql(`
    CREATE VIEW room_ledger WITH (security_invoker = true) AS
      SELECT e.room_id, e.paid_by AS user_id, e.amount_paise
        FROM expenses e WHERE e.deleted_at IS NULL
      UNION ALL
      SELECT e.room_id, es.user_id, -es.share_paise
        FROM expense_splits es JOIN expenses e ON e.id = es.expense_id WHERE e.deleted_at IS NULL
      UNION ALL
      SELECT s.room_id, s.from_user_id, s.amount_paise
        FROM settlements s WHERE s.deleted_at IS NULL
      UNION ALL
      SELECT s.room_id, s.to_user_id, -s.amount_paise
        FROM settlements s WHERE s.deleted_at IS NULL;
  `);
  pgm.sql(`GRANT SELECT ON room_ledger TO app_user;`);

  // ---- fund payments: who confirmed them ------------------------------------------
  pgm.addColumns("fund_entries", {
    confirmed_by: { type: "uuid", references: "users" },
    confirmed_at: { type: "timestamptz" },
  });
  pgm.sql(`UPDATE fund_entries SET confirmed_by = created_by, confirmed_at = created_at WHERE confirmed;`);
  pgm.addConstraint("fund_entries", "fund_entries_confirmed_pair", {
    check: "confirmed = (confirmed_at IS NOT NULL) AND (confirmed_at IS NULL) = (confirmed_by IS NULL)",
  });

  // ---- length limits (same as the API's Zod schemas) ---------------------------------
  const limits = [
    ["users", "name", 1, 100],
    ["rooms", "name", 1, 100],
    ["expenses", "description", 1, 200],
    ["room_funds", "name", 1, 60],
    ["listings", "title", 1, 100],
    ["listings", "description", 1, 2000],
    ["listings", "locality", 1, 100],
    ["listings", "city", 1, 60],
    ["listings", "state", 1, 60],
  ];
  for (const [table, column, min, max] of limits) {
    pgm.addConstraint(table, `${table}_${column}_length`, {
      check: `char_length(${column}) BETWEEN ${min} AND ${max}`,
    });
  }
  const optionalLimits = [
    ["fund_entries", "note", 200],
    ["listings", "rejection_reason", 300],
    ["listing_requests", "message", 500],
    ["listing_reports", "description", 500],
  ];
  for (const [table, column, max] of optionalLimits) {
    pgm.addConstraint(table, `${table}_${column}_length`, { check: `char_length(${column}) <= ${max}` });
  }

  // ---- indexes ------------------------------------------------------------------------
  pgm.createIndex("rooms", "organization_id");
  pgm.dropIndex("refresh_tokens", [], { name: "refresh_tokens_token_hash_index" });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.createIndex("refresh_tokens", "token_hash", { name: "refresh_tokens_token_hash_index" });
  pgm.dropIndex("rooms", "organization_id");

  for (const [table, column] of [
    ["users", "name"], ["rooms", "name"], ["expenses", "description"], ["room_funds", "name"],
    ["listings", "title"], ["listings", "description"], ["listings", "locality"], ["listings", "city"],
    ["listings", "state"], ["fund_entries", "note"], ["listings", "rejection_reason"],
    ["listing_requests", "message"], ["listing_reports", "description"],
  ]) {
    pgm.dropConstraint(table, `${table}_${column}_length`);
  }

  pgm.dropConstraint("fund_entries", "fund_entries_confirmed_pair");
  pgm.dropColumns("fund_entries", ["confirmed_by", "confirmed_at"]);

  pgm.sql(`DROP VIEW room_ledger;`);
  pgm.dropTable("settlements");

  pgm.sql(`DROP POLICY expenses_update ON expenses;`);
  pgm.sql(`
    CREATE POLICY expenses_update ON expenses FOR UPDATE
      USING (is_room_member(room_id)) WITH CHECK (is_room_member(room_id));
  `);
  pgm.dropIndex("expenses", [], { name: "expenses_paid_by_live_index" });
  pgm.dropIndex("expenses", [], { name: "expenses_room_date_live_index" });
  // Soft-deleted expenses would come back as live ones; remove them for real.
  pgm.sql(`DELETE FROM expenses WHERE deleted_at IS NOT NULL;`);
  pgm.createIndex("expenses", ["room_id", { name: "expense_date", sort: "DESC" }, { name: "created_at", sort: "DESC" }], {
    name: "expenses_room_date_index",
  });
  pgm.dropConstraint("expenses", "expenses_deleted_pair");
  pgm.dropColumns("expenses", ["deleted_at", "deleted_by"]);

  for (const table of ["users", "rooms", "room_funds", "expenses", "listings", "listing_requests"]) {
    pgm.sql(`DROP TRIGGER ${table}_set_updated_at ON ${table};`);
  }
  for (const table of ["users", "rooms", "room_funds", "expenses"]) {
    pgm.dropColumn(table, "updated_at");
  }
  pgm.sql(`DROP FUNCTION set_updated_at();`);
};
