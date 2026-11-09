// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function renderEditor() {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => { root.render(<Editor />); });
}
import { useForm } from "react-hook-form";
import PluginUpdateNotice from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/PluginUpdateNotice";
import { manifestFingerprint } from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/manifest";
const state = vi.hoisted(() => ({ store: null as any }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useEditor", () => ({ default: () => state.store }));
vi.mock("react-i18next", () => ({ Trans: ({ children }: any) => children }));
vi.mock("@progressiveui/react", () => ({ Button: (props: any) => <button {...props} />, Callout: ({ title, children, actions }: any) => <div>{title}{children}{actions}</div> }));
const oldManifest = { name: "Demo", version: "1", renderPage: "/v1/render", settingsPage: "/settings" };
const nextManifest = { name: "Demo", version: "2", renderPage: "/v2/render", nativeSettings: { color: "red", rotation: 90 } };
const url = "https://example.com/config.json";
function Editor() {
  const form = useForm({ defaultValues: { meta: { pluginConfigUrl: url, pluginManifest: oldManifest, pluginRenderPage: oldManifest.renderPage, pluginSettingsPage: oldManifest.settingsPage, pluginSettings: { city: "Berlin" }, color: "blue" } } });
  state.store = { form, entryData: { meta: { pluginConfigUrl: url, pluginManifest: oldManifest } } };
  return <PluginUpdateNotice />;
}
afterEach(() => { if (root) act(() => root.unmount()); vi.unstubAllGlobals(); });
it("only applies on click, preserves settings and clears removed URLs", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => nextManifest });
  vi.stubGlobal("fetch", fetch);
  await renderEditor();
  expect(container.textContent).toContain("Integration update available");
  expect(state.store.form.getValues("meta.pluginManifest")).toEqual(oldManifest);
  await act(async () => { container.querySelector("button")!.click(); });
  expect(container.textContent).toBe("");
  expect(state.store.form.getValues("meta")).toMatchObject({ pluginManifest: nextManifest, pluginRenderPage: "/v2/render", pluginSettingsPage: "", pluginSettings: { city: "Berlin" }, color: "blue", rotation: 90 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "omit" });
});
it.each([oldManifest, { invalid: true }, "offline"])("keeps the existing paper for %j", async (result) => {
  const fetch = result === "offline" ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue({ ok: true, json: async () => result });
  vi.stubGlobal("fetch", fetch);
  await renderEditor();
  expect(fetch).toHaveBeenCalledOnce();
  expect(container.textContent).toBe("");
  expect(state.store.form.getValues("meta.pluginManifest")).toEqual(oldManifest);
});
it("ignores object key order but detects same-version changes", () => {
  expect(manifestFingerprint({ version: "1", nativeSettings: { a: 1, b: 2 } })).toBe(manifestFingerprint({ nativeSettings: { b: 2, a: 1 }, version: "1" }));
  expect(manifestFingerprint(oldManifest)).not.toBe(manifestFingerprint({ ...oldManifest, renderPage: "/changed" }));
});
