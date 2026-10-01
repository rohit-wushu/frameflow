import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// The same storage folder the worker writes to (storage/ at the repo root, or STORAGE_DIR).
const ROOT = resolve(process.env.FRAMEFLOW_STORAGE ?? "storage");

export function storagePath(key: string): string {
  const p = resolve(join(ROOT, key));
  if (!p.startsWith(ROOT + "/")) throw new Error("storage key escapes the storage root");
  return p;
}

export const storageExists = (key: string) => existsSync(storagePath(key));

export async function readStorageJson<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(storagePath(key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeStorage(key: string, data: Uint8Array) {
  const p = storagePath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}
