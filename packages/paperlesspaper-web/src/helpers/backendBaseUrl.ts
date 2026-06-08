export const paperlesspaperBackendStorageKey = "paperlesspaper.selectedBackend";

export const paperlesspaperBackendTargets = ["default", "dev", "prod"] as const;

export type PaperlesspaperBackendTarget =
  (typeof paperlesspaperBackendTargets)[number];

const paperlesspaperBackendBaseUrls: Record<
  PaperlesspaperBackendTarget,
  string
> = {
  default: "",
  dev: "https://api.dev.paperlesspaper.de/v1/",
  prod: "https://api.paperlesspaper.de/v1/",
};

const normalizeBaseUrl = (url: string) => (url.endsWith("/") ? url : `${url}/`);

export const getEnvironmentPaperlesspaperBackendBaseUrl = (): string =>
  normalizeBaseUrl(
    `${
      import.meta.env.REACT_APP_SERVER_BASE_URL ||
      paperlesspaperBackendBaseUrls.dev
    }`,
  );

const isPaperlesspaperBackendTarget = (
  value: unknown,
): value is PaperlesspaperBackendTarget =>
  paperlesspaperBackendTargets.includes(value as PaperlesspaperBackendTarget);

export const getSelectedPaperlesspaperBackend =
  (): PaperlesspaperBackendTarget => {
    if (typeof window === "undefined") {
      return "default";
    }

    const storedValue = window.localStorage.getItem(
      paperlesspaperBackendStorageKey,
    );
    if (isPaperlesspaperBackendTarget(storedValue)) {
      return storedValue;
    }

    return "default";
  };

export const setSelectedPaperlesspaperBackend = (
  target: PaperlesspaperBackendTarget,
) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(paperlesspaperBackendStorageKey, target);
};

export const getPaperlesspaperBackendBaseUrl = (): string =>
  getSelectedPaperlesspaperBackend() === "default"
    ? getEnvironmentPaperlesspaperBackendBaseUrl()
    : normalizeBaseUrl(
        paperlesspaperBackendBaseUrls[getSelectedPaperlesspaperBackend()],
      );

export const buildPaperlesspaperBackendUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${getPaperlesspaperBackendBaseUrl()}${normalizedPath}`;
};
