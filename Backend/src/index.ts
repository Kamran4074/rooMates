import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { pool, adminPool, warmUpPool } from "./config/db";
import { runMigrations } from "./config/migrate";
import { scheduleHousekeeping } from "./config/housekeeping";
import { seedSuperAdmin } from "./config/superAdminSeed";

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

  // Never throws: a bad SUPER_ADMIN_* config is logged, not fatal.
  await seedSuperAdmin();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
  // In the background: requests still work if this is slow or fails.
  warmUpPool().catch((err) => logger.warn("Couldn't pre-open DB connections", { error: (err as Error).message }));
  scheduleHousekeeping();

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
