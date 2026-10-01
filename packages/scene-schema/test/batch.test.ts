import { describe, expect, it } from "vitest";
import { batchPlans, fillPlan, findPlaceholders, parseCsv } from "../src/batch";

describe("parseCsv", () => {
  it("reads quotes, commas and newlines inside quotes, CRLF and a BOM", () => {
    const csv = parseCsv('﻿name,city,tagline\r\nAsha,"Pune, MH","She said ""hi""\nthen left"\r\nRavi,Delhi,\n');
    expect(csv.headers).toEqual(["name", "city", "tagline"]);
    expect(csv.rows).toEqual([
      { name: "Asha", city: "Pune, MH", tagline: 'She said "hi"\nthen left' },
      { name: "Ravi", city: "Delhi", tagline: "" },
    ]);
  });

  it("skips blank lines and rejects broken files", () => {
    expect(parseCsv("a,b\n\n1,2\n\n").rows).toEqual([{ a: "1", b: "2" }]);
    expect(() => parseCsv('a,b\n"1,2\n')).toThrow(/unclosed quote/);
    expect(() => parseCsv("a,a\n1,2")).toThrow(/repeats the column a/);
    expect(() => parseCsv("a,b\n1,2,3")).toThrow(/more values/);
    expect(() => parseCsv("\n\n")).toThrow(/empty/);
  });
});

describe("placeholders", () => {
  const plan = {
    title: "Welcome {{ name }}",
    brand: { name: "Acme", logoUrl: "uploads/{{name}}.png" },
    assets: { website: { file: "research/{{x}}/shot.png" } },
    scenes: [{ content: { headline: "Hi {{name}}", items: ["{{city}} office"] }, voiceover: "Hello {{name}} from {{city}}." }],
  };

  it("finds them anywhere in the text", () => {
    expect(findPlaceholders(plan).sort()).toEqual(["city", "name", "x"]);
  });

  it("fills text but never file references", () => {
    const filled = fillPlan(plan, { name: "Asha", city: "Pune" });
    expect(filled.title).toBe("Welcome Asha");
    expect(filled.scenes[0].content.items).toEqual(["Pune office"]);
    expect(filled.scenes[0].voiceover).toBe("Hello Asha from Pune.");
    expect(filled.brand.logoUrl).toBe("uploads/{{name}}.png");
    expect(filled.assets.website.file).toBe("research/{{x}}/shot.png");
  });

  it("checks the CSV has every column and value", () => {
    const p = { title: "{{name}}", scenes: [{ voiceover: "{{city}}" }] };
    expect(batchPlans(p, parseCsv("name,city\nAsha,Pune\nRavi,Delhi")).map((r) => r.plan.title)).toEqual(["Asha", "Ravi"]);
    expect(() => batchPlans(p, parseCsv("name\nAsha"))).toThrow(/no column for \{\{city\}\}/);
    expect(() => batchPlans(p, parseCsv("name,city\nAsha,"))).toThrow(/row 1 has no value for city/);
    expect(() => batchPlans({ title: "plain" }, parseCsv("name\nAsha"))).toThrow(/no \{\{column\}\} placeholders/);
    expect(() => batchPlans(p, parseCsv("name,city\n" + "a,b\n".repeat(3)), 2)).toThrow(/limit is 2/);
  });
});
