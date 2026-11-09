// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: {
    organization: "org",
    page: "calendar",
    entry: "new",
    kind: "device",
  },
  device: null as any,
  create: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  exportImage: vi.fn(),
  prepareImage: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  queryDevice: vi.fn(),
  ready: true,
  activeEditors: 0,
  maxEditors: 0,
  editorState: null as any,
  editorProps: [] as any[],
  sharePayload: null as any,
  sharedImage: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => mocks.params,
  useHistory: () => ({ push: mocks.push, replace: mocks.replace }),
  useLocation: () => ({ search: "?frameKind=openpaper13&shareTargetId=keep" }),
}));
vi.mock("helpers/useUsers", () => ({
  useActiveUserDevice: () => ({ data: mocks.device }),
}));
vi.mock("ducks/devices", () => ({
  devicesApi: {
    useGetAllDevicesQuery: () => ({
      data: [{ id: "frame-1", name: "Living room", kind: "openpaper13" }],
    }),
    useGetSingleDevicesQuery: (...args: any[]) => mocks.queryDevice(...args),
  },
}));
vi.mock("ducks/ePaper/papersApi", () => ({
  papersApi: {
    useCreateSinglePapersMutation: () => [mocks.create],
    useUploadSingleImageMutation: () => [mocks.upload],
    useUpdateSinglePapersMutation: () => [mocks.update],
  },
}));
vi.mock("helpers/useQs", () => ({ default: () => ({}) }));
vi.mock("helpers/shareTarget", () => ({
  getShareTargetPayload: () => mocks.sharePayload,
  getShareTargetImageDataUrl: (...args: any[]) => mocks.sharedImage(...args),
}));
vi.mock("components/OverlayLoading", () => ({
  default: ({ description }: any) => <div>{description}</div>,
}));
vi.mock("react-i18next", () => ({
  Trans: ({ children }: any) => children,
  useTranslation: () => ({ t: (s: string) => s }),
}));
vi.mock("@progressiveui/react", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Modal: ({
    children,
    onRequestSubmit,
    primaryButtonText,
    primaryButtonDisabled,
  }: any) => (
    <div>
      {children}
      <button onClick={onRequestSubmit} disabled={primaryButtonDisabled}>
        {primaryButtonText}
      </button>
    </div>
  ),
  Story: ({ children }: any) => <div>{children}</div>,
  Callout: ({ children }: any) => <div role="alert">{children}</div>,
  Select: ({ id, labelText, children, ...props }: any) => (
    <label>
      {labelText}
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  ),
  SelectItem: ({ text, value }: any) => <option value={value}>{text}</option>,
}));
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/imageDataUrl",
  () => ({
    prepareImageFileForEditor: (...args: any[]) => mocks.prepareImage(...args),
    resizeImageDataUrl: async (_: number, image: string) => image,
  })
);
vi.mock(
  "../../src/components/Epaper/Integrations/ImageEditor/ImageEditor",
  () => ({
    default: React.forwardRef((props: any, ref) => {
      mocks.editorProps.push(props);
      React.useEffect(() => {
        mocks.activeEditors++;
        mocks.maxEditors = Math.max(mocks.maxEditors, mocks.activeEditors);
        return () => {
          mocks.activeEditors--;
        };
      }, []);
      React.useEffect(() => {
        if (mocks.ready) props.onSourceReady?.();
      }, [props.onSourceReady]);
      React.useImperativeHandle(ref, () => ({
        getEditorState: () => mocks.editorState,
        exportImageData: () => mocks.exportImage(props.image),
      }));
      return props.open ? (
        <button onClick={props.onRequestCloseOverride}>Close editor</button>
      ) : null;
    }),
  })
);
import MultiImageUploadEditor from "../../src/components/Epaper/Integrations/MultiImageUploadEditor/MultiImageUploadEditor";
import { useActiveDevice } from "../../src/helpers/devices/useDevices";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = (node: React.ReactNode) => act(() => root.render(node));
const upload = () =>
  act(async () => {
    const button = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Upload images"
    )!;
    button.click();
  });
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
  vi.clearAllMocks();
  mocks.ready = true;
  mocks.activeEditors = 0;
  mocks.maxEditors = 0;
  mocks.editorProps = [];
  mocks.editorState = null;
  mocks.sharePayload = null;
  mocks.params.entry = "new";
  mocks.device = null;
  mocks.prepareImage
    .mockReset()
    .mockImplementation(
      async (file: File) => `data:image/png;base64,${file.name}`
    );
  mocks.exportImage.mockReset().mockResolvedValue({
    dataDirect: new Blob(["device"]),
    dataOriginal: new Blob(["original"]),
    dataEditable: "{}",
    meta: { orientation: "landscape", dithering: "custom" },
  });
  mocks.create.mockImplementation(() => ({
    unwrap: async () => ({ id: `paper-${mocks.create.mock.calls.length}` }),
  }));
  mocks.upload.mockImplementation(() => ({ unwrap: async () => ({}) }));
  mocks.update.mockImplementation(() => ({ unwrap: async () => ({}) }));
});
afterEach(() => act(() => root.unmount()));

