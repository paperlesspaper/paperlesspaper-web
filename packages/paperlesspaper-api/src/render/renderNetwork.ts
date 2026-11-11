import { lookup } from "node:dns/promises";
import http from "node:http";
import {
  BlockList,
  connect,
  isIP,
  type Socket,
  type LookupFunction,
} from "node:net";
import type { Duplex } from "node:stream";

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedV4.addSubnet(address, prefix, "ipv4");
// Azure's platform/metadata virtual IP is outside the private address ranges.
blockedV4.addAddress("168.63.129.16", "ipv4");

const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blockedV6.addSubnet(address, prefix, "ipv6");

export const isPublicRenderAddress = (address: string): boolean => {
  if (isIP(address) === 4) return !blockedV4.check(address, "ipv4");
  // Reject mapped IPv4, NAT64, transition, local and reserved IPv6 addresses.
  return (
    isIP(address) === 6 &&
    globalV6.check(address, "ipv6") &&
    !blockedV6.check(address, "ipv6")
  );
};

export const parseRenderUrl = (value: string): URL => {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Render URL must use HTTP(S) without embedded credentials");
  }
  return url;
};

export const resolveRenderUrl = (value: string): string => {
  const url = parseRenderUrl(value);
  const override = process.env.PAPERLESSPAPER_APPS_URL;
  if (override && url.origin === "https://apps.paperlesspaper.de") {
    const base = parseRenderUrl(override);
    base.pathname = `${base.pathname.replace(/\/$/, "")}${url.pathname}`;
    base.search = url.search;
    base.hash = url.hash;
    return base.href;
  }
  return url.href;
};

export const getAllowedPrivateRenderOrigins = (): Set<string> => {
  const configured = process.env.RENDER_ALLOWED_PRIVATE_ORIGINS?.trim();
  if (!configured) return new Set();
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RENDER_ALLOWED_PRIVATE_ORIGINS is only supported outside production"
    );
  }
  return new Set(
    configured.split(",").map((entry) => {
      const url = parseRenderUrl(entry.trim());
      if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error(
          "RENDER_ALLOWED_PRIVATE_ORIGINS must contain exact origins, including ports"
        );
      }
      return url.origin;
    })
  );
};

type Lookup = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;
const lookupAll: Lookup = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export const resolveRenderAddresses = async (
  url: URL,
  allowedPrivateOrigins = new Set<string>(),
  lookupAddresses: Lookup = lookupAll
): Promise<Array<{ address: string; family: number }>> => {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookupAddresses(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isIP(address))) {
    throw new Error("Render destination has no usable address");
  }
  if (
    !allowedPrivateOrigins.has(url.origin) &&
    addresses.some(({ address }) => !isPublicRenderAddress(address))
  ) {
    throw new Error("Render destination is not a public network address");
  }
  return addresses;
};

const NETWORK_TIMEOUT_MS = 15_000;
const withTimeout = async <T>(work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Render network timeout")),
          NETWORK_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** All browser HTTP(S)/WS traffic goes through this proxy. Connect to the checked
 * numeric IP, never resolve the hostname again (DNS rebinding / TOCTOU).
 * TLS stays end-to-end: Chromium still checks the original host certificate.
 */
export const startRenderProxy = async (
  allowedPrivateOrigins = getAllowedPrivateRenderOrigins()
) => {
  // CONNECT carries host:port, not the final protocol (Chromium also uses it
  // for plain ws://). Development exceptions therefore allow tunnels to the
  // explicitly configured host and port, whether carrying HTTP or TLS.
  const allowedTunnelOrigins = new Set(
    [...allowedPrivateOrigins].map((origin) => {
      const url = new URL(origin);
      const port = url.port || (url.protocol === "http:" ? "80" : "443");
      url.protocol = "https:";
      url.port = port;
      return url.origin;
    })
  );
  const sockets = new Set<Duplex>();
  const track = <T extends Duplex>(socket: T): T => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    return socket;
  };
  const targetFor = async (url: URL, tunnel = false) => {
    const addresses = await withTimeout(
      resolveRenderAddresses(
        url,
        tunnel ? allowedTunnelOrigins : allowedPrivateOrigins
      )
    );
    // Retain IPv4/IPv6 fallback without a second DNS resolution at connect time.
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    };
    return {
      host: url.hostname.replace(/^\[|\]$/g, ""),
      lookup: pinnedLookup,
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 250,
    };
  };
  const headersFor = (req: http.IncomingMessage, url: URL) => {
    const headers: http.OutgoingHttpHeaders = {
      ...req.headers,
      host: url.host,
    };
    delete headers["proxy-authorization"];
    delete headers["proxy-connection"];
    return headers;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = parseRenderUrl(req.url || "");
      if (url.protocol !== "http:") throw new Error("Use CONNECT for HTTPS");
      const target = await targetFor(url);
      if (req.destroyed || res.destroyed) return;
      const upstream = http.request(
        {
          ...target,
          port: url.port || 80,
          path: `${url.pathname}${url.search}`,
          method: req.method,
          headers: headersFor(req, url),
          agent: false,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.on("error", () => res.destroy());
          response.pipe(res);
        }
      );
      upstream.on("socket", track);
      upstream.setTimeout(NETWORK_TIMEOUT_MS, () =>
        upstream.destroy(new Error("Render network timeout"))
      );
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      res.on("close", () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Render destination blocked");
    }
  });

  server.on("connect", async (req, client, head) => {
    try {
      const authority = req.url || "";
      const url = parseRenderUrl(`https://${authority}`);
      if (url.pathname !== "/" || url.search || url.hash || !authority) {
        throw new Error("Invalid tunnel destination");
      }
      const target = await targetFor(url, true);
      if (client.destroyed) return;
      const upstream = track(
        connect({
          ...target,
          port: Number(url.port || 443),
        })
      );
      upstream.setTimeout(NETWORK_TIMEOUT_MS, () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      upstream.on("close", () => client.destroy());
      client.on("close", () => upstream.destroy());
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream).pipe(client);
      });
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });

  // Preserve unencrypted WebSocket support, with the same destination policy.
  server.on("upgrade", async (req, client, head) => {
    try {
      const url = parseRenderUrl((req.url || "").replace(/^ws:/, "http:"));
      if (url.protocol !== "http:")
        throw new Error("Invalid upgrade destination");
      const target = await targetFor(url);
      if (client.destroyed) return;
      const upstream = http.request({
        ...target,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        headers: headersFor(req, url),
        agent: false,
      });
      upstream.on("socket", track);
      upstream.setTimeout(NETWORK_TIMEOUT_MS, () => upstream.destroy());
      upstream.on("error", () => client.destroy());
      upstream.on("response", () => {
        upstream.destroy();
        client.destroy();
      });
      client.on("close", () => upstream.destroy());
      upstream.on("upgrade", (response, socket, upstreamHead) => {
        client.write(
          `HTTP/1.1 101 Switching Protocols\r\n${response.rawHeaders.reduce(
            (result, value, index, all) =>
              index % 2 ? result : `${result}${value}: ${all[index + 1]}\r\n`,
            ""
          )}\r\n`
        );
        if (upstreamHead.length) client.write(upstreamHead);
        if (head.length) socket.write(head);
        socket.on("close", () => client.destroy());
        client.on("close", () => socket.destroy());
        client.pipe(socket).pipe(client);
      });
      upstream.end();
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });

  server.on("connection", (socket: Socket) => {
    track(socket);
    socket.unref();
  });
  server.on("clientError", (_, socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref();
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Render proxy failed to bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
