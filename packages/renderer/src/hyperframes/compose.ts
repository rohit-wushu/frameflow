import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FORMAT_SIZE, type ScenePlan } from "@frameflow/scene-schema";
import { FALLBACK_ICON, getTemplate, iconSvg } from "@frameflow/templates";
import type { CaptionChunk, TimingResult } from "@frameflow/timing";
import { loadGoogleFont } from "../fonts.js";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const run = promisify(execFile);
const FALLBACK_FONT = "Inter";
const DEVANAGARI_FONT = "Noto Sans Devanagari";

export interface ComposeInput {
  plan: ScenePlan;
  timing: TimingResult;
  captions: CaptionChunk[];
  burnCaptions: boolean;
  mixFile: string;
  logoFile: string | null; // local file, already downloaded
  images?: Record<string, string>; // plan.assets name -> local file
  projectDir: string;
  fontCacheDir: string;
}

// JSON that is safe inside a <script> tag
const scriptJson = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Text color for use on the primary color (buttons, set large): white while it meets WCAG's 3:1
// for large text, otherwise near-black.
export function onColor(hex: string): string {
  return 1.05 / (luminance(hex) + 0.05) >= 3 ? "#FFFFFF" : "#0B0B10";
}

// width / height of an image file (1 when unknown): square logos get the brand name next to them
async function imageAspect(file: string): Promise<number> {
  try {
    if (extname(file).toLowerCase() === ".svg") {
      const svg = await readFile(file, "utf8");
      const tag = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
      const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
      const w = Number(/\swidth="([\d.]+)/.exec(tag)?.[1] ?? vb?.[1]);
      const h = Number(/\sheight="([\d.]+)/.exec(tag)?.[1] ?? vb?.[2]);
      return w > 0 && h > 0 ? w / h : 1;
    }
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
    const [w, h] = stdout.trim().split(",").map(Number);
    return w > 0 && h > 0 ? w / h : 1;
  } catch {
    return 1;
  }
}

function collectIcons(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => collectIcons(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "icon" && typeof v === "string") out.add(v);
      else collectIcons(v, out);
    }
  }
}

async function fontCss(plan: ScenePlan, cacheDir: string, fontsDir: string, warnings: string[]) {
  const families = { heading: plan.brand.font.heading, body: plan.brand.font.body };
  // Hindi: keep the brand fonts' Devanagari files too when they have them (Poppins, Mukta, ...)
  const subsets = plan.language === "en" ? undefined : ["latin", "latin-ext", "devanagari"];
  const weights = { heading: [600, 700], body: [400, 500, 600] };
  const css: string[] = [];
  for (const role of ["heading", "body"] as const) {
    let family = families[role];
    let font;
    try {
      font = await loadGoogleFont(family, weights[role], cacheDir, subsets);
    } catch (e) {
      warnings.push(`${(e as Error).message}; using ${FALLBACK_FONT} for the ${role}`);
      family = FALLBACK_FONT;
      font = await loadGoogleFont(family, weights[role], cacheDir);
    }
    families[role] = family;
    for (const f of font.files) await copyFile(f.path, join(fontsDir, f.name));
    css.push(font.css);
  }
  // Hindi text: most brand fonts have no Devanagari, so the browser falls back to this one per glyph
  let script: string | null = null;
  if (plan.language !== "en") {
    try {
      const deva = await loadGoogleFont(DEVANAGARI_FONT, [400, 500, 600, 700], cacheDir, ["devanagari", "latin"]);
      for (const f of deva.files) await copyFile(f.path, join(fontsDir, f.name));
      css.push(deva.css);
      script = DEVANAGARI_FONT;
    } catch (e) {
      warnings.push(`${(e as Error).message}; Hindi text uses the system font`);
    }
  }
  return { css: [...new Set(css)].join("\n"), families, script };
}

