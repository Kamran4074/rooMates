/**
 * Room funds ("kitty"): roommates pool money upfront - say ₹1500 each - and
 * spend from the pool. Partial payments are normal ("₹1000 now, ₹500 later"),
 * so each payment is its own row and a member's progress is their sum.
 *
 * Deliberately a separate ledger from expenses: money spent from the pool
 * belongs to everyone, so it must not count as "paid by" anyone in the
 * settle-up balances.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("room_funds", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    name: { type: "text", notNull: true },
    per_member_paise: { type: "bigint", notNull: true },
    created_by: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("room_funds", "room_funds_per_member_check", "CHECK (per_member_paise > 0)");
  pgm.createIndex("room_funds", "room_id");

  // One table for money in (contribution) and money out (spend): the fund's
  // balance is then a single SUM, and the history is one ordered list.
  pgm.createTable("fund_entries", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    fund_id: { type: "uuid", notNull: true, references: "room_funds", onDelete: "CASCADE" },
    kind: { type: "text", notNull: true },
    // Who paid in (contributions only). Separate from created_by: anyone in
    // the room can record that a roommate handed over cash.
    member_id: { type: "uuid", references: "users" },
    amount_paise: { type: "bigint", notNull: true },
    note: { type: "text" },
    created_by: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("fund_entries", "fund_entries_kind_check", "CHECK (kind IN ('contribution', 'spend'))");
  pgm.addConstraint("fund_entries", "fund_entries_amount_check", "CHECK (amount_paise > 0)");
  pgm.addConstraint(
    "fund_entries",
    "fund_entries_member_check",
    "CHECK ((kind = 'contribution') = (member_id IS NOT NULL))"
  );
  pgm.createIndex("fund_entries", "fund_id");

  // Same pattern as is_member_of_expense: SECURITY DEFINER so the policy can
  // look through room_funds without recursing into its RLS.
  pgm.sql(`
    CREATE FUNCTION is_member_of_fund(p_fund_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM room_funds f WHERE f.id = p_fund_id AND is_room_member(f.room_id)
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`ALTER TABLE room_funds ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY room_funds_select ON room_funds FOR SELECT USING (is_room_member(room_id));`);
  pgm.sql(`
    CREATE POLICY room_funds_insert ON room_funds FOR INSERT
      WITH CHECK (is_room_member(room_id) AND created_by = app_current_user_id());
  `);
  // Needed for SELECT ... FOR UPDATE, which the API uses to lock a fund while
  // checking its balance before a spend.
  pgm.sql(`
    CREATE POLICY room_funds_update ON room_funds FOR UPDATE
      USING (is_room_member(room_id)) WITH CHECK (is_room_member(room_id));
  `);

  pgm.sql(`ALTER TABLE fund_entries ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY fund_entries_select ON fund_entries FOR SELECT USING (is_member_of_fund(fund_id));`);
  pgm.sql(`
    CREATE POLICY fund_entries_insert ON fund_entries FOR INSERT
      WITH CHECK (is_member_of_fund(fund_id) AND created_by = app_current_user_id());
  `);
  // Only whoever recorded an entry can remove it (to fix their own mistake).
  pgm.sql(`CREATE POLICY fund_entries_delete ON fund_entries FOR DELETE USING (created_by = app_current_user_id());`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("fund_entries", { ifExists: true, cascade: true });
  pgm.dropTable("room_funds", { ifExists: true, cascade: true });
  pgm.sql(`DROP FUNCTION IF EXISTS is_member_of_fund(uuid);`);
};
