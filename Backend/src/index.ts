import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { pool } from "./config/db";

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

// Hosts like Render/Railway send SIGTERM on every deploy. Stop accepting new
// connections, let in-flight requests finish, then close the DB pool - instead
// of cutting requests off mid-transaction.
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  // Don't hang forever on a stuck keep-alive connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
