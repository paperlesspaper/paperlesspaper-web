import {
  faIcons,
  faPalette,
  type IconDefinition,
} from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, InlineLoading, Modal, Search } from "@progressiveui/react";
import classnames from "classnames";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../EditorButton";
import { useImageEditorContext } from "../ImageEditor";
import useEditor from "../useEditor";
import { getArtworkCreator, searchArtworks } from "./api";
import styles from "./artBrowser.module.scss";
import type { Artwork, ArtworkSource } from "./types";

const SEARCH_LIMIT = 120;
const ART_HIGHLIGHTED_LIMIT = 8;
const SYMBOL_HIGHLIGHTED_LIMIT = 10;
const RELATED_ARTWORK_LIMIT = 16;
const CANVAS_IMAGE_RESOLUTION_MULTIPLIER = 2;
const MASONRY_BREAKPOINTS = [
  { query: "(min-width: 1056px)", columns: 5 },
  { query: "(min-width: 672px)", columns: 4 },
  { query: "(min-width: 320px)", columns: 2 },
];

type BrowserOption = {
  id: "artBrowser" | "iconBrowser";
  value: ArtworkSource;
  label: string;
  icon: IconDefinition;
};

const browserOptions: BrowserOption[] = [
  { id: "artBrowser", value: "wikimedia", label: "Art", icon: faPalette },
  { id: "iconBrowser", value: "svgrepo", label: "Icons", icon: faIcons },
];

type FeaturedSearch = {
  label: string;
  description: string;
  query: string;
  source: ArtworkSource;
  collectionSlug?: string;
};

const featuredArtSearches = [
  {
    label: "Paul Cézanne",
    description:
      "A patient observer whose still lifes and Provençal landscapes helped open the door to modern painting.",
    query: "Paul Cézanne",
    source: "wikimedia",
  },
  {
    label: "Vincent van Gogh",
    description:
      "A restless colorist who turned fields, rooms, flowers, and night skies into charged emotional scenes.",
    query: "Vincent van Gogh",
    source: "wikimedia",
  },
  {
    label: "Claude Monet",
    description:
      "A light-obsessed impressionist whose gardens, rivers, haystacks, and cathedrals captured color in motion.",
    query: "Claude Monet",
    source: "wikimedia",
  },
  {
    label: "Paul Gauguin",
    description:
      "A bold post-impressionist whose tropical scenes and symbolic color shaped a wilder modern vision.",
    query: "Paul Gauguin",
    source: "wikimedia",
  },
  {
    label: "Ernst Ludwig Kirchner",
    description:
      "An expressive modernist whose sharp color, city scenes, and angular figures helped define Die Brücke.",
    query: "Ernst Ludwig Kirchner",
    source: "wikimedia",
  },
  {
    label: "Poster",
    description:
      "Graphic works where typography, illustration, and public life meet in one immediate image.",
    query: "poster",
    source: "wikimedia",
  },
] satisfies FeaturedSearch[];

const featuredSymbolAlbums = [
  {
    label: "Minimal Ui Icons",
    description: "A large collection of clean interface icons and controls.",
    query: "collection:minimal-ui-icons",
    source: "svgrepo",
    collectionSlug: "minimal-ui-icons",
  },
  {
    label: "Variety Shadowed Icons",
    description: "Colorful everyday symbols with a bold shadowed style.",
    query: "collection:variety-shadowed-icons",
    source: "svgrepo",
    collectionSlug: "variety-shadowed-icons",
  },
  {
    label: "Food Line Filled Vectors",
    description: "A consistent filled collection of food and drink symbols.",
    query: "collection:food-line-filled-vectors",
    source: "svgrepo",
    collectionSlug: "food-line-filled-vectors",
  },
  {
    label: "Tiny Filled Colored Icons",
    description: "Compact colorful icons for objects, places, and activities.",
    query: "collection:tiny-filled-colored-icons",
    source: "svgrepo",
    collectionSlug: "tiny-filled-colored-icons",
  },
  {
    label: "World Famous Tourist Attractions Vectors",
    description:
      "Recognizable landmarks and destinations from around the world.",
    query: "collection:world-famous-tourist-attractions-vectors",
    source: "svgrepo",
    collectionSlug: "world-famous-tourist-attractions-vectors",
  },
  {
    label: "Sensa Emoji Vectors",
    description:
      "Expressive emoji for people, reactions, objects, and activities.",
    query: "collection:sensa-emoji-vectors",
    source: "svgrepo",
    collectionSlug: "sensa-emoji-vectors",
  },
] satisfies FeaturedSearch[];