it("lets the library user select a frame and preserves the share query", () => {
  render(<MultiImageUploadEditor />);
  act(() => {
    const select = container.querySelector("select")!;
    select.value = "frame-1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(mocks.replace).toHaveBeenCalledWith({
    pathname: "/org/calendar/device/frame-1/new/image-multi-upload",
    search: "?frameKind=openpaper13&shareTargetId=keep",
  });
});
it("does not fetch the route placeholder as a device", () => {
  const Probe = () => {
    useActiveDevice();
    return null;
  };
  render(<Probe />);
  expect(mocks.queryDevice).toHaveBeenLastCalledWith("new", { skip: true });
  mocks.params.entry = "frame-1";
  render(<Probe />);
  expect(mocks.queryDevice).toHaveBeenLastCalledWith("frame-1", {
    skip: false,
  });
});
async function selectFiles(
  names: (string | File)[],
  expectedCount = names.length
) {
  mocks.device = { id: "frame-1", kind: "openpaper13" };
  render(<MultiImageUploadEditor />);
  await act(async () => {
    const input = container.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: names.map((name) =>
        typeof name === "string"
          ? new File(["image"], name, { type: "image/png" })
          : name
      ),
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelectorAll("img")).toHaveLength(expectedCount);
}
it("stores the exported orientation and editor settings", async () => {
  await selectFiles(["one.png"]);
  await upload();
  expect(mocks.push).toHaveBeenCalled();
  expect(mocks.create.mock.calls[0][0].values.meta).toMatchObject({
    orientation: "landscape",
    dithering: "custom",
    frameKind: "openpaper13",
  });
  expect(mocks.upload.mock.calls[0][0].body.getAll("picture")).toHaveLength(2);
});
it("keeps failed images and retries without duplicating completed or created papers", async () => {
  let attempts = 0;
  mocks.upload.mockImplementation(() => ({
    unwrap: async () => {
      if (++attempts === 2) throw new Error("offline");
      return {};
    },
  }));
  await selectFiles(["one.png", "two.png", "three.png"]);
  await upload();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(container.querySelectorAll("img")).toHaveLength(1);
  await upload();
  expect(mocks.push).toHaveBeenCalled();
  expect(mocks.create).toHaveBeenCalledTimes(3);
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.upload).toHaveBeenCalledTimes(4);
  expect(mocks.upload.mock.calls[3][0].id).toBe(
    mocks.upload.mock.calls[1][0].id
  );
});
it("does not create an empty paper when the editor cannot export", async () => {
  mocks.exportImage.mockResolvedValue(null);
  await selectFiles(["one.png"]);
  await upload();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("retains existing and readable images when one selected file cannot decode", async () => {
  await selectFiles(["existing.png"]);
  mocks.prepareImage.mockImplementation(async (file: File) => {
    if (file.name === "broken.heic")
      throw new Error("Image could not be loaded.");
    return `data:image/png;base64,${file.name}`;
  });
  await selectFiles(["one.png", "broken.heic", "three.png"], 3);
  expect(
    Array.from(container.querySelectorAll("img"), (img) => img.alt)
  ).toEqual(["existing.png", "one.png", "three.png"]);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "broken.heic"
  );
  await upload();
  expect(mocks.upload).toHaveBeenCalledTimes(3);
});

it("resets the file input after a failure and permits selecting the same file again", async () => {
  mocks.device = { id: "frame-1", kind: "openpaper13" };
  render(<MultiImageUploadEditor />);
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const resetInput = vi.spyOn(input, "value", "set");
  mocks.prepareImage.mockRejectedValueOnce(new Error("read failed"));
  await selectFiles(["retry.png"], 0);
  expect(resetInput).toHaveBeenCalledWith("");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "retry.png"
  );
  await selectFiles(["retry.png"]);
  expect(mocks.prepareImage).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  resetInput.mockRestore();
});

