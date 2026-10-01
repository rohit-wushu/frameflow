import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BlockedUrlError, checkUrl, guardedLookup, isPublicAddress, safeFetch, startGuardProxy } from "../src/net-guard.js";

describe("isPublicAddress", () => {
  it("refuses loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["93.184.215.14", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});

describe("checkUrl", () => {
  it("accepts ordinary websites", () => {
    expect(checkUrl("https://tabler.io/").hostname).toBe("tabler.io");
    expect(checkUrl("http://example.com:80/x").pathname).toBe("/x");
  });
  it("refuses other schemes, credentials, odd ports and internal hosts", () => {
    for (const u of ["file:///etc/passwd", "ftp://example.com", "https://user:pw@example.com", "https://example.com:8790/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "http://localhost/", "http://printer.local/", "not a url"]) {
      expect(() => checkUrl(u), u).toThrow(BlockedUrlError);
    }
  });
});

describe("connections", () => {
  let target: http.Server;
  let port: number;
  beforeAll(async () => {
    target = http.createServer((_req, res) => res.end("secret"));
    await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
    port = (target.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => target.close(() => r())));

  it("fails a DNS lookup that lands on a private address", async () => {
    const err = await new Promise<Error | null>((resolve) => guardedLookup("localhost", {}, (e) => resolve(e)));
    expect(err?.message).toMatch(/private address/);
  });

  it("safeFetch refuses internal targets", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(BlockedUrlError);
  });

  it("the browser proxy refuses internal targets (plain http and CONNECT)", async () => {
    const proxy = await startGuardProxy();
    try {
      const proxyPort = Number(new URL(proxy.server).port);
      const status = await new Promise<number>((resolve, reject) => {
        http.get({ host: "127.0.0.1", port: proxyPort, path: `http://127.0.0.1:${port}/` }, (res) => resolve(res.statusCode ?? 0)).on("error", reject);
      });
      expect(status).toBe(403);
      const connect = await new Promise<number>((resolve, reject) => {
        http.request({ host: "127.0.0.1", port: proxyPort, method: "CONNECT", path: `127.0.0.1:${port}` }).on("connect", (res, socket) => {
          socket.destroy();
          resolve(res.statusCode ?? 0);
        }).on("error", reject).end();
      });
      expect(connect).toBe(403);
    } finally {
      await proxy.close();
    }
  });
});
