// SSRF protection. Users give us URLs (their website, a logo); the server must never be tricked into
// reaching its own network (the audio service, Postgres, cloud metadata at 169.254.169.254, ...).
// Every connection resolves the host itself and refuses private addresses, so a DNS answer can't
// change between the check and the connection. Set ALLOW_PRIVATE_URLS=1 only on a dev machine.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import net, { BlockList, isIP, type AddressInfo } from "node:net";
import { Agent, fetch as undiciFetch, type RequestInit, type Response } from "undici";

const blocked = new BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
// (IPv4-mapped addresses, ::ffff:a.b.c.d, are checked against the IPv4 rules by BlockList itself;
// adding ::ffff:0:0/96 here would block every IPv4 address)
const V6: [string, number][] = [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
];
V4.forEach(([a, p]) => blocked.addSubnet(a, p, "ipv4"));
V6.forEach(([a, p]) => blocked.addSubnet(a, p, "ipv6"));

const allowPrivate = () => process.env.ALLOW_PRIVATE_URLS === "1";

export class BlockedUrlError extends Error {}

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return !blocked.check(ip, family === 6 ? "ipv6" : "ipv4");
}

// A URL a user may point us at: http(s) on the default ports, no credentials, not an internal address.
export function checkUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedUrlError(`"${input}" is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("only http and https links can be read");
  if (url.username || url.password) throw new BlockedUrlError("links with a user name or password are not allowed");
  if (allowPrivate()) return url;
  if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("only websites on the standard ports (80, 443) can be read");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new BlockedUrlError(`${host} is a private address; only public websites can be read`);
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new BlockedUrlError(`${host} is not a public website`);
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

// dns.lookup that fails for private addresses (used for every outgoing connection we make for a user).
export function guardedLookup(hostname: string, options: { all?: boolean; family?: number } | number, callback: LookupCallback): void {
  const opts = typeof options === "number" ? { family: options } : options;
  dnsLookup(hostname, { family: opts.family as 0 | 4 | 6 | undefined, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    const bad = allowPrivate() ? undefined : list.find((a) => !isPublicAddress(a.address));
    if (bad || !list.length) {
      const e = new BlockedUrlError(`${hostname} resolves to a private address${bad ? ` (${bad.address})` : ""}; only public websites can be read`) as NodeJS.ErrnoException;
      e.code = "EPRIVATEADDRESS";
      return callback(e, "");
    }
    if (opts.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({ connect: { lookup: guardedLookup as never }, headersTimeout: 20_000, bodyTimeout: 30_000 });

// fetch for user-supplied URLs: every hop of a redirect is checked, every connection is guarded.
export async function safeFetch(input: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let url = checkUrl(input);
  for (let hop = 0; ; hop++) {
    const res = await undiciFetch(url, { ...init, redirect: "manual", dispatcher: agent });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    if (hop >= maxRedirects) throw new BlockedUrlError(`too many redirects from ${input}`);
    url = checkUrl(new URL(location, url));
  }
}

// A local forward proxy for headless Chrome: every request the page makes (redirects, images, scripts,
// websockets) goes through it and is refused when it targets a private address.
export async function startGuardProxy(): Promise<{ server: string; close: () => Promise<void> }> {
  const proxy = http.createServer((req, res) => {
    let target: URL;
    try {
      target = checkUrl(req.url ?? "");
      if (target.protocol !== "http:") throw new BlockedUrlError("expected an http URL");
    } catch (e) {
      res.writeHead(403).end((e as Error).message);
      return;
    }
    const upstream = http.request(
      { hostname: target.hostname, port: target.port || 80, path: target.pathname + target.search, method: req.method, headers: req.headers, lookup: guardedLookup as never },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      if (!res.headersSent) res.writeHead(e instanceof BlockedUrlError ? 403 : 502);
      res.end();
    });
    req.pipe(upstream);
  });
  // https (and websockets): CONNECT host:port, then a raw tunnel
  proxy.on("connect", (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    const [host, portText] = (req.url ?? "").split(/:(?=\d+$)/);
    const port = Number(portText || 443);
    const refuse = (code: number) => {
      client.end(`HTTP/1.1 ${code} ${code === 403 ? "Forbidden" : "Bad Gateway"}\r\n\r\n`);
    };
    try {
      checkUrl(`https://${host}:${port}/`);
    } catch {
      return refuse(403);
    }
    const upstream = net.connect({ host: host.replace(/^\[|\]$/g, ""), port, lookup: guardedLookup as never }, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on("error", (e) => (client.writable ? refuse(e instanceof BlockedUrlError ? 403 : 502) : client.destroy()));
    client.on("error", () => upstream.destroy());
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const { port } = proxy.address() as AddressInfo;
  return {
    server: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        proxy.closeAllConnections();
        proxy.close(() => resolve());
      }),
  };
}
