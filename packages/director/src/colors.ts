// Turning colors sampled from a website into the four brand colors the templates use.

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(css: string): Rgb | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(css);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css.trim());
  if (h) {
    const x = h[1].length === 3 ? [...h[1]].map((c) => c + c).join("") : h[1];
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
  }
  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function hsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a: 1 };
}

function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
// On a dark background, brands use light tints (e.g. lavender text), so allow lighter colors there.
const isColorful = (c: Rgb, darkBg = false) => {
  const { s, l } = hsl(c);
  return s >= 0.25 && l >= 0.15 && l <= (darkBg ? 0.9 : 0.85);
};

export interface ColorSamples {
  background: string; // body background (computed)
  pageBackground: string; // html background
  text: string; // heading or body text color
  accents: Record<string, number>; // colors of buttons/links -> weight
  areas: Record<string, number>; // background colors -> visible area
  // what the screenshot actually shows: its dominant color and colorful pixel colors -> share of pixels.
  // CSS can't see background images and gradients; this can.
  seen?: { background: string; colors: Record<string, number> };
}

export interface BrandColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

export const DEFAULT_PRIMARY = "#6D5DF6";

// Background = the page background; text = the heading color (fixed up for contrast);
// primary = the most used colorful accent (buttons, links); secondary = the next colorful one
// with a clearly different hue, or a hue-shifted primary.
export function deriveBrandColors(s: ColorSamples): { colors: BrandColors; notes: string[] } {
  const notes: string[] = [];
  const opaque = (c: string | undefined) => {
    const p = c ? parseColor(c) : null;
    return p && p.a >= 0.9 ? p : null;
  };
  let bg = opaque(s.background) ?? opaque(s.pageBackground) ?? { r: 255, g: 255, b: 255, a: 1 };
  const seenBg = s.seen ? parseColor(s.seen.background) : null;
  if (seenBg && distance(seenBg, bg) > 60) {
    bg = seenBg;
    notes.push("the page background is an image or gradient; using the color it shows on screen");
  }
  const darkBg = luminance(bg) < 0.2;
  let text = opaque(s.text) ?? { r: 17, g: 17, b: 17, a: 1 };
  if (contrast(text, bg) < 4.5) {
    const dark = { r: 11, g: 11, b: 16, a: 1 }, light = { r: 250, g: 250, b: 252, a: 1 };
    text = contrast(dark, bg) >= contrast(light, bg) ? dark : light;
    notes.push("the site's text color had low contrast on its background; using a readable one");
  }

  const ranked = (weights: Record<string, number>) =>
    Object.entries(weights)
      .map(([css, w]) => ({ c: parseColor(css), w }))
      .filter((x): x is { c: Rgb; w: number } => !!x.c && x.c.a >= 0.9 && isColorful(x.c, darkBg) && distance(x.c, bg) > 40 && distance(x.c, text) > 40)
      .sort((a, b) => b.w - a.w)
      .map((x) => x.c);
  const candidates = [...ranked(s.accents), ...ranked(s.areas), ...ranked(s.seen?.colors ?? {})];

  let primary = candidates[0];
  if (!primary) {
    primary = parseColor(DEFAULT_PRIMARY)!;
    notes.push("no colorful brand color found on the page; using a neutral violet (edit it if needed)");
  }
  const ph = hsl(primary).h;
  let secondary = candidates.find((c) => hueGap(hsl(c).h, ph) >= 30);
  if (!secondary) {
    const { h, s: sat, l } = hsl(primary);
    secondary = fromHsl((h + 40) % 360, Math.min(1, sat), Math.min(0.7, Math.max(0.45, l)));
    notes.push("secondary color derived from the primary");
  }
  return { colors: { primary: toHex(primary), secondary: toHex(secondary), background: toHex(bg), text: toHex(text) }, notes };
}
