import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function canShareImage(file: File): boolean {
  if (Capacitor.isNativePlatform()) return true;
  try {
    return Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

export function downloadImage(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Keep the URL alive long enough for mobile browsers to consume it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export async function shareImage(file: File) {
  if (!Capacitor.isNativePlatform()) {
    // The file is prepared before the click, preserving Web Share's user activation.
    await navigator.share({ files: [file] });
    return;
  }

  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const path = `image-export-${crypto.randomUUID()}/${file.name}`;
  const { uri } = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  // Android targets may still read the file after the sheet closes.
  // Retain it in the OS-managed cache for the receiving app.
  await Share.share({ files: [uri] });
}

export function isShareCancelled(error: unknown): boolean {
  const candidate = error as { name?: string; message?: string };
  return (
    candidate?.name === "AbortError" ||
    /cancel(?:led|ed)|canceled sharing/i.test(candidate?.message || "")
  );
}
