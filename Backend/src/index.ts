import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { pool, adminPool } from "./config/db";
import { runMigrations } from "./config/migrate";

async function start() {
  if (env.MIGRATE_ON_START) {
    try {
      await runMigrations();
    } catch (err) {
      // Serving requests against a half-migrated or outdated schema is worse
      // than not starting at all.
      logger.error("Migrations failed, not starting the server", { error: (err as Error).message });
      process.exit(1);
    }
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  // Hosts like Render/Railway send SIGTERM on every deploy. Stop accepting new
  // connections, let in-flight requests finish, then close the DB pool - instead
  // of cutting requests off mid-transaction.
  function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      Promise.all([pool.end(), adminPool.end()]).finally(() => process.exit(0));
    });
    // Don't hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
