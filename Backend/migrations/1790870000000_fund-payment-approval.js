/**
 * Two-sided fund payments: a payment counts only once both sides agree.
 *   - a member records their own payment  -> the collector/admin confirms it (as before)
 *   - the collector/admin records a member's payment -> that member approves it (new)
 *   - the collector/admin records their own payment -> counts at once
 *
 * The member may instead dispute it, with a note. A disputed entry never
 * counts and can't be deleted: it stays in the fund's history as a record of
 * the disagreement. created_by / confirmed_by / confirmed_at / disputed_* are
 * the proof trail shown in the fund history.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("fund_entries", {
    disputed_at: { type: "timestamptz" },
    disputed_by: { type: "uuid", references: "users" },
    dispute_note: { type: "text", check: "char_length(dispute_note) <= 200" },
  });
  pgm.addConstraint("fund_entries", "fund_entries_dispute_shape", {
    check: "(disputed_at IS NULL) = (disputed_by IS NULL) AND (disputed_at IS NULL OR NOT confirmed)",
  });

  // Disputed entries are evidence: nobody deletes them, not even the collector.
  pgm.sql(`DROP POLICY fund_entries_delete ON fund_entries;`);
  pgm.sql(`
    CREATE POLICY fund_entries_delete ON fund_entries FOR DELETE
      USING ((created_by = app_current_user_id() OR is_member_of_fund(fund_id)) AND disputed_at IS NULL);
  `);

  // "Waiting for my approval" across all my rooms.
  pgm.createIndex("fund_entries", "member_id", {
    name: "fund_entries_awaiting_member_index",
    where: "kind = 'contribution' AND NOT confirmed AND disputed_at IS NULL",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("fund_entries", [], { name: "fund_entries_awaiting_member_index" });
  pgm.sql(`DROP POLICY fund_entries_delete ON fund_entries;`);
  pgm.sql(`
    CREATE POLICY fund_entries_delete ON fund_entries FOR DELETE
      USING (created_by = app_current_user_id() OR is_member_of_fund(fund_id));
  `);
  pgm.dropConstraint("fund_entries", "fund_entries_dispute_shape");
  pgm.dropColumns("fund_entries", ["disputed_at", "disputed_by", "dispute_note"]);
};
