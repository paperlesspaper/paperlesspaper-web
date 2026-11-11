// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDeviceActivation } from "../../src/helpers/devices/useDeviceActivation";

const values = {
  id: "epd7-test",
  body: { organization: "org-b", enable: true },
};
const pending = { activation_status: "pending" };
const success = {
  activation_status: "success",
  registrationCompleted: true,
  createdDevice: { id: "db-id" },
};
const api = (...responses: any[]) =>
  vi.fn(() => ({
    unwrap: () =>
      Promise.resolve(responses.length > 1 ? responses.shift() : responses[0]),
  }));
function renderHook(callback: (props?: any) => any, options?: any) {
  const element = document.createElement("div");
  const root = createRoot(element);
  const result = { current: undefined as any };
  function Harness({ props }: any) {
    result.current = callback(props);
    return null;
  }
  const rerender = (props: any) =>
    act(() => {
      root.render(<Harness props={props} />);
    });
  rerender(options?.initialProps);
  return { result, rerender, unmount: () => act(() => root.unmount()) };
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it("continues polling unchanged pending responses with the target organization", async () => {
  const register = api(pending, pending, pending, success);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
  expect(register).toHaveBeenCalledTimes(4);
  expect(
    register.mock.calls
      .slice(1)
      .every(
        ([request]: any) =>
          request.body.enable === false && request.body.organization === "org-b"
      )
  ).toBe(true);
  expect(hook.result.current.response.data).toEqual(success);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(304000);
  });
  expect(register).toHaveBeenCalledTimes(4);
  expect(hook.result.current.response.data).toEqual(success);
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not poll or restart activation between starting and writing WLAN credentials", async () => {
  const register = api(pending, success);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values, true);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(register).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.resume());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(register.mock.calls[1][0].body.enable).toBe(false);
  hook.unmount();
});

it("rejects raw success without server-verified registration", async () => {
  const hook = renderHook(() =>
    useDeviceActivation(api({ activation_status: "success" }), "org-b")
  );
  await act(async () => {
    await hook.result.current.start(values);
  });
  expect(hook.result.current.response.data.activation_status).toBe("error");
  hook.unmount();
});

it("ignores a late response after cancellation", async () => {
  let resolve: (value: any) => void;
  const register = vi.fn(() => ({
    unwrap: () =>
      new Promise((r) => {
        resolve = r;
      }),
  }));
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  let start: Promise<any>;
  act(() => {
    start = hook.result.current.start(values);
  });
  act(() => hook.result.current.cancel());
  await act(async () => {
    resolve!(success);
    await start!;
  });
  expect(hook.result.current.response).toBeUndefined();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(register).toHaveBeenCalledTimes(1);
  hook.unmount();
});

it("stops polling on organization change", async () => {
  const register = api(pending);
  const hook = renderHook(({ org }) => useDeviceActivation(register, org), {
    initialProps: { org: "org-b" },
  });
  await act(async () => {
    await hook.result.current.start(values);
  });
  hook.rerender({ org: "org-c" });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(register).toHaveBeenCalledTimes(1);
  expect(hook.result.current.response).toBeUndefined();
  hook.unmount();
});

it("bounds a stuck pending response by the five-minute window", async () => {
  const hook = renderHook(() => useDeviceActivation(api(pending), "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(304000);
  });
  expect(hook.result.current.time).toBe(0);
  expect(hook.result.current.response.data.activation_status).toBe("error");
  expect(hook.result.current.error.status).toBe("TIMEOUT_ERROR");
  hook.unmount();
});

