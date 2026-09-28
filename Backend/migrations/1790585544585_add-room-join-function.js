/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Same bootstrap problem as auth: you need to see a room's basic info to
  // join it, but rooms_select requires membership you don't have yet. Knowing
  // the invite code IS the authorization here, so this SECURITY DEFINER
  // function deliberately returns minimal info (no expenses, no member list)
  // to anyone holding the code, bypassing RLS just for that.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION find_room_by_invite_code(p_invite_code text)
    RETURNS TABLE(room_id uuid, name text, type text) AS $$
      SELECT id, name, type FROM rooms WHERE invite_code = p_invite_code;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION find_room_by_invite_code(text) TO app_user;`);

  // rooms_select (RLS) only shows rooms the CALLER is a member of. That's
  // correct for normal reads, but wrong for a billing/quota count: an
  // organization's room count must include every room it owns, regardless of
  // which of its members happens to be asking. Another narrow, deliberate bypass.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION count_org_rooms(p_organization_id uuid)
    RETURNS integer AS $$
      SELECT COUNT(*)::integer FROM rooms WHERE organization_id = p_organization_id;
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`GRANT EXECUTE ON FUNCTION count_org_rooms(uuid) TO app_user;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP FUNCTION IF EXISTS count_org_rooms(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS find_room_by_invite_code(text);`);
};
