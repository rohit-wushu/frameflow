import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// Generated files live behind this interface so S3/R2 can be added later.
// ffmpeg and the renderer need real files, so a remote backend would sync keys to local paths.
export interface Storage {
  readonly root: string;
  path(key: string): string; // local file path for a key
  exists(key: string): boolean;
  write(key: string, data: string | Uint8Array): Promise<string>;
  read(key: string): Promise<Buffer>;
  readJson<T>(key: string): Promise<T>;
  writeJson(key: string, value: unknown): Promise<string>;
}

export class LocalStorage implements Storage {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  path(key: string): string {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error(`storage key escapes the storage root: ${key}`);
    return p;
  }

  exists(key: string): boolean {
    return existsSync(this.path(key));
  }

  async write(key: string, data: string | Uint8Array): Promise<string> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
    return p;
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async readJson<T>(key: string): Promise<T> {
    return JSON.parse(await readFile(this.path(key), "utf8")) as T;
  }

  writeJson(key: string, value: unknown): Promise<string> {
    return this.write(key, JSON.stringify(value, null, 2) + "\n");
  }
}
