import React from "react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import { papersApi } from "ducks/ePaper/papersApi";

import { getOriginFromUrl } from "./manifest";
import OpenIntegrationSettingsIframe from "./OpenIntegrationSettingsIframe";
import OpenIntegrationSchemaForm from "./OpenIntegrationSchemaForm";
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
  const resolvedSettingsPage = React.useMemo(() => {
    if (!settingsPage) return "";

    try {
      if (configUrl) return new URL(settingsPage, configUrl).toString();
      return new URL(settingsPage).toString();
    } catch {
      return settingsPage;
    }
  }, [settingsPage, configUrl]);

  const paperId =
    params?.paper && params.paper !== "new" ? params.paper : undefined;

  const [height, setHeight] = React.useState<number>(520);

  const [redirectMessage, setRedirectMessage] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!paperId) {
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
          source: "paperlesspaper-app" as const,
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
  }, [paperId, createToken]);

  const initMessage = {
    source: "paperlesspaper-app" as const,
    type: "INIT" as const,
    payload: {
      settings: (form.getValues?.(SETTINGS_PATH) || {}) as Record<string, any>,
      nativeSettings: {
        orientation: form.getValues?.("meta.orientation"),
        lut: form.getValues?.("meta.lut"),
        quality: form.getValues?.("meta.quality"),
      },
      paper: {
        id: paperId,
        kind: form.getValues?.("kind"),
        organization: form.getValues?.("organization"),
      },
      device: {
        kind: form.getValues?.("meta.frameKind"),
        deviceId: form.getValues?.("meta.deviceId"),
      },
      app: {
        language: form.getValues?.("meta.language"),
      },
    },
  };

  // Optional: attach redirectUrl/tempToken later (API-backed)
  const expectedOrigin = resolvedSettingsPage
    ? getOriginFromUrl(resolvedSettingsPage)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!manifest?.name ? (
        <p>
          <Trans>Load a manifest in setup first.</Trans>
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OpenIntegrationSchemaForm schema={manifest.formSchema} />

          {resolvedSettingsPage && (
            <OpenIntegrationSettingsIframe
              url={resolvedSettingsPage}
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
          )}
        </div>
      )}
    </div>
  );
};

export default PluginIframeModal;
