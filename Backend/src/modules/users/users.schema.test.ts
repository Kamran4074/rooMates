import { indianMobile } from "./users.schema";

describe("indianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("normalises %s to %s so the same number can't register twice", (input, expected) => {
    expect(indianMobile.parse(input)).toBe(expected);
  });

  it.each(["12345", "5876543210", "98765432101", "+1 415 555 0100", ""])("rejects %p", (input) => {
    expect(indianMobile.safeParse(input).success).toBe(false);
  });
});
