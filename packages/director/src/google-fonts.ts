// Google Fonts lookups: the templates can only use fonts from Google Fonts.
const known = new Map<string, boolean>();
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont", "emoji", "math", "inherit", "initial"]);
export const FALLBACK_FONT = "Inter";

export async function isGoogleFont(family: string): Promise<boolean> {
  const key = family.trim().toLowerCase();
  if (!key || GENERIC.has(key)) return false;
  if (!known.has(key)) {
    try {
      const url = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family.trim()).replace(/%20/g, "+");
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      known.set(key, res.ok);
    } catch {
      return false; // offline: don't cache the miss
    }
  }
  return known.get(key)!;
}

// Families in a CSS font-family stack, in order, without quotes.
export function fontStack(css: string): string[] {
  return css.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

// Names a self-hosted font may have on Google Fonts: "Inter Variable" -> "Inter", "GeistSans" -> "Geist".
export function nameVariants(family: string): string[] {
  const stripped = family.replace(/[\s_-]*(variable|var|vf|fallback|web|pro)$/i, "").trim();
  const spaced = stripped.replace(/([a-z])([A-Z])/g, "$1 $2");
  const first = spaced.split(/\s+/)[0];
  return [...new Set([family, stripped, spaced, first.length >= 4 ? first : ""])].filter(Boolean);
}

// The first family of a CSS font stack that exists on Google Fonts, else the fallback.
export async function pickGoogleFont(css: string, fallback = FALLBACK_FONT): Promise<{ family: string; matched: boolean }> {
  for (const family of fontStack(css)) {
    for (const name of nameVariants(family)) if (await isGoogleFont(name)) return { family: name, matched: true };
  }
  return { family: fallback, matched: false };
}
