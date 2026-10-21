import type { Request } from "express";

// Auth requests come through the frontend's proxy, which forwards the
// browser's IP. That IP must only be believed with the shared secret - or
// anyone could send a fake IP and get a fresh rate-limit budget each time.
const SECRET = "s".repeat(32);
jest.mock("../config/env", () => ({ env: { PROXY_SECRET: "s".repeat(32) } }));

import { clientIp } from "./clientIp";

const req = (headers: Record<string, string>) =>
  ({ ip: "10.0.0.1", get: (name: string) => headers[name.toLowerCase()] }) as unknown as Request;

describe("clientIp", () => {
  it("uses the forwarded IP when the proxy secret matches", () => {
    expect(clientIp(req({ "x-roomates-client-ip": "203.0.113.7", "x-roomates-proxy-secret": SECRET }))).toBe("203.0.113.7");
  });

  it("ignores the forwarded IP without the right secret", () => {
    expect(clientIp(req({ "x-roomates-client-ip": "203.0.113.7" }))).toBe("10.0.0.1");
    expect(clientIp(req({ "x-roomates-client-ip": "203.0.113.7", "x-roomates-proxy-secret": "wrong" }))).toBe("10.0.0.1");
  });

  it("ignores a forwarded value that isn't an IP", () => {
    expect(clientIp(req({ "x-roomates-client-ip": "not-an-ip", "x-roomates-proxy-secret": SECRET }))).toBe("10.0.0.1");
  });
});
