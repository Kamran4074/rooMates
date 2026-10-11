/**
 * Schema tuning, done while the database is empty (cheap now, costly later).
 * Measured on 2,000 rooms / 200k expenses / 800k splits - see the PR notes.
 *
 * 1. RLS without per-row function calls. Policies like
 *      USING (is_room_member(room_id))
 *    call the function once per candidate row, and the planner can't use an
 *    index for it. "My expenses this month" took ~4 s. Now:
 *      USING (room_id = ANY ((SELECT my_room_ids())::uuid[]))
 *    The scalar subquery runs once per query (an InitPlan), and
 *    room_id = ANY(array) is index-friendly. INSERT/UPDATE checks touch one
 *    row, so they keep the simple functions.
 *
 * 2. expense_splits.room_id, kept equal to its expense's room by a composite
 *    foreign key (expense_id, room_id) -> expenses (id, room_id), so splits get
 *    the same cheap policy instead of looking up their expense per row.
 *
 * 3. Natural primary keys for the two join tables: room_members (room_id,
 *    user_id) and expense_splits (expense_id, user_id). Their surrogate id
 *    columns were never used and cost an extra index on every insert -
 *    expense_splits is the biggest table in the app.
 *
 * 4. audit_logs (entity_type, entity_id, created_at DESC) for an account's
 *    admin history.
 *
 * 5. uuidv7() (PostgreSQL 18) as the default id of append-heavy tables:
 *    time-ordered ids land at the end of the primary-key index instead of at
 *    random pages, and sort by creation time.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */

// The ::uuid[] cast makes this ONE array value (computed once, as an InitPlan);
// without it, "= ANY (subquery)" would mean "equals any row of the subquery".
const MINE = "(SELECT my_room_ids())::uuid[]";

// table -> [policy name, command, USING expression, WITH CHECK expression or null]
const POLICIES = {
  rooms: [["rooms_select", "SELECT", `id = ANY (${MINE})`, null]],
  room_members: [["room_members_select", "SELECT", `room_id = ANY (${MINE})`, null]],
  expenses: [
    ["expenses_select", "SELECT", `room_id = ANY (${MINE})`, null],
    ["expenses_update", "UPDATE", `room_id = ANY (${MINE}) AND (created_by = app_current_user_id() OR is_room_admin(room_id))`, "is_room_member(room_id)"],
  ],
  expense_splits: [
    ["expense_splits_select", "SELECT", `room_id = ANY (${MINE})`, null],
    ["expense_splits_insert", "INSERT", null, `room_id = ANY (${MINE})`],
  ],
  settlements: [
    ["settlements_select", "SELECT", `room_id = ANY (${MINE})`, null],
    ["settlements_update", "UPDATE", `room_id = ANY (${MINE}) AND (created_by = app_current_user_id() OR is_room_admin(room_id))`, "is_room_member(room_id)"],
  ],
  room_funds: [
    ["room_funds_select", "SELECT", `room_id = ANY (${MINE})`, null],
    ["room_funds_update", "UPDATE", `room_id = ANY (${MINE})`, "is_room_member(room_id)"],
  ],
  activity_log: [["activity_log_select", "SELECT", `room_id = ANY (${MINE})`, null]],
  expense_categories: [["expense_categories_select", "SELECT", `room_id = ANY (${MINE})`, null]],
};

// The previous definitions, for down().
const OLD_POLICIES = {
  rooms: [["rooms_select", "SELECT", "is_room_member(id)", null]],
  room_members: [["room_members_select", "SELECT", "is_room_member(room_id)", null]],
  expenses: [
    ["expenses_select", "SELECT", "is_room_member(room_id)", null],
    ["expenses_update", "UPDATE", "is_room_member(room_id) AND (created_by = app_current_user_id() OR is_room_admin(room_id))", "is_room_member(room_id)"],
  ],
  expense_splits: [
    ["expense_splits_select", "SELECT", "is_member_of_expense(expense_id)", null],
    ["expense_splits_insert", "INSERT", null, "is_member_of_expense(expense_id)"],
  ],
  settlements: [
    ["settlements_select", "SELECT", "is_room_member(room_id)", null],
    ["settlements_update", "UPDATE", "is_room_member(room_id) AND (created_by = app_current_user_id() OR is_room_admin(room_id))", "is_room_member(room_id)"],
  ],
  room_funds: [
    ["room_funds_select", "SELECT", "is_room_member(room_id)", null],
    ["room_funds_update", "UPDATE", "is_room_member(room_id)", "is_room_member(room_id)"],
  ],
  activity_log: [["activity_log_select", "SELECT", "is_room_member(room_id)", null]],
  expense_categories: [["expense_categories_select", "SELECT", "is_room_member(room_id)", null]],
};