it("reports non-images while accepting image extensions with missing MIME types", async () => {
  await selectFiles(
    [
      new File(["image"], "photo.JPG"),
      new File(["text"], "notes.txt", { type: "text/plain" }),
      "good.png",
    ],
    2
  );
  expect(mocks.prepareImage).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "notes.txt"
  );
});

it("prepares files sequentially and disables uploads and picking while preparing", async () => {
  let finishFirst!: (value: string) => void;
  mocks.prepareImage.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finishFirst = resolve;
      })
  );
  await selectFiles(["one.png", "two.png"], 0);
  expect(mocks.prepareImage).toHaveBeenCalledTimes(1);
  expect(
    container.querySelector<HTMLInputElement>('input[type="file"]')!.disabled
  ).toBe(true);
  const uploadButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Upload images"
  )!;
  expect(uploadButton.disabled).toBe(true);
  await act(async () => finishFirst("data:image/png;base64,one"));
  expect(mocks.prepareImage).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll("img")).toHaveLength(2);
  expect(uploadButton.disabled).toBe(false);
});

it("continues after an export failure and removes its error when the image is removed", async () => {
  mocks.exportImage.mockImplementation(async (image: string) => {
    if (image.endsWith("broken.png")) throw new Error("export failed");
    return {
      dataDirect: new Blob(["device"]),
      dataOriginal: new Blob(["original"]),
      dataEditable: "{}",
      meta: {},
    };
  });
  await selectFiles(["one.png", "broken.png", "three.png"]);
  await upload();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "broken.png"
  );
  expect(mocks.push).not.toHaveBeenCalled();
  act(() =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Remove")!
      .click()
  );
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("continues after paper creation fails and retries only the failed image", async () => {
  mocks.create.mockImplementationOnce(() => ({
    unwrap: async () => {
      throw new Error("create failed");
    },
  }));
  await selectFiles(["one.png", "two.png"]);
  await upload();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll("img")).toHaveLength(1);
  await upload();
  expect(mocks.create).toHaveBeenCalledTimes(3);
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalled();
});

const click = (label: string) =>
  act(() => {
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === label)!
      .click();
  });

it.each([12, 13, 30])(
  "uploads %i photos in selection order with at most one mounted editor",
  async (count) => {
    const names = Array.from({ length: count }, (_, i) => `photo-${i + 1}.png`);
    await selectFiles(names);
    expect(mocks.activeEditors).toBe(0);
    await upload();
    expect(mocks.maxEditors).toBe(1);
    expect(mocks.activeEditors).toBe(0);
    expect(
      mocks.create.mock.calls.map(([request]) => request.values.name)
    ).toEqual(names);
    expect(mocks.upload).toHaveBeenCalledTimes(count);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  }
);

