import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { templateRules, templates } from "../registry.js";

describe("template registry", () => {
  const all = Object.values(templates);

  it("has all 12 templates", () => {
    expect(Object.keys(templates).sort()).toEqual([
      "comparison", "cta", "device_mockup", "feature_grid", "feature_spotlight", "hero_text", "kinetic_words",
      "logo_reveal", "problem_list", "screenshot_zoom", "stat_counter", "testimonial",
    ]);
  });

  it.each(all.filter((t) => t.example.content.image).map((t) => [t.meta.name, t] as const))("%s: example image exists", (_, t) => {
    const asset = t.example.assets?.[t.example.content.image as string];
    expect(asset).toBeDefined();
    expect(existsSync(join(t.dir, asset!.file))).toBe(true);
  });

  it.each(all.map((t) => [t.meta.name, t] as const))("%s: example passes its schema and fits its duration", (_, t) => {
    const r = t.schema.safeParse(t.example.content);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(t.example.estDuration).toBeGreaterThanOrEqual(t.meta.minDuration);
    expect(t.example.estDuration).toBeLessThanOrEqual(t.meta.maxDuration);
  });

  it.each(all.map((t) => [t.meta.name, t] as const))("%s: registers itself in template.html and reads brand tokens, not colors", (name, t) => {
    expect(t.html).toContain(`FF.register("${name}"`);
    expect(existsSync(join(t.dir, "meta.ts"))).toBe(true);
    const css = /<style>([\s\S]*?)<\/style>/.exec(t.html)?.[1] ?? "";
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]); // colors come from --primary etc.
  });

  it("rejects icon names that are not Tabler icons", () => {
    const grid = templates.feature_grid.schema;
    const content = { title: "Hi", items: [{ icon: "microphone", title: "Ok" }, { icon: "not-an-icon-xyz", title: "Bad" }] };
    const r = grid.safeParse(content);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["items", 1, "icon"]);
  });

  it("rejects a highlight word that is not in the headline", () => {
    expect(templates.hero_text.schema.safeParse({ headline: "Hello world", highlight: "moon" }).success).toBe(false);
    expect(templates.hero_text.schema.safeParse({ headline: "Hello world!", highlight: "World" }).success).toBe(true);
  });

  it("exposes validator rules with a hook and end templates", () => {
    const rules = templateRules();
    expect(Object.values(rules).some((r) => r.category === "hook")).toBe(true);
    expect(rules.logo_reveal.category).toBe("end");
  });
});
