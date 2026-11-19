import { describe, expect, it } from "vitest";
import { createSessionToken, safeEqual, verifySessionToken } from "@/lib/auth";

const secret = "x".repeat(40);

describe("session tokens", () => {
  it("accepts a fresh token", async () => {
    expect(await verifySessionToken(await createSessionToken(secret), secret)).toBe(true);
  });
  it("rejects tampering, wrong secret, expiry and junk", async () => {
    const t = await createSessionToken(secret);
    const [a, exp, sig] = t.split(".");
    expect(await verifySessionToken(`${a}.${Number(exp) + 1000}.${sig}`, secret)).toBe(false);
    expect(await verifySessionToken(t, "y".repeat(40))).toBe(false);
    expect(await verifySessionToken(t, secret, Number(exp) + 1)).toBe(false);
    expect(await verifySessionToken(undefined, secret)).toBe(false);
    expect(await verifySessionToken("owner.1.2.3", secret)).toBe(false);
  });
  it("compares strings safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
