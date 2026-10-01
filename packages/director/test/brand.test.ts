import { describe, expect, it } from "vitest";
import { brandName, contrast, deriveBrandColors, fontStack, nameVariants, parseColor } from "../src/index.js";

describe("deriveBrandColors", () => {
  it("takes the button color as primary on a light site", () => {
    const { colors } = deriveBrandColors({
      background: "rgb(255, 255, 255)",
      pageBackground: "rgba(0, 0, 0, 0)",
      text: "rgb(17, 24, 39)",
      accents: { "rgb(37, 99, 235)": 90000, "rgb(255, 255, 255)": 50000, "rgb(16, 185, 129)": 20000 },
      areas: { "rgb(255, 255, 255)": 900000, "rgb(243, 244, 246)": 200000 },
    });
    expect(colors).toEqual({ primary: "#2563EB", secondary: "#10B981", background: "#FFFFFF", text: "#111827" });
  });

  it("fixes unreadable text and derives a secondary when there is only one brand color", () => {
    const { colors, notes } = deriveBrandColors({
      background: "rgb(10, 10, 20)",
      pageBackground: "rgb(10, 10, 20)",
      text: "rgb(40, 40, 50)",
      accents: { "rgb(124, 92, 255)": 1000 },
      areas: {},
    });
    expect(colors.primary).toBe("#7C5CFF");
    expect(colors.secondary).not.toBe(colors.primary);
    expect(contrast(parseColor(colors.text)!, parseColor(colors.background)!)).toBeGreaterThanOrEqual(4.5);
    expect(notes.join(" ")).toMatch(/contrast/);
  });

  it("falls back to a default primary on a grayscale site, and says so", () => {
    const { colors, notes } = deriveBrandColors({
      background: "rgb(255, 255, 255)",
      pageBackground: "rgb(255, 255, 255)",
      text: "rgb(0, 0, 0)",
      accents: { "rgb(0, 0, 0)": 5000, "rgb(128, 128, 128)": 3000 },
      areas: {},
    });
    expect(colors.primary).toBe("#6D5DF6");
    expect(notes.join(" ")).toMatch(/no colorful brand color/);
  });

  it("ignores transparent backgrounds", () => {
    const { colors } = deriveBrandColors({ background: "rgba(0, 0, 0, 0)", pageBackground: "rgb(250, 250, 250)", text: "rgb(20,20,20)", accents: {}, areas: {} });
    expect(colors.background).toBe("#FAFAFA");
  });
});

describe("brandName", () => {
  it("prefers og:site_name, then the title part that matches the domain, then the domain", () => {
    expect(brandName({ siteName: "Linear", title: "whatever" }, "https://linear.app")).toBe("Linear");
    expect(brandName({ siteName: "", title: "Plan and build products – Linear" }, "https://linear.app/")).toBe("Linear");
    expect(brandName({ siteName: "", title: "Notion | Your connected workspace" }, "https://www.notion.so")).toBe("Notion");
    expect(brandName({ siteName: "", title: "" }, "https://acme-tools.com")).toBe("Acme-tools");
  });
});

describe("nameVariants", () => {
  it("tries the plain family name behind self-hosted variants", () => {
    expect(nameVariants("Inter Variable")).toContain("Inter");
    expect(nameVariants("GeistSans")).toContain("Geist");
    expect(nameVariants("sohne-var")).toContain("sohne");
    expect(nameVariants("Open Sans")[0]).toBe("Open Sans"); // the full name is always tried first
  });
});

describe("fontStack", () => {
  it("splits and unquotes a CSS font-family", () => {
    expect(fontStack('"Söhne", "Inter var", -apple-system, sans-serif')).toEqual(["Söhne", "Inter var", "-apple-system", "sans-serif"]);
  });
});
