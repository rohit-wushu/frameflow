import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Tabler icons (MIT), outline set: https://tabler.io/icons
const require = createRequire(import.meta.url);
const OUTLINE_DIR = dirname(require.resolve("@tabler/icons/outline/circle.svg"));
export const FALLBACK_ICON = "sparkles";

// A short list the director sees in its prompt (the full set has 5000+ names).
const COMMON = [
  "sparkles", "bolt", "rocket", "wand", "bulb", "brain", "robot", "cpu", "target", "flag", "trophy", "award", "star", "heart",
  "chart-bar", "chart-line", "chart-pie", "trending-up", "gauge", "clock", "hourglass", "calendar", "alarm",
  "users", "user", "user-check", "users-group", "mood-smile", "thumb-up", "message", "messages", "mail", "bell", "phone",
  "shield-check", "lock", "key", "fingerprint", "eye", "search", "filter", "zoom-check",
  "cloud", "cloud-upload", "database", "server", "code", "terminal", "api", "plug", "git-branch", "brand-github", "bug",
  "world", "world-www", "language", "map-pin", "device-mobile", "device-laptop", "device-desktop",
  "camera", "photo", "video", "microphone", "music", "headphones", "player-play", "file-text", "files", "folder",
  "clipboard-check", "checklist", "list-check", "circle-check", "check", "alert-triangle", "settings", "adjustments", "tool",
  "palette", "brush", "pencil", "layout", "layout-grid", "components", "puzzle", "coin", "currency-dollar", "credit-card",
  "receipt", "shopping-cart", "building-store", "truck", "package", "home", "building", "briefcase", "school", "book",
  "refresh", "repeat", "link", "share", "download", "upload", "send", "infinity", "leaf", "sun", "moon", "flame", "droplet",
  "lifebuoy", "headset", "qrcode", "scan", "id", "certificate", "scale", "stethoscope", "heartbeat", "coffee", "car", "plane", "gift",
];

let names: Set<string> | null = null;

export function iconNames(): Set<string> {
  names ??= new Set(readdirSync(OUTLINE_DIR).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4)));
  return names;
}

export function iconExists(name: string): boolean {
  return iconNames().has(name);
}

export function iconSvg(name: string): string | null {
  return iconExists(name) ? readFileSync(join(OUTLINE_DIR, `${name}.svg`), "utf8") : null;
}

export function commonIcons(): string[] {
  return COMMON.filter(iconExists);
}

// Real icon names that share a word with `name` (shortest first), for helpful validation errors.
export function suggestIcons(name: string, limit = 6): string[] {
  const parts = name.toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
  const hits = [...iconNames()].filter((n) => parts.some((p) => n.split("-").includes(p)));
  hits.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return hits.length ? hits.slice(0, limit) : commonIcons().slice(0, limit);
}
