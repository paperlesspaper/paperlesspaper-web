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
    .filter((label) => label.textContent === text)
    .map(
      (label) =>
        document.getElementById(label.htmlFor) ||
        label.querySelector("input,select,textarea")
    ) as HTMLElement[];
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
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
        element,
        event.target.value
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
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
vi.mock(
  "../../src/components/Epaper/Integrations/components/PaperSelectionGrid",
  () => ({
    default: ({ papers, selectedPaperIds, onTogglePaper, inputName }: any) => (
      <div>
        {papers.map((paper: any) => (
          <label key={paper.id}>
            <input
              type="radio"
              name={inputName}
              aria-label={paper.name}
              checked={Boolean(selectedPaperIds[paper.id])}
              onChange={() => onTogglePaper(paper.id)}
            />
            <img alt={paper.name} src={`/${paper.id}.png`} />
          </label>
        ))}
      </div>
    ),
  })
);
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
  resolveLayout.mockReset().mockImplementation(() => ({
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
  fireEvent.click(
    document.querySelector('input[aria-label="Mountain photo"]')!
  );
  fireEvent.click(screen.getByText("Select content"));
  fireEvent.click(
    document.querySelector(
      'input[name="layout-paper-1"][aria-label="Family calendar"]'
    )!
  );
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
    expect(
      document.querySelector('input[aria-label="Other layout"]')
    ).toBeNull();
    expect(document.querySelector('img[alt="Mountain photo"]')).not.toBeNull();
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
    expect(document.querySelectorAll("fieldset")).toHaveLength(3);
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
  it.each(["-1", "65", "1.5", ""])(
    "blocks invalid spacing %j before requesting a preview",
    async (value) => {
      render(<LayoutEditor />);
      await selectContents();
      status("current-render", "ready");
      resolveLayout.mockClear();
      fireEvent.change(screen.getByLabelText("Spacing (px)"), {
        target: { value },
      });
      await act(() => vi.advanceTimersByTimeAsync(500));
      expect(resolveLayout).not.toHaveBeenCalled();
      expect(
        (screen.getByText("Render display preview") as HTMLButtonElement)
          .disabled
      ).toBe(true);
      expect(
        (screen.getByText("Send layout") as HTMLButtonElement).disabled
      ).toBe(true);
      expect(document.body.textContent).toContain(
        "Enter a whole number from 0 to 64 for spacing."
      );
      fireEvent.change(screen.getByLabelText("Spacing (px)"), {
        target: { value: "64" },
      });
      await act(() => vi.advanceTimersByTimeAsync(500));
      expect(resolveLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ gap: 64 }),
        })
      );
    }
  );
  it("validates duplicate and malformed slot names at the field and recovers", async () => {
    render(<LayoutEditor />);
    await selectContents();
    fireEvent.change(screen.getByLabelText("Layout"), {
      target: { value: "custom" },
    });
    resolveLayout.mockClear();
    fireEvent.change(screen.getAllByLabelText("Slot name")[1], {
      target: { value: "left" },
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(resolveLayout).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Each area needs a unique slot name."
    );
    fireEvent.change(screen.getAllByLabelText("Slot name")[1], {
      target: { value: "1invalid" },
    });
    expect(document.body.textContent).toContain("Use a lowercase letter first");
    fireEvent.change(screen.getAllByLabelText("Slot name")[1], {
      target: { value: "right" },
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(resolveLayout).toHaveBeenCalledTimes(1);
  });
  it("uses the Progressive UI stepper without dropping its value", () => {
    render(<LayoutEditor />);
    const increment = document
      .querySelector("#layout-gap")!
      .parentElement!.querySelector("button.up-icon");
    fireEvent.click(increment!);
    expect(
      (screen.getByLabelText("Spacing (px)") as HTMLInputElement).value
    ).toBe("9");
  });
  it("discards a late display preview after the orientation changes", async () => {
    render(<LayoutEditor />);
    await selectContents();
    status("current-render", "ready");
    let finish!: (value: unknown) => void;
    const abort = vi.fn();
    resolveLayout.mockImplementationOnce(() => ({
      unwrap: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      abort,
    }));
    fireEvent.click(screen.getByText("Render display preview"));
    fireEvent.change(screen.getByLabelText("Orientation"), {
      target: { value: "landscape" },
    });
    expect(abort).toHaveBeenCalled();
    await act(async () => {
      finish({ image: "data:image/png;base64,stale" });
    });
    expect(
      document.querySelector('img[alt="Processed layout preview"]')
    ).toBeNull();
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(500));
    status("current-render", "ready");
    expect(
      (screen.getByText("Send layout") as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
