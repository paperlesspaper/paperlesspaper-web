import React from "react";
import { createRoot } from "react-dom/client";
import MultiImageUploadEditor from "../../src/components/Epaper/Integrations/MultiImageUploadEditor/MultiImageUploadEditor";
import { state } from "./environment";
const root = createRoot(document.querySelector("#root")!);
const report = document.querySelector("#results")!;
const results: any[] = [];
let peakCanvases = 0;
const sample = () => {
  peakCanvases = Math.max(
    peakCanvases,
    document.querySelectorAll("canvas").length
  );
};
const observer = new MutationObserver(sample);
observer.observe(document.querySelector("#root")!, {
  subtree: true,
  childList: true,
});
const waitFor = async (predicate: () => boolean, message: string) => {
  const deadline = Date.now() + 180000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const button = (label: string) =>
  [...document.querySelectorAll("button")].find(
    (button) => button.textContent === label
  )!;
const input = () =>
  document.querySelector<HTMLInputElement>("input[type=file]")!;
const ready = () => !input().disabled;
async function select(files: File[]) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input().files = transfer.files;
  input().dispatchEvent(new Event("change", { bubbles: true }));
  await waitFor(() => !ready(), "preparation started");
  await waitFor(ready, "preparation completed");
}
async function upload() {
  button("Upload images").click();
  await waitFor(() => !ready(), "upload started");
  await waitFor(ready, "upload completed");
}
async function files(count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 4032;
  canvas.height = 3024;
  const ctx = canvas.getContext("2d")!;
  const output: File[] = [];
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `hsl(${i * 37},70%,55%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.font = "300px sans-serif";
    ctx.fillText(`Photo ${i + 1}`, 200, 600);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9)
    );
    output.push(new File([blob], `photo-${i + 1}.jpg`, { type: "image/jpeg" }));
  }
  canvas.width = canvas.height = 0;
  return output;
}
async function run() {
  for (const count of [12, 13, 30]) {
    state.created = [];
    state.uploaded = [];
    state.attempts = [];
    state.navigations = 0;
    state.failed = false;
    state.failName = count === 13 ? "photo-7.jpg" : "";
    peakCanvases = 0;
    root.render(
      <React.StrictMode>
        <MultiImageUploadEditor key={count} />
      </React.StrictMode>
    );
    await waitFor(
      () => Boolean(input()) && !document.querySelector("img"),
      "fresh importer"
    );
    const selection = await files(count);
    if (count === 30)
      selection.splice(
        5,
        0,
        new File(["broken"], "broken.jpg", { type: "image/jpeg" })
      );
    await select(selection);
    assert(
      document.querySelectorAll("img").length === count,
      "all readable photos selected"
    );
    assert(document.querySelectorAll("canvas").length === 0, "no idle editors");
    if (count === 13) {
      button("Edit").click();
      await waitFor(
        () =>
          (window as any).editorContext?.fabricRef.current?.getObjects()
            .length > 0 &&
          !(window as any).editorContext?.imageEditorTools.isLoadingImageData,
        "edit ready"
      );
      (window as any).editorContext.fabricRef.current
        .getObjects()[0]
        .set({ angle: 90 });
      button("Close editor").click();
      await waitFor(() => !document.querySelector("canvas"), "editor disposed");
      button("Edit").click();
      await waitFor(
        () =>
          (window as any).editorContext?.fabricRef.current?.getObjects()[0]
            ?.angle === 90,
        "edit restored"
      );
      button("Close editor").click();
      await waitFor(
        () => !document.querySelector("canvas"),
        "editor disposed again"
      );
    }
    await upload();
    if (count === 13) {
      assert(
        state.uploaded.length === 12,
        "remaining files continue after upload failure"
      );
      assert(
        document.querySelectorAll("img").length === 1,
        "only failed file pending"
      );
      assert(
        state.uploaded[0].editable.objects[0].angle === 90,
        "edited rotation uploaded"
      );
      await upload();
      assert(state.attempts.length === 14, "only failed file retried");
      assert(
        state.uploaded.at(-1).id === state.created[6].id,
        "retry reused paper ID"
      );
    }
    assert(state.created.length === count, "no duplicate papers");
    assert(state.uploaded.length === count, "all valid files uploaded");
    assert(
      state.created.every((paper, i) => paper.name === `photo-${i + 1}.jpg`),
      "selection order preserved"
    );
    assert(
      peakCanvases <= 4,
      `at most one editor; got ${peakCanvases} canvases`
    );
    if (count === 30) {
      assert(
        document
          .querySelector("[role=alert]")
          ?.textContent?.includes("broken.jpg"),
        "broken filename visible"
      );
      assert(state.navigations === 0, "preparation failure stays visible");
    }
    results.push({
      count,
      status: "PASS",
      created: state.created.length,
      uploads: state.uploaded.length,
      attempts: state.attempts.length,
      peakCanvases,
    });
    report.textContent = JSON.stringify(results, null, 2);
  }
}
run()
  .catch((error) => {
    results.push({ status: "FAIL", error: String(error), stack: error.stack });
  })
  .finally(async () => {
    observer.disconnect();
    const result = { userAgent: navigator.userAgent, results };
    report.textContent = JSON.stringify(result, null, 2);
    document.title = results.some((result) => result.status === "FAIL")
      ? "FAIL Photo import"
      : "PASS Photo import";
    await fetch("/results", { method: "POST", body: JSON.stringify(result) });
  });
