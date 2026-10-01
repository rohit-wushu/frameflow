// pnpm templates:catalog -> packages/templates/catalog.md, the template list the director reads.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "../catalog.js";
import { templates } from "../registry.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "catalog.md");
writeFileSync(out, buildCatalog());
console.log(`wrote ${out} (${Object.keys(templates).length} templates)`);
