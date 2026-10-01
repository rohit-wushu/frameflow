// pnpm connector: make Frameflow reachable as a claude.ai custom connector.
// Opens a Cloudflare quick tunnel (https://<random>.trycloudflare.com -> 127.0.0.1:<port>), then starts
// the HTTP MCP server with that public URL, and prints the connector URL to paste into claude.ai.
// Quick tunnels need no Cloudflare account, but the hostname changes every time this starts, so the
// connector must be re-added (or edited) after a restart. A named tunnel gives a stable hostname.
import { spawn } from "node:child_process";
import { createContext } from "@frameflow/pipeline";

createContext(); // loads .env (port override)
const port = Number(process.env.FRAMEFLOW_MCP_PORT ?? 8791);

const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
tunnel.on("error", (e) => {
  console.error(`could not start cloudflared (install it with \`brew install cloudflared\`): ${e.message}`);
  process.exit(1);
});

const url = await new Promise<string>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("cloudflared did not report a tunnel URL within 45 s")), 45_000);
  const onData = (chunk: Buffer) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
    if (m) {
      clearTimeout(timer);
      resolve(m[0]);
    }
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
  tunnel.on("exit", (code) => reject(new Error(`cloudflared exited (${code}) before the tunnel was up`)));
});

const stop = () => {
  tunnel.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

process.env.FRAMEFLOW_PUBLIC_URL = url;
console.log(`Tunnel up: ${url}`);
await import("./http.js");
