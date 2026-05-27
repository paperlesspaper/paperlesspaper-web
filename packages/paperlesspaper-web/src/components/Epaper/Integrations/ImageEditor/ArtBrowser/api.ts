import type {
  Artwork,
  ArtworkRatingFilter,
  ArtworkSearchResponse,
  ArtworkSource,
} from "./types";

const ART_API_BASE_URL = "https://art.paperlesspaper.de";
const ART_OBJECT_STORAGE_BASE_URL =
  "https://fsn1.your-objectstorage.com/paperlesspaper-art";

export type SearchArtworkParams = {
  q?: string;
  source?: ArtworkSource | "";
  highlighted?: boolean;
  rating?: ArtworkRatingFilter;
  limit?: number;
  offset?: number;
};

function toArtDomainUrl(url?: string) {
  if (!url) return url;

  if (url.startsWith(ART_API_BASE_URL)) {
    return withArtAssetCacheBuster(url);
  }

  if (url.startsWith(ART_OBJECT_STORAGE_BASE_URL)) {
    return withArtAssetCacheBuster(
      `${ART_API_BASE_URL}${url.slice(ART_OBJECT_STORAGE_BASE_URL.length)}`,
    );
  }

  return url;
}

function withArtAssetCacheBuster(url: string) {
  if (!url.startsWith(`${ART_API_BASE_URL}/images/`)) return url;

  const nextUrl = new URL(url);
  nextUrl.searchParams.set("cors", "1");
  return nextUrl.toString();
}

function normalizeArtworkImageUrls(artwork: Artwork): Artwork {
  return {
    ...artwork,
    image: {
      ...artwork.image,
      url: toArtDomainUrl(artwork.image.url) || artwork.image.url,
      localOriginalPath: toArtDomainUrl(artwork.image.localOriginalPath),
      localResizedPaths: artwork.image.localResizedPaths
        ? Object.fromEntries(
            Object.entries(artwork.image.localResizedPaths).map(
              ([key, value]) => [key, toArtDomainUrl(value) || value],
            ),
          )
        : artwork.image.localResizedPaths,
      resizedUrls: artwork.image.resizedUrls
        ? Object.fromEntries(
            Object.entries(artwork.image.resizedUrls).map(([key, value]) => [
              key,
              toArtDomainUrl(value) || value,
            ]),
          )
        : artwork.image.resizedUrls,
    },
  };
}

export async function searchArtworks({
  q,
  source,
  highlighted,
  rating,
  limit = 24,
  offset = 0,
}: SearchArtworkParams): Promise<ArtworkSearchResponse> {
  const url = new URL("/api/artworks", ART_API_BASE_URL);

  if (q) url.searchParams.set("q", q);
  if (source) url.searchParams.set("source", source);
  if (typeof highlighted === "boolean") {
    url.searchParams.set("highlighted", String(highlighted));
  }
  if (rating) url.searchParams.set("rating", String(rating));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Artwork search failed: ${response.status}`);
  }

  const data = (await response.json()) as ArtworkSearchResponse;

  return {
    items: Array.isArray(data.items)
      ? data.items.map(normalizeArtworkImageUrls)
      : [],
    total: Number(data.total || 0),
    limit: Number(data.limit || limit),
    offset: Number(data.offset || offset),
  };
}

export function getArtworkCreator(artwork: Artwork) {
  return artwork.artist || artwork.author?.name || artwork.collection?.name;
}
