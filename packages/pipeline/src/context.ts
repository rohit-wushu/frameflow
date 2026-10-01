import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HyperFramesRenderer, type Renderer } from "@frameflow/renderer";
import { AudioClient } from "./audio-client.js";
import { LocalStorage, type Storage } from "./storage.js";

export function findRepoRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  let dir = from;
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("could not find the repo root (pnpm-workspace.yaml)");
    dir = up;
  }
  return dir;
}

// Reads .env (never logged). Keys stay in .env only.
export function loadEnv(root: string) {
  const file = join(root, ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}

export interface Context {
  root: string;
  storage: Storage;
  audio: AudioClient;
  renderer: Renderer;
  assetsDir: string;
}

export function createContext(root = findRepoRoot()): Context {
  loadEnv(root);
  const storage = new LocalStorage(resolve(root, process.env.STORAGE_DIR ?? "storage"));
  return {
    root,
    storage,
    audio: new AudioClient(process.env.AUDIO_SERVICE_URL ?? "http://127.0.0.1:8790"),
    renderer: new HyperFramesRenderer(storage.path("cache/fonts")),
    assetsDir: join(root, "assets"),
  };
}
