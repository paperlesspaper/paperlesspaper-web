export type ArtworkSource = "met" | "artic" | "wikimedia" | "svgrepo";

export type ArtworkRating = 1 | 2 | 3 | 4 | 5;
export type ArtworkRatingFilter = ArtworkRating | "rated" | "unrated";

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
  selected?: boolean;
  highlighted?: boolean;
  rating?: ArtworkRating;
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
    width?: number;
    height?: number;
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
