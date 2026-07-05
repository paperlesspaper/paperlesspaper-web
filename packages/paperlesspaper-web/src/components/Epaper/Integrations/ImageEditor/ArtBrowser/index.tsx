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
const HIGHLIGHTED_LIMIT = 8;
const RELATED_ARTWORK_LIMIT = 16;
const CANVAS_IMAGE_RESOLUTION_MULTIPLIER = 2;
const MASONRY_BREAKPOINTS = [
  { query: "(min-width: 1056px)", columns: 5 },
  { query: "(min-width: 672px)", columns: 4 },
  { query: "(min-width: 320px)", columns: 2 },
];

type SourceOption = {
  value: ArtworkSource;
  label: string;
  icon: IconDefinition;
};

const sourceOptions: SourceOption[] = [
  { value: "wikimedia", label: "Art", icon: faPalette },
  { value: "svgrepo", label: "Icons", icon: faIcons },
];

const featuredSearches = [
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
] satisfies Array<{
  label: string;
  description: string;
  query: string;
  source: ArtworkSource;
}>;

type FeaturedSearch = (typeof featuredSearches)[number];
type FeaturedSearchImages = Partial<Record<FeaturedSearch["query"], string>>;

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
        },
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

  return (
    <section className={styles.featuredSearches}>
      <div className={styles.sectionHeading}>
        <Trans>Featured collections</Trans>
      </div>
      <div className={styles.featuredSearchGrid}>
        {featuredSearches.map((featuredSearch) => {
          const isSelected =
            source === featuredSearch.source &&
            normalizedQuery === featuredSearch.query.toLocaleLowerCase();
          const imageUrl = images[featuredSearch.query];

          return (
            <button
              key={featuredSearch.query}
              type="button"
              className={classnames(styles.featuredSearchTile, {
                [styles.featuredSearchTileActive]: isSelected,
                [styles.featuredSearchTileWithImage]: Boolean(imageUrl),
              })}
              aria-pressed={isSelected}
              aria-label={t("Search for {{query}}", {
                query: featuredSearch.label,
              })}
              onClick={() => onSelect(featuredSearch)}
            >
              {imageUrl && (
                <span className={styles.featuredSearchTileImage}>
                  <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                </span>
              )}
              <span className={styles.featuredSearchTileBody}>
                <span className={styles.featuredSearchTileLabel}>
                  {featuredSearch.label}
                </span>
                <span className={styles.featuredSearchTileDescription}>
                  {featuredSearch.description}
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
        <Button disabled={isAdding} onClick={() => onUse(artwork)}>
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
      tag.toLocaleLowerCase(),
    ),
  );
  const candidateTags = getRelatedArtworkSearchTerms(candidate).map((tag) =>
    tag.toLocaleLowerCase(),
  );
  const sharedTagCount = candidateTags.filter((tag) =>
    selectedTags.has(tag),
  ).length;
  const sameCreator =
    getArtworkCreator(candidate) &&
    getArtworkCreator(candidate) === getArtworkCreator(selectedArtwork)
      ? 2
      : 0;

  return sharedTagCount * 3 + sameCreator + getRatingSortValue(candidate);
}

function sortRelatedArtworks(
  artworks: Artwork[],
  selectedArtwork: Artwork,
) {
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

function getMasonryColumnCount() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return 2;

  return (
    MASONRY_BREAKPOINTS.find(({ query }) => window.matchMedia(query).matches)
      ?.columns || 2
  );
}

function useMasonryColumnCount() {
  const [columnCount, setColumnCount] = React.useState(getMasonryColumnCount);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;

    const updateColumnCount = () => setColumnCount(getMasonryColumnCount());
    const mediaQueries = MASONRY_BREAKPOINTS.map(({ query }) =>
      window.matchMedia(query),
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
  }, []);

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
  columnCount: number,
) {
  const columns = Array.from({ length: columnCount }, () => ({
    height: 0,
    items: [] as Artwork[],
  }));

  artworks.forEach((artwork) => {
    const shortestColumn = columns.reduce((shortest, column) =>
      column.height < shortest.height ? column : shortest,
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
  canvasSize: { width: number; height: number },
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
        getLargestNumberInText(key) || getLargestNumberInText(url),
      );
    });
  };

  addCandidates(artwork.image.localResizedPaths);
  addCandidates(artwork.image.resizedUrls);

  if (artwork.image.localOriginalPath) {
    candidates.set(
      artwork.image.localOriginalPath,
      originalLongEdge || Number.MAX_SAFE_INTEGER,
    );
  }

  if (artwork.image.originalUrl) {
    candidates.set(
      artwork.image.originalUrl,
      originalLongEdge || Number.MAX_SAFE_INTEGER,
    );
  }

  const sortedCandidates = Array.from(candidates.entries()).sort(
    ([, a], [, b]) => a - b,
  );
  const preferredCandidate =
    sortedCandidates.find(([, size]) => size >= targetLongEdge) ||
    sortedCandidates.at(-1);

  return preferredCandidate?.[0] || artwork.image.url;
}

function getFeaturedSearchImage(artworks: Artwork[]) {
  return filterAndSortArtworksByRating(artworks).find(
    (artwork) => Boolean(artwork.image.url) && !isSvgArtwork(artwork),
  )?.image.url;
}

