// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";

let editorForm: ReturnType<typeof useForm>;
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useEditor", () => ({
  default: () => ({ form: editorForm }),
}));
vi.mock("react-i18next", () => ({ Trans: ({ children }: any) => children }));
vi.mock("@progressiveui/react", () => ({
  Input: ({ labelText, helperText, children }: any) => (
    <div>{labelText}{helperText}{children}</div>
  ),
  Select: ({ labelText, helperText, ...props }: any) => <select {...props} />,
  SelectItem: ({ text, ...props }: any) => <option {...props}>{text}</option>,
  TextInput: ({ labelText, helperText, ...props }: any) => <input {...props} />,
  Checkbox: () => null,
  TextArea: () => null,
}));

import OpenIntegrationSchemaForm from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/OpenIntegrationSchemaForm";
import type { OpenIntegrationJsonSchemaProperty } from "../../src/components/Epaper/Integrations/OpenIntegrationEditor/types";

function Harness({
  initial,
  property = { type: "string", format: "timezone", default: "Europe/Berlin" },
  basePath = "meta.pluginSettings",
}: {
  initial?: string;
  property?: OpenIntegrationJsonSchemaProperty;
  basePath?: string;
}) {
  editorForm = useForm({
    defaultValues: initial === undefined ? {} : { meta: { pluginSettings: { zone: initial } } },
  });
  return <OpenIntegrationSchemaForm basePath={basePath} schema={{
    type: "object",
    required: ["zone"],
    properties: { zone: { title: "Local timezone", description: "Clock location", ...property } },
  }} />;
}

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function render(element: React.ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(element));
}
function chooseTimezone(search: string) {
  const input = container.querySelector("input")!;
  act(() => {
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const option = Array.from(container.querySelectorAll('[role="option"]'))
    .find((item) => item.textContent?.includes(search));
  expect(option).toBeTruthy();
  act(() => option!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.restoreAllMocks();
});

it("applies a default and saves a selected IANA timezone as a dirty setting", () => {
  render(<Harness />);
  expect(editorForm.getValues("meta.pluginSettings.zone")).toBe("Europe/Berlin");
  expect(container.textContent).toContain("Local timezone *");
  expect(container.textContent).toContain("Clock location");
  chooseTimezone("Tokyo");
  expect(editorForm.getValues("meta.pluginSettings.zone")).toBe("Asia/Dili");
  expect(editorForm.getFieldState("meta.pluginSettings.zone").isDirty).toBe(true);
  expect(editorForm.getFieldState("meta.pluginSettings.zone").isTouched).toBe(true);
});

it("preserves an existing IANA identifier when its city group is reselected", () => {
  render(<Harness initial="Europe/Berlin" />);
  chooseTimezone("Berlin");
  expect(editorForm.getValues("meta.pluginSettings.zone")).toBe("Europe/Berlin");
});

it("supports the widget alias and custom settings paths", () => {
  render(<Harness basePath="custom" property={{ type: "string", "ui:widget": "timezone" }} />);
  chooseTimezone("Tokyo");
  expect(editorForm.getValues("custom.zone")).toBe("Asia/Dili");
  expect(editorForm.getValues("meta.pluginSettings.zone")).toBeUndefined();
});

it("keeps explicit enum restrictions", () => {
  render(<Harness property={{ type: "string", format: "timezone", enum: ["Europe/Berlin", "Asia/Tokyo"] }} />);
  expect(container.querySelectorAll("option")).toHaveLength(2);
  const select = container.querySelector("select")!;
  act(() => {
    select.value = "Asia/Tokyo";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(editorForm.getValues("meta.pluginSettings.zone")).toBe("Asia/Tokyo");
});
