import { describe, expect, it } from "vitest";
import { effectiveTier, limitsFor } from "../src/limits";

describe("effectiveTier", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("keeps free as free", () => expect(effectiveTier({ tier: "free", proUntil: null }, now)).toBe("free"));
  it("pro with no end date stays pro", () => expect(effectiveTier({ tier: "pro", proUntil: null }, now)).toBe("pro"));
  it("pro before its end date is pro", () => expect(effectiveTier({ tier: "pro", proUntil: new Date("2026-10-02T00:00:00Z") }, now)).toBe("pro"));
  it("pro after its end date is free", () => expect(effectiveTier({ tier: "pro", proUntil: new Date("2026-10-01T11:59:59Z") }, now)).toBe("free"));
  it("ends exactly at proUntil", () => expect(effectiveTier({ tier: "pro", proUntil: now }, now)).toBe("free"));
  it("gives pro the larger render limit", () => expect(limitsFor("pro").rendersPerMonth).toBeGreaterThan(limitsFor("free").rendersPerMonth));
});
