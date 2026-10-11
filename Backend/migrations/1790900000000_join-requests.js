/**
 * Joining a room needs the room admin's approval.
 *
 * An invite code no longer makes you a member: it files a join request, and
 * the room admin approves (you become a member) or rejects it. Enforced by the
 * database, not just the API:
 *  - room_members INSERT is allowed only for the creator adding themselves as
 *    admin, or the room admin adding someone who has a pending request.
 *    Nobody can add themselves as a member any more.
 *  - room_join_requests: you can file one for yourself (one pending per room);
 *    only the room admin can decide it; nobody can delete it (it's the record).
 *
 * Activity log: "X asked to join" and "X's request was declined" are logged
 * by a trigger; approval shows as "member_joined" with the admin as actor.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("room_join_requests", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("uuidv7()") },
    room_id: { type: "uuid", notNull: true, references: "rooms", onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    status: { type: "text", notNull: true, default: "pending", check: "status IN ('pending', 'approved', 'rejected')" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    decided_by: { type: "uuid", references: "users", onDelete: "SET NULL" },
    decided_at: { type: "timestamptz" },
  });
  pgm.addConstraint("room_join_requests", "room_join_requests_decided", { check: "(status = 'pending') = (decided_at IS NULL)" });
  // One open request per person per room; asking again after a rejection is fine.
  pgm.createIndex("room_join_requests", ["room_id", "user_id"], { name: "room_join_requests_one_pending", unique: true, where: "status = 'pending'" });
  pgm.createIndex("room_join_requests", "user_id");

  pgm.sql(`ALTER TABLE room_join_requests ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`CREATE POLICY room_join_requests_select ON room_join_requests FOR SELECT USING (user_id = app_current_user_id() OR is_room_admin(room_id));`);
  pgm.sql(`
    CREATE POLICY room_join_requests_insert ON room_join_requests FOR INSERT
      WITH CHECK (user_id = app_current_user_id() AND status = 'pending' AND NOT is_room_member(room_id));
  `);
  pgm.sql(`CREATE POLICY room_join_requests_update ON room_join_requests FOR UPDATE USING (is_room_admin(room_id)) WITH CHECK (is_room_admin(room_id));`);

  // Membership: the creator (as admin), or the admin approving a pending request.
  pgm.sql(`DROP POLICY room_members_insert ON room_members;`);
  pgm.sql(`
    CREATE POLICY room_members_insert ON room_members FOR INSERT WITH CHECK (
      (user_id = app_current_user_id() AND role = 'admin' AND is_room_creator(room_id))
      OR (
        role = 'member' AND is_room_admin(room_id)
        AND EXISTS (
          SELECT 1 FROM room_join_requests r
          WHERE r.room_id = room_members.room_id AND r.user_id = room_members.user_id AND r.status = 'pending'
        )
      )
    );
  `);

  // Lists with names. The requester isn't a member yet, so normal RLS would
  // hide the room from them and their profile from the admin.
  pgm.sql(`
    CREATE FUNCTION my_join_requests()
    RETURNS TABLE(id uuid, room_id uuid, room_name text, room_type text, created_at timestamptz) AS $$
      SELECT r.id, r.room_id, rm.name, rm.type, r.created_at
      FROM room_join_requests r JOIN rooms rm ON rm.id = r.room_id
      WHERE r.user_id = app_current_user_id() AND r.status = 'pending'
      ORDER BY r.created_at DESC;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`
    CREATE FUNCTION join_requests_to_approve()
    RETURNS TABLE(id uuid, room_id uuid, room_name text, user_id uuid, name text, email text, picture text, created_at timestamptz) AS $$
      SELECT r.id, r.room_id, rm.name, u.id, u.name, u.email, u.picture, r.created_at
      FROM room_join_requests r
      JOIN rooms rm ON rm.id = r.room_id
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM room_members m
          WHERE m.room_id = r.room_id AND m.user_id = app_current_user_id() AND m.role = 'admin'
        )
      ORDER BY r.created_at;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION my_join_requests() TO app_user;`);
  pgm.sql(`GRANT EXECUTE ON FUNCTION join_requests_to_approve() TO app_user;`);

  pgm.sql(`
    CREATE FUNCTION log_join_request_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        -- The requester isn't a member, so RLS on users hides their name from
        -- the room; keep a copy on the event so the feed can say who asked.
        PERFORM log_activity(NEW.room_id, 'join_requested', NEW.user_id, NEW.user_id, NULL,
          jsonb_build_object('request_id', NEW.id, 'name', (SELECT name FROM users WHERE id = NEW.user_id)));
      ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
        PERFORM log_activity(NEW.room_id, 'join_rejected', NEW.decided_by, NEW.user_id, NULL, jsonb_build_object('request_id', NEW.id));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`
    CREATE TRIGGER room_join_requests_log_activity AFTER INSERT OR UPDATE ON room_join_requests
      FOR EACH ROW EXECUTE FUNCTION log_join_request_activity();
  `);

  // "member_joined" now records who let them in (the approving admin).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION log_member_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        -- The creator "joining" their own new room isn't news.
        IF NEW.role <> 'admin' THEN
          PERFORM log_activity(NEW.room_id, 'member_joined', COALESCE(app_current_user_id(), NEW.user_id), NEW.user_id, NULL, '{}');
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
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION log_member_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
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
  pgm.sql(`DROP POLICY room_members_insert ON room_members;`);
  pgm.sql(`
    CREATE POLICY room_members_insert ON room_members FOR INSERT
      WITH CHECK (user_id = app_current_user_id() AND (role = 'member' OR is_room_creator(room_id)));
  `);
  pgm.dropTable("room_join_requests");
  pgm.sql(`DROP FUNCTION log_join_request_activity();`);
  pgm.sql(`DROP FUNCTION join_requests_to_approve();`);
  pgm.sql(`DROP FUNCTION my_join_requests();`);
};
