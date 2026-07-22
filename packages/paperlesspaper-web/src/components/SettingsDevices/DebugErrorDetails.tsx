import { Button, Modal } from "@progressiveui/react";
import { Capacitor } from "@capacitor/core";
import JsonViewer from "components/JsonViewer";
import React, { useState } from "react";
import styles from "./debugErrorDetails.module.scss";

type DebugErrorDetailsProps = {
  area: string;
  state: string;
  error?: unknown;
  context?: Record<string, unknown>;
  helpLink?: React.ReactNode;
};

const sensitiveKeyPattern =
  /password|passphrase|passcode|token|authorization|cookie|secret|api.?key|credential/i;

const sanitizeDebugValue = (
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 20000
      ? `${value.slice(0, 20000)}… [truncated]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (typeof value !== "object") return String(value);
  if (depth >= 8) return "[Maximum depth reached]";
  if (seen.has(value)) return "[Circular reference]";

  seen.add(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const errorDetails: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: sanitizeDebugValue(value.cause, seen, depth + 1),
    };

    Object.getOwnPropertyNames(value).forEach((key) => {
      if (key in errorDetails) return;
      errorDetails[key] = sensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : sanitizeDebugValue(
            (value as unknown as Record<string, unknown>)[key],
            seen,
            depth + 1,
          );
    });

    return errorDetails;
  }

  if (Array.isArray(value)) {
    const entries = value
      .slice(0, 100)
      .map((entry) => sanitizeDebugValue(entry, seen, depth + 1));

    if (value.length > 100) {
      entries.push(`[${value.length - 100} additional entries omitted]`);
    }

    return entries;
  }

  const output: Record<string, unknown> = {};

  Object.keys(value).forEach((key) => {
    if (sensitiveKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      return;
    }

    try {
      output[key] = sanitizeDebugValue(
        (value as Record<string, unknown>)[key],
        seen,
        depth + 1,
      );
    } catch (readError) {
      output[key] = `[Unable to read: ${String(readError)}]`;
    }
  });

  return output;
};

const createRuntimeDetails = () => {
  const networkInformation = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        type?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
      deviceMemory?: number;
    }
  ).connection;
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };

  return {
    app: {
      version: import.meta.env.REACT_APP_VERSION,
      mode: import.meta.env.MODE,
      development: import.meta.env.DEV,
      production: import.meta.env.PROD,
    },
    capacitor: {
      platform: Capacitor.getPlatform(),
      nativePlatform: Capacitor.isNativePlatform(),
    },
    page: {
      pathname: window.location.pathname,
      queryParameterNames: Array.from(
        new URLSearchParams(window.location.search).keys(),
      ),
      hasHash: window.location.hash.length > 0,
      documentVisibility: document.visibilityState,
    },
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: navigatorWithMemory.deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
    },
    network: networkInformation
      ? {
          effectiveType: networkInformation.effectiveType,
          type: networkInformation.type,
          downlinkMbps: networkInformation.downlink,
          roundTripTimeMs: networkInformation.rtt,
          saveData: networkInformation.saveData,
        }
      : { available: false },
    display: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      availableScreenWidth: window.screen.availWidth,
      availableScreenHeight: window.screen.availHeight,
      devicePixelRatio: window.devicePixelRatio,
      colorDepth: window.screen.colorDepth,
      orientation: window.screen.orientation?.type,
    },
    locale: {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      localTime: new Date().toString(),
    },
  };
};

export default function DebugErrorDetails({
  area,
  state,
  error,
  context,
  helpLink,
}: DebugErrorDetailsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState<Record<string, unknown>>({});

  const openDetails = () => {
    setSnapshot({
      generatedAt: new Date().toISOString(),
      area,
      state,
      error: sanitizeDebugValue(error),
      context: sanitizeDebugValue(context || {}),
      runtime: createRuntimeDetails(),
    });
    setCopied(false);
    setOpen(true);
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
    } catch (copyError) {
      console.log("Could not copy debug details", copyError);
      setCopied(false);
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      <div className={styles.actions}>
        {helpLink}
        <Button small kind="tertiary" onClick={openDetails}>
          Details anzeigen
        </Button>
      </div>
      <Modal
        open={open}
        inPortal
        lazyLoad
        width="wide"
        kindMobile="fullscreen"
        overscrollBehavior="inside"
        modalHeading="Fehlerdetails"
        className={styles.modal}
        primaryButtonText="Schließen"
        onRequestClose={close}
        onRequestSubmit={close}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalActions}>
            <Button small kind="tertiary" onClick={copyDetails}>
              {copied ? "Details kopiert" : "Details kopieren"}
            </Button>
          </div>
          <div className={styles.jsonViewer}>
            <JsonViewer collapsed={1} src={snapshot} />
          </div>
        </div>
      </Modal>
    </>
  );
}
