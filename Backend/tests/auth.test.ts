import { adminPool } from "../src/config/db";
import { sha256 } from "../src/utils/hash";
import { api, cleanup, createUser, startServer, trackUserByEmail } from "./helpers";

// No real emails from tests: the OTP is replaced with a known code below.
jest.mock("../src/config/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  escapeHtml: (s: string) => s,
}));

beforeAll(startServer);
afterAll(cleanup);

const email = `apitest-signup-${Date.now()}@example.com`;
const password = "correct horse battery";

// The real code is random and stored hashed; give the latest one a known value.
async function setOtp(code: string) {
  await adminPool.query(
    `UPDATE otp_codes SET code_hash = $2
     WHERE id = (SELECT o.id FROM otp_codes o JOIN users u ON u.id = o.user_id
                 WHERE u.email = $1 ORDER BY o.created_at DESC LIMIT 1)`,
    [email, sha256(code)]
  );
}

describe("register -> verify -> login", () => {
  it("signs up (terms required), stores only a bcrypt hash", async () => {
    const noTerms = await api(null, "POST", "/api/auth/signup", { name: "Asha", email, password });
    expect(noTerms.status).toBe(400);

    const res = await api(null, "POST", "/api/auth/signup", { name: "Asha", email: email.toUpperCase(), password, agreedToTerms: true });
    expect(res.status).toBe(201);
    await trackUserByEmail(email);

    const { rows } = await adminPool.query("SELECT email, password_hash FROM users WHERE email = $1", [email]);
    expect(rows[0].email).toBe(email); // normalised to lowercase
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain(password);
  });

  it("blocks login until the email is verified", async () => {
    const res = await api(null, "POST", "/api/auth/login", { email, password });
    expect(res.status).toBe(403);
  });

  it("a wrong code fails; the right one signs in", async () => {
    await setOtp("123456");
    expect((await api(null, "POST", "/api/auth/verify-email", { email, code: "000000" })).status).toBe(400);
    const ok = await api(null, "POST", "/api/auth/verify-email", { email, code: "123456" });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual(
      expect.objectContaining({ accessToken: expect.any(String), refreshToken: expect.any(String) })
    );
    expect(ok.body.data.user.role).toBe("user");
  });

  it("logs in with the right password only, and the token works", async () => {
    expect((await api(null, "POST", "/api/auth/login", { email, password: "wrong password" })).status).toBe(401);
    const login = await api(null, "POST", "/api/auth/login", { email, password });
    expect(login.status).toBe(200);

    const me = await api({ id: "", email, token: login.body.data.accessToken }, "GET", "/api/users/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it("a refresh token works once (rotation)", async () => {
    const login = await api(null, "POST", "/api/auth/login", { email, password });
    const { refreshToken } = login.body.data;
    expect((await api(null, "POST", "/api/auth/refresh", { refreshToken })).status).toBe(200);
    expect((await api(null, "POST", "/api/auth/refresh", { refreshToken })).status).toBe(401);
  });
});

describe("authentication on protected routes", () => {
  it("rejects missing and forged tokens", async () => {
    expect((await api(null, "GET", "/api/rooms")).status).toBe(401);
    const forged = await api({ id: "", email: "", token: "eyJhbGciOiJIUzI1NiJ9.e30.forged" }, "GET", "/api/rooms");
    expect(forged.status).toBe(401);
  });

  it("room data is invisible to non-members", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const room = await api(a, "POST", "/api/rooms", { name: "Private flat", type: "roommates" });
    expect((await api(b, "GET", `/api/rooms/${room.body.data.id}`)).status).toBe(404);
    expect((await api(b, "GET", `/api/rooms/${room.body.data.id}/expenses`)).status).toBe(404);
    const add = await api(b, "POST", `/api/rooms/${room.body.data.id}/expenses`, { description: "x", amount: 10, splitType: "equal" });
    expect(add.status).toBe(404);
  });
});