it("retries a transient polling failure without starting another activation", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  register.mockImplementationOnce(() => ({
    unwrap: () => Promise.reject({ status: "FETCH_ERROR" }),
  }));
  register.mockImplementationOnce(() => ({
    unwrap: () => Promise.resolve(success),
  }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(hook.result.current.response.data).toEqual(success);
  expect(register.mock.calls[2][0].body.enable).toBe(false);
  hook.unmount();
});

it("leaves pending after five minutes even when an HTTP polling request never settles", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  try {
    await act(async () => {
      await hook.result.current.start(values);
    });
    register.mockImplementationOnce(() => ({
      unwrap: () => new Promise(() => {}),
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(304000);
    });
    expect(hook.result.current.time).toBe(0);
    expect(hook.result.current.response.data.activation_status).toBe("error");
    expect(hook.result.current.error).toMatchObject({ status: "TIMEOUT_ERROR" });
  } finally {
    hook.unmount();
  }
});

it("ignores a successful polling response that arrives after the deadline", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  let resolve: (value: unknown) => void;
  try {
    await act(async () => {
      await hook.result.current.start(values);
    });
    register.mockImplementationOnce(() => ({
      unwrap: () =>
        new Promise((done) => {
          resolve = done;
        }),
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(304000);
    });
    expect(hook.result.current.response.data.activation_status).toBe("error");
    expect(hook.result.current.error).toMatchObject({ status: "TIMEOUT_ERROR" });
    await act(async () => {
      resolve!(success);
    });
    expect(hook.result.current.response.data.activation_status).toBe("error");
    expect(hook.result.current.error).toMatchObject({ status: "TIMEOUT_ERROR" });
    expect(register.mock.calls.filter(([value]) => value.body.enable)).toHaveLength(1);
  } finally {
    hook.unmount();
  }
});

it("recovers a lost start acknowledgement using a status poll before allowing WLAN writes", async () => {
  const register = api(pending);
  register.mockImplementationOnce(() => ({
    unwrap: () => Promise.reject({ status: 502 }),
  }));
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    expect(await hook.result.current.start(values, true)).toEqual(pending);
  });
  expect(
    register.mock.calls.map(([request]: any) => request.body.enable)
  ).toEqual([true, false]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(register).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it("stops immediately on a forbidden poll instead of retrying for five minutes", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  register.mockImplementationOnce(() => ({
    unwrap: () => Promise.reject({ status: 403 }),
  }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
  expect(hook.result.current.error.status).toBe(403);
  expect(register).toHaveBeenCalledTimes(2);
  hook.unmount();
});

it("aborts a hanging poll after 20 seconds and can recover on the next poll", async () => {
  const register = api(pending, success);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  const abort = vi.fn();
  let resolve: (value: any) => void;
  register.mockImplementationOnce(() => ({
    abort,
    unwrap: () =>
      new Promise((r) => {
        resolve = r;
      }),
  }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(28000);
  });
  expect(abort).toHaveBeenCalledOnce();
  expect(hook.result.current.response.data).toEqual(success);
  await act(async () => {
    resolve!(pending);
  });
  expect(hook.result.current.response.data).toEqual(success);
  hook.unmount();
});

it.each(["cancel", "organization", "unmount"])(
  "aborts a hanging start on %s and settles the caller",
  async (action) => {
    const abort = vi.fn();
    const register = vi.fn(() => ({
      abort,
      unwrap: () => new Promise(() => {}),
    }));
    const hook = renderHook(({ org }) => useDeviceActivation(register, org), {
      initialProps: { org: "org-b" },
    });
    let start: Promise<any>;
    act(() => {
      start = hook.result.current.start(values, true);
    });
    if (action === "cancel") act(() => hook.result.current.cancel());
    else if (action === "organization") hook.rerender({ org: "org-c" });
    else hook.unmount();
    await act(async () => {
      expect(await start!).toBeNull();
    });
    expect(abort).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledTimes(1);
    if (action !== "unmount") hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  }
);

it("expires deferred WLAN setup and will not restart polling after its deadline", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values, true);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(hook.result.current.error.status).toBe("TIMEOUT_ERROR");
  act(() => hook.result.current.resume());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(register).toHaveBeenCalledTimes(1);
  hook.unmount();
});

it.each([undefined, "unclaimed", "unknown"])(
  "leaves the loading screen on an unsupported response state %s",
  async (activation_status) => {
    const hook = renderHook(() =>
      useDeviceActivation(api({ activation_status }), "org-b")
    );
    await act(async () => {
      await hook.result.current.start(values);
    });
    expect(hook.result.current.error.status).toBe("CUSTOM_ERROR");
    expect(hook.result.current.response.data.activation_status).toBe("error");
    hook.unmount();
  }
);

it("does not report completion on a late success after the overall deadline", async () => {
  const register = api(pending);
  const hook = renderHook(() => useDeviceActivation(register, "org-b"));
  await act(async () => {
    await hook.result.current.start(values);
  });
  let resolve: (value: any) => void;
  register.mockImplementation(() => ({
    unwrap: () =>
      new Promise((r) => {
        resolve = r;
      }),
  }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  await act(async () => {
    resolve!(success);
  });
  expect(hook.result.current.error.status).toBe("TIMEOUT_ERROR");
  expect(hook.result.current.response.data.activation_status).toBe("error");
  hook.unmount();
});
