import React from "react";
import { InlineLoading } from "@progressiveui/react";
import { Trans } from "react-i18next";

import { getOriginFromUrl } from "./manifest";
import type {
  OpenIntegrationAppToPluginMessage,
  OpenIntegrationPluginToAppMessage,
} from "./types";

type Props = {
  url: string;
  expectedOrigin?: string | null;
  height?: number;
  onHeight?: (height: number) => void;
  onSettingsUpdate?: (settingsPatch: Record<string, any>) => void;
  initMessage: OpenIntegrationAppToPluginMessage;
  redirectMessage?: OpenIntegrationAppToPluginMessage;
};

export default function OpenIntegrationSettingsIframe({
  url,
  expectedOrigin,
  height,
  onHeight,
  onSettingsUpdate,
  initMessage,
  redirectMessage,
}: Props) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const origin = expectedOrigin ?? getOriginFromUrl(url);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!iframeRef.current) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      // Strict origin check when possible.
      if (origin && event.origin !== origin) return;

      const data = event.data as OpenIntegrationPluginToAppMessage | any;
      if (!data || typeof data !== "object") return;

      if (data.source === "wirewire-plugin" && data.type === "SET_HEIGHT") {
        const next = Number(data.payload?.height);
        if (Number.isFinite(next) && next > 0) onHeight?.(next);
      }

      if (
        data.source === "wirewire-plugin" &&
        data.type === "UPDATE_SETTINGS" &&
        data.payload &&
        typeof data.payload === "object"
      ) {
        onSettingsUpdate?.(data.payload);
      }

      // Backwards compatibility: { cmd: 'message', data: {...} }
      if (
        data.cmd === "message" &&
        data.data &&
        typeof data.data === "object"
      ) {
        onSettingsUpdate?.(data.data);
      }

      // Backwards compatibility: { height: 123 }
      if (typeof data.height === "number" && Number.isFinite(data.height)) {
        onHeight?.(data.height);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, onHeight, onSettingsUpdate]);

  const post = React.useCallback(
    (msg: OpenIntegrationAppToPluginMessage) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(msg, origin || "*");

      // Backwards compatibility for very simple plugins
      if (msg.type === "INIT") {
        win.postMessage({ cmd: "message", data: msg.payload }, origin || "*");
      }
      if (msg.type === "REDIRECT") {
        win.postMessage({ cmd: "redirect", data: msg.payload }, origin || "*");
      }
    },
    [origin],
  );

  React.useEffect(() => {
    if (!loaded) return;
    post(initMessage);
    if (redirectMessage) post(redirectMessage);
  }, [loaded, post, initMessage, redirectMessage]);

  return (
    <div>
      {!loaded && (
        <div style={{ padding: 12 }}>
          <InlineLoading description={<Trans>Loading integration…</Trans>} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: height ? `${height}px` : "520px",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 8,
        }}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        referrerPolicy="no-referrer"
        title="Integration Settings"
      />
    </div>
  );
}
