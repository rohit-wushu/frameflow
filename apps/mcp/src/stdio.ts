// Frameflow MCP server over stdio, for Claude Desktop and Claude Code (local).
// stdout carries the MCP protocol, so nothing else may print there.
console.log = console.error;

import { createContext, ensureAudioService } from "@frameflow/pipeline";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JobQueue } from "./jobs.js";
import { createServer } from "./server.js";

const ctx = createContext();
const jobs = new JobQueue();
let stopAudio: (() => void) | null = null;

const server = createServer({
  ctx,
  jobs,
  ensureAudio: async () => {
    stopAudio ??= await ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), (m) => console.error(`[frameflow] ${m}`));
  },
});

const shutdown = () => {
  stopAudio?.();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("close", shutdown);

await server.connect(new StdioServerTransport());
console.error(`[frameflow] MCP server ready (stdio), storage: ${ctx.storage.root}`);
