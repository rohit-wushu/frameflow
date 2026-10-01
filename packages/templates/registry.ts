import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TemplateRules } from "@frameflow/scene-schema";
import type { z } from "zod";
import type { Template, TemplateExample, TemplateMeta } from "./types.js";

import { meta as ctaMeta } from "./cta/meta.js";
import { schema as ctaSchema } from "./cta/schema.js";
import { meta as featureGridMeta } from "./feature_grid/meta.js";
import { schema as featureGridSchema } from "./feature_grid/schema.js";
import { meta as heroTextMeta } from "./hero_text/meta.js";
import { schema as heroTextSchema } from "./hero_text/schema.js";
import { meta as logoRevealMeta } from "./logo_reveal/meta.js";
import { schema as logoRevealSchema } from "./logo_reveal/schema.js";
import { meta as statCounterMeta } from "./stat_counter/meta.js";
import { schema as statCounterSchema } from "./stat_counter/schema.js";
import { meta as kineticWordsMeta } from "./kinetic_words/meta.js";
import { schema as kineticWordsSchema } from "./kinetic_words/schema.js";
import { meta as problemListMeta } from "./problem_list/meta.js";
import { schema as problemListSchema } from "./problem_list/schema.js";
import { meta as featureSpotlightMeta } from "./feature_spotlight/meta.js";
import { schema as featureSpotlightSchema } from "./feature_spotlight/schema.js";
import { meta as deviceMockupMeta } from "./device_mockup/meta.js";
import { schema as deviceMockupSchema } from "./device_mockup/schema.js";
import { meta as screenshotZoomMeta } from "./screenshot_zoom/meta.js";
import { schema as screenshotZoomSchema } from "./screenshot_zoom/schema.js";
import { meta as comparisonMeta } from "./comparison/meta.js";
import { schema as comparisonSchema } from "./comparison/schema.js";
import { meta as testimonialMeta } from "./testimonial/meta.js";
import { schema as testimonialSchema } from "./testimonial/schema.js";

export type { Template, TemplateExample, TemplateMeta } from "./types.js";
export { commonIcons, FALLBACK_ICON, iconExists, iconNames, iconSvg, suggestIcons } from "./icons.js";

const root = dirname(fileURLToPath(import.meta.url));

function load(meta: TemplateMeta, schema: z.ZodType): Template {
  const dir = join(root, meta.name);
  return {
    meta,
    schema,
    dir,
    html: readFileSync(join(dir, "template.html"), "utf8"),
    example: JSON.parse(readFileSync(join(dir, "example.json"), "utf8")) as TemplateExample,
  };
}

export const templates: Record<string, Template> = Object.fromEntries(
  [
    load(heroTextMeta, heroTextSchema),
    load(kineticWordsMeta, kineticWordsSchema),
    load(problemListMeta, problemListSchema),
    load(featureGridMeta, featureGridSchema),
    load(featureSpotlightMeta, featureSpotlightSchema),
    load(statCounterMeta, statCounterSchema),
    load(deviceMockupMeta, deviceMockupSchema),
    load(screenshotZoomMeta, screenshotZoomSchema),
    load(comparisonMeta, comparisonSchema),
    load(testimonialMeta, testimonialSchema),
    load(ctaMeta, ctaSchema),
    load(logoRevealMeta, logoRevealSchema),
  ].map((t) => [t.meta.name, t]),
);

export function getTemplate(name: string): Template {
  const t = templates[name];
  if (!t) throw new Error(`unknown template "${name}"; available: ${Object.keys(templates).join(", ")}`);
  return t;
}

// What the plan validator needs from each template.
export function templateRules(): Record<string, TemplateRules> {
  return Object.fromEntries(
    Object.values(templates).map((t) => [t.meta.name, { category: t.meta.category, minDuration: t.meta.minDuration, maxDuration: t.meta.maxDuration, schema: t.schema }]),
  );
}
