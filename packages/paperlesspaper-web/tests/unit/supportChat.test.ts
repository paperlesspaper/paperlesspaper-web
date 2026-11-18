// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseUrl = "https://support.paperlesspaper.de";
const websiteToken = "test-inbox";
const identity = {
  identifier: "test-user",
  email: "test@example.invalid",
  identifierHash: "test-signature",
  identityValidationConfigured: true,
};
let openSupportChat: typeof import("../../src/helpers/supportChat").openSupportChat;
let onSupportChatError: typeof import("../../src/helpers/supportChat").onSupportChatError;
const chatWindow = window as any;

function options() {
  return {
    getIdentity: vi.fn().mockResolvedValue(identity),
    user: { name: "Test User", email: identity.email },
    platform: "ios",
    native: true,
    launcherTitle: "Chat with us",
  };
}

function widget(loaded = true) {
  const iframe = document.createElement("iframe");
  iframe.id = "chatwoot_live_chat_widget";
  document.body.appendChild(iframe);
  const chat = {
    hasLoaded: loaded,
    setUser: vi.fn(),
    setCustomAttributes: vi.fn(),
    toggle: vi.fn(),
  };
  chatWindow.$chatwoot = chat;
  return { chat, iframe };
}

function ready(chat: { hasLoaded: boolean }) {
  chat.hasLoaded = true;
  window.dispatchEvent(new Event("chatwoot:ready"));
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("REACT_APP_CHATWOOT", websiteToken);
  ({ openSupportChat, onSupportChatError } = await import(
    "../../src/helpers/supportChat"
  ));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete chatWindow.$chatwoot;
  delete chatWindow.chatwootSDK;
  delete chatWindow.chatwootSettings;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  for (const cookie of document.cookie.split(";")) {
    document.cookie = `${cookie.split("=")[0].trim()}=; Max-Age=0; path=/`;
  }
});

