/**
 * Three plans instead of free/paid: basic (free), standard, premium.
 *
 *  - organizations.plan moves to the new names (free -> basic, paid ->
 *    premium) and each organization's limits are reset to its plan's.
 *  - organizations.plan_expires_at: a paid plan bought for a month or a year
 *    runs until then; the API moves expired organizations back to basic.
 *    NULL = no end (basic, or a plan the super admin granted by hand).
 *  - plan_upgrade_requests: until online payments exist, a user asks for a
 *    plan and leaves a mobile number; the super admin calls them, takes the
 *    payment and approves. Users see and cancel only their own requests;
 *    deciding happens through the admin (owner) connection.
 *
 * What each plan unlocks (funds, bill sections, Find a room) lives in the API
 * (src/config/plans.ts), next to the prices.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.dropConstraint("organizations", "organizations_plan_check");
  pgm.sql(`
    UPDATE organizations SET plan = CASE plan WHEN 'paid' THEN 'premium' ELSE 'basic' END;
    UPDATE organizations SET max_rooms = 2, max_members_per_room = 4 WHERE plan = 'basic';
    UPDATE organizations SET max_rooms = 100, max_members_per_room = 100 WHERE plan = 'premium';
    ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'basic';
  `);
  pgm.addConstraint("organizations", "organizations_plan_check", "CHECK (plan IN ('basic', 'standard', 'premium'))");
  pgm.addColumn("organizations", { plan_expires_at: { type: "timestamptz" } });
  pgm.createIndex("organizations", "plan_expires_at", { where: "plan_expires_at IS NOT NULL" });

  pgm.createTable("plan_upgrade_requests", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("uuidv7()") },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    plan: { type: "text", notNull: true, check: "plan IN ('standard', 'premium')" },
    billing_cycle: { type: "text", notNull: true, check: "billing_cycle IN ('monthly', 'yearly')" },
    // The price when they asked, so a later price change doesn't change what they were quoted.
    amount_paise: { type: "integer", notNull: true, check: "amount_paise > 0" },
    phone: { type: "text", notNull: true },
    note: { type: "text", check: "char_length(note) <= 500" },
    status: { type: "text", notNull: true, default: "pending", check: "status IN ('pending', 'approved', 'rejected', 'cancelled')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    decided_by: { type: "uuid", references: "users", onDelete: "SET NULL" },
    decided_at: { type: "timestamptz" },
    admin_note: { type: "text", check: "char_length(admin_note) <= 500" },
  });
  pgm.addConstraint("plan_upgrade_requests", "plan_upgrade_requests_decided", { check: "(status = 'pending') = (decided_at IS NULL)" });
  // One open request per person; the admin's queue reads pending ones oldest first.
  pgm.createIndex("plan_upgrade_requests", "user_id", { name: "plan_upgrade_requests_one_pending", unique: true, where: "status = 'pending'" });
  pgm.createIndex("plan_upgrade_requests", ["status", "created_at"]);

  pgm.sql(`ALTER TABLE plan_upgrade_requests ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY plan_upgrade_requests_select ON plan_upgrade_requests FOR SELECT USING (user_id = app_current_user_id());`);
  pgm.sql(`
    CREATE POLICY plan_upgrade_requests_insert ON plan_upgrade_requests FOR INSERT
      WITH CHECK (user_id = app_current_user_id() AND status = 'pending' AND decided_by IS NULL);
  `);
  // The only change a user can make: withdraw their own pending request.
  pgm.sql(`
    CREATE POLICY plan_upgrade_requests_cancel ON plan_upgrade_requests FOR UPDATE
      USING (user_id = app_current_user_id() AND status = 'pending')
      WITH CHECK (user_id = app_current_user_id() AND status = 'cancelled' AND decided_by IS NULL);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropTable("plan_upgrade_requests");
  pgm.dropIndex("organizations", "plan_expires_at");
  pgm.dropColumn("organizations", "plan_expires_at");
  pgm.dropConstraint("organizations", "organizations_plan_check");
  pgm.sql(`
    UPDATE organizations SET plan = CASE plan WHEN 'basic' THEN 'free' ELSE 'paid' END;
    UPDATE organizations SET max_rooms = 2, max_members_per_room = 4 WHERE plan = 'free';
    UPDATE organizations SET max_rooms = 10, max_members_per_room = 20 WHERE plan = 'paid';
    ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'free';
  `);
  pgm.addConstraint("organizations", "organizations_plan_check", "CHECK (plan IN ('free', 'paid'))");
};