const featuredSearches: FeaturedSearch[] = [
  ...featuredArtSearches,
  ...featuredSymbolAlbums,
];
type FeaturedSearchImages = Partial<Record<string, string[]>>;

function getFeaturedSearchKey(featuredSearch: FeaturedSearch) {
  return `${featuredSearch.source}:${featuredSearch.query}`;
}

function ArtworkCard({
  artwork,
  isSelected,
  onSelect,
  variant = "gallery",
}: {
  artwork: Artwork;
  isSelected: boolean;
  onSelect: (artwork: Artwork) => void;
  variant?: "featured" | "gallery";
}) {
  const imageWidth =
    typeof artwork.image.width === "number" && artwork.image.width > 0
      ? artwork.image.width
      : undefined;
  const imageHeight =
    typeof artwork.image.height === "number" && artwork.image.height > 0
      ? artwork.image.height
      : undefined;

  return (
    <button
      type="button"
      className={classnames(
        variant === "featured" ? styles.featuredItem : styles.galleryItem,
        {
          [styles.selectedItem]: isSelected,
        }
      )}
      onClick={() => onSelect(artwork)}
    >
      <span className={styles.previewFrame}>
        <img
          className={styles.preview}
          src={artwork.image.url}
          alt={artwork.title}
          width={imageWidth}
          height={imageHeight}
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className={styles.itemBody}>
        <span className={styles.itemTitle}>{artwork.title}</span>
      </span>
    </button>
  );
}

