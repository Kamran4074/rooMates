/**
 * 1. Expense sections ("categories"): the room admin keeps a list - Rent,
 *    Groceries, WiFi, Gas... - each with the people who share that bill. An
 *    expense filed under a section is split equally between those people
 *    (it can still be changed for one expense). New members are added to
 *    every section of the room automatically; anyone removed from the room is
 *    removed from its sections. Both happen in a trigger, so no code path can
 *    forget it.
 *
 * 2. activity_log: every money event in a room - expense added/deleted,
 *    payment recorded, fund payment recorded/approved/disputed, spends,
 *    fund opened/closed, people joining/leaving. Written by triggers on the
 *    tables themselves, so it can't be skipped or faked by the app, and
 *    app_user has no INSERT/UPDATE/DELETE on it: the log is the proof.
 *    users.notifications_seen_at drives the unread count. Each new row is
 *    also announced with pg_notify('room_activity') for live updates.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // ---------------- sections ----------------
  pgm.createTable("expense_categories", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    name: { type: "text", notNull: true, check: "char_length(name) BETWEEN 1 AND 40" },
    created_by: { type: "uuid", references: "users", onDelete: "SET NULL" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("expense_categories", ["room_id", { name: "lower(name)" }], {
    name: "expense_categories_room_name_unique",
    unique: true,
  });

  pgm.createTable("expense_category_members", {
    category_id: { type: "uuid", notNull: true, references: "expense_categories", onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
  });
  pgm.addConstraint("expense_category_members", "expense_category_members_pkey", { primaryKey: ["category_id", "user_id"] });
  pgm.createIndex("expense_category_members", "user_id");

  pgm.addColumn("expenses", {
    category_id: { type: "uuid", references: "expense_categories", onDelete: "SET NULL" },
  });

  pgm.sql(`ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY expense_categories_select ON expense_categories FOR SELECT USING (is_room_member(room_id));`);
  pgm.sql(`CREATE POLICY expense_categories_write ON expense_categories FOR ALL USING (is_room_admin(room_id)) WITH CHECK (is_room_admin(room_id));`);

  pgm.sql(`
    CREATE FUNCTION category_room(p_category_id uuid) RETURNS uuid AS $$
      SELECT room_id FROM expense_categories WHERE id = p_category_id;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`ALTER TABLE expense_category_members ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY expense_category_members_select ON expense_category_members FOR SELECT USING (is_room_member(category_room(category_id)));`);
  pgm.sql(`
    CREATE POLICY expense_category_members_write ON expense_category_members FOR ALL
      USING (is_room_admin(category_room(category_id))) WITH CHECK (is_room_admin(category_room(category_id)));
  `);

  // Room membership drives section membership.
  pgm.sql(`
    CREATE FUNCTION sync_category_members() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO expense_category_members (category_id, user_id)
          SELECT c.id, NEW.user_id FROM expense_categories c WHERE c.room_id = NEW.room_id
          ON CONFLICT DO NOTHING;
        RETURN NEW;
      END IF;
      DELETE FROM expense_category_members cm
        USING expense_categories c
        WHERE cm.category_id = c.id AND c.room_id = OLD.room_id AND cm.user_id = OLD.user_id;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`
    CREATE TRIGGER room_members_sync_categories AFTER INSERT OR DELETE ON room_members
      FOR EACH ROW EXECUTE FUNCTION sync_category_members();
  `);

  // ---------------- activity log ----------------
  pgm.createTable("activity_log", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    type: { type: "text", notNull: true },
    // Who did it (null: the system or a support admin), and who it's about.
    actor_id: { type: "uuid", references: "users", onDelete: "SET NULL" },
    subject_id: { type: "uuid", references: "users", onDelete: "SET NULL" },
    amount_paise: { type: "bigint" },
    data: { type: "jsonb", notNull: true, default: "{}" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("activity_log", ["room_id", { name: "created_at", sort: "DESC" }]);
  pgm.sql(`ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;`);
  // Read-only for everyone in the room. No write policy: only the triggers
  // below (running as the table owner) ever add rows.
  pgm.sql(`CREATE POLICY activity_log_select ON activity_log FOR SELECT USING (is_room_member(room_id));`);
  pgm.sql(`REVOKE INSERT, UPDATE, DELETE ON activity_log FROM app_user;`);

  pgm.addColumn("users", { notifications_seen_at: { type: "timestamptz" } });

  pgm.sql(`
    CREATE FUNCTION log_activity(p_room uuid, p_type text, p_actor uuid, p_subject uuid, p_amount bigint, p_data jsonb)
    RETURNS void AS $$
    BEGIN
      -- During a cascade (room or account being deleted) the room is already
      -- gone; there is nothing left to log into.
      IF EXISTS (SELECT 1 FROM rooms WHERE id = p_room) THEN
        INSERT INTO activity_log (room_id, type, actor_id, subject_id, amount_paise, data)
          VALUES (p_room, p_type, p_actor, p_subject, p_amount, COALESCE(p_data, '{}'));
        -- Live updates: the API listens on this channel and pushes it to the
        -- room's members (config/realtime.ts). Delivered only on COMMIT.
        PERFORM pg_notify('room_activity', json_build_object('room_id', p_room, 'type', p_type)::text);
      END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`
    CREATE FUNCTION log_expense_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(NEW.room_id, 'expense_added', NEW.created_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description, 'expense_date', NEW.expense_date,
                             'category', (SELECT name FROM expense_categories WHERE id = NEW.category_id)));
      ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        PERFORM log_activity(NEW.room_id, 'expense_deleted', NEW.deleted_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`CREATE TRIGGER expenses_log_activity AFTER INSERT OR UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION log_expense_activity();`);

  pgm.sql(`
    CREATE FUNCTION log_settlement_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(NEW.room_id, 'payment_recorded', NEW.created_by, NEW.from_user_id, NEW.amount_paise,
          jsonb_build_object('to_user_id', NEW.to_user_id, 'note', NEW.note, 'settled_on', NEW.settled_on));
      ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        PERFORM log_activity(NEW.room_id, 'payment_deleted', NEW.deleted_by, NEW.from_user_id, NEW.amount_paise,
          jsonb_build_object('to_user_id', NEW.to_user_id));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`CREATE TRIGGER settlements_log_activity AFTER INSERT OR UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION log_settlement_activity();`);

  pgm.sql(`
    CREATE FUNCTION log_fund_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(NEW.room_id, 'fund_opened', NEW.created_by, NEW.collector_id, NEW.per_member_paise,
          jsonb_build_object('fund_id', NEW.id, 'fund', NEW.name));
      ELSIF OLD.status = 'open' AND NEW.status = 'closed' THEN
        PERFORM log_activity(NEW.room_id, 'fund_closed', app_current_user_id(), NEW.collector_id, NULL,
          jsonb_build_object('fund_id', NEW.id, 'fund', NEW.name));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`CREATE TRIGGER room_funds_log_activity AFTER INSERT OR UPDATE ON room_funds FOR EACH ROW EXECUTE FUNCTION log_fund_activity();`);

  pgm.sql(`
    CREATE FUNCTION log_fund_entry_activity() RETURNS trigger AS $$
    DECLARE
      v_room uuid;
      v_fund text;
    BEGIN
      SELECT room_id, name INTO v_room, v_fund FROM room_funds WHERE id = NEW.fund_id;
      IF TG_OP = 'INSERT' THEN
        IF NEW.kind = 'contribution' THEN
          PERFORM log_activity(v_room, 'fund_payment_recorded', NEW.created_by, NEW.member_id, NEW.amount_paise,
            jsonb_build_object('fund_id', NEW.fund_id, 'fund', v_fund, 'entry_id', NEW.id, 'confirmed', NEW.confirmed, 'note', NEW.note));
        ELSIF NEW.kind = 'spend' THEN
          PERFORM log_activity(v_room, 'fund_spend', NEW.created_by, NULL, NEW.amount_paise,
            jsonb_build_object('fund_id', NEW.fund_id, 'fund', v_fund, 'description', NEW.note));
        END IF;
      ELSIF NOT OLD.confirmed AND NEW.confirmed THEN
        PERFORM log_activity(v_room,
          CASE WHEN NEW.kind = 'contribution' THEN 'fund_payment_approved' ELSE 'fund_settled' END,
          NEW.confirmed_by, NEW.member_id, NEW.amount_paise,
          jsonb_build_object('fund_id', NEW.fund_id, 'fund', v_fund, 'entry_id', NEW.id, 'kind', NEW.kind));
      ELSIF OLD.disputed_at IS NULL AND NEW.disputed_at IS NOT NULL THEN
        PERFORM log_activity(v_room, 'fund_payment_disputed', NEW.disputed_by, NEW.member_id, NEW.amount_paise,
          jsonb_build_object('fund_id', NEW.fund_id, 'fund', v_fund, 'entry_id', NEW.id, 'note', NEW.dispute_note));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`CREATE TRIGGER fund_entries_log_activity AFTER INSERT OR UPDATE ON fund_entries FOR EACH ROW EXECUTE FUNCTION log_fund_entry_activity();`);

  pgm.sql(`
    CREATE FUNCTION log_member_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        -- The creator "joining" their own new room isn't news.
        IF NEW.role <> 'admin' THEN
          PERFORM log_activity(NEW.room_id, 'member_joined', NEW.user_id, NEW.user_id, NULL, '{}');
        END IF;
        RETURN NULL;
      END IF;
      PERFORM log_activity(OLD.room_id,
        CASE WHEN app_current_user_id() = OLD.user_id THEN 'member_left' ELSE 'member_removed' END,
        app_current_user_id(), OLD.user_id, NULL, '{}');
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`CREATE TRIGGER room_members_log_activity AFTER INSERT OR DELETE ON room_members FOR EACH ROW EXECUTE FUNCTION log_member_activity();`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TRIGGER room_members_log_activity ON room_members;`);
  pgm.sql(`DROP TRIGGER fund_entries_log_activity ON fund_entries;`);
  pgm.sql(`DROP TRIGGER room_funds_log_activity ON room_funds;`);
  pgm.sql(`DROP TRIGGER settlements_log_activity ON settlements;`);
  pgm.sql(`DROP TRIGGER expenses_log_activity ON expenses;`);
  pgm.sql(`DROP FUNCTION log_member_activity();`);
  pgm.sql(`DROP FUNCTION log_fund_entry_activity();`);
  pgm.sql(`DROP FUNCTION log_fund_activity();`);
  pgm.sql(`DROP FUNCTION log_settlement_activity();`);
  pgm.sql(`DROP FUNCTION log_expense_activity();`);
  pgm.sql(`DROP FUNCTION log_activity(uuid, text, uuid, uuid, bigint, jsonb);`);
  pgm.dropColumn("users", "notifications_seen_at");
  pgm.dropTable("activity_log");

  pgm.sql(`DROP TRIGGER room_members_sync_categories ON room_members;`);
  pgm.sql(`DROP FUNCTION sync_category_members();`);
  pgm.dropColumn("expenses", "category_id");
  pgm.dropTable("expense_category_members");
  pgm.dropTable("expense_categories");
  pgm.sql(`DROP FUNCTION category_room(uuid);`);
};
