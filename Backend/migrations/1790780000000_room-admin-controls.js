/**
 * The room's creator is its admin: only they see/share the invite code, and
 * only they can remove members or change the room. These policies make the
 * database enforce that too, so a bug in the API can't hand out admin powers.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // SECURITY DEFINER for the same reason as is_room_member: policies on
  // room_members can't query room_members without infinite recursion.
  pgm.sql(`
    CREATE FUNCTION is_room_admin(p_room_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM room_members
        WHERE room_id = p_room_id AND user_id = app_current_user_id() AND role = 'admin'
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  // At room creation the creator isn't a member yet, so rooms_select hides the
  // row from them - this looks it up directly.
  pgm.sql(`
    CREATE FUNCTION is_room_creator(p_room_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND created_by = app_current_user_id());
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);

  // Before: anyone could insert themselves into any room with ANY role,
  // including 'admin'. Now you can only add yourself as a plain member,
  // except the creator adding themselves as their new room's admin.
  pgm.sql(`DROP POLICY room_members_insert ON room_members;`);
  pgm.sql(`
    CREATE POLICY room_members_insert ON room_members FOR INSERT
      WITH CHECK (user_id = app_current_user_id() AND (role = 'member' OR is_room_creator(room_id)));
  `);

  // You can leave; the admin can remove others.
  pgm.sql(`DROP POLICY room_members_delete ON room_members;`);
  pgm.sql(`
    CREATE POLICY room_members_delete ON room_members FOR DELETE
      USING (user_id = app_current_user_id() OR is_room_admin(room_id));
  `);

  // Changing the room itself (e.g. resetting the invite code) is admin-only.
  pgm.sql(`DROP POLICY rooms_update ON rooms;`);
  pgm.sql(`
    CREATE POLICY rooms_update ON rooms FOR UPDATE
      USING (is_room_admin(id)) WITH CHECK (is_room_admin(id));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP POLICY rooms_update ON rooms;`);
  pgm.sql(`
    CREATE POLICY rooms_update ON rooms FOR UPDATE
      USING (is_room_member(id)) WITH CHECK (is_room_member(id));
  `);
  pgm.sql(`DROP POLICY room_members_delete ON room_members;`);
  pgm.sql(`CREATE POLICY room_members_delete ON room_members FOR DELETE USING (user_id = app_current_user_id());`);
  pgm.sql(`DROP POLICY room_members_insert ON room_members;`);
  pgm.sql(`CREATE POLICY room_members_insert ON room_members FOR INSERT WITH CHECK (user_id = app_current_user_id());`);
  pgm.sql(`DROP FUNCTION IF EXISTS is_room_creator(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS is_room_admin(uuid);`);
};