function FeaturedSearchTiles({
  query,
  source,
  images,
  onSelect,
}: {
  query: string;
  source: ArtworkSource;
  images: FeaturedSearchImages;
  onSelect: (featuredSearch: FeaturedSearch) => void;
}) {
  const { t } = useTranslation();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searches = featuredSearches.filter(
    (featuredSearch) => featuredSearch.source === source
  );

  return (
    <section className={styles.featuredSearches}>
      <div className={styles.sectionHeading}>
        {source === "svgrepo" ? (
          <Trans>Featured symbol albums</Trans>
        ) : (
          <Trans>Featured collections</Trans>
        )}
      </div>
      <div className={styles.featuredSearchGrid}>
        {searches.map((featuredSearch) => {
          const isSelected =
            source === featuredSearch.source &&
            normalizedQuery === featuredSearch.query.toLocaleLowerCase();
          const imageUrls = images[getFeaturedSearchKey(featuredSearch)] || [];

          return (
            <button
              key={featuredSearch.query}
              type="button"
              className={classnames(styles.featuredSearchTile, {
                [styles.featuredSearchTileActive]: isSelected,
                [styles.featuredSearchTileWithImage]: imageUrls.length > 0,
                [styles.featuredSymbolAlbum]: source === "svgrepo",
              })}
              aria-pressed={isSelected}
              aria-label={t("Search for {{query}}", {
                query: t(featuredSearch.label),
              })}
              onClick={() => onSelect(featuredSearch)}
            >
              {imageUrls.length > 0 && (
                <span
                  className={classnames(styles.featuredSearchTileImage, {
                    [styles.featuredSearchTileImageMosaic]:
                      imageUrls.length > 1,
                  })}
                >
                  {imageUrls.map((imageUrl) => (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </span>
              )}
              <span className={styles.featuredSearchTileBody}>
                <span className={styles.featuredSearchTileLabel}>
                  {t(featuredSearch.label)}
                </span>
                <span className={styles.featuredSearchTileDescription}>
                  {t(featuredSearch.description)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ArtworkDetail({
  artwork,
  relatedArtworks,
  isLoadingRelated,
  isAdding,
  onUse,
  onSelectRelated,
  onBack,
  mobileOverlay = false,
}: {
  artwork: Artwork | null;
  relatedArtworks: Artwork[];
  isLoadingRelated: boolean;
  isAdding: boolean;
  onUse: (artwork: Artwork) => void;
  onSelectRelated: (artwork: Artwork) => void;
  onBack?: () => void;
  mobileOverlay?: boolean;
}) {
  if (!artwork) {
    return (
      <aside className={styles.detailPanel}>
        <div className={styles.detailEmpty}>
          <Trans>Select an artwork to view details.</Trans>
        </div>
      </aside>
    );
  }

  const creator = getArtworkCreator(artwork);

  return (
    <aside
      className={classnames(styles.detailPanel, {
        [styles.mobileDetailPanel]: mobileOverlay,
      })}
    >
      {onBack && (
        <Button kind="secondary" className={styles.backButton} onClick={onBack}>
          <Trans>Back</Trans>
        </Button>
      )}
      <div className={styles.detailImageFrame}>
        <img
          className={styles.detailImage}
          src={artwork.image.url}
          alt={artwork.title}
        />
      </div>
      <div className={styles.detailBody}>
        <h3 className={styles.detailTitle}>{artwork.title}</h3>
        <dl className={styles.metadata}>
          {creator && (
            <>
              <dt>
                <Trans>Creator</Trans>
              </dt>
              <dd>{creator}</dd>
            </>
          )}
          {artwork.date && (
            <>
              <dt>
                <Trans>Date</Trans>
              </dt>
              <dd>{artwork.date}</dd>
            </>
          )}
          {artwork.collection?.name && (
            <>
              <dt>
                <Trans>Collection</Trans>
              </dt>
              <dd>
                {artwork.collection.url ? (
                  <a
                    href={artwork.collection.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {artwork.collection.name}
                  </a>
                ) : (
                  artwork.collection.name
                )}
              </dd>
            </>
          )}
          <dt>
            <Trans>License</Trans>
          </dt>
          <dd>
            {artwork.licenseUrl ? (
              <a href={artwork.licenseUrl} target="_blank" rel="noreferrer">
                {artwork.license}
              </a>
            ) : (
              artwork.license
            )}
          </dd>
          <dt>
            <Trans>Source</Trans>
          </dt>
          <dd>
            <a href={artwork.sourceUrl} target="_blank" rel="noreferrer">
              {artwork.source}
            </a>
          </dd>
        </dl>
        <Button
          kind="primary"
          className={styles.useImageButton}
          disabled={isAdding}
          onClick={() => onUse(artwork)}
        >
          {isAdding ? <Trans>Adding...</Trans> : <Trans>Use Image</Trans>}
        </Button>
        {(isLoadingRelated || relatedArtworks.length > 0) && (
          <section className={styles.relatedArtworks}>
            <div className={styles.relatedHeading}>
              <Trans>Related art</Trans>
            </div>
            {isLoadingRelated ? (
              <InlineLoading description={<Trans>Loading...</Trans>} />
            ) : (
              <div className={styles.relatedGrid}>
                {relatedArtworks.map((relatedArtwork) => (
                  <button
                    key={relatedArtwork.id}
                    type="button"
                    className={styles.relatedArtwork}
                    onClick={() => onSelectRelated(relatedArtwork)}
                  >
                    <span className={styles.relatedArtworkImageFrame}>
                      <img
                        src={relatedArtwork.image.url}
                        alt={relatedArtwork.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className={styles.relatedArtworkTitle}>
                      {relatedArtwork.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

const INTERNAL_TAG_PATTERNS = [/batch/i, /dedupe/i];
const MAX_RELATED_SEARCH_TERMS = 4;

function getRelatedArtworkSearchTerms(artwork: Artwork) {
  const seen = new Set<string>();
  const terms = [
    ...(artwork.tags || []),
    getArtworkCreator(artwork),
    artwork.collection?.name,
  ];

  return terms
    .map((term) => term?.trim() || "")
    .filter((tag) => {
      if (!tag || INTERNAL_TAG_PATTERNS.some((pattern) => pattern.test(tag))) {
        return false;
      }

      const normalizedTag = tag.toLocaleLowerCase();
      if (seen.has(normalizedTag)) return false;

      seen.add(normalizedTag);
      return true;
    })
    .slice(0, MAX_RELATED_SEARCH_TERMS);
}

function scoreRelatedArtwork(candidate: Artwork, selectedArtwork: Artwork) {
  const selectedTags = new Set(
    getRelatedArtworkSearchTerms(selectedArtwork).map((tag) =>
      tag.toLocaleLowerCase()
    )
  );
  const candidateTags = getRelatedArtworkSearchTerms(candidate).map((tag) =>
    tag.toLocaleLowerCase()
  );
  const sharedTagCount = candidateTags.filter((tag) =>
    selectedTags.has(tag)
  ).length;
  const sameCreator =
    getArtworkCreator(candidate) &&
    getArtworkCreator(candidate) === getArtworkCreator(selectedArtwork)
      ? 2
      : 0;

  return sharedTagCount * 3 + sameCreator + getRatingSortValue(candidate);
}

function sortRelatedArtworks(artworks: Artwork[], selectedArtwork: Artwork) {
  return filterAndSortArtworksByRating(artworks).sort((a, b) => {
    const scoreDifference =
      scoreRelatedArtwork(b, selectedArtwork) -
      scoreRelatedArtwork(a, selectedArtwork);

    if (scoreDifference !== 0) return scoreDifference;

    return a.title.localeCompare(b.title);
  });
}

function getRatingSortValue(artwork: Artwork) {
  return typeof artwork.rating === "number" ? artwork.rating : 0;
}

function filterAndSortArtworksByRating(artworks: Artwork[]) {
  return artworks
    .filter((artwork) => artwork.rating !== 1)
    .sort((a, b) => {
      const ratingDifference = getRatingSortValue(b) - getRatingSortValue(a);
      if (ratingDifference !== 0) return ratingDifference;

      return a.title.localeCompare(b.title);
    });
}

function getMasonryColumnCount(source: ArtworkSource) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return source === "svgrepo" ? 4 : 2;

  const responsiveColumnCount =
    MASONRY_BREAKPOINTS.find(({ query }) => window.matchMedia(query).matches)
      ?.columns || 2;

  return source === "svgrepo"
    ? Math.max(4, responsiveColumnCount)
    : responsiveColumnCount;
}

function useMasonryColumnCount(source: ArtworkSource) {
  const [columnCount, setColumnCount] = React.useState(() =>
    getMasonryColumnCount(source)
  );

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;

    const updateColumnCount = () =>
      setColumnCount(getMasonryColumnCount(source));
    const mediaQueries = MASONRY_BREAKPOINTS.map(({ query }) =>
      window.matchMedia(query)
    );

    updateColumnCount();

    mediaQueries.forEach((mediaQuery) => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateColumnCount);
      } else {
        mediaQuery.addListener(updateColumnCount);
      }
    });

    return () => {
      mediaQueries.forEach((mediaQuery) => {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", updateColumnCount);
        } else {
          mediaQuery.removeListener(updateColumnCount);
        }
      });
    };
  }, [source]);

  return columnCount;
}

function getArtworkHeightEstimate(artwork: Artwork) {
  const { width, height } = artwork.image;

  if (
    typeof width === "number" &&
    width > 0 &&
    typeof height === "number" &&
    height > 0
  ) {
    return height / width + 0.35;
  }

  return 1.35;
}

function distributeArtworksIntoColumns(
  artworks: Artwork[],
  columnCount: number
) {
  const columns = Array.from({ length: columnCount }, () => ({
    height: 0,
    items: [] as Artwork[],
  }));

  artworks.forEach((artwork) => {
    const shortestColumn = columns.reduce((shortest, column) =>
      column.height < shortest.height ? column : shortest
    );

    shortestColumn.items.push(artwork);
    shortestColumn.height += getArtworkHeightEstimate(artwork);
  });

  return columns.map((column) => column.items);
}

function isSvgArtwork(artwork: Artwork) {
  return [
    artwork.image.url,
    artwork.image.originalUrl,
    artwork.image.localOriginalPath,
  ].some((url) => Boolean(url && /\.svg(?:[?#]|$)/i.test(url)));
}

function getLargestNumberInText(value?: string) {
  if (!value) return 0;

  const numbers = value.match(/\d{3,5}/g)?.map(Number) || [];
  return numbers.length ? Math.max(...numbers) : 0;
}

function getArtworkImageLongEdge(artwork: Artwork) {
  const { width, height } = artwork.image;
  if (typeof width === "number" && typeof height === "number") {
    return Math.max(width, height);
  }
  return 0;
}

function getHighResolutionArtworkUrl(
  artwork: Artwork,
  canvasSize: { width: number; height: number }
) {
  if (isSvgArtwork(artwork)) {
    return artwork.image.localOriginalPath || artwork.image.url;
  }

  const targetLongEdge =
    Math.max(canvasSize.width, canvasSize.height) *
    CANVAS_IMAGE_RESOLUTION_MULTIPLIER;
  const originalLongEdge = getArtworkImageLongEdge(artwork);
  const candidates = new Map<string, number>();

  const addCandidates = (urls?: Record<string, string>) => {
    Object.entries(urls || {}).forEach(([key, url]) => {
      if (!url) return;
      candidates.set(
        url,
        getLargestNumberInText(key) || getLargestNumberInText(url)
      );
    });
  };

  addCandidates(artwork.image.localResizedPaths);
  addCandidates(artwork.image.resizedUrls);

  if (artwork.image.localOriginalPath) {
    candidates.set(
      artwork.image.localOriginalPath,
      originalLongEdge || Number.MAX_SAFE_INTEGER
    );
  }

  if (artwork.image.originalUrl) {
    candidates.set(
      artwork.image.originalUrl,
      originalLongEdge || Number.MAX_SAFE_INTEGER
    );
  }

  const sortedCandidates = Array.from(candidates.entries()).sort(
    ([, a], [, b]) => a - b
  );
  const preferredCandidate =
    sortedCandidates.find(([, size]) => size >= targetLongEdge) ||
    sortedCandidates.at(-1);

  return preferredCandidate?.[0] || artwork.image.url;
}

function getFeaturedSearchImages(
  artworks: Artwork[],
  source: ArtworkSource,
  collectionSlug?: string
) {
  const imageUrls = filterAndSortArtworksByRating(artworks)
    .filter(
      (artwork) =>
        Boolean(artwork.image.url) &&
        (source === "svgrepo" || !isSvgArtwork(artwork)) &&
        (!collectionSlug ||
          artwork.collection?.url.includes(`/collection/${collectionSlug}/`))
    )
    .map((artwork) => artwork.image.url);

  return imageUrls.slice(0, source === "svgrepo" ? 4 : 1);
}

function ArtPortalControls({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (query: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.controls}>
      <Search
        labelText={<Trans>Search</Trans>}
        hideLabel
        closeButtonLabelText={t("Clear search")}
        placeholder={t("Search...")}
        value={query}
        onChange={(_event, value = "") => setQuery(value)}
      />
    </div>
  );
}

function ArtPortalModal({
  classes,
  onClose,
  sourceOption,
}: {
  classes: string;
  onClose: () => void;
  sourceOption: BrowserOption;
}) {
  const { imageEditorTools }: any = useImageEditorContext();
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const source = sourceOption.value;
  const [highlightedItems, setHighlightedItems] = React.useState<Artwork[]>([]);
  const [highlightedTotal, setHighlightedTotal] = React.useState(0);
  const [highlightedOffset, setHighlightedOffset] = React.useState(0);
  const [isLoadingHighlighted, setIsLoadingHighlighted] = React.useState(false);
  const [items, setItems] = React.useState<Artwork[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [selectedArtwork, setSelectedArtwork] = React.useState<Artwork | null>(
    null
  );
  const [relatedArtworks, setRelatedArtworks] = React.useState<Artwork[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [featuredSearchImages, setFeaturedSearchImages] =
    React.useState<FeaturedSearchImages>({});
  const requestIdRef = React.useRef(0);
  const relatedRequestIdRef = React.useRef(0);

  const fetchArtworks = React.useCallback(
    async ({ nextOffset, append }: { nextOffset: number; append: boolean }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const trimmedQuery = query.trim();
        const shouldLoadHighlighted = !append && !trimmedQuery;
        const highlightedLimit =
          source === "svgrepo"
            ? SYMBOL_HIGHLIGHTED_LIMIT
            : ART_HIGHLIGHTED_LIMIT;
        const searchParams = {
          q: trimmedQuery,
          source,
        };
        const [result, highlightedResult] = await Promise.all([
          searchArtworks({
            ...searchParams,
            highlighted: false,
            limit: SEARCH_LIMIT,
            offset: nextOffset,
          }),
          shouldLoadHighlighted
            ? searchArtworks({
                ...searchParams,
                highlighted: true,
                limit: highlightedLimit,
                offset: 0,
              })
            : Promise.resolve(null),
        ]);

        if (requestIdRef.current !== requestId) return;

        if (highlightedResult) {
          setHighlightedItems(
            filterAndSortArtworksByRating(highlightedResult.items)
          );
          setHighlightedTotal(highlightedResult.total);
          setHighlightedOffset(
            highlightedResult.offset + highlightedResult.items.length
          );
        }

        setItems((current) => {
          const nextItems = filterAndSortArtworksByRating(result.items);
          return append ? [...current, ...nextItems] : nextItems;
        });
        setTotal(result.total);
        setOffset(result.offset);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        console.error(e);
        setError(t("Could not load artworks. Please try again."));
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [query, source, t]
  );

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedArtwork(null);
      setHighlightedItems([]);
      setHighlightedTotal(0);
      setHighlightedOffset(0);
      void fetchArtworks({ nextOffset: 0, append: false });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [fetchArtworks]);

  React.useEffect(() => {
    let isMounted = true;

    setFeaturedSearchImages({});
    const sourceFeaturedSearches = featuredSearches.filter(
      (featuredSearch) => featuredSearch.source === source
    );

    void Promise.all(
      sourceFeaturedSearches.map(async (featuredSearch) => {
        try {
          const result = await searchArtworks({
            q: featuredSearch.query,
            source: featuredSearch.source,
            highlighted: false,
            limit: source === "svgrepo" ? 16 : 8,
            offset: 0,
          });

          return [
            getFeaturedSearchKey(featuredSearch),
            getFeaturedSearchImages(
              result.items,
              featuredSearch.source,
              featuredSearch.collectionSlug
            ),
          ] as const;
        } catch (e) {
          console.error(e);
          return [getFeaturedSearchKey(featuredSearch), []] as const;
        }
      })
    ).then((results) => {
      if (!isMounted) return;

      setFeaturedSearchImages(
        Object.fromEntries(results) as FeaturedSearchImages
      );
    });

    return () => {
      isMounted = false;
    };
  }, [source]);

  React.useEffect(() => {
    const requestId = relatedRequestIdRef.current + 1;
    relatedRequestIdRef.current = requestId;
    setRelatedArtworks([]);

    if (!selectedArtwork) {
      setIsLoadingRelated(false);
      return undefined;
    }

    const searchTerms = getRelatedArtworkSearchTerms(selectedArtwork);
    if (searchTerms.length === 0) {
      setIsLoadingRelated(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoadingRelated(true);

    void Promise.all(
      searchTerms.map((searchTerm) =>
        searchArtworks({
          q: searchTerm,
          source: selectedArtwork.source,
          highlighted: false,
          limit: RELATED_ARTWORK_LIMIT,
          offset: 0,
        }).catch((error) => {
          console.error(error);
          return null;
        })
      )
    ).then((results) => {
      if (
        !isMounted ||
        relatedRequestIdRef.current !== requestId ||
        !selectedArtwork
      ) {
        return;
      }

      const relatedArtworkById = new Map<string, Artwork>();

      results.forEach((result) => {
        result?.items.forEach((relatedArtwork) => {
          if (
            relatedArtwork.id !== selectedArtwork.id &&
            relatedArtwork.image.url
          ) {
            relatedArtworkById.set(relatedArtwork.id, relatedArtwork);
          }
        });
      });

      setRelatedArtworks(
        sortRelatedArtworks(
          Array.from(relatedArtworkById.values()),
          selectedArtwork
        ).slice(0, RELATED_ARTWORK_LIMIT)
      );
      setIsLoadingRelated(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedArtwork]);

  const selectFeaturedSearch = React.useCallback(
    (featuredSearch: FeaturedSearch) => {
      setSelectedArtwork(null);
      setQuery(featuredSearch.query);
    },
    []
  );

  const loadMoreHighlightedSymbols = React.useCallback(async () => {
    if (
      source !== "svgrepo" ||
      isLoadingHighlighted ||
      highlightedOffset >= highlightedTotal
    ) {
      return;
    }

    setIsLoadingHighlighted(true);

    try {
      const result = await searchArtworks({
        source,
        highlighted: true,
        limit: SYMBOL_HIGHLIGHTED_LIMIT,
        offset: highlightedOffset,
      });

      setHighlightedItems((current) => {
        const itemsById = new Map(
          [...current, ...result.items].map((artwork) => [artwork.id, artwork])
        );

        return filterAndSortArtworksByRating(Array.from(itemsById.values()));
      });
      setHighlightedTotal(result.total);
      setHighlightedOffset(result.offset + result.items.length);
    } catch (e) {
      console.error(e);
      setError(t("Could not load artworks. Please try again."));
    } finally {
      setIsLoadingHighlighted(false);
    }
  }, [highlightedOffset, highlightedTotal, isLoadingHighlighted, source, t]);

  const addArtwork = React.useCallback(
    async (artwork: Artwork | null) => {
      if (!artwork?.image?.url || addingId) return;

      setAddingId(artwork.id);

      try {
        const canvasSize = imageEditorTools.getCanvasSize();
        const isSvg = isSvgArtwork(artwork);
        const width = isSvg
          ? Math.min(canvasSize.width, canvasSize.height) * 0.5
          : undefined;
        const imageUrl = getHighResolutionArtworkUrl(artwork, canvasSize);
        const loadArtworkImage = async (url: string) => {
          try {
            return await imageEditorTools.addImageFromUrl({
              url,
              width,
              fit: isSvg ? undefined : "cover",
              crossOrigin: "anonymous",
            });
          } catch (error) {
            console.warn("Artwork image could not be loaded", url, error);
            return null;
          }
        };

        let img = await loadArtworkImage(imageUrl);

        if (!img && imageUrl !== artwork.image.url) {
          img = await loadArtworkImage(artwork.image.url);
        }

        if (!img) {
          throw new Error("Artwork image could not be loaded");
        }

        img?.set?.({
          memoElementType: "artwork",
          artworkAttribution: {
            id: artwork.id,
            title: artwork.title,
            creator: getArtworkCreator(artwork),
            license: artwork.license,
            licenseUrl: artwork.licenseUrl,
            source: artwork.source,
            sourceUrl: artwork.sourceUrl,
          },
        });

        onClose();
      } catch (e) {
        console.error(e);
        setError(t("Could not add artwork. Please try another image."));
      } finally {
        setAddingId(null);
      }
    },
    [addingId, imageEditorTools, onClose, t]
  );

  const hasMore = offset + SEARCH_LIMIT < total;
  const isSearchActive = Boolean(query.trim());
  const shouldShowFeaturedSearches = !isSearchActive;
  const featuredItems = isSearchActive ? [] : highlightedItems;
  const galleryItems = items;
  const hasItems = featuredItems.length > 0 || galleryItems.length > 0;
  const hasMoreHighlightedSymbols =
    source === "svgrepo" && highlightedOffset < highlightedTotal;
  const masonryColumnCount = useMasonryColumnCount(source);
  const masonryColumns = React.useMemo(
    () => distributeArtworksIntoColumns(galleryItems, masonryColumnCount),
    [galleryItems, masonryColumnCount]
  );

  return (
    <Modal
      open
      className={classes}
      modalHeading={
        <div className={styles.portalHeading}>
          <span className={styles.portalTitle}>{t(sourceOption.label)}</span>
          <ArtPortalControls query={query} setQuery={setQuery} />
        </div>
      }
      onRequestClose={onClose}
      overscrollBehavior="inside"
      kind="fullscreen"
      kindMobile="fullscreen"
      passiveModal
      width="full"
    >
      <div className={styles.artBrowser}>
        {error && <div className={styles.message}>{error}</div>}

        {!error && shouldShowFeaturedSearches && (
          <FeaturedSearchTiles
            query={query}
            source={source}
            images={featuredSearchImages}
            onSelect={selectFeaturedSearch}
          />
        )}

        {!error && !hasItems && isLoading && (
          <div className={styles.message}>
            <InlineLoading
              description={
                source === "svgrepo" ? (
                  <Trans>Loading symbols...</Trans>
                ) : (
                  <Trans>Loading artworks...</Trans>
                )
              }
            />
          </div>
        )}

        {!error && !hasItems && !isLoading && (
          <div className={styles.message}>
            <Trans>No artworks found.</Trans>
          </div>
        )}

        <div className={styles.portalLayout}>
          <div className={styles.browsePane}>
            {!error && hasItems && (
              <>
                {featuredItems.length > 0 && (
                  <section className={styles.featured}>
                    <div className={styles.sectionHeading}>
                      {source === "svgrepo" ? (
                        <Trans>Highlighted Symbols</Trans>
                      ) : (
                        <Trans>Highlighted art</Trans>
                      )}
                    </div>
                    <div
                      className={classnames(styles.featuredGrid, {
                        [styles.symbolGrid]: source === "svgrepo",
                      })}
                    >
                      {featuredItems.map((artwork) => (
                        <ArtworkCard
                          key={artwork.id}
                          artwork={artwork}
                          isSelected={selectedArtwork?.id === artwork.id}
                          onSelect={setSelectedArtwork}
                          variant="featured"
                        />
                      ))}
                    </div>
                    {hasMoreHighlightedSymbols && (
                      <div className={styles.highlightedFooter}>
                        <Button
                          kind="secondary"
                          disabled={isLoadingHighlighted}
                          onClick={() => void loadMoreHighlightedSymbols()}
                        >
                          {isLoadingHighlighted ? (
                            <InlineLoading
                              description={<Trans>Loading...</Trans>}
                            />
                          ) : (
                            <Trans>Show more highlighted symbols</Trans>
                          )}
                        </Button>
                      </div>
                    )}
                  </section>
                )}

                {galleryItems.length > 0 && (
                  <section
                    className={classnames(styles.gallery, {
                      [styles.symbolGallery]: source === "svgrepo",
                    })}
                  >
                    <div className={styles.sectionHeading}>
                      <Trans>Browse</Trans>
                    </div>
                    <div
                      className={styles.masonry}
                      style={
                        {
                          "--masonry-column-count": masonryColumns.length,
                        } as React.CSSProperties
                      }
                    >
                      {masonryColumns.map((column, columnIndex) => (
                        <div key={columnIndex} className={styles.masonryColumn}>
                          {column.map((artwork) => (
                            <ArtworkCard
                              key={artwork.id}
                              artwork={artwork}
                              isSelected={selectedArtwork?.id === artwork.id}
                              onSelect={setSelectedArtwork}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {hasMore && (
                  <div className={styles.footer}>
                    <Button
                      kind="secondary"
                      disabled={isLoading}
                      onClick={() =>
                        void fetchArtworks({
                          nextOffset: offset + SEARCH_LIMIT,
                          append: true,
                        })
                      }
                    >
                      {isLoading ? (
                        <InlineLoading
                          description={<Trans>Loading...</Trans>}
                        />
                      ) : (
                        <Trans>Load more</Trans>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <ArtworkDetail
            artwork={selectedArtwork}
            relatedArtworks={relatedArtworks}
            isLoadingRelated={isLoadingRelated}
            isAdding={Boolean(
              selectedArtwork && addingId === selectedArtwork.id
            )}
            onUse={(artwork) => void addArtwork(artwork)}
            onSelectRelated={setSelectedArtwork}
          />
        </div>

        {selectedArtwork && (
          <div className={styles.mobileDetailOverlay}>
            <ArtworkDetail
              artwork={selectedArtwork}
              relatedArtworks={relatedArtworks}
              isLoadingRelated={isLoadingRelated}
              isAdding={addingId === selectedArtwork.id}
              onUse={(artwork) => void addArtwork(artwork)}
              onSelectRelated={setSelectedArtwork}
              onBack={() => setSelectedArtwork(null)}
              mobileOverlay
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function ArtBrowser() {
  const { modalOpen, setModalOpen }: any = useEditor();
  const { t } = useTranslation();
  const activeBrowserOption = browserOptions.find(
    (option) => option.id === modalOpen
  );
  const classes = classnames(styles.artPortalModal, "force-darkmode");
  const handleClose = React.useCallback(
    () => setModalOpen(false),
    [setModalOpen]
  );

  return (
    <>
      {browserOptions.map((option) => (
        <EditorButton
          key={option.id}
          id={option.id}
          kind="secondary"
          text={t(option.label)}
          icon={<FontAwesomeIcon icon={option.icon} />}
          onClick={() => setModalOpen(option.id)}
        />
      ))}

      {activeBrowserOption && (
        <ArtPortalModal
          classes={classes}
          onClose={handleClose}
          sourceOption={activeBrowserOption}
        />
      )}
    </>
  );
}
