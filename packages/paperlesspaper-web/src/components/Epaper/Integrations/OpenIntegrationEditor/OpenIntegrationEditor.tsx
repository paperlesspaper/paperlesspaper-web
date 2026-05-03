import React from "react";
import { Button, Empty } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import DeletePaper from "../ImageEditor/DeletePaper";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import RotateScreen from "../../Fields/RotateScreen";
import LutFields from "../../Fields/LutFields";
import { papersApi } from "ducks/ePaper/papersApi";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faCircleCheck } from "@fortawesome/pro-regular-svg-icons";
import PluginIframeModal from "./PluginIframeModal";
import PluginInstallPanel from "./PluginInstallPanel";
import { faGears } from "@fortawesome/pro-light-svg-icons";

const CONFIG_URL_PATH = "meta.pluginConfigUrl";
const SETTINGS_PATH = "meta.pluginSettings";

function safeJsonParse(value?: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function OpenIntegrationEmptyMessage() {
  const { setModalOpen } = useEditor();

  return (
    <Empty
      title={<Trans>Enter the integration URL</Trans>}
      icon={<FontAwesomeIcon icon={faGears} size="2x" />}
      button={
        <Button onClick={() => setModalOpen("setup")}>
          <Trans>Enter URL</Trans>
        </Button>
      }
    >
      <Trans>Start by adding the config.json URL for this integration.</Trans>
    </Empty>
  );
}

function showEmptyOpenIntegration(store: any) {
  const pluginConfigUrl =
    store.form.getValues?.(CONFIG_URL_PATH) ||
    store.entryData?.meta?.pluginConfigUrl;

  return !pluginConfigUrl;
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
  const openedSetupRef = React.useRef(false);

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

  const components = {
    EmptyMessage: OpenIntegrationEmptyMessage,
  };

  React.useEffect(() => {
    if (openedSetupRef.current) return;
    if (params?.paper !== "new") return;
    if (store.form.getValues?.(CONFIG_URL_PATH)) return;

    openedSetupRef.current = true;
    store.setModalOpen?.("setup");
  }, [params?.paper, store]);

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
      components={components}
      showEmpty={showEmptyOpenIntegration}
      elements={
        <>
          <EditorButton
            id="setup"
            icon={<FontAwesomeIcon icon={faCircleCheck} />}
            text="Setup"
            modalHeading={<Trans>Setup</Trans>}
            modalComponent={PluginInstallPanel}
          />

          <EditorButton
            id="plugin-iframe"
            icon={<FontAwesomeIcon icon={faGear} />}
            text={<Trans>Settings</Trans>}
            modalHeading={<Trans>Settings</Trans>}
            modalComponent={PluginIframeModal}
          />

          <LutFields />
          <RotateScreen />
          <DeletePaper />
        </>
      }
    ></IntegrationModal>
  );
}
