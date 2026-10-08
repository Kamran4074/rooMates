import { withUserContext } from "../../config/db";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";

// The activity feed: every money event in the rooms I'm in, newest first.
// Rows come from activity_log, which database triggers write and nobody can
// edit - so this page doubles as the proof of who paid what, and when.
// RLS limits it to rooms I'm a member of; no extra room filter is needed.

export async function listNotifications(userId: string, roomId: string | undefined, params: PageParams) {
  return withUserContext(userId, async (client) => {
    const { limit, offset } = toLimitOffset(params);
    // LEFT JOINs: someone who left the room is hidden by RLS (shown as "Former member").
    const { rows } = await client.query(
      `SELECT a.id, a.type, a.room_id, r.name AS room_name, r.type AS room_type,
              a.actor_id, actor.name AS actor_name,
              a.subject_id, subject.name AS subject_name,
              a.amount_paise::float8 AS amount_paise, a.data, a.created_at,
              to_user.name AS to_name,
              (a.created_at > COALESCE(me.notifications_seen_at, '-infinity') AND a.actor_id IS DISTINCT FROM $1) AS unread,
              COUNT(*) OVER() AS total_count
       FROM activity_log a
       JOIN rooms r ON r.id = a.room_id
       JOIN users me ON me.id = $1
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN users subject ON subject.id = a.subject_id
       LEFT JOIN users to_user ON to_user.id = (a.data->>'to_user_id')::uuid
       WHERE ($2::uuid IS NULL OR a.room_id = $2)
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, roomId ?? null, limit, offset]
    );
    return paginate(rows, params);
  });
}

// What other people did since I last opened the page (my own actions don't count).
export async function unreadCount(userId: string) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM activity_log a JOIN users me ON me.id = $1
       WHERE a.created_at > COALESCE(me.notifications_seen_at, '-infinity')
         AND a.actor_id IS DISTINCT FROM $1`,
      [userId]
    );
    return { count: rows[0].count };
  });
}

export async function markSeen(userId: string) {
  return withUserContext(userId, async (client) => {
    await client.query("UPDATE users SET notifications_seen_at = now() WHERE id = $1", [userId]);
  });
}
