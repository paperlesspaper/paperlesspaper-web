import QRCodeStyling from "qr-code-styling";

export type QrCodeMode = "url" | "wifi";

export type QrCodeWifiSecurity = "WPA" | "WEP" | "nopass";

export type QrCodeStylePreset = "classic" | "dots" | "rounded" | "inverted";

export interface QrCodeWifiConfig {
  ssid: string;
  password: string;
  security: QrCodeWifiSecurity;
  hidden?: boolean;
}

export interface QrCodeConfig {
  mode: QrCodeMode;
  url?: string;
  wifi?: QrCodeWifiConfig;
  stylePreset: QrCodeStylePreset;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export function buildWifiQrData(wifi: QrCodeWifiConfig): string {
  const ssid = (wifi.ssid || "").replace(/([\\;,:"\\])/g, "\\$1");
  const password = (wifi.password || "").replace(/([\\;,:"\\])/g, "\\$1");
  const security = wifi.security || "WPA";
  const hidden = wifi.hidden ? "true" : "false";

  // Standard WiFi QR format:
  // WIFI:T:WPA;S:MySSID;P:MyPassword;H:false;;
  return `WIFI:T:${security};S:${ssid};P:${password};H:${hidden};;`;
}

export function buildQrData(config: QrCodeConfig): string {
  if (config.mode === "wifi") {
    return buildWifiQrData(
      config.wifi || { ssid: "", password: "", security: "WPA" }
    );
  }

  return config.url || "";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function presetToOptions(stylePreset: QrCodeStylePreset) {
  switch (stylePreset) {
    case "dots":
      return {
        dotsOptions: { type: "dots" as const },
        cornersSquareOptions: { type: "extra-rounded" as const },
        cornersDotOptions: { type: "dot" as const },
      };
    case "rounded":
      return {
        dotsOptions: { type: "rounded" as const },
        cornersSquareOptions: { type: "extra-rounded" as const },
        cornersDotOptions: { type: "dot" as const },
      };
    case "inverted":
      return {
        dotsOptions: { type: "square" as const },
        cornersSquareOptions: { type: "square" as const },
        cornersDotOptions: { type: "square" as const },
        inverted: true,
      };
    case "classic":
    default:
      return {
        dotsOptions: { type: "square" as const },
        cornersSquareOptions: { type: "square" as const },
        cornersDotOptions: { type: "square" as const },
      };
  }
}

export async function generateQrPngDataUrl({
  config,
  sizePx,
}: {
  config: QrCodeConfig;
  sizePx: number;
}): Promise<string> {
  const data = buildQrData(config);
  const margin = config.margin ?? 8;
  const ecc = config.errorCorrectionLevel ?? "M";

  const preset = presetToOptions(config.stylePreset);
  const inverted = (preset as any).inverted;

  const foreground = inverted ? "#ffffff" : "#000000";
  const background = inverted ? "#000000" : "#ffffff";

  const qrCode = new QRCodeStyling({
    width: sizePx,
    height: sizePx,
    data,
    margin,
    qrOptions: { errorCorrectionLevel: ecc },
    dotsOptions: { color: foreground, ...(preset as any).dotsOptions },
    cornersSquareOptions: {
      color: foreground,
      ...(preset as any).cornersSquareOptions,
    },
    cornersDotOptions: {
      color: foreground,
      ...(preset as any).cornersDotOptions,
    },
    backgroundOptions: { color: background },
  } as any);

  const blob = (await qrCode.getRawData("png" as any)) as Blob;
  return blobToDataUrl(blob);
}

export function clampQrPixelSize(sizePx: number) {
  if (!Number.isFinite(sizePx)) return 512;
  return Math.max(128, Math.min(1536, Math.round(sizePx)));
}
