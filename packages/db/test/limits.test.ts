import { describe, expect, it } from "vitest";
import { effectiveTier, limitsFor, renderBlocked } from "../src/limits";

describe("effectiveTier", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("keeps free as free", () => expect(effectiveTier({ tier: "free", proUntil: null }, now)).toBe("free"));
  it("pro with no end date stays pro", () => expect(effectiveTier({ tier: "pro", proUntil: null }, now)).toBe("pro"));
  it("pro before its end date is pro", () => expect(effectiveTier({ tier: "pro", proUntil: new Date("2026-10-02T00:00:00Z") }, now)).toBe("pro"));
  it("pro after its end date is free", () => expect(effectiveTier({ tier: "pro", proUntil: new Date("2026-10-01T11:59:59Z") }, now)).toBe("free"));
  it("ends exactly at proUntil", () => expect(effectiveTier({ tier: "pro", proUntil: now }, now)).toBe("free"));
  it("gives pro the larger render limit", () => expect(limitsFor("pro").rendersPerMonth).toBeGreaterThan(limitsFor("free").rendersPerMonth));
});

describe("renderBlocked", () => {
  const base = { videos: 5, videosLimit: 5, videoIds: ["a", "b", "c", "d", "e"], renders: 9, rendersLimit: 25, aiCalls: 0, aiCallsLimit: 40, resetsOn: new Date("2026-11-01T00:00:00Z") };
  it("a sixth free video is blocked", () => expect(renderBlocked(base, "f")).toMatch(/5 of your 5 free videos/));
  it("re-rendering one of this month's videos is fine", () => expect(renderBlocked(base, "c")).toBeNull());
  it("the render cap still applies", () => expect(renderBlocked({ ...base, renders: 25 }, "c")).toMatch(/all 25 renders/));
  it("pro has no video limit", () => expect(renderBlocked({ ...base, videosLimit: null, rendersLimit: 200 }, "f")).toBeNull());
  it("a batch needs a video per row", () => expect(renderBlocked({ ...base, videos: 3, videoIds: ["a", "b", "c"] }, "new", 3)).toMatch(/free videos/));
  it("free gets 5 videos by default", () => expect(limitsFor("free").videosPerMonth).toBe(5));
});
