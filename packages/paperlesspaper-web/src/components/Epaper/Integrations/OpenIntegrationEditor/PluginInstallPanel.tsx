import React from "react";
import {
  Button,
  Callout,
  InlineLoading,
  TextInput,
} from "@progressiveui/react";
import { Trans } from "react-i18next";
import useEditor from "../ImageEditor/useEditor";
import {
  CONFIG_URL_PATH,
  isTrustedIntegrationConfigUrl,
  loadManifestIntoForm,
  MANIFEST_PATH,
} from "./manifest";
import type { OpenIntegrationManifest } from "./types";

const PluginInstallPanel = () => {
  const { form }: any = useEditor();

  const configUrl = String(form.watch?.(CONFIG_URL_PATH) || "");
  const manifest = form.watch?.(MANIFEST_PATH) as
    | OpenIntegrationManifest
    | undefined;
  const isTrustedConfigUrl = isTrustedIntegrationConfigUrl(configUrl);

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
      await loadManifestIntoForm(form, configUrl);
    } catch (e: any) {
      setError(e?.message || "Failed to load manifest");
    } finally {
      setLoading(false);
    }
  }, [configUrl, form]);

  // Auto-load only trusted Paperlesspaper-owned config URLs.
  React.useEffect(() => {
    if (!configUrl) return;
    if (!isTrustedConfigUrl) return;
    if (manifest?.name) return;
    if (loading) return;
    // Avoid spamming retries if there was an error.
    if (error) return;
    load();
  }, [configUrl, isTrustedConfigUrl, manifest?.name, loading, error, load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <Callout kind="warning">
          <Trans>{error}</Trans>
        </Callout>
      )}

      {configUrl && !isTrustedConfigUrl && !manifest?.name && !error && (
        <Callout kind="warning" title={<Trans>External integration</Trans>}>
          <Trans>
            This integration is hosted outside paperlesspaper.de. Load it only
            if you trust the source.
          </Trans>
        </Callout>
      )}

      {manifest?.name && (
        <Callout
          kind="success"
          title={<Trans>Integration loaded successfully</Trans>}
        >
          {manifest.name} ({manifest.version})
        </Callout>
      )}
      <TextInput
        labelText={<Trans>Config URL</Trans>}
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
        <Button onClick={load} disabled={!configUrl}>
          <Trans>Load Integration</Trans>
        </Button>
      )}
    </div>
  );
};

export default PluginInstallPanel;
