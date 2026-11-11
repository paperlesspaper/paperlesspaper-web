import { createHash, randomBytes } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";

export const secret = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const privateRanges = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  privateRanges.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
privateRanges.addSubnet("2001::", 23, "ipv6");
privateRanges.addSubnet("2001:db8::", 32, "ipv6");
privateRanges.addSubnet("2002::", 16, "ipv6");

export function publicAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !privateRanges.check(address, "ipv4")
    : family === 6 &&
        globalV6.check(address, "ipv6") &&
        !privateRanges.check(address, "ipv6");
}
export function localDevelopment(url: URL) {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.INTEGRATION_ALLOW_LOCALHOST === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}
export function validatePublicUrl(url: URL) {
  if (url.username || url.password || url.hash || url.search)
    throw new Error("Invalid integration URL");
  if (localDevelopment(url) && ["http:", "https:"].includes(url.protocol))
    return;
  if (url.protocol !== "https:" || (url.port && url.port !== "443"))
    throw new Error("HTTPS on port 443 required");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !publicAddress(hostname))
    throw new Error("Private address forbidden");
}

// Resolve and pin the address on EVERY request. Never follow redirects with a bearer token.
export async function sendCallback(
  urlString: string,
  token: string,
  payload: unknown
) {
  const url = new URL(urlString);
  validatePublicUrl(url);
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), {
    all: true,
  });
  if (
    !addresses.length ||
    (!localDevelopment(url) && addresses.some((a) => !publicAddress(a.address)))
  )
    throw new Error("Callback address forbidden");
  const selected = addresses[0];
  const body = JSON.stringify(payload);
  await new Promise<void>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "POST",
        agent: false,
        lookup: ((_hostname: string, options: any, done: any) =>
          options?.all
            ? done(null, [selected])
            : done(null, selected.address, selected.family)) as any,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        signal: AbortSignal.timeout(15_000),
      },
      (response) => {
        response.destroy(); // Only the status matters; never download a callback response body.
        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        )
          resolve();
        else reject(new Error("Callback not accepted"));
      }
    );
    request.on("error", () => reject(new Error("Callback unavailable")));
    request.end(body);
  });
}
