// Frameflow MCP server over Streamable HTTP, for claude.ai custom connectors.
// Binds to 127.0.0.1 only. To reach it from claude.ai, put a tunnel in front (see CLAUDE.md) and set
// FRAMEFLOW_PUBLIC_URL to the tunnel's https URL.
//
// Access control: the endpoint and the file links live under a secret path segment
// (FRAMEFLOW_MCP_TOKEN), because claude.ai custom connectors take a plain URL. Anyone with the full
// URL can use the connector, so treat it like a password.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { createContext, ensureAudioService } from "@frameflow/pipeline";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { JobQueue } from "./jobs.js";
import { createServer } from "./server.js";

const ctx = createContext(); // loads .env
const port = Number(process.env.FRAMEFLOW_MCP_PORT ?? 8791);
const publicUrl = (process.env.FRAMEFLOW_PUBLIC_URL ?? "").replace(/\/+$/, "");
// The token comes from FRAMEFLOW_MCP_TOKEN, else from storage/mcp-token.txt (created once), so the
// connector URL stays the same across restarts. Delete that file to revoke the old URL.
function loadToken(): string {
  const fromEnv = process.env.FRAMEFLOW_MCP_TOKEN ?? "";
  if (fromEnv.length >= 24) return fromEnv;
  const file = ctx.storage.path("mcp-token.txt");
  if (existsSync(file)) {
    const saved = readFileSync(file, "utf8").trim();
    if (saved.length >= 24) return saved;
  }
  const fresh = randomBytes(24).toString("base64url");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, fresh + "\n", { mode: 0o600 });
  return fresh;
}
const token = loadToken();

const jobs = new JobQueue();
let stopAudio: (() => void) | null = null;
const ensureAudio = async () => {
  stopAudio ??= await ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), (m) => console.log(`[frameflow] ${m}`));
};
const base = publicUrl || `http://127.0.0.1:${port}`;
// only finished outputs are served, never plans in progress or the cache
const SERVABLE = /^projects\/[^/]+\/v\d+\/(video\.mp4|video-social\.mp4|captions\.(srt|vtt)|credits\.txt)$/;
const fileUrl = (abs: string) => {
  const rel = relative(ctx.storage.root, abs).split(sep).join("/");
  return SERVABLE.test(rel) ? `${base}/files/${token}/${rel}` : null;
};

const allowedHosts = ["127.0.0.1", "localhost", `127.0.0.1:${port}`, `localhost:${port}`];
if (publicUrl) allowedHosts.push(new URL(publicUrl).host);
const app = createMcpExpressApp({ host: "127.0.0.1", allowedHosts });

// Stateless Streamable HTTP: a fresh server + transport per request; render jobs live in `jobs`.
app.post(`/mcp/${token}`, async (req: Request, res: Response) => {
  const server = createServer({ ctx, jobs, ensureAudio, fileUrl });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "internal error" }, id: null });
  }
});
app.all(`/mcp/${token}`, (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "method not allowed (stateless server: POST only)" }, id: null });
});

app.get(`/files/${token}/*path`, (req: Request, res: Response) => {
  const rel = ([] as string[]).concat((req.params as { path: string | string[] }).path).join("/");
  const abs = resolve(ctx.storage.root, rel);
  if (!SERVABLE.test(rel) || !abs.startsWith(ctx.storage.root + sep) || !existsSync(abs)) {
    res.status(404).send("not found");
    return;
  }
  res.sendFile(abs);
});

const shutdown = () => {
  stopAudio?.();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(port, "127.0.0.1", () => {
  console.log(`Frameflow MCP server (HTTP) listening on 127.0.0.1:${port}`);
  console.log(`Connector URL: ${base}/mcp/${token}`);
  if (!publicUrl) console.log("For claude.ai, run `pnpm connector` instead (it adds a public tunnel), or set FRAMEFLOW_PUBLIC_URL.");
  else {
    console.log("\nIn claude.ai: Settings → Connectors → Add custom connector, and paste the Connector URL above.");
    console.log("Treat the URL like a password. Keep this window open while you use it; Ctrl+C stops everything.\n");
  }
});
