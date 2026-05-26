export type ArtworkSource = "met" | "artic" | "wikimedia" | "svgrepo";

export type Artwork = {
  id: string;
  source: ArtworkSource;
  sourceId: string;
  title: string;
  artist?: string;
  date?: string;
  isPublicDomain: boolean;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  collection?: {
    name: string;
    url: string;
  };
  author?: {
    name: string;
    url: string;
  };
  tags?: string[];
  image: {
    originalUrl?: string;
    url: string;
    localOriginalPath?: string;
    localResizedPaths?: Record<string, string>;
    resizedUrls?: Record<string, string>;
  };
};

export type ArtworkSearchResponse = {
  items: Artwork[];
  total: number;
  limit: number;
  offset: number;
};
