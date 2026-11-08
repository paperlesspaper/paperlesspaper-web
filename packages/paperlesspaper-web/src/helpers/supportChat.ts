import type { ChatwootIdentity } from "ducks/supportApi";

const BASE_URL = "https://support.paperlesspaper.de";
const SCRIPT_ID = "chatwoot-sdk";
const TIMEOUT = 15000;

type Chatwoot = {
  hasLoaded: boolean;
  baseDomain?: string;
  setUser: (identifier: string, user: Record<string, string>) => void;
  setCustomAttributes?: (attributes: Record<string, string>) => void;
  toggle: (state: "open" | "close") => void;
};

type ChatWindow = Window & {
  $chatwoot?: Chatwoot;
  chatwootSettings?: Record<string, unknown>;
  chatwootSDK?: {
    run: (options: { baseUrl: string; websiteToken: string }) => void;
  };
};

type Options = {
  getIdentity: () => Promise<ChatwootIdentity>;
  user: { name?: string; email?: string; picture?: string };
  platform: string;
  native: boolean;
  launcherTitle: string;
};

let opening: Promise<void> | undefined;

function loadWidget(
  websiteToken: string,
  launcherTitle: string
): Promise<Chatwoot> {
  const chatWindow = window as ChatWindow;
  if (chatWindow.$chatwoot?.hasLoaded)
    return Promise.resolve(chatWindow.$chatwoot);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("chatwoot:ready", ready);
      script?.removeEventListener("load", run);
      script?.removeEventListener("error", failed);
    };
    const failed = () => {
      cleanup();
      // A failed script must not block the next attempt. Preserve the SDK and
      // conversation cookie if only the iframe is still loading.
      if (!chatWindow.chatwootSDK) script?.remove();
      reject(new Error("Support chat could not be loaded"));
    };
    const ready = () => {
      if (!chatWindow.$chatwoot?.hasLoaded) return;
      cleanup();
      resolve(chatWindow.$chatwoot);
    };
    const run = () => {
      try {
        if (!chatWindow.chatwootSDK) return failed();
        chatWindow.chatwootSDK.run({ baseUrl: BASE_URL, websiteToken });
        ready();
      } catch {
        failed();
      }
    };
    const timer = window.setTimeout(failed, TIMEOUT);
    window.addEventListener("chatwoot:ready", ready);
    chatWindow.chatwootSettings = {
      ...chatWindow.chatwootSettings,
      hideMessageBubble: true,
      position: "right",
      locale: "de",
      type: "expanded_bubble",
      launcherTitle,
      showPopoutButton: true,
      enableEndConversation: false,
    };

    if (chatWindow.$chatwoot) {
      // Retry a failed iframe load without resetting the persisted session.
      const iframe = document.getElementById(
        "chatwoot_live_chat_widget"
      ) as HTMLIFrameElement | null;
      if (iframe) iframe.setAttribute("src", iframe.src);
    } else if (chatWindow.chatwootSDK) {
      run();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = `${BASE_URL}/packs/js/sdk.js`;
        script.async = true;
      }
      script.addEventListener("load", run);
      script.addEventListener("error", failed);
      if (!script.isConnected) document.head.appendChild(script);
    }
  });
}

// The SDK does not expose an identification-complete event: setAuthCookie is
// only sent when the server rotates the token, not on every successful setUser.
// Listen for explicit rejections instead of waiting for an optional event.
export function onSupportChatError(onError: () => void): () => void {
  const listener = (event: MessageEvent) => {
    const iframe = document.getElementById(
      "chatwoot_live_chat_widget"
    ) as HTMLIFrameElement | null;
    if (
      event.origin !== BASE_URL ||
      !iframe?.contentWindow ||
      event.source !== iframe.contentWindow
    )
      return;
    if (
      typeof event.data !== "string" ||
      !event.data.startsWith("chatwoot-widget:")
    )
      return;
    try {
      if (
        JSON.parse(event.data.slice("chatwoot-widget:".length)).event !==
        "error"
      )
        return;
    } catch {
      return;
    }
    (window as ChatWindow).$chatwoot?.toggle("close");
    onError();
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function openSupportChat(options: Options): Promise<void> {
  if (opening) return opening;
  opening = (async () => {
    const identity = await options.getIdentity();
    if (
      !identity.identifier ||
      !identity.identityValidationConfigured ||
      !identity.identifierHash
    ) {
      throw new Error("Support chat requires a verified identity");
    }
    const websiteToken =
      import.meta.env.REACT_APP_CHATWOOT || "ErhRVgC985NqpKuC9YBGzGiU";
    const chat = await loadWidget(websiteToken, options.launcherTitle);
    // setUser's deduplication cookie survives independently of the session and
    // is written before the server accepts the identity. Re-identify on opening
    // even if that cache exists; preserve cw_conversation and its chat history.
    const cookie = `cw_user_${websiteToken}=; Max-Age=0; path=/`;
    document.cookie = cookie;
    if (chat.baseDomain)
      document.cookie = `${cookie}; domain=${chat.baseDomain}`;
    chat.setUser(identity.identifier, {
      name:
        options.user.name ||
        identity.email ||
        options.user.email ||
        identity.identifier,
      ...(identity.email || options.user.email
        ? { email: identity.email || options.user.email }
        : {}),
      ...(options.user.picture ? { avatar_url: options.user.picture } : {}),
      identifier_hash: identity.identifierHash,
    });
    chat.setCustomAttributes?.({
      app_platform: options.platform,
      app_shell: options.native ? "native" : "web",
      ...(identity.email || options.user.email
        ? { support_email: identity.email || options.user.email }
        : {}),
    });
    chat.toggle("open");
  })().finally(() => {
    opening = undefined;
  });
  return opening;
}
