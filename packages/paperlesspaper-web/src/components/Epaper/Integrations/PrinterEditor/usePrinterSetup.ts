import React from "react";
import useEditor from "../ImageEditor/useEditor";
import { tokensApi } from "ducks/tokens";

export const PRINTER_HOST = "print.paperlesspaper.de";
export const PRINTER_IPPS_ADDRESS = `${PRINTER_HOST}:443`;

export type DesktopPlatform = "windows" | "macos" | "linux" | "unknown";

export const detectDesktopPlatform = (): DesktopPlatform => {
  if (typeof navigator === "undefined") return "unknown";

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = [
    navigatorWithUserAgentData.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent,
  ]
    .filter(Boolean)
    .join(" ");

  if (/android|iphone|ipad|ipod/i.test(platform)) return "unknown";
  if (/windows|win32|win64/i.test(platform)) return "windows";
  if (/macos|macintosh|macintel/i.test(platform)) return "macos";
  if (/linux|x11|ubuntu|fedora/i.test(platform)) return "linux";

  return "unknown";
};

export default function usePrinterSetup() {
  const store: any = useEditor();
  const paperId = store?.entryData?.id;
  const hasSavedPaper = Boolean(paperId) && store?.params?.paper !== "new";
  const [createToken, createTokenResult] =
    tokensApi.useCreateSingleTokensMutation({
      fixedCacheKey: `printer-setup-${paperId || "new"}`,
    });

  const generatedToken = createTokenResult.data?.raw;
  const hasGeneratedToken = Boolean(
    createTokenResult.isSuccess && generatedToken
  );
  const encodedToken = encodeURIComponent(generatedToken || "your_api_key");
  const printerPath = hasSavedPaper
    ? `ipp/print/${paperId}/${encodedToken}`
    : "ipp/print/<paper_id>/your_api_key";

  return {
    paperId,
    hasSavedPaper,
    hasGeneratedToken,
    generatedToken,
    createToken,
    createTokenResult,
    printerPath,
    macLinuxUrl: `ipps://${PRINTER_IPPS_ADDRESS}/${printerPath}`,
    windowsUrl: `https://${PRINTER_HOST}/${printerPath}`,
    windowsCommand: `Add-Printer -Name "paperlesspaper" -IppURL "https://${PRINTER_HOST}/${printerPath}"`,
    linuxCommand: `sudo lpadmin -p paperlesspaper -E -v 'ipps://${PRINTER_IPPS_ADDRESS}/${printerPath}' -m everywhere`,
    platform: React.useMemo(detectDesktopPlatform, []),
  };
}
