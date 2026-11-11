import { useCallback, useEffect, useRef, useState } from "react";
import { isTemporaryActivationError } from "./activationErrors";

export const ACTIVATION_WINDOW_SECONDS = 300;
const WINDOW_MS = ACTIVATION_WINDOW_SECONDS * 1000;
const POLL_MS = 4_000;
const REQUEST_MS = 20_000;
const timeoutError = () => ({ status: "TIMEOUT_ERROR" });
const waiting = (data: any) =>
  ["pending", "device_confirmed"].includes(data?.activation_status);

// Bound the entire mutation, including token acquisition. Aborting an RTK
// request alone is not enough if its underlying promise never settles.
function send(register: any, values: any, signal: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject({ name: "AbortError" });
    const operation = register(values);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject({ name: "AbortError" });
      operation.abort?.();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(timeoutError());
      operation.abort?.();
    }, REQUEST_MS);
    signal.addEventListener("abort", abort, { once: true });
    try {
      Promise.resolve(operation.unwrap()).then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error) => {
          cleanup();
          reject(error);
        }
      );
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function useDeviceActivation(register: any, organization?: string) {
  const [response, setResponse] = useState<any>();
  const [error, setError] = useState<any>();
  const [time, setTime] = useState(ACTIVATION_WINDOW_SECONDS);
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deadline = useRef<number | undefined>(undefined);
  const request = useRef<any>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const registerRef = useRef(register);
  registerRef.current = register;

  const stop = useCallback(() => {
    run.current += 1;
    clearTimeout(timer.current);
    clearTimeout(expiry.current);
    deadline.current = undefined;
    request.current = undefined;
    controller.current?.abort();
    controller.current = undefined;
  }, []);

  const cancel = useCallback(() => {
    stop();
    setResponse(undefined);
    setError(undefined);
    setTime(ACTIVATION_WINDOW_SECONDS);
  }, [stop]);

  useEffect(() => {
    cancel();
    return stop;
  }, [organization, cancel, stop]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (deadline.current) {
        setTime(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const fail = (failure: any) => {
    stop();
    setError(failure);
    setResponse({ data: { activation_status: "error" } });
  };

  const armDeadline = () => {
    clearTimeout(expiry.current);
    deadline.current = Date.now() + WINDOW_MS;
    setTime(ACTIVATION_WINDOW_SECONDS);
    expiry.current = setTimeout(() => {
      // A local deadline cannot tell us whether the cloud completed the claim.
      fail(timeoutError());
      setTime(0);
    }, WINDOW_MS);
  };

  const accept = (data: any) => {
    if (
      ![
        "pending",
        "device_confirmed",
        "success",
        "error",
        "reset",
        "timeout",
      ].includes(data?.activation_status)
    ) {
      fail({ status: "CUSTOM_ERROR" });
      return { activation_status: "error" };
    }
    if (
      request.current?.id.startsWith("epd") &&
      data.activation_status === "success" &&
      (!data.registrationCompleted || !data.createdDevice?.id)
    ) {
      data = {
        activation_status: "error",
        message: "Device ownership could not be confirmed",
      };
    }
    setResponse({ data });
    setError(undefined);
    if (!waiting(data)) stop();
    return data;
  };

  const schedule = (attempt: number) => {
    clearTimeout(timer.current);
    if (!request.current || !controller.current || attempt !== run.current)
      return;
    timer.current = setTimeout(async () => {
      if (attempt !== run.current || !request.current) return;
      try {
        const data = await send(
          registerRef.current,
          {
            ...request.current,
            body: { ...request.current.body, enable: false },
          },
          controller.current!.signal
        );
        if (attempt !== run.current) return;
        if (waiting(accept(data))) schedule(attempt);
      } catch (failure) {
        if (attempt !== run.current) return;
        if (isTemporaryActivationError(failure)) schedule(attempt);
        else fail(failure);
      }
    }, POLL_MS);
  };

  const start = async (values: any, deferPolling = false) => {
    cancel();
    const attempt = run.current;
    request.current = values;
    const active = new AbortController();
    controller.current = active;
    armDeadline();
    try {
      let data;
      try {
        data = await send(
          registerRef.current,
          {
            ...values,
            body: { ...values.body, enable: true },
          },
          active.signal
        );
      } catch (failure) {
        if (attempt !== run.current || !isTemporaryActivationError(failure))
          throw failure;
        // A lost acknowledgement may still have started activation. Recover by
        // reading its status; never automatically restart the activation window.
        data = await send(
          registerRef.current,
          {
            ...values,
            body: { ...values.body, enable: false },
          },
          active.signal
        );
      }
      if (attempt !== run.current) return null;
      const result = accept(data);
      if (waiting(result)) {
        armDeadline();
        if (!deferPolling) schedule(attempt);
      }
      return result;
    } catch (failure) {
      if (attempt === run.current) fail(failure);
      return null;
    }
  };

  return {
    response,
    error,
    time,
    start,
    cancel,
    resume: () => schedule(run.current),
  };
}
