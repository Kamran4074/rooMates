// Runs once before `npm run test:api`. The API tests write to the database
// (throwaway users, rooms...) and one of them re-seeds the super admin, which
// demotes every other super admin - harmless on a scratch database, a real
// outage on production. So refuse anything but a local database unless you
// explicitly say otherwise.
//
// Local (Docker, see README):  the default, nothing to do.
// Anything else on purpose:    ALLOW_REMOTE_TEST_DB=yes npm run test:api
require("dotenv").config({ quiet: true });

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

module.exports = function guardDatabase() {
  const url = process.env.DATABASE_URL;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // An unparseable URL fails later with a clearer error from pg.
    return;
  }
  if (LOCAL.has(host) || process.env.ALLOW_REMOTE_TEST_DB === "yes") return;

  // The host is left out on purpose: it would put .env details into logs.
  throw new Error(
    "Refusing to run API tests: DATABASE_URL is not a local database.\n" +
      "They create and delete data and re-seed the super admin. Point DATABASE_URL and\n" +
      "APP_DATABASE_URL at a local Docker Postgres (see README > Tests), or set\n" +
      "ALLOW_REMOTE_TEST_DB=yes if you really mean it."
  );
};
