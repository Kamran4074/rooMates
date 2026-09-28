import { Pool, PoolClient } from "pg";
import { env } from "./env";
import { logger } from "./logger";

// This pool connects as the least-privilege app_user role (not the table
// owner), so Postgres RLS policies actually apply. Never point this at
// DATABASE_URL - that's the owner connection, used only by migrations.
export const pool = new Pool({
  connectionString: env.APP_DATABASE_URL,
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle Postgres client", { error: err.message });
});

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    logger.error("Postgres connection check failed", { error: (err as Error).message });
    return false;
  }
}

// Every authenticated request's DB work should go through this: it runs the
// callback in a transaction with app.current_user_id set via SET LOCAL, which
// is what the RLS policies key off. Outside of this, queries see zero rows.
export async function withUserContext<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    }
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
