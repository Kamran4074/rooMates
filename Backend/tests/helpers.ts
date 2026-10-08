import { AddressInfo } from "net";
import { Server } from "http";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { env } from "../src/config/env";
import { adminPool, pool } from "../src/config/db";

// Integration-test helpers: the real Express app on a random port, real
// database (from .env), throwaway users created directly in the DB and
// removed again in cleanup(). Nothing here is mocked except outgoing email.

let server: Server;
let baseUrl = "";
const createdUsers: string[] = [];
const createdOrgs: string[] = [];

export async function startServer() {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export async function createUser(options: { role?: "user" | "super_admin"; phone?: boolean } = {}): Promise<TestUser> {
  const id = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const email = `apitest-${id.slice(0, 8)}@example.com`;
  // A unique, valid Indian mobile per user (the column is unique).
  const phone = options.phone === false ? null : `+919${String(crypto.randomInt(0, 1e9)).padStart(9, "0")}`;
  await adminPool.query("INSERT INTO organizations (id, name) VALUES ($1, 'api test')", [orgId]);
  await adminPool.query(
    `INSERT INTO users (id, organization_id, email, name, phone, role, email_verified, onboarding_completed, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, true, true, 'not-a-real-hash')`,
    [id, orgId, email, `Test ${id.slice(0, 4)}`, phone, options.role ?? "user"]
  );
  createdUsers.push(id);
  createdOrgs.push(orgId);
  const token = jwt.sign({ sub: id, organizationId: orgId, email, name: "Test" }, env.JWT_SECRET, { expiresIn: "15m" });
  return { id, email, token };
}

// Track users the tests create through the API (e.g. signup) for cleanup.
export async function trackUserByEmail(email: string) {
  const { rows } = await adminPool.query("SELECT id, organization_id FROM users WHERE email = $1", [email]);
  if (rows[0]) {
    createdUsers.push(rows[0].id);
    createdOrgs.push(rows[0].organization_id);
  }
}

export async function api(user: TestUser | null, method: string, path: string, body?: unknown) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(user && { Authorization: `Bearer ${user.token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// For non-JSON responses (CSV downloads).
export async function apiRaw(user: TestUser | null, path: string) {
  const res = await fetch(baseUrl + path, { headers: user ? { Authorization: `Bearer ${user.token}` } : {} });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

export const validListing =(overrides: Record<string, unknown> = {}) => ({
  title: "Sunny private room near metro",
  description: "Bright room in a 2BHK, 5 minutes from the metro station, friendly flatmates.",
  rent: 8500,
  roomType: "private_room",
  furnishing: "semi_furnished",
  amenities: ["wifi", "geyser"],
  locality: "Lajpat Nagar",
  city: `TestCity${crypto.randomUUID().slice(0, 6)}`, // unique per test, so searches only see our rows
  state: "Delhi",
  pincode: "110024",
  latitude: 28.5677,
  longitude: 77.2433,
  availableFrom: "2026-11-01",
  ...overrides,
});

export async function cleanup() {
  if (createdUsers.length) {
    // Order matters where foreign keys don't cascade.
    await adminPool.query("DELETE FROM audit_logs WHERE admin_id = ANY($1)", [createdUsers]);
    await adminPool.query("UPDATE listing_reports SET resolved_by = NULL WHERE resolved_by = ANY($1)", [createdUsers]);
    await adminPool.query("DELETE FROM listings WHERE owner_id = ANY($1)", [createdUsers]);
    await adminPool.query("DELETE FROM rooms WHERE created_by = ANY($1)", [createdUsers]);
    await adminPool.query("DELETE FROM refresh_tokens WHERE user_id = ANY($1)", [createdUsers]);
    await adminPool.query("DELETE FROM users WHERE id = ANY($1)", [createdUsers]);
    await adminPool.query("DELETE FROM organizations WHERE id = ANY($1)", [createdOrgs]);
  }
  await new Promise((resolve) => server?.close(resolve));
  await Promise.all([pool.end(), adminPool.end()]);
}
