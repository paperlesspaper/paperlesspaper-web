import React from "react";
import {
  Button,
  Callout,
  InlineLoading,
  TextInput,
} from "@progressiveui/react";
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

import { fetchManifest, getOriginFromUrl } from "./manifest";
import OpenIntegrationSchemaForm from "./OpenIntegrationSchemaForm";
import OpenIntegrationSettingsIframe from "./OpenIntegrationSettingsIframe";
import type { OpenIntegrationManifest } from "./types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/pro-regular-svg-icons";
import PluginIframeModal from "./PluginIframeModal";

const CONFIG_URL_PATH = "meta.pluginConfigUrl";
const MANIFEST_PATH = "meta.pluginManifest";
const SETTINGS_PATH = "meta.pluginSettings";
const RENDER_PAGE_PATH = "meta.pluginRenderPage";
const SETTINGS_PAGE_PATH = "meta.pluginSettingsPage";
const NAME_PATH = "meta.pluginName";
const ICON_PATH = "meta.pluginIcon";
const VERSION_PATH = "meta.pluginVersion";

const PluginInstallPanel = () => {
  const { form }: any = useEditor();

  const configUrl = String(form.watch?.(CONFIG_URL_PATH) || "");
  const manifest = form.watch?.(MANIFEST_PATH) as
    | OpenIntegrationManifest
    | undefined;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!configUrl) {
      setError("Missing config URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchManifest(configUrl);
      form.setValue?.(MANIFEST_PATH, next);
      form.setValue?.(NAME_PATH, next.name);
      form.setValue?.(VERSION_PATH, next.version);
      if (next.icon) form.setValue?.(ICON_PATH, next.icon);
      if (next.renderPage) form.setValue?.(RENDER_PAGE_PATH, next.renderPage);
      if (next.settingsPage)
        form.setValue?.(SETTINGS_PAGE_PATH, next.settingsPage);

      // Apply native defaults (only if undefined)
      const native = next.nativeSettings || {};
      for (const [k, v] of Object.entries(native)) {
        const path = `meta.${k}`;
        const current = form.getValues?.(path);
        if (typeof current === "undefined") form.setValue?.(path, v);
      }

      // Ensure settings object exists
      const currentSettings = form.getValues?.(SETTINGS_PATH);
      if (!currentSettings) form.setValue?.(SETTINGS_PATH, {});
    } catch (e: any) {
      setError(e?.message || "Failed to load manifest");
    } finally {
      setLoading(false);
    }
  }, [configUrl, form]);

  // Auto-load manifest when a config URL is prefilled (e.g. via query param).
  React.useEffect(() => {
    if (!configUrl) return;
    if (manifest?.name) return;
    if (loading) return;
    // Avoid spamming retries if there was an error.
    if (error) return;
    load();
  }, [configUrl, manifest?.name, loading, error, load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TextInput
        labelText={<Trans>Integration config URL</Trans>}
        helperText={
          <Trans>Example: https://myExampleIntegration.com/config.json</Trans>
        }
        value={configUrl}
        onChange={(e) => form.setValue?.(CONFIG_URL_PATH, e.target.value)}
        placeholder="https://…/config.json"
      />

      {loading ? (
        <InlineLoading description={<Trans>Loading…</Trans>} />
      ) : (
        <Button kind="secondary" onClick={load} disabled={!configUrl}>
          <Trans>Load manifest</Trans>
        </Button>
      )}

      {error && (
        <Callout kind="warning">
          <Trans>{error}</Trans>
        </Callout>
      )}

      {manifest?.name && (
        <div>
          <strong>
            <Trans>Loaded</Trans>
          </strong>
          : {manifest.name} ({manifest.version})
        </div>
      )}

      <h3>Settings</h3>

      <OpenIntegrationSchemaForm schema={manifest?.formSchema} />
    </div>
  );
};

export default PluginInstallPanel;
