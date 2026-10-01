// Brand research: open the website with Playwright, take a screenshot, and pull out the logo,
// main colors, fonts and page text. The result (brand.json) can be edited before the director runs.
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Asset, Box, Brand } from "@frameflow/scene-schema";
import { deriveBrandColors, type ColorSamples } from "./colors.js";
import { pickGoogleFont } from "./google-fonts.js";
import { checkUrl, safeFetch, startGuardProxy } from "./net-guard.js";

const here = dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);
const RESEARCH_TIMEOUT_MS = 120_000;

export interface Screenshot {
  file: string;
  width: number;
  height: number;
  regions?: Record<string, Box>; // named areas (percent): headline, button, nav, image
}

export interface BrandResearch {
  url: string;
  brand: Brand; // ready to drop into a scene plan (logoUrl is a local file path)
  description: string;
  headings: string[];
  pageText: string; // facts for the director; never invent claims beyond this
  screenshot: string;
  screenshots?: { desktop: Screenshot; mobile?: Screenshot };
  detected: { headingFont: string; bodyFont: string; logo: string | null };
  notes: string[];
}

interface PageScan {
  regions: Record<string, Box>;
  title: string;
  siteName: string;
  description: string;
  headings: string[];
  text: string;
  colors: ColorSamples;
  fonts: { heading: string; body: string };
  logo: { kind: "img"; src: string; width: number; height: number } | { kind: "svg"; markup: string; width: number; height: number } | null;
}

// The brand name: og:site_name, else the shortest meaningful part of the title, else the domain.
export function brandName(scan: { siteName: string; title: string }, url: string): string {
  if (scan.siteName && scan.siteName.length <= 40) return scan.siteName.trim();
  const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
  const parts = scan.title.split(/\s[|–—:·-]\s|\s[|–—·]\s?/).map((p) => p.trim()).filter((p) => p.length >= 2 && p.length <= 30);
  const byHost = parts.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(host.toLowerCase()));
  if (byHost) return byHost;
  if (parts.length) return parts.sort((a, b) => a.length - b.length)[0];
  return host.charAt(0).toUpperCase() + host.slice(1);
}

function extensionFor(contentType: string, src: string): string {
  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return /\.(svg|png|webp|jpe?g)(\?|$)/i.exec(src)?.[0].replace(/\?$/, "").toLowerCase() ?? ".png";
}

// The screenshot's dominant color and its colorful colors, from a small downscale (ffmpeg -> raw RGB).
export async function screenshotColors(file: string): Promise<{ background: string; colors: Record<string, number> }> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale=64:40:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { encoding: "buffer", maxBuffer: 1 << 20 });
  const px = stdout as Buffer;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 2 < px.length; i += 3) {
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    const key = `${r >> 4},${g >> 4},${b >> 4}`; // 16 levels per channel
    const x = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    x.n++;
    x.r += r;
    x.g += g;
    x.b += b;
    buckets.set(key, x);
  }
  const total = px.length / 3;
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((x) => ({ share: x.n / total, css: `rgb(${Math.round(x.r / x.n)}, ${Math.round(x.g / x.n)}, ${Math.round(x.b / x.n)})` }));
  return { background: ranked[0].css, colors: Object.fromEntries(ranked.slice(1, 40).filter((x) => x.share >= 0.004).map((x) => [x.css, x.share])) };
}

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// The images a researched website gives the plan (scene content refers to them by name).
export function researchAssets(r: Pick<BrandResearch, "screenshots">): Record<string, Asset> {
  const s = r.screenshots;
  if (!s) return {};
  const assets: Record<string, Asset> = {
    website: { file: s.desktop.file, width: s.desktop.width, height: s.desktop.height, description: "the website's first screen on a desktop browser", regions: s.desktop.regions },
  };
  if (s.mobile) assets["website-mobile"] = { file: s.mobile.file, width: s.mobile.width, height: s.mobile.height, description: "the website on a phone (portrait)" };
  return assets;
}