describe("support chat session recovery", () => {
  it("does not load an anonymous widget when the identity endpoint fails, and allows retry", async () => {
    const input = options();
    input.getIdentity.mockRejectedValueOnce(new Error("offline"));
    await expect(openSupportChat(input)).rejects.toThrow("offline");
    expect(document.getElementById("chatwoot-sdk")).toBeNull();
    const { chat } = widget();
    await openSupportChat(input);
    expect(chat.setUser).toHaveBeenCalledWith(
      identity.identifier,
      expect.objectContaining({ identifier_hash: identity.identifierHash })
    );
    expect(chat.toggle).toHaveBeenCalledWith("open");
  });

  it.each([
    { ...identity, identifier: "" },
    { ...identity, identifierHash: undefined },
    { ...identity, identityValidationConfigured: false },
  ])(
    "rejects an identity that cannot restore verified history: %j",
    async (invalid) => {
      const { chat } = widget();
      const input = options();
      input.getIdentity.mockResolvedValue(invalid);
      await expect(openSupportChat(input)).rejects.toThrow("verified identity");
      expect(chat.setUser).not.toHaveBeenCalled();
      expect(chat.toggle).not.toHaveBeenCalled();
    }
  );

  it.each(["", "cw_conversation=existing-session"])(
    "invalidates stale identity deduplication while preserving the conversation cookie (%s)",
    async (session) => {
      const { chat } = widget();
      if (session) document.cookie = `${session}; path=/`;
      document.cookie = `cw_user_${websiteToken}=stale-cache; path=/`;
      const sessionBefore = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("cw_conversation="));
      chat.setUser.mockImplementation(() => {
        expect(document.cookie).not.toContain(`cw_user_${websiteToken}=`);
        const sessionAfter = document.cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("cw_conversation="));
        expect(sessionAfter).toBe(sessionBefore);
        // Like the SDK, cache this attempted identity for subsequent openings.
        document.cookie = `cw_user_${websiteToken}=attempted-identity; path=/`;
      });
      await openSupportChat(options());
      await openSupportChat(options());
      expect(chat.setUser).toHaveBeenCalledTimes(2);
      expect(chat.toggle).toHaveBeenCalledTimes(2);
    }
  );

  it("shares one script and one identity request for concurrent clicks and waits for widget readiness", async () => {
    const input = options();
    const first = openSupportChat(input);
    const second = openSupportChat(input);
    expect(second).toBe(first);
    await vi.waitFor(() =>
      expect(document.getElementById("chatwoot-sdk")).not.toBeNull()
    );
    const { chat } = widget(false);
    chatWindow.chatwootSDK = { run: vi.fn() };
    document.getElementById("chatwoot-sdk")!.dispatchEvent(new Event("load"));
    expect(chatWindow.chatwootSDK.run).toHaveBeenCalledTimes(1);
    expect(chat.setUser).not.toHaveBeenCalled();
    ready(chat);
    await Promise.all([first, second]);
    expect(input.getIdentity).toHaveBeenCalledTimes(1);
    expect(chat.setUser).toHaveBeenCalledTimes(1);
    expect(chat.toggle).toHaveBeenCalledTimes(1);
  });

  it("does not mistake an existing but loading SDK for a ready widget", async () => {
    const { chat } = widget(false);
    const pending = openSupportChat(options());
    await Promise.resolve();
    window.dispatchEvent(new Event("chatwoot:ready"));
    expect(chat.setUser).not.toHaveBeenCalled();
    ready(chat);
    await pending;
    expect(chat.toggle).toHaveBeenCalledWith("open");
  });

  it("removes a failed script so a later attempt can load it again", async () => {
    const pending = openSupportChat(options());
    const rejected = expect(pending).rejects.toThrow("could not be loaded");
    await vi.waitFor(() =>
      expect(document.getElementById("chatwoot-sdk")).not.toBeNull()
    );
    const failedScript = document.getElementById("chatwoot-sdk")!;
    failedScript.dispatchEvent(new Event("error"));
    await rejected;
    expect(failedScript.isConnected).toBe(false);
    const retry = openSupportChat(options());
    await vi.waitFor(() =>
      expect(document.getElementById("chatwoot-sdk")).not.toBeNull()
    );
    expect(document.getElementById("chatwoot-sdk")).not.toBe(failedScript);
    const { chat } = widget(false);
    ready(chat);
    await retry;
    expect(chat.toggle).toHaveBeenCalledTimes(1);
  });

  it("times out, cleans up the old ready listener and permits a successful retry", async () => {
    vi.useFakeTimers();
    const { chat } = widget(false);
    const pending = openSupportChat(options());
    const rejected = expect(pending).rejects.toThrow("could not be loaded");
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(chat.toggle).not.toHaveBeenCalled();
    const retry = openSupportChat(options());
    await vi.advanceTimersByTimeAsync(0);
    ready(chat);
    await retry;
    expect(chat.setUser).toHaveBeenCalledTimes(1);
    expect(chat.toggle).toHaveBeenCalledTimes(1);
  });

  it("closes the widget and reports identity rejections only from the actual support iframe", async () => {
    const { chat, iframe } = widget();
    const error = vi.fn();
    const unsubscribe = onSupportChatError(error);
    await openSupportChat(options());
    const dispatch = (origin: string, source: Window | null, data: string) =>
      window.dispatchEvent(
        new MessageEvent("message", { origin, source, data })
      );
    const rejection =
      'chatwoot-widget:{"event":"error","errorType":"SET_USER_ERROR"}';
    dispatch("https://example.invalid", iframe.contentWindow, rejection);
    dispatch(baseUrl, window, rejection);
    dispatch(baseUrl, iframe.contentWindow, "chatwoot-widget:invalid-json");
    expect(error).not.toHaveBeenCalled();
    dispatch(baseUrl, iframe.contentWindow, rejection);
    expect(error).toHaveBeenCalledTimes(1);
    expect(chat.toggle).toHaveBeenLastCalledWith("close");
    unsubscribe();
    dispatch(baseUrl, iframe.contentWindow, rejection);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
