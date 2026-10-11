/**
 * A room's size depends on its owner's plan: free = 4 people (admin included),
 * paid = 20. The room uses the plan of the account that created it
 * (rooms.organization_id), so the person who pays is the person who runs it.
 *
 * Enforced by the database, in one place, for both ways in:
 *  - room_join_requests INSERT: a full room doesn't even take a request;
 *  - room_members INSERT (the admin approving): two approvals at the same
 *    moment can't both take the last seat - the room row is locked first.
 * Rooms already bigger than their limit keep everyone; they just can't grow.
 *
 * The error uses its own SQLSTATE (RM001) so the API can turn it into a 409
 * with the database's message.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumn("organizations", {
    max_members_per_room: { type: "integer", notNull: true, default: 4 },
  });
  pgm.addConstraint("organizations", "organizations_max_members_check", "CHECK (max_members_per_room BETWEEN 2 AND 100)");
  pgm.sql("UPDATE organizations SET max_members_per_room = 20 WHERE plan = 'paid'");

  // Unrestricted - for the triggers only, so nobody can probe other rooms' sizes.
  pgm.sql(`
    CREATE FUNCTION room_capacity_internal(p_room uuid)
    RETURNS TABLE (member_count int, max_members int, plan text) AS $$
      SELECT (SELECT COUNT(*)::int FROM room_members m WHERE m.room_id = r.id), o.max_members_per_room, o.plan
      FROM rooms r JOIN organizations o ON o.id = r.organization_id
      WHERE r.id = p_room
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
    REVOKE EXECUTE ON FUNCTION room_capacity_internal(uuid) FROM PUBLIC;
  `);
  // For the room page: members only (the owner's organization row is hidden by RLS otherwise).
  pgm.sql(`
    CREATE FUNCTION room_capacity(p_room uuid)
    RETURNS TABLE (member_count int, max_members int, plan text) AS $$
      SELECT * FROM room_capacity_internal(p_room) WHERE is_room_member(p_room)
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`
    CREATE FUNCTION enforce_room_member_limit() RETURNS trigger AS $$
    DECLARE
      c record;
    BEGIN
      -- One join at a time per room. NO KEY UPDATE doesn't block expenses
      -- being added meanwhile (their foreign key check only needs KEY SHARE).
      PERFORM 1 FROM rooms WHERE id = NEW.room_id FOR NO KEY UPDATE;
      SELECT * INTO c FROM room_capacity_internal(NEW.room_id);
      IF c.member_count >= c.max_members THEN
        RAISE EXCEPTION USING
          ERRCODE = 'RM001',
          MESSAGE = format('This room is full: %s of %s people on the %s plan. The room admin can upgrade to add more.',
                           c.member_count, c.max_members, c.plan);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`
    CREATE TRIGGER room_members_limit BEFORE INSERT ON room_members
      FOR EACH ROW WHEN (NEW.role = 'member') EXECUTE FUNCTION enforce_room_member_limit();
    CREATE TRIGGER room_join_requests_limit BEFORE INSERT ON room_join_requests
      FOR EACH ROW EXECUTE FUNCTION enforce_room_member_limit();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER room_join_requests_limit ON room_join_requests;
    DROP TRIGGER room_members_limit ON room_members;
    DROP FUNCTION enforce_room_member_limit();
    DROP FUNCTION room_capacity(uuid);
    DROP FUNCTION room_capacity_internal(uuid);
  `);
  pgm.dropConstraint("organizations", "organizations_max_members_check");
  pgm.dropColumn("organizations", "max_members_per_room");
};
