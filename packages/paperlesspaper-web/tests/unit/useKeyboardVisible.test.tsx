// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useKeyboardVisible from "../../src/helpers/useKeyboardVisible";

const mocks = vi.hoisted(() => ({
  native: true,
  registrations: [] as {
    event: string;
    callback: () => void;
    remove: ReturnType<typeof vi.fn>;
    resolve: () => void;
  }[],
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native },
}));
vi.mock("@capacitor/keyboard", () => ({
  Keyboard: {
    addListener: (event: string, callback: () => void) => {
      const remove = vi.fn();
      return new Promise((resolve) => {
        mocks.registrations.push({
          event, callback, remove, resolve: () => resolve({ remove }),
        });
      });
    },
  },
}));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.native = true;
  mocks.registrations = [];
});

function renderHook(hook: () => boolean, strict = false) {
  const root = createRoot(document.createElement("div"));
  const result = { current: false };
  function Probe() {
    result.current = hook();
    return null;
  }
  const rerender = () => act(() => root.render(
    strict ? <StrictMode><Probe /></StrictMode> : <Probe />,
  ));
  rerender();
  return { result, rerender, unmount: () => act(() => root.unmount()) };
}

const emit = (event: string) => act(() => {
  mocks.registrations.filter((r) => r.event === event).forEach((r) => r.callback());
});

describe("useKeyboardVisible", () => {
  it("reconciles completion events without accumulating listeners on renders", () => {
    const { result, rerender, unmount } = renderHook(useKeyboardVisible);
    emit("keyboardWillShow");
    expect(result.current).toBe(true);
    rerender();
    // A missing willHide event must not leave navigation hidden.
    emit("keyboardDidHide");
    expect(result.current).toBe(false);
    emit("keyboardDidShow");
    expect(result.current).toBe(true);
    emit("keyboardWillHide");
    expect(result.current).toBe(false);
    expect(mocks.registrations).toHaveLength(4);
    unmount();
  });

  it("removes late registrations and ignores callbacks from a StrictMode remount", async () => {
    const { result, unmount } = renderHook(useKeyboardVisible, true);
    expect(mocks.registrations).toHaveLength(8);
    act(() => mocks.registrations[0].callback());
    expect(result.current).toBe(false);
    act(() => mocks.registrations[4].callback());
    expect(result.current).toBe(true);
    unmount();
    await act(async () => mocks.registrations.forEach((r) => r.resolve()));
    mocks.registrations.forEach((r) => expect(r.remove).toHaveBeenCalledTimes(1));
  });

  it("does not subscribe in the browser", () => {
    mocks.native = false;
    const { result, unmount } = renderHook(useKeyboardVisible);
    expect(result.current).toBe(false);
    expect(mocks.registrations).toHaveLength(0);
    unmount();
  });
});
