// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useForm, type UseFormReturn } from "react-hook-form";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let form: UseFormReturn<{ meta: { protectTextAndGraphics?: boolean } }>;
vi.mock("react-i18next", () => ({ Trans: ({ children }: any) => children }));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/useEditor", () => ({
  default: () => ({ form }),
}));
vi.mock("../../src/components/Epaper/Integrations/ImageEditor/EditorButton", () => ({
  default: ({ modalComponent: Component }: any) => <Component />,
}));
import WebsiteImageProcessing from "../../src/components/Epaper/Fields/WebsiteImageProcessing";

const Harness = ({ protection }: { protection?: boolean }) => {
  form = useForm({ defaultValues: { meta: { protectTextAndGraphics: protection } } });
  return <WebsiteImageProcessing />;
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it.each([undefined, true, false])("reflects the default or saved website protection preference (%s)", (protection) => {
  act(() => root.render(<Harness protection={protection} />));
  const checkbox = container.querySelector("input[type=checkbox]") as HTMLInputElement;
  expect(checkbox.checked).toBe(protection !== false);
  act(() => checkbox.click());
  expect(form.getValues("meta.protectTextAndGraphics")).toBe(protection === false);
  act(() => root.render(<Harness protection={protection} />));
  expect(checkbox.checked).toBe(protection === false);
});
