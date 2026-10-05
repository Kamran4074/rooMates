import path from "path";
import { env } from "./env";
import { logger } from "./logger";

// Runs any pending migrations before the server starts accepting requests, so
// the code never runs against an older schema than it expects.
//
// - Uses the OWNER connection (DATABASE_URL): migrations need DDL rights the
//   app_user role deliberately doesn't have. The connection is closed once
//   migrations finish; requests still go through app_user.
// - An advisory lock ("wait" mode) means that if several instances boot at
//   once, one migrates and the others wait, instead of racing each other.
// - All pending migrations run in one transaction: a failure rolls them all
//   back and the server refuses to start.
export async function runMigrations(): Promise<void> {
  // node-pg-migrate v9 is ESM-only; a dynamic import loads it from this
  // CommonJS build.
  const { runner } = await import("node-pg-migrate");

  const applied = await runner({
    databaseUrl: env.DATABASE_URL,
    dir: path.resolve(__dirname, "../../migrations"),
    migrationsTable: "pgmigrations",
    direction: "up",
    checkOrder: true,
    singleTransaction: true,
    advisoryLockMode: "wait",
    // The CLI prints every SQL statement; at startup only the summary matters.
    log: () => {},
  });

  if (applied.length === 0) {
    logger.info("Database schema is up to date");
  } else {
    logger.info(`Applied ${applied.length} migration(s)`, { migrations: applied.map((m) => m.name) });
  }
}
