// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@progressiveui/react", () => ({
  TextInput: ({ addonAfter, ...props }: any) => <><input {...props} />{addonAfter}</>,
  Tooltip: ({ content, children }: any) => <><span>{content}</span>{children}</>,
  Button: ({ icon, ...props }: any) => <button {...props} />,
}));
import TextInputWithCopy from "../../src/components/inputs/TextInputWithCopy";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const writeText = vi.fn();
const render = async (value = "test-token") => {
  await act(async () => root.render(<form><TextInputWithCopy id="token" value={value}
    tooltipContent={(copied) => copied ? "Token copied" : "Copy token"} /></form>));
};
const click = async () => { await act(async () => container.querySelector("button")!.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container); writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
it("confirms only after clipboard success and does not submit the form", async () => {
  let resolve!: () => void;
  writeText.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  await render();
  const submit = vi.fn((event: Event) => event.preventDefault());
  container.querySelector("form")!.addEventListener("submit", submit);
  await click();
  expect(writeText).toHaveBeenCalledWith("test-token");
  expect(container.textContent).not.toContain("Token copied");
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => resolve());
  expect(container.textContent).toContain("Token copied");
  expect(container.querySelector("button")!.disabled).toBe(false);
  expect(submit).not.toHaveBeenCalled();
});
it.each(["rejected", "unavailable"])("offers manual copying when clipboard is %s", async (failure) => {
  if (failure === "unavailable") Object.defineProperty(navigator, "clipboard", { value: undefined });
  else writeText.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  await render(); await click();
  expect(container.textContent).not.toContain("Token copied");
  expect(container.querySelector('[role="alert"]')!.textContent).toContain("copy it manually");
  const input = container.querySelector("input")!;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(container.querySelector("button")!.disabled).toBe(false);
});
it("can retry a rejected copy", async () => {
  writeText.mockRejectedValueOnce(new Error("Denied")).mockResolvedValueOnce(undefined);
  await render(); await click(); await click();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("Token copied");
});
it.each(["resolve", "reject"])("ignores stale %s when value changes", async (outcome) => {
  let resolve!: () => void; let reject!: (error: Error) => void;
  writeText.mockReturnValue(new Promise<void>((done, fail) => { resolve = done; reject = fail; }));
  await render(); await click(); await render("new-token");
  await act(async () => outcome === "resolve" ? resolve() : reject(new Error("Denied")));
  expect(container.textContent).not.toContain("Token copied");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector("input")!.value).toBe("new-token");
  expect(container.querySelector("button")!.disabled).toBe(false);
});