// Write a HyperFrames project (index.html + assets) for a timed plan.
export async function composeProject(input: ComposeInput): Promise<{ indexPath: string; warnings: string[] }> {
  const { plan, timing, projectDir } = input;
  const warnings: string[] = [];
  const size = FORMAT_SIZE[plan.format];
  const u = Math.min(size.width, size.height) / 100;
  const dirs = ["assets/fonts", "assets/audio", "assets/images", "vendor"].map((d) => join(projectDir, d));
  await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));

  await copyFile(require.resolve("gsap/dist/gsap.min.js"), join(projectDir, "vendor/gsap.min.js"));
  await copyFile(input.mixFile, join(projectDir, "assets/audio/mix.m4a"));
  let logo: { src: string; aspect: number } | null = null;
  if (input.logoFile) {
    const src = `assets/images/logo${extname(input.logoFile) || ".png"}`;
    await copyFile(input.logoFile, join(projectDir, src));
    logo = { src, aspect: await imageAspect(input.logoFile) };
  }
  // images scenes show (screenshots for device_mockup / screenshot_zoom), with their named regions
  const images: Record<string, { src: string; aspect: number; regions: Record<string, unknown> }> = {};
  for (const [name, file] of Object.entries(input.images ?? {})) {
    const src = `assets/images/img-${name}${extname(file) || ".png"}`;
    await copyFile(file, join(projectDir, src));
    const asset = plan.assets?.[name];
    images[name] = { src, aspect: asset?.width && asset?.height ? asset.width / asset.height : await imageAspect(file), regions: asset?.regions ?? {} };
  }
  const fonts = await fontCss(plan, input.fontCacheDir, join(projectDir, "assets/fonts"), warnings);

  const iconNames = new Set<string>();
  plan.scenes.forEach((s) => collectIcons(s.content, iconNames));
  const icons: Record<string, string> = { __fallback: iconSvg(FALLBACK_ICON)! };
  for (const name of iconNames) {
    const svg = iconSvg(name);
    if (svg) icons[name] = svg;
    else warnings.push(`icon "${name}" is not a Tabler icon; using "${FALLBACK_ICON}"`);
  }

  const used = [...new Set(plan.scenes.map((s) => s.template))];
  const fragments = used.map((name) => getTemplate(name).html).join("\n");
  const runtime = await readFile(join(here, "runtime.js"), "utf8");
  const shellCss = await readFile(join(here, "shell.css"), "utf8");
  const c = plan.brand.colors;

  const page = {
    format: plan.format,
    captions: input.burnCaptions,
    brand: { name: plan.brand.name, colors: c },
    logo,
    images,
    icons,
    scenes: plan.scenes.map((s) => ({ id: s.id, template: s.template, content: s.content, transitionOut: s.transitionOut, textScale: s.textScale })),
  };
  const timingForPage = {
    duration: timing.duration,
    fps: timing.fps,
    beats: timing.beats,
    downbeats: timing.downbeats,
    scenes: timing.scenes.map(({ cutOut, ...s }) => s),
    captions: input.captions,
  };
  const D = timing.duration;

  const html = `<!DOCTYPE html>
<html lang="${plan.language === "en" ? "en" : "hi"}" data-resolution="${size.resolution}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${size.width}, height=${size.height}">
<title>${escapeHtml(plan.title)}</title>
<script src="vendor/gsap.min.js"></script>
<style>
${fonts.css}
:root {
  --W: ${size.width}px; --H: ${size.height}px; --u: ${u}px;
  --bg: ${c.background}; --primary: ${c.primary}; --secondary: ${c.secondary}; --text: ${c.text}; --on-primary: ${onColor(c.primary)};
  --muted: color-mix(in srgb, var(--text) 68%, var(--bg));
  --card: color-mix(in srgb, var(--text) 6%, transparent);
  --line: color-mix(in srgb, var(--text) 14%, transparent);
  --heading-font: "${fonts.families.heading}",${fonts.script ? ` "${fonts.script}",` : ""} sans-serif;
  --body-font: "${fonts.families.body}",${fonts.script ? ` "${fonts.script}",` : ""} sans-serif;
}
${shellCss}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${D}" data-width="${size.width}" data-height="${size.height}" data-format="${plan.format}">
  <div id="bg" class="layer"></div>
  <div id="stage" class="layer"></div>
  <div id="wipe" class="layer"></div>
  <div id="captions" class="layer"></div>
  <div id="fade" class="layer"></div>
  <audio id="mix" src="assets/audio/mix.m4a" data-start="0" data-duration="${D}" data-track-index="10" data-volume="1"></audio>
</div>
<script>/*TIMING:BEGIN*/window.TIMING=${scriptJson(timingForPage)};/*TIMING:END*/</script>
<script>window.PLAN=${scriptJson(page)};</script>
<script>
${runtime}
</script>
${fragments}
<script>FF.start();</script>
</body>
</html>
`;
  const indexPath = join(projectDir, "index.html");
  await writeFile(indexPath, html);
  await writeFile(
    join(projectDir, "hyperframes.json"),
    JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { assets: "assets" }, media: { autoProxy: true } }, null, 2) + "\n",
  );
  return { indexPath, warnings };
}