it("restores edits after closing, reopening and uploading without keeping a canvas mounted", async () => {
  await selectFiles(["one.png", "two.png"]);
  click("Edit");
  mocks.editorState = {
    dataEditable: '{"objects":[{"angle":90}]}',
    meta: { orientation: "landscape" },
  };
  click("Close editor");
  expect(mocks.activeEditors).toBe(0);
  click("Edit");
  expect(mocks.editorProps.at(-1).initialState).toEqual(mocks.editorState);
  click("Close editor");
  await upload();
  expect(
    mocks.editorProps.filter((props) => props.inline)[0].initialState
  ).toEqual(mocks.editorState);
  expect(mocks.maxEditors).toBe(1);
});

it("waits for the editor image before exporting and reports preparation/upload progress", async () => {
  mocks.ready = false;
  await selectFiles(["one.png", "two.png"]);
  await upload();
  expect(mocks.exportImage).not.toHaveBeenCalled();
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "1/2: one.png"
  );
  mocks.ready = true;
  await act(async () => mocks.editorProps.at(-1).onSourceReady());
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it("keeps successful results in their original positions after a failed upload and retry", async () => {
  mocks.upload.mockImplementationOnce(() => ({
    unwrap: async () => {
      throw new Error("offline");
    },
  }));
  await selectFiles(["one.png", "two.png", "three.png"]);
  await upload();
  const results = () =>
    Array.from(container.querySelectorAll("p"), (p) => p.textContent).filter(
      (text) => /^\d+\./.test(text!)
    );
  expect(results()).toEqual([
    "1. one.png — Upload failed",
    "2. two.png — Uploaded",
    "3. three.png — Uploaded",
  ]);
  await upload();
  expect(results()).toEqual([
    "1. one.png — Uploaded",
    "2. two.png — Uploaded",
    "3. three.png — Uploaded",
  ]);
  expect(mocks.create).toHaveBeenCalledTimes(3);
  expect(mocks.upload).toHaveBeenCalledTimes(4);
});

it("continues after an editor load failure and retries the failed file", async () => {
  mocks.ready = false;
  await selectFiles(["broken.png", "good.png"]);
  await upload();
  mocks.ready = true;
  await act(async () =>
    mocks.editorProps.at(-1).onSourceReady(new Error("decode failed"))
  );
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(mocks.create.mock.calls[0][0].values.name).toBe("good.png");
  expect(mocks.activeEditors).toBe(0);
  await upload();
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it("does not hide unreadable files by navigating away after the valid files upload", async () => {
  mocks.prepareImage.mockRejectedValueOnce(new Error("decode failed"));
  await selectFiles(["broken.png", "good.png"], 1);
  await upload();
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "broken.png"
  );
});

it("prepares shared photos sequentially and retains valid files after a shared file fails", async () => {
  mocks.device = { id: "frame-1", kind: "openpaper13" };
  mocks.sharePayload = {
    images: [
      { name: "one.png" },
      { name: "broken.png" },
      { name: "three.png" },
    ],
  };
  let active = 0;
  let peak = 0;
  mocks.sharedImage.mockImplementation(async (image) => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    if (image.name === "broken.png") throw new Error("read failed");
    return `data:image/png;base64,${image.name}`;
  });
  await act(async () => root.render(<MultiImageUploadEditor />));
  expect(peak).toBe(1);
  expect(
    Array.from(container.querySelectorAll("img"), (img) => img.alt)
  ).toEqual(["one.png", "three.png"]);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "broken.png"
  );
  await upload();
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it("times out a stalled editor, continues with later images and permits retry", async () => {
  vi.useFakeTimers();
  try {
    mocks.ready = false;
    await selectFiles(["stalled.png", "good.png"]);
    await upload();
    mocks.ready = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].values.name).toBe("good.png");
    expect(mocks.push).not.toHaveBeenCalled();
    await upload();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.activeEditors).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("ignores a second upload click while the current batch is waiting for an editor", async () => {
  mocks.ready = false;
  await selectFiles(["one.png"]);
  await upload();
  await upload();
  mocks.ready = true;
  await act(async () => mocks.editorProps.at(-1).onSourceReady());
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
});
