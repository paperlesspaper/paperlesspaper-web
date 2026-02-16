import React from "react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import DeletePaper from "../ImageEditor/DeletePaper";
import EditorButton from "../ImageEditor/EditorButton";
import RotateScreen from "../../Fields/RotateScreen";
import LutFields from "../../Fields/LutFields";
import { papersApi } from "ducks/ePaper/papersApi";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/pro-regular-svg-icons";
import PluginIframeModal from "./PluginIframeModal";
import PluginInstallPanel from "./PluginInstallPanel";

const SETTINGS_PATH = "meta.pluginSettings";

function safeJsonParse(value?: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function OpenIntegrationEditor({
  defaultPluginConfigUrl,
}: {
  defaultPluginConfigUrl?: string;
} = {}) {
  const params = useParams<any>();

  const [redeemToken] = papersApi.useRedeemPluginRedirectTokenMutation();

  const searchParams = new URLSearchParams(window.location.search);
  const pluginConfigUrl =
    defaultPluginConfigUrl || searchParams.get("pluginConfigUrl") || undefined;

  const store = useIntegrationForm({
    defaultValues: {
      kind: "plugin",
      meta: {
        pluginConfigUrl,
        // default container for plugin settings
        pluginSettings: {},
      },
    },
  });

  // Apply redirect payload if present (user already authenticated)
  React.useEffect(() => {
    const tempToken =
      searchParams.get("tempToken") || searchParams.get("integrationTempToken");
    const settingsJson =
      searchParams.get("settings") || searchParams.get("integrationSettings");

    const parsed = safeJsonParse(settingsJson);
    if (!parsed || typeof parsed !== "object") return;

    const paperId = params?.paper;

    (async () => {
      if (tempToken) {
        if (!paperId || paperId === "new") return;
        try {
          await redeemToken({ id: paperId, body: { tempToken } }).unwrap();
        } catch {
          return;
        }
      }

      const current = store.form.getValues?.(SETTINGS_PATH) || {};
      store.form.setValue?.(SETTINGS_PATH, { ...current, ...parsed });

      // Clean URL (avoid re-applying on refresh)
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("tempToken");
      cleaned.searchParams.delete("integrationTempToken");
      cleaned.searchParams.delete("settings");
      cleaned.searchParams.delete("integrationSettings");
      window.history.replaceState({}, "", cleaned.toString());
    })();
  }, []);

  return (
    <IntegrationModal
      store={store}
      modalHeading={<Trans>Integration Plugin</Trans>}
      passiveModal
      elements={
        <>
          <EditorButton
            id="plugin-iframe"
            icon={<FontAwesomeIcon icon={faGear} />}
            text={<Trans>Settings</Trans>}
            modalHeading={<Trans>Settings</Trans>}
            modalComponent={PluginIframeModal}
          />

          <EditorButton
            id="setup"
            text={<Trans>Setup</Trans>}
            icon={<FontAwesomeIcon icon={faGear} />}
            modalComponent={<PluginInstallPanel />}
            modalHeading={<Trans>Setup</Trans>}
          />

          <LutFields />
          <RotateScreen />
          <DeletePaper />
        </>
      }
    ></IntegrationModal>
  );
}
