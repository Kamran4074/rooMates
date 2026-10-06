import { Pool, PoolClient } from "pg";
import { env } from "./env";
import { logger } from "./logger";

// Opening a connection to a remote Postgres (TLS + auth) costs several network
// round trips - seconds when the database is far away. So connections are kept
// open and reused: idle ones live for 5 minutes instead of pg's default 10 s,
// and TCP keep-alive stops networks from silently dropping them.
const POOL_SETTINGS = { idleTimeoutMillis: 5 * 60_000, keepAlive: true };

// This pool connects as the least-privilege app_user role (not the table
// owner), so Postgres RLS policies actually apply. Never point this at
// DATABASE_URL - that's the owner connection, used only by migrations.
export const pool = new Pool({ connectionString: env.APP_DATABASE_URL, max: 10, ...POOL_SETTINGS });

pool.on("error", (err) => {
  logger.error("Unexpected error on idle Postgres client", { error: err.message });
});

// Owner connection - BYPASSES RLS. Only the super-admin module uses it, and
// only behind requireSuperAdmin, for the cross-tenant reads moderation needs
// (every user, every listing, any room). Kept small: admin traffic is tiny.
export const adminPool = new Pool({ connectionString: env.DATABASE_URL, max: 3, ...POOL_SETTINGS });

adminPool.on("error", (err) => {
  logger.error("Unexpected error on idle admin Postgres client", { error: err.message });
});

// Opens a few connections at startup, so the first page load (several
// requests in parallel) doesn't wait for brand-new connections.
export async function warmUpPool(connections = 6) {
  const clients = await Promise.all(Array.from({ length: connections }, () => pool.connect()));
  clients.forEach((c) => c.release());
}

// A plain transaction on the admin connection (no RLS context to set).
export async function withAdminTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    logger.error("Postgres connection check failed", { error: (err as Error).message });
    return false;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every authenticated request's DB work should go through this: it runs the
// callback in a transaction with app.current_user_id set via SET LOCAL, which
// is what the RLS policies key off. Outside of this, queries see zero rows.
//
// BEGIN and SET LOCAL go to the server as ONE round trip (two statements in a
// single simple query). That needs the id written into the SQL text, which is
// safe only because it's checked to be a UUID first - it comes from our own
// signed JWT, and the check makes injection impossible even if it didn't.
export async function withUserContext<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (userId !== null && !UUID.test(userId)) throw new Error("withUserContext: user id is not a UUID");
  const client = await pool.connect();
  try {
    await client.query(userId ? `BEGIN; SET LOCAL app.current_user_id = '${userId}'` : "BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
