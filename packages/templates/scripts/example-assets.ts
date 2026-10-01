// Renders _assets/mock-site.html (a made-up product page) to the example screenshots the image templates'
// previews use, with the same named regions brand research finds on real sites.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "_assets");
const scan = readFileSync(join(dir, "..", "..", "director", "src", "page-scan.js"), "utf8");
const browser = await chromium.launch();
const out: Record<string, unknown> = {};
for (const [name, opts] of [
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ["mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }],
] as const) {
  const page = await (await browser.newContext(opts)).newPage();
  await page.goto(`file://${join(dir, "mock-site.html")}`);
  const file = `example-${name}.png`;
  await page.screenshot({ path: join(dir, file) });
  const { regions } = (await page.evaluate(scan)) as { regions: Record<string, unknown> };
  out[name] = { file, width: opts.viewport.width * 2, height: opts.viewport.height * 2, regions: name === "desktop" ? regions : undefined };
}
await browser.close();
writeFileSync(join(dir, "example-assets.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 1));
