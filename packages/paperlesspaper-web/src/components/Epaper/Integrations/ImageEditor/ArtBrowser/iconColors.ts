import type { Artwork } from "./types";

/** Ignore transparent edge pixels; RGB values there are unstable after rasterization. */
export function getMonochromeColor(pixels: Uint8ClampedArray): string | null {
  let color: number[] | undefined;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (!color) color = rgb;
    else if (
      rgb.some((channel, index) => Math.abs(channel - color![index]) > 6)
    ) {
      return null;
    }
  }
  return color
    ? `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`
    : null;
}

const colorCache = new Map<string, Promise<string | null>>();

function inspectIcon(url: string): Promise<string | null> {
  const cached = colorCache.get(url);
  if (cached) return cached;
  const result = new Promise<string | null>((resolve) => {
    const image = new Image();
    const finish = (color: string | null) => {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(color);
    };
    const timeout = setTimeout(() => finish(null), 5000);
    image.crossOrigin = "anonymous";
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(
          1,
          256 / Math.max(image.naturalWidth, image.naturalHeight),
        );
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish(
          getMonochromeColor(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
          ),
        );
      } catch {
        // A failed or CORS-restricted image must remain usable without recoloring.
        finish(null);
      }
    };
    image.src = url;
  });
  if (colorCache.size >= 1000)
    colorCache.delete(colorCache.keys().next().value!);
  colorCache.set(url, result);
  return result;
}

export async function classifyIcons(artworks: Artwork[]): Promise<Artwork[]> {
  const result = [...artworks];
  let index = 0;
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout>;
  // Bound the whole page, not five seconds for each successive batch of icons.
  const budget = new Promise<null>((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, 5000);
  });
  try {
    await Promise.all(
      Array.from({ length: Math.min(8, result.length) }, async () => {
        while (index < result.length && !timedOut) {
          const current = index++;
          const artwork = result[current];
          if (artwork.source !== "svgrepo") continue;
          result[current] = {
            ...artwork,
            monochromeColor: await Promise.race([
              inspectIcon(artwork.image.url),
              budget,
            ]),
          };
        }
      }),
    );
  } finally {
    clearTimeout(timeout!);
  }
  return result;
}

export function compareIconColors(a: Artwork, b: Artwork) {
  return (
    Number(Boolean(a.source === "svgrepo" && a.monochromeColor)) -
    Number(Boolean(b.source === "svgrepo" && b.monochromeColor))
  );
}
