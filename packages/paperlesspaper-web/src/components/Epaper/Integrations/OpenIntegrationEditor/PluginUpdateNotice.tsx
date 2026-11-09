import React from "react";
import { Button, Callout } from "@progressiveui/react";
import { Trans } from "react-i18next";
import useEditor from "../ImageEditor/useEditor";
import {
  applyManifestToForm,
  CONFIG_URL_PATH,
  fetchManifest,
  MANIFEST_PATH,
  manifestFingerprint,
} from "./manifest";
import type { OpenIntegrationManifest } from "./types";

export default function PluginUpdateNotice() {
  const { form, entryData }: any = useEditor();
  const configUrl = form.watch(CONFIG_URL_PATH);
  const manifest = form.watch(MANIFEST_PATH);
  // Only contact the provider already installed on this paper.
  const installedUrl = entryData?.meta?.pluginManifest?.name
    ? entryData.meta.pluginConfigUrl
    : undefined;
  const [remote, setRemote] = React.useState<{
    url: string;
    manifest: OpenIntegrationManifest;
  } | null>(null);

  React.useEffect(() => {
    setRemote(null);
    if (!installedUrl || configUrl !== installedUrl) return;
    const controller = new AbortController();
    fetchManifest(installedUrl, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setRemote({ url: installedUrl, manifest: next });
        }
      })
      .catch(() => {
        // An unavailable provider must not block editing an existing paper.
      });
    return () => controller.abort();
  }, [installedUrl, configUrl]);

  if (
    !manifest ||
    !remote ||
    remote.url !== configUrl ||
    manifestFingerprint(manifest) === manifestFingerprint(remote.manifest)
  ) return null;

  return (
    <Callout
      kind="info"
      title={<Trans>Integration update available</Trans>}
      actions={
        <Button
          type="button"
          kind="primary"
          onClick={() => {
            applyManifestToForm(form, remote.manifest);
            form.setValue(MANIFEST_PATH, remote.manifest, { shouldDirty: true });
          }}
        >
          <Trans>Update</Trans>
        </Button>
      }
    >
      <Trans>A new version of this integration is available.</Trans>
    </Callout>
  );
}
