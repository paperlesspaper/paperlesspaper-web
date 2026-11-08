import { describe, expect, it } from "vitest";
import {
  parseAuthenticatedRenderUrl,
  renderAuthHeaders,
} from "../../src/render/renderAuth";
import { parseRenderRequest } from "../../src/render/renderProtocol";

describe("render Basic Auth", () => {
  it.each([
    ["user:p%40ss%3Aword", "user:p@ss:word"],
    ["user:", "user:"],
    [":password", ":password"],
    ["user:p%25ss+word", "user:p%ss+word"],
  ])(
    "preserves credentials through the protocol and decodes %s once",
    (credentials, decoded) => {
      const url = `https://${credentials}@example.org/calendar?q=1#today`;
      expect(parseRenderRequest({ url }).url).toBe(url);
      expect(parseAuthenticatedRenderUrl(url)).toEqual({
        url: "https://example.org/calendar?q=1#today",
        auth: {
          origin: "https://example.org",
          authorization: `Basic ${Buffer.from(decoded).toString("base64")}`,
        },
      });
    }
  );

  it("scopes auth to the exact scheme, host and port, removing inherited credentials", () => {
    const { auth } = parseAuthenticatedRenderUrl(
      "https://user:secret@example.org"
    );
    for (const url of [
      "http://example.org",
      "https://example.org:444",
      "https://other.example.org",
      "blob:https://example.org/identifier",
    ]) {
      expect(
        renderAuthHeaders(
          url,
          { Authorization: auth!.authorization, accept: "*/*" },
          auth!
        )
      ).toEqual({ accept: "*/*" });
    }
    expect(
      renderAuthHeaders("https://example.org/image.png", {}, auth!)
    ).toEqual({ authorization: auth!.authorization });
  });

  it.each([
    "https://user:%ZZ@example.org",
    "file:///etc/passwd",
    "https://user:secret@[",
  ])("rejects invalid URLs without echoing credentials: %s", (url) => {
    expect(() => parseAuthenticatedRenderUrl(url)).toThrow(
      /^Invalid render URL$/
    );
  });
});