export async function researchBrand(url: string, outDir: string): Promise<BrandResearch> {
  checkUrl(url); // a clear error for private or malformed links before starting a browser
  const { chromium } = await import("playwright");
  await mkdir(outDir, { recursive: true });
  const notes: string[] = [];
  // every request of the page goes through a proxy that refuses private addresses (SSRF)
  const proxy = await startGuardProxy();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: { server: proxy.server, bypass: "<-loopback>" },
      args: ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--webrtc-ip-handling-policy=disable_non_proxied_udp"],
    });
  } catch (e) {
    await proxy.close();
    throw new Error(`could not start Playwright's Chromium (run \`pnpm exec playwright install chromium\` once): ${(e as Error).message.split("\n")[0]}`);
  }
  // a hard limit: a stuck page (or a machine that is swapping) must not hang the pipeline
  let timedOut = false;
  const guard = setTimeout(() => {
    timedOut = true;
    void browser.close();
  }, RESEARCH_TIMEOUT_MS);
  try {
    // 2x pixels, so a zoom into the screenshot stays sharp
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (res && res.status() >= 400) throw new Error(`the website answered HTTP ${res.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => notes.push("the page kept loading; scanned what was there after 8 s"));
    await page.waitForTimeout(600); // let entrance animations and web fonts settle

    const screenshot = join(outDir, "screenshot.png");
    await page.screenshot({ path: screenshot });
    const scan = (await page.evaluate(await readFile(join(here, "page-scan.js"), "utf8"))) as PageScan;

    // logo
    let logoFile: string | null = null;
    if (scan.logo?.kind === "svg") {
      logoFile = join(outDir, "logo.svg");
      await writeFile(logoFile, scan.logo.markup);
    } else if (scan.logo?.kind === "img") {
      try {
        const r = await safeFetch(scan.logo.src, { signal: AbortSignal.timeout(15000) });
        const type = r.headers.get("content-type") ?? "";
        const body = new Uint8Array(await r.arrayBuffer());
        if (r.ok && type.startsWith("image/") && body.length > 200 && body.length < 5_000_000) {
          logoFile = join(outDir, "logo" + extensionFor(type, scan.logo.src));
          await writeFile(logoFile, body);
        } else notes.push(`the logo image could not be downloaded (${r.status} ${type})`);
      } catch (e) {
        notes.push(`the logo image could not be downloaded: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    if (!logoFile) notes.push("no logo found in the page header; the brand name will be used as a wordmark");

    // the same page on a phone, for phone mockups (best effort)
    let mobile: Screenshot | undefined;
    try {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA });
      const p2 = await phone.newPage();
      await p2.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await p2.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
      await p2.waitForTimeout(500);
      const file = join(outDir, "screenshot-mobile.png");
      await p2.screenshot({ path: file });
      mobile = { file, width: 780, height: 1688 };
      await phone.close();
    } catch (e) {
      notes.push(`no phone screenshot: ${(e as Error).message.split("\n")[0]}`);
    }

    const seen = await screenshotColors(screenshot).catch(() => undefined);
    const { colors, notes: colorNotes } = deriveBrandColors({ ...scan.colors, seen });
    notes.push(...colorNotes);
    const heading = await pickGoogleFont(scan.fonts.heading);
    const body = await pickGoogleFont(scan.fonts.body, heading.family);
    if (!heading.matched) notes.push(`heading font "${scan.fonts.heading.split(",")[0]}" is not on Google Fonts; using ${heading.family}`);
    if (!body.matched) notes.push(`body font "${scan.fonts.body.split(",")[0]}" is not on Google Fonts; using ${body.family}`);

    const research: BrandResearch = {
      url,
      brand: {
        name: brandName(scan, url),
        colors,
        font: { heading: heading.family, body: body.family },
        ...(logoFile ? { logoUrl: logoFile } : {}),
      },
      description: scan.description,
      headings: scan.headings,
      pageText: scan.text,
      screenshot,
      screenshots: { desktop: { file: screenshot, width: 2880, height: 1800, regions: scan.regions }, ...(mobile ? { mobile } : {}) },
      detected: { headingFont: scan.fonts.heading, bodyFont: scan.fonts.body, logo: scan.logo?.kind === "img" ? scan.logo.src : scan.logo ? "inline svg" : null },
      notes,
    };
    await writeFile(join(outDir, "brand.json"), JSON.stringify(research, null, 2) + "\n");
    return research;
  } catch (e) {
    if (timedOut) throw new Error(`reading ${url} took longer than ${RESEARCH_TIMEOUT_MS / 1000} s and was stopped`);
    throw e;
  } finally {
    clearTimeout(guard);
    await browser.close();
    await proxy.close();
  }
}
