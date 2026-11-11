// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const controller = readFileSync(
  new URL("../../ios/App/App/BridgeViewController.swift", import.meta.url),
  "utf8",
);
const bootstrap = controller.match(/let bootstrap = """([\s\S]*?)"""/)![1];

describe("iOS bridge startup configuration", () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])(
    "returns native cookie=%s and HTTP=%s flags without a synchronous prompt",
    (cookies, http) => {
      const originalPrompt = vi.fn((_message?: string, _defaultText?: string) => "user input");
      const window = { prompt: originalPrompt };
      runInNewContext(
        bootstrap.replaceAll("\\(cookiesEnabled)", String(cookies))
          .replaceAll("\\(httpEnabled)", String(http)),
        { window },
      );
      expect(window.prompt('{"type":"CapacitorCookies.isEnabled"}')).toBe(String(cookies));
      expect(window.prompt('{"type":"CapacitorHttp"}')).toBe(String(http));
      expect(originalPrompt).not.toHaveBeenCalled();
      expect(window.prompt).toBe(originalPrompt);
    },
  );

  it("preserves normal prompts, arguments and receiver during initialization", () => {
    const originalPrompt = vi.fn((_message?: string, _defaultText?: string) => "user input");
    const window = { prompt: originalPrompt };
    runInNewContext(
      bootstrap.replaceAll("\\(cookiesEnabled)", "false")
        .replaceAll("\\(httpEnabled)", "false"),
      { window },
    );
    for (const message of ["Name?", "null", '{"type":"other"}', '{"type":"toString"}']) {
      expect(window.prompt(message, "default")).toBe("user input");
      expect(originalPrompt).toHaveBeenLastCalledWith(message, "default");
    }
    expect(originalPrompt.mock.contexts.every((context) => context === window)).toBe(true);
    expect(window.prompt('{"type":"CapacitorHttp"}')).toBe("false");
    expect(window.prompt('{"type":"CapacitorCookies.isEnabled"}')).toBe("false");
    expect(window.prompt).toBe(originalPrompt);
  });
});