function ArtPortalControls({
  query,
  setQuery,
  source,
  setSource,
}: {
  query: string;
  setQuery: (query: string) => void;
  source: ArtworkSource;
  setSource: (source: ArtworkSource) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.controls}>
      <div
        className={styles.sourceSwitch}
        role="radiogroup"
        aria-label={t("Source")}
      >
        {sourceOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={classnames(styles.sourceSwitchButton, {
              [styles.sourceSwitchButtonActive]: source === option.value,
            })}
            role="radio"
            aria-checked={source === option.value}
            aria-label={t(option.label)}
            title={t(option.label)}
            onClick={() => setSource(option.value)}
          >
            <FontAwesomeIcon icon={option.icon} />
            <span className={styles.sourceSwitchLabel}>{t(option.label)}</span>
          </button>
        ))}
      </div>
      <Search
        labelText={<Trans>Search</Trans>}
        hideLabel
        closeButtonLabelText={t("Clear search")}
        placeholder={t("Landscape, icon, flower...")}
        value={query}
        onChange={(_event, value = "") => setQuery(value)}
      />
    </div>
  );
}

function ArtPortalModal({
  classes,
  onClose,
}: {
  classes: string;
  onClose: () => void;
}) {
  const { imageEditorTools }: any = useImageEditorContext();
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState<ArtworkSource>("wikimedia");
  const [highlightedItems, setHighlightedItems] = React.useState<Artwork[]>([]);
  const [items, setItems] = React.useState<Artwork[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [selectedArtwork, setSelectedArtwork] = React.useState<Artwork | null>(
    null,
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
                limit: HIGHLIGHTED_LIMIT,
                offset: 0,
              })
            : Promise.resolve(null),
        ]);

        if (requestIdRef.current !== requestId) return;

        if (highlightedResult) {
          setHighlightedItems(
            filterAndSortArtworksByRating(highlightedResult.items),
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
    [query, source, t],
  );

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedArtwork(null);
      setHighlightedItems([]);
      void fetchArtworks({ nextOffset: 0, append: false });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [fetchArtworks]);

  React.useEffect(() => {
    let isMounted = true;

    void Promise.all(
      featuredSearches.map(async (featuredSearch) => {
        try {
          const result = await searchArtworks({
            q: featuredSearch.query,
            source: featuredSearch.source,
            highlighted: false,
            limit: 8,
            offset: 0,
          });

          return [
            featuredSearch.query,
            getFeaturedSearchImage(result.items),
          ] as const;
        } catch (e) {
          console.error(e);
          return [featuredSearch.query, undefined] as const;
        }
      }),
    ).then((results) => {
      if (!isMounted) return;

      setFeaturedSearchImages(
        Object.fromEntries(
          results.filter(
            (result): result is [FeaturedSearch["query"], string] =>
              Boolean(result[1]),
          ),
        ) as FeaturedSearchImages,
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
        }),
      ),
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
          selectedArtwork,
        ).slice(0, RELATED_ARTWORK_LIMIT),
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
      setSource(featuredSearch.source);
      setQuery(featuredSearch.query);
    },
    [],
  );

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
    [addingId, imageEditorTools, onClose, t],
  );

  const hasMore = offset + SEARCH_LIMIT < total;
  const isSearchActive = Boolean(query.trim());
  const shouldShowFeaturedSearches = source !== "svgrepo" && !isSearchActive;
  const featuredItems = isSearchActive ? [] : highlightedItems;
  const galleryItems = items;
  const hasItems = featuredItems.length > 0 || galleryItems.length > 0;
  const masonryColumnCount = useMasonryColumnCount();
  const masonryColumns = React.useMemo(
    () => distributeArtworksIntoColumns(galleryItems, masonryColumnCount),
    [galleryItems, masonryColumnCount],
  );

  return (
    <Modal
      open
      className={classes}
      modalHeading={
        <div className={styles.portalHeading}>
          <span className={styles.portalTitle}>
            <Trans>Art browser</Trans>
          </span>
          <ArtPortalControls
            query={query}
            setQuery={setQuery}
            source={source}
            setSource={setSource}
          />
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
            <InlineLoading description={<Trans>Loading artworks...</Trans>} />
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
                      <Trans>Highlighted art</Trans>
                    </div>
                    <div className={styles.featuredGrid}>
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
                  </section>
                )}

                {galleryItems.length > 0 && (
                  <section className={styles.gallery}>
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
              selectedArtwork && addingId === selectedArtwork.id,
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
  const isOpen = modalOpen === "artBrowser";
  const classes = classnames(styles.artPortalModal, "force-darkmode");
  const handleClose = React.useCallback(
    () => setModalOpen(false),
    [setModalOpen],
  );

  return (
    <>
      <EditorButton
        id="artBrowser"
        kind="secondary"
        text={<Trans>Art</Trans>}
        icon={<FontAwesomeIcon icon={faPalette} />}
        onClick={() => setModalOpen("artBrowser")}
      />

      {isOpen && <ArtPortalModal classes={classes} onClose={handleClose} />}
    </>
  );
}
