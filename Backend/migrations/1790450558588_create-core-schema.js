/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // --- least-privilege role the API connects as (never the table owner, so RLS actually applies) ---
  const appPassword = process.env.APP_DB_PASSWORD;
  if (!appPassword) {
    throw new Error("APP_DB_PASSWORD env var is required to provision the app_user role");
  }
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD '${appPassword}';
      ELSE
        ALTER ROLE app_user WITH PASSWORD '${appPassword}';
      END IF;
    END
    $$;
  `);
  pgm.sql(`GRANT CONNECT ON DATABASE neondb TO app_user;`);
  pgm.sql(`GRANT USAGE ON SCHEMA public TO app_user;`);
  pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;`);

  // Reads the current request's authenticated user id, set per-transaction via
  // SET LOCAL app.current_user_id by the API layer. NULL if unset -> deny by default.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
      SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    $$ LANGUAGE sql STABLE;
  `);

  // --- organizations (billing tenant: personal account, or a business managing many rooms) ---
  pgm.createTable("organizations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    plan: { type: "text", notNull: true, default: "free" },
    max_rooms: { type: "integer", notNull: true, default: 2 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("organizations", "organizations_plan_check", "CHECK (plan IN ('free', 'paid'))");

  // --- users ---
  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    organization_id: { type: "uuid", notNull: true, references: "organizations", onDelete: "CASCADE" },
    google_id: { type: "text", notNull: true, unique: true },
    email: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    picture: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // --- rooms ---
  pgm.createTable("rooms", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    organization_id: { type: "uuid", notNull: true, references: "organizations", onDelete: "CASCADE" },
    name: { type: "text", notNull: true },
    type: { type: "text", notNull: true },
    invite_code: { type: "text", notNull: true, unique: true },
    created_by: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("rooms", "rooms_type_check", "CHECK (type IN ('roommates', 'trip'))");

  // --- room_members (this is what actually controls access, not organization_id) ---
  pgm.createTable("room_members", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    role: { type: "text", notNull: true, default: "member" },
    joined_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("room_members", "room_members_role_check", "CHECK (role IN ('admin', 'member'))");
  pgm.addConstraint("room_members", "room_members_unique", "UNIQUE (room_id, user_id)");

  // --- expenses ---
  pgm.createTable("expenses", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    paid_by: { type: "uuid", notNull: true, references: "users" },
    description: { type: "text", notNull: true },
    amount_paise: { type: "bigint", notNull: true },
    created_by: { type: "uuid", notNull: true, references: "users" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("expenses", "expenses_amount_check", "CHECK (amount_paise > 0)");

  // --- expense_splits ---
  pgm.createTable("expense_splits", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    expense_id: { type: "uuid", notNull: true, references: "expenses", onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: "users" },
    share_paise: { type: "bigint", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("expense_splits", "expense_splits_share_check", "CHECK (share_paise >= 0)");
  pgm.addConstraint("expense_splits", "expense_splits_unique", "UNIQUE (expense_id, user_id)");

  // ============================================================
  // Row-Level Security
  //
  // Access to rooms/room_members/expenses/expense_splits is granted by ROOM
  // MEMBERSHIP, not by organization_id (a room is shared across organizations
  // once roommates from other accounts join it). organization_id only matters
  // for billing/room-quota checks.
  //
  // room_members' own policy can't query room_members directly (Postgres
  // throws "infinite recursion detected in policy"), so membership checks go
  // through SECURITY DEFINER helper functions, which run with the owner's
  // privileges and therefore bypass RLS internally, breaking the cycle.
  // ============================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = app_current_user_id()
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION shares_room_with(p_other_user uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM room_members rm1
        JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = app_current_user_id() AND rm2.user_id = p_other_user
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION current_user_org_id() RETURNS uuid AS $$
      SELECT organization_id FROM users WHERE id = app_current_user_id();
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION is_member_of_expense(p_expense_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM expenses e WHERE e.id = p_expense_id AND is_room_member(e.room_id)
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  // Policies are split per-command (not one FOR ALL) because INSERT has to
  // solve a bootstrap problem: at signup, the user's organization and user row
  // don't exist yet, so a membership-based USING check would block their own
  // creation. INSERT policies instead check that the row being created is
  // tied to the caller's own identity; SELECT/UPDATE/DELETE stay strict.

  pgm.sql(`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY organizations_select ON organizations FOR SELECT USING (id = current_user_org_id());`);
  pgm.sql(`CREATE POLICY organizations_insert ON organizations FOR INSERT WITH CHECK (true);`);
  pgm.sql(`
    CREATE POLICY organizations_update ON organizations FOR UPDATE
      USING (id = current_user_org_id()) WITH CHECK (id = current_user_org_id());
  `);

  pgm.sql(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY users_select ON users FOR SELECT
      USING (id = app_current_user_id() OR shares_room_with(id));
  `);
  pgm.sql(`CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (true);`);
  pgm.sql(`
    CREATE POLICY users_update ON users FOR UPDATE
      USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());
  `);

  pgm.sql(`ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY rooms_select ON rooms FOR SELECT USING (is_room_member(id));`);
  pgm.sql(`CREATE POLICY rooms_insert ON rooms FOR INSERT WITH CHECK (created_by = app_current_user_id());`);
  pgm.sql(`
    CREATE POLICY rooms_update ON rooms FOR UPDATE
      USING (is_room_member(id)) WITH CHECK (is_room_member(id));
  `);

  pgm.sql(`ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY room_members_select ON room_members FOR SELECT USING (is_room_member(room_id));`);
  pgm.sql(`CREATE POLICY room_members_insert ON room_members FOR INSERT WITH CHECK (user_id = app_current_user_id());`);
  pgm.sql(`CREATE POLICY room_members_delete ON room_members FOR DELETE USING (user_id = app_current_user_id());`);

  pgm.sql(`ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY expenses_select ON expenses FOR SELECT USING (is_room_member(room_id));`);
  pgm.sql(`
    CREATE POLICY expenses_insert ON expenses FOR INSERT
      WITH CHECK (is_room_member(room_id) AND created_by = app_current_user_id());
  `);
  pgm.sql(`
    CREATE POLICY expenses_update ON expenses FOR UPDATE
      USING (is_room_member(room_id)) WITH CHECK (is_room_member(room_id));
  `);
  pgm.sql(`CREATE POLICY expenses_delete ON expenses FOR DELETE USING (created_by = app_current_user_id());`);

  pgm.sql(`ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY expense_splits_select ON expense_splits FOR SELECT USING (is_member_of_expense(expense_id));`);
  pgm.sql(`CREATE POLICY expense_splits_insert ON expense_splits FOR INSERT WITH CHECK (is_member_of_expense(expense_id));`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  const opts = { ifExists: true, cascade: true };
  pgm.dropTable("expense_splits", opts);
  pgm.dropTable("expenses", opts);
  pgm.dropTable("room_members", opts);
  pgm.dropTable("rooms", opts);
  pgm.dropTable("users", opts);
  pgm.dropTable("organizations", opts);
  pgm.sql(`DROP FUNCTION IF EXISTS is_member_of_expense(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS current_user_org_id();`);
  pgm.sql(`DROP FUNCTION IF EXISTS shares_room_with(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS is_room_member(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS app_current_user_id();`);
};
