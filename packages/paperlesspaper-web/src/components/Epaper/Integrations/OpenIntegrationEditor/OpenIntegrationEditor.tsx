import React from "react";
import { Button, Empty } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { useParams } from "react-router-dom";

import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import GoogleCalendarDesign from "../GoogleCalendarEditor/GoogleCalenderDesign";
import EmptyGoogleCalendar, {
  showEmptyGoogleCalendar,
} from "../GoogleCalendarEditor/EmptyGoogleCalendar";
import DeletePaper from "../ImageEditor/DeletePaper";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import RotateScreen from "../../Fields/RotateScreen";
import LutFields from "../../Fields/LutFields";
import { papersApi } from "ducks/ePaper/papersApi";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faCircleCheck } from "@fortawesome/pro-regular-svg-icons";
import PluginIframeModal from "./PluginIframeModal";
import PluginInstallPanel from "./PluginInstallPanel";
import { faGears } from "@fortawesome/pro-light-svg-icons";
import {
  applyManifestToForm,
  CONFIG_URL_PATH,
  NAME_PATH,
  hasRequiredPermission,
  isTrustedIntegrationConfigUrl,
  loadManifestIntoForm,
  MANIFEST_PATH,
} from "./manifest";
import type { OpenIntegrationManifest } from "./types";
import { consumeIntegrationInstallSession } from "helpers/integrationInstallSession";

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
  const store: any = useEditor();
  const { setModalOpen } = store;

  if (
    !showMissingOpenIntegrationConfig(store) &&
    showMissingGoogleCalendar(store)
  ) {
    return <EmptyGoogleCalendar />;
  }

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

function showMissingOpenIntegrationConfig(store: any) {
  const pluginConfigUrl =
    store.form.getValues?.(CONFIG_URL_PATH) ||
    store.entryData?.meta?.pluginConfigUrl;

  return !pluginConfigUrl;
}

function openIntegrationRequiresGoogleCalendar(store: any) {
  const manifest =
    store.form.getValues?.(MANIFEST_PATH) ||
    store.entryData?.meta?.pluginManifest;

  return hasRequiredPermission(manifest, "googleCalendar");
}

function showMissingGoogleCalendar(store: any) {
  return (
    openIntegrationRequiresGoogleCalendar(store) && showEmptyGoogleCalendar(store)
  );
}

function showEmptyOpenIntegration(store: any) {
  return (
    showMissingOpenIntegrationConfig(store) || showMissingGoogleCalendar(store)
  );
}

export default function OpenIntegrationEditor({
  defaultPluginConfigUrl,
}: {
  defaultPluginConfigUrl?: string;
} = {}) {
  const params = useParams<any>();

  const [redeemToken] = papersApi.useRedeemPluginRedirectTokenMutation();

  const searchParams = new URLSearchParams(window.location.search);
  const trustedInstallSession = React.useMemo(
    () =>
      consumeIntegrationInstallSession(searchParams.get("integrationInstallId")),
    [],
  );
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
  const manifest = store.form.watch?.(MANIFEST_PATH) as
    | OpenIntegrationManifest
    | undefined;
  const pluginName = String(
    store.form.watch?.(NAME_PATH) || manifest?.name || "",
  );
  const requiresGoogleCalendar = hasRequiredPermission(
    manifest,
    "googleCalendar",
  );

  const components = {
    EmptyMessage: OpenIntegrationEmptyMessage,
  };

  React.useEffect(() => {
    if (!pluginConfigUrl) return;
    const isTrustedInstall =
      Boolean(defaultPluginConfigUrl) ||
      isTrustedIntegrationConfigUrl(pluginConfigUrl) ||
      trustedInstallSession?.configUrl === pluginConfigUrl;
    if (!isTrustedInstall) return;

    const manifest = store.form.getValues?.(MANIFEST_PATH) as
      | OpenIntegrationManifest
      | undefined;
    if (manifest?.name) return;

    if (trustedInstallSession?.manifest) {
      applyManifestToForm(store.form, trustedInstallSession.manifest);
      return;
    }

    const controller = new AbortController();

    loadManifestIntoForm(store.form, pluginConfigUrl, controller.signal).catch(
      (error) => {
        if (error?.name === "AbortError") return;
      },
    );

    return () => controller.abort();
  }, [defaultPluginConfigUrl, pluginConfigUrl, store.form, trustedInstallSession]);

  React.useEffect(() => {
    if (openedSetupRef.current) return;
    if (params?.paper !== "new") return;
    const configUrl = store.form.getValues?.(CONFIG_URL_PATH);
    if (configUrl && isTrustedIntegrationConfigUrl(configUrl)) return;
    if (configUrl && trustedInstallSession?.configUrl === configUrl) return;
    if (configUrl && defaultPluginConfigUrl) return;

    openedSetupRef.current = true;
    store.setModalOpen?.("setup");
  }, [defaultPluginConfigUrl, params?.paper, store, trustedInstallSession]);

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

  const modal = (
    <IntegrationModal
      store={store}
      modalHeading={pluginName || <Trans>Integration Plugin</Trans>}
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

          {requiresGoogleCalendar && (
            <GoogleCalendarDesign
              id="google-calendar"
              text={<Trans>Google Calendar</Trans>}
              settingsBasePath={SETTINGS_PATH}
              showDisplaySettings={false}
              enabled
            />
          )}

          <LutFields />
          <RotateScreen />
          <DeletePaper />
        </>
      }
    ></IntegrationModal>
  );

  if (!requiresGoogleCalendar) {
    return modal;
  }

  return (
    <GoogleOAuthProvider clientId="719541140462-7fg6e3rttotee9tsqmvqgr9mlp77tlq7.apps.googleusercontent.com">
      {modal}
    </GoogleOAuthProvider>
  );
}
