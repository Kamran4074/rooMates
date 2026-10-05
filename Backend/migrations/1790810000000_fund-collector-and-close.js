/**
 * Room fund as a proper "collect upfront, settle at the end" kitty:
 *
 * - collector: the one person holding the cash (default: the room admin).
 * - participants: fixed when the fund starts, so someone joining the room
 *   mid-trip isn't suddenly asked for money.
 * - confirmed: money only counts once it has actually changed hands. A
 *   payment the collector records is confirmed straight away; one a member
 *   records about themselves waits for the collector to confirm it.
 * - closing: everyone's fair cost is (total spent / participants). Whoever
 *   paid more gets the difference back from the collector ('refund' entries);
 *   whoever paid less pays the collector ('collection' entries). Those
 *   settlement entries start unconfirmed and are confirmed when paid.
 *
 * Existing funds keep working: collector = room admin, participants = current
 * members, and every existing entry counts as confirmed.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("room_funds", {
    collector_id: { type: "uuid", references: "users" },
    status: { type: "text", notNull: true, default: "open" },
    closed_at: { type: "timestamptz" },
  });
  pgm.addConstraint("room_funds", "room_funds_status_check", "CHECK (status IN ('open', 'closed'))");
  pgm.sql(`
    UPDATE room_funds f SET collector_id = COALESCE(
      (SELECT m.user_id FROM room_members m WHERE m.room_id = f.room_id AND m.role = 'admin' LIMIT 1),
      f.created_by
    );
  `);
  pgm.alterColumn("room_funds", "collector_id", { notNull: true });

  pgm.createTable("fund_participants", {
    fund_id: { type: "uuid", notNull: true, references: "room_funds", onDelete: "CASCADE", primaryKey: true },
    user_id: { type: "uuid", notNull: true, references: "users", primaryKey: true },
    added_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.sql(`
    INSERT INTO fund_participants (fund_id, user_id)
    SELECT f.id, m.user_id FROM room_funds f JOIN room_members m ON m.room_id = f.room_id
    ON CONFLICT DO NOTHING;
  `);
  // Anyone who already paid into a fund is a participant, even if they've left the room.
  pgm.sql(`
    INSERT INTO fund_participants (fund_id, user_id)
    SELECT DISTINCT fund_id, member_id FROM fund_entries WHERE member_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);

  pgm.addColumns("fund_entries", {
    confirmed: { type: "boolean", notNull: true, default: false },
  });
  pgm.sql(`UPDATE fund_entries SET confirmed = true;`);

  pgm.dropConstraint("fund_entries", "fund_entries_kind_check");
  pgm.addConstraint(
    "fund_entries",
    "fund_entries_kind_check",
    "CHECK (kind IN ('contribution', 'spend', 'refund', 'collection'))"
  );
  pgm.dropConstraint("fund_entries", "fund_entries_member_check");
  pgm.addConstraint("fund_entries", "fund_entries_member_check", "CHECK ((kind = 'spend') = (member_id IS NULL))");

  // RLS: participants follow their fund, like entries do.
  pgm.sql(`ALTER TABLE fund_participants ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY fund_participants_select ON fund_participants FOR SELECT USING (is_member_of_fund(fund_id));`);
  pgm.sql(`CREATE POLICY fund_participants_insert ON fund_participants FOR INSERT WITH CHECK (is_member_of_fund(fund_id));`);

  // Confirming a payment updates its entry. Who may confirm (the collector or
  // room admin) is checked in the service; RLS keeps it inside the room.
  pgm.sql(`
    CREATE POLICY fund_entries_update ON fund_entries FOR UPDATE
      USING (is_member_of_fund(fund_id)) WITH CHECK (is_member_of_fund(fund_id));
  `);
  // The collector can also reject (delete) a payment someone else recorded.
  pgm.sql(`DROP POLICY fund_entries_delete ON fund_entries;`);
  pgm.sql(`
    CREATE POLICY fund_entries_delete ON fund_entries FOR DELETE
      USING (created_by = app_current_user_id() OR is_member_of_fund(fund_id));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP POLICY fund_entries_delete ON fund_entries;`);
  pgm.sql(`CREATE POLICY fund_entries_delete ON fund_entries FOR DELETE USING (created_by = app_current_user_id());`);
  pgm.sql(`DROP POLICY fund_entries_update ON fund_entries;`);
  pgm.sql(`DELETE FROM fund_entries WHERE kind IN ('refund', 'collection');`);
  pgm.dropConstraint("fund_entries", "fund_entries_member_check");
  pgm.addConstraint(
    "fund_entries",
    "fund_entries_member_check",
    "CHECK ((kind = 'contribution') = (member_id IS NOT NULL))"
  );
  pgm.dropConstraint("fund_entries", "fund_entries_kind_check");
  pgm.addConstraint("fund_entries", "fund_entries_kind_check", "CHECK (kind IN ('contribution', 'spend'))");
  pgm.dropColumns("fund_entries", ["confirmed"]);
  pgm.dropTable("fund_participants");
  pgm.dropConstraint("room_funds", "room_funds_status_check");
  pgm.dropColumns("room_funds", ["collector_id", "status", "closed_at"]);
};
