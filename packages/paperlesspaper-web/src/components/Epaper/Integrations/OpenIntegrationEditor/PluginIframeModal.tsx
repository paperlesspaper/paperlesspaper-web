import React from "react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import { papersApi } from "ducks/ePaper/papersApi";

import { getOriginFromUrl } from "./manifest";
import OpenIntegrationSettingsIframe from "./OpenIntegrationSettingsIframe";
import type { OpenIntegrationManifest } from "./types";
import useEditor from "../ImageEditor/useEditor";

const CONFIG_URL_PATH = "meta.pluginConfigUrl";
const MANIFEST_PATH = "meta.pluginManifest";
const SETTINGS_PATH = "meta.pluginSettings";
const SETTINGS_PAGE_PATH = "meta.pluginSettingsPage";

const PluginIframeModal = () => {
  const { form }: any = useEditor();
  const params = useParams<any>();

  const [createToken] = papersApi.useCreatePluginRedirectTokenMutation();

  const configUrl = String(form.watch?.(CONFIG_URL_PATH) || "");
  const manifest = form.watch?.(MANIFEST_PATH) as
    | OpenIntegrationManifest
    | undefined;
  const settingsPage = String(
    form.watch?.(SETTINGS_PAGE_PATH) || manifest?.settingsPage || "",
  );

  const [height, setHeight] = React.useState<number>(520);

  const [redirectMessage, setRedirectMessage] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;

    const paperId = params?.paper;
    if (!paperId || paperId === "new") {
      setRedirectMessage(null);
      return;
    }

    (async () => {
      try {
        const tokenResult = await createToken({ id: paperId }).unwrap();
        const tempToken = tokenResult?.tempToken;
        if (!tempToken) return;

        const redirectUrl = `${window.location.origin}${window.location.pathname}`;
        const msg = {
          source: "wirewire-app" as const,
          type: "REDIRECT" as const,
          payload: {
            redirectUrl,
            tempToken,
          },
        };

        if (!cancelled) setRedirectMessage(msg);
      } catch {
        // Token is optional; keep iframe usable without it.
        if (!cancelled) setRedirectMessage(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params?.paper, createToken]);

  if (!settingsPage) {
    return (
      <p>
        <Trans>No settings page provided by this integration.</Trans>
      </p>
    );
  }

  const initMessage = {
    source: "wirewire-app" as const,
    type: "INIT" as const,
    payload: {
      settings: (form.getValues?.(SETTINGS_PATH) || {}) as Record<string, any>,
      nativeSettings: {
        orientation: form.getValues?.("meta.orientation"),
        quality: form.getValues?.("meta.quality"),
      },
      device: {
        deviceId: form.getValues?.("meta.deviceId"),
      },
      app: {
        language: form.getValues?.("meta.language"),
      },
    },
  };

  // Optional: attach redirectUrl/tempToken later (API-backed)
  const expectedOrigin = getOriginFromUrl(settingsPage);

  return (
    <div>
      {!configUrl && (
        <p>
          <Trans>Tip: load a manifest first.</Trans>
        </p>
      )}
      <OpenIntegrationSettingsIframe
        url={settingsPage}
        expectedOrigin={expectedOrigin}
        height={height}
        onHeight={(h) => setHeight(Math.min(Math.max(h, 240), 1400))}
        onSettingsUpdate={(patch) => {
          const current = form.getValues?.(SETTINGS_PATH) || {};
          form.setValue?.(SETTINGS_PATH, { ...current, ...patch });
        }}
        initMessage={initMessage}
        redirectMessage={redirectMessage || undefined}
      />
    </div>
  );
};

export default PluginIframeModal;
