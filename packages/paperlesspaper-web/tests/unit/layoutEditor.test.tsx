// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
let root: Root;
function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(element));
}
function cleanup() {
  act(() => root?.unmount());
  document.body.innerHTML = "";
}
const labels = (text: string) =>
  [...document.querySelectorAll("label")]
    .filter((label) => label.firstChild?.textContent === text)
    .map(
      (label) => label.querySelector("input,select,textarea") as HTMLElement
    );
const screen = {
  getByText: (text: string) =>
    [...document.querySelectorAll("button,p")].find(
      (element) => element.textContent === text
    )!,
  queryByText: (pattern: RegExp) =>
    [...document.querySelectorAll("option")].find((element) =>
      pattern.test(element.textContent || "")
    ) || null,
  getAllByLabelText: labels,
  getByLabelText: (text: string) => labels(text)[0],
  getByTitle: (title: string) => document.querySelector(`[title="${title}"]`)!,
  getByRole: (role: string) => document.querySelector(`[role="${role}"]`)!,
};
const fireEvent = {
  change: (element: HTMLElement, event: { target: { value: string } }) =>
    act(() => {
      (element as HTMLInputElement).value = event.target.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }),
  click: (element: Element) =>
    act(() =>
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    ),
};
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const resolveLayout = vi.hoisted(() => vi.fn());
const t = vi.hoisted(() => (value: string) => value);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
  Trans: ({ children }: any) => children,
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, kind, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("../../src/ducks/ePaper/papersApi", () => ({
  papersApi: { useResolveLayoutMutation: () => [resolveLayout] },
}));
vi.mock("../../src/components/Epaper/Integrations/IntegrationModal", () => ({
  default: ({ children, primaryButtonDisabled }: any) => (
    <div>
      {children}
      <button disabled={primaryButtonDisabled}>Send layout</button>
    </div>
  ),
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/useRotationList",
  () => ({
    default: () => ({
      portrait: { width: 480, height: 800 },
      landscape: { width: 800, height: 480 },
    }),
  })
);
vi.mock(
  "../../src/components/Epaper/Integrations/useIntegrationForm",
  async () => {
    const { useForm } = await import("react-hook-form");
    return {
      default: ({ defaultValues }: any) => ({
        form: useForm({ defaultValues }),
        params: { organization: "aaaaaaaaaaaaaaaaaaaaaaaa" },
        organizationPapers: {
          data: [
            {
              id: "bbbbbbbbbbbbbbbbbbbbbbbb",
              kind: "image",
              name: "Mountain photo",
            },
            {
              id: "cccccccccccccccccccccccc",
              kind: "plugin",
              name: "Family calendar",
            },
            {
              id: "dddddddddddddddddddddddd",
              kind: "layout",
              name: "Other layout",
            },
          ],
        },
      }),
    };
  }
);
import LayoutEditor from "../../src/components/Epaper/Integrations/LayoutEditor/LayoutEditor";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  resolveLayout
    .mockReset()
    .mockImplementation(() => ({
      unwrap: () => Promise.resolve({ layout: { renderId: "current-render" } }),
      abort: vi.fn(),
    }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function selectContents() {
  const selects = screen.getAllByLabelText("Content");
  fireEvent.change(selects[0], {
    target: { value: "bbbbbbbbbbbbbbbbbbbbbbbb" },
  });
  fireEvent.change(selects[1], {
    target: { value: "cccccccccccccccccccccccc" },
  });
  await act(() => vi.advanceTimersByTimeAsync(500));
}
function status(
  renderId: string,
  state: string,
  origin = "https://integrations.paperlesspaper.de"
) {
  const frame = screen.getByTitle("Layout preview") as HTMLIFrameElement;
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        origin,
        data: { type: "PAPERLESS_LAYOUT_STATUS", renderId, status: state },
      })
    )
  );
}
describe("Layout editor", () => {
  it("can request a processed server preview when a legacy integration cannot preview live", async () => {
    render(<LayoutEditor />);
    await selectContents();
    status("current-render", "error");
    resolveLayout.mockImplementationOnce(() => ({
      unwrap: () => Promise.resolve({ image: "data:image/png;base64,fixture" }),
      abort: vi.fn(),
    }));
    fireEvent.click(screen.getByText("Render display preview"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolveLayout).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "render", orientation: "portrait" })
    );
    expect(
      document
        .querySelector('img[alt="Processed layout preview"]')
        ?.getAttribute("src")
    ).toContain("fixture");
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(false);
  });
  it("keeps send disabled until all contents are selected and the matching preview is ready", async () => {
    render(<LayoutEditor />);
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.queryByText(/Other layout/)).toBeNull();
    await selectContents();
    expect(resolveLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "aaaaaaaaaaaaaaaaaaaaaaaa",
        settings: expect.objectContaining({
          regions: expect.arrayContaining([
            expect.objectContaining({ paperId: "bbbbbbbbbbbbbbbbbbbbbbbb" }),
          ]),
        }),
      })
    );
    status("old-render", "ready");
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
    status("current-render", "ready", "https://untrusted.example");
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
    status("current-render", "ready");
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(false);
    fireEvent.click(screen.getByText("Add area"));
    expect(screen.getAllByLabelText("Content")).toHaveLength(3);
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it("shows custom HTML/CSS editors and keeps failed previews from being sent", async () => {
    render(<LayoutEditor />);
    fireEvent.change(screen.getByLabelText("Layout"), {
      target: { value: "custom" },
    });
    expect(
      (screen.getByLabelText("HTML") as HTMLTextAreaElement).value
    ).toContain('paperless-slot name="left"');
    expect(
      (screen.getByLabelText("CSS") as HTMLTextAreaElement).value
    ).toContain("orientation: portrait");
    await selectContents();
    status("current-render", "error");
    expect(screen.getByRole("alert").textContent).toBe(
      "Layout contents could not be loaded."
    );
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