function replacePolicies(pgm, definitions) {
  for (const [table, policies] of Object.entries(definitions)) {
    for (const [name, cmd, using, check] of policies) {
      pgm.sql(`DROP POLICY ${name} ON ${table};`);
      pgm.sql(
        `CREATE POLICY ${name} ON ${table} FOR ${cmd}` +
          (using ? ` USING (${using})` : "") +
          (check ? ` WITH CHECK (${check})` : "") +
          ";"
      );
    }
  }
}

const UUIDV7_TABLES = ["expenses", "settlements", "activity_log", "fund_entries", "audit_logs", "refresh_tokens", "otp_codes", "listing_requests"];

export const up = (pgm) => {
  // ---- my rooms, once per query ------------------------------------------------
  pgm.sql(`
    CREATE FUNCTION my_room_ids() RETURNS uuid[] AS $$
      SELECT COALESCE(array_agg(room_id), '{}') FROM room_members WHERE user_id = app_current_user_id();
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION my_room_ids() TO app_user;`);

  // ---- room_members: natural key ---------------------------------------------------
  pgm.dropConstraint("room_members", "room_members_pkey");
  pgm.dropColumn("room_members", "id");
  pgm.dropConstraint("room_members", "room_members_unique");
  pgm.addConstraint("room_members", "room_members_pkey", { primaryKey: ["room_id", "user_id"] });

  // ---- expense_splits: room_id + natural key ------------------------------------------
  pgm.addColumn("expense_splits", { room_id: { type: "uuid" } });
  pgm.sql(`UPDATE expense_splits es SET room_id = e.room_id FROM expenses e WHERE e.id = es.expense_id;`);
  pgm.alterColumn("expense_splits", "room_id", { notNull: true });
  pgm.addConstraint("expenses", "expenses_id_room_unique", { unique: ["id", "room_id"] });
  pgm.dropConstraint("expense_splits", "expense_splits_expense_id_fkey");
  pgm.addConstraint("expense_splits", "expense_splits_expense_room_fkey", {
    foreignKeys: { columns: ["expense_id", "room_id"], references: "expenses(id, room_id)", onDelete: "CASCADE" },
  });
  pgm.dropConstraint("expense_splits", "expense_splits_pkey");
  pgm.dropColumn("expense_splits", "id");
  pgm.dropConstraint("expense_splits", "expense_splits_unique");
  pgm.addConstraint("expense_splits", "expense_splits_pkey", { primaryKey: ["expense_id", "user_id"] });

  replacePolicies(pgm, POLICIES);

  // ---- indexes and ids ----------------------------------------------------------------------
  pgm.createIndex("audit_logs", ["entity_type", "entity_id", { name: "created_at", sort: "DESC" }]);
  for (const table of UUIDV7_TABLES) {
    pgm.alterColumn(table, "id", { default: pgm.func("uuidv7()") });
  }
};

export const down = (pgm) => {
  for (const table of UUIDV7_TABLES) {
    pgm.alterColumn(table, "id", { default: pgm.func("gen_random_uuid()") });
  }
  pgm.dropIndex("audit_logs", ["entity_type", "entity_id", { name: "created_at", sort: "DESC" }]);

  replacePolicies(pgm, OLD_POLICIES);

  pgm.dropConstraint("expense_splits", "expense_splits_pkey");
  pgm.addColumn("expense_splits", { id: { type: "uuid", notNull: true, default: pgm.func("gen_random_uuid()") } });
  pgm.addConstraint("expense_splits", "expense_splits_pkey", { primaryKey: "id" });
  pgm.addConstraint("expense_splits", "expense_splits_unique", { unique: ["expense_id", "user_id"] });
  pgm.dropConstraint("expense_splits", "expense_splits_expense_room_fkey");
  pgm.addConstraint("expense_splits", "expense_splits_expense_id_fkey", {
    foreignKeys: { columns: "expense_id", references: "expenses(id)", onDelete: "CASCADE" },
  });
  pgm.dropConstraint("expenses", "expenses_id_room_unique");
  pgm.dropColumn("expense_splits", "room_id");

  pgm.dropConstraint("room_members", "room_members_pkey");
  pgm.addColumn("room_members", { id: { type: "uuid", notNull: true, default: pgm.func("gen_random_uuid()") } });
  pgm.addConstraint("room_members", "room_members_pkey", { primaryKey: "id" });
  pgm.addConstraint("room_members", "room_members_unique", { unique: ["room_id", "user_id"] });

  pgm.sql(`DROP FUNCTION my_room_ids();`);
};
