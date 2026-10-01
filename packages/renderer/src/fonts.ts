import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

// Google Fonts are downloaded once into a cache and served as local files, so renders are
// deterministic (motion-video-skill's rule: local font files with font-display: block).
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const LATIN = ["latin", "latin-ext"];

export interface LoadedFont {
  css: string; // @font-face rules pointing at assets/fonts/<file>
  files: { name: string; path: string }[];
}

async function fetchCss(family: string, weights: number[]): Promise<string> {
  const base = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family).replace(/%20/g, "+");
  // not every family has every weight; fall back to the default weight
  for (const url of [`${base}:wght@${weights.join(";")}&display=block`, `${base}&display=block`]) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.text();
  }
  throw new Error(`font "${family}" was not found on Google Fonts`);
}

// `subsets`: the Unicode ranges to keep (Google splits fonts per script), e.g. add "devanagari" for Hindi.
export async function loadGoogleFont(family: string, weights: number[], cacheDir: string, subsets: string[] = LATIN): Promise<LoadedFont> {
  const keep = new Set(subsets);
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dir = join(cacheDir, slug);
  await mkdir(dir, { recursive: true });
  const cssPath = join(dir, `fonts-${weights.join("-")}.css`);
  let css: string;
  if (existsSync(cssPath)) css = await readFile(cssPath, "utf8");
  else {
    css = await fetchCss(family, weights);
    await writeFile(cssPath, css);
  }

  const tagged = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
  const blocks = tagged.length ? tagged.filter((m) => keep.has(m[1])).map((m) => m[2]) : [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);
  const files: LoadedFont["files"] = [];
  const out: string[] = [];
  for (const block of blocks) {
    const url = /url\((https:[^)]+)\)/.exec(block)?.[1];
    if (!url) continue;
    const name = `${slug}-${createHash("sha1").update(url).digest("hex").slice(0, 10)}${extname(new URL(url).pathname) || ".woff2"}`;
    const local = join(dir, name);
    if (!existsSync(local)) {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`could not download font file for "${family}": HTTP ${res.status}`);
      await writeFile(local, Buffer.from(await res.arrayBuffer()));
    }
    files.push({ name, path: local });
    out.push(block.replace(/url\([^)]+\)/, `url("assets/fonts/${name}")`).replace(/font-display:\s*\w+;?/, "font-display: block;"));
  }
  if (!out.length) throw new Error(`font "${family}" has no ${subsets.join("/")} files on Google Fonts`);
  return { css: out.join("\n"), files };
}
