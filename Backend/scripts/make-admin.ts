// Grants (or removes) the super_admin role. Deliberately a server-side script,
// not an API endpoint: there is no request anyone can send to become admin.
//
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- someone@example.com --remove
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const remove = process.argv.includes("--remove");
  if (!email || !process.env.DATABASE_URL) {
    console.error("Usage: npm run make-admin -- <email> [--remove]   (needs DATABASE_URL in .env)");
    process.exit(1);
  }

  // Owner connection: app_user can't change roles, by design.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      "UPDATE users SET role = $1 WHERE email = $2 RETURNING name",
      [remove ? "user" : "super_admin", email]
    );
    if (!rows[0]) {
      console.error(`No account with email ${email}. Sign up first, then run this again.`);
      process.exit(1);
    }
    console.log(`${rows[0].name} <${email}> is now ${remove ? "a regular user" : "a super admin"}. Sign out and back in to see it.`);
  } finally {
    await client.end();
  }
}

main();
