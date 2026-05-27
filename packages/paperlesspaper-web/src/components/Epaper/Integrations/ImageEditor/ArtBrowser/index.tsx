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

const SEARCH_LIMIT = 60;
const HIGHLIGHTED_LIMIT = 8;

type SourceOption = {
  value: ArtworkSource;
  label: string;
  icon: IconDefinition;
};

const sourceOptions: SourceOption[] = [
  { value: "wikimedia", label: "Art", icon: faPalette },
  { value: "svgrepo", label: "Icons", icon: faIcons },
];

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

function ArtworkDetail({
  artwork,
  isAdding,
  onUse,
  onBack,
  mobileOverlay = false,
}: {
  artwork: Artwork | null;
  isAdding: boolean;
  onUse: (artwork: Artwork) => void;
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
      </div>
    </aside>
  );
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

function isSvgArtwork(artwork: Artwork) {
  return [
    artwork.image.url,
    artwork.image.originalUrl,
    artwork.image.localOriginalPath,
  ].some((url) => Boolean(url && /\.svg(?:[?#]|$)/i.test(url)));
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
  const [isLoading, setIsLoading] = React.useState(false);
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);

  const fetchArtworks = React.useCallback(
    async ({ nextOffset, append }: { nextOffset: number; append: boolean }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const searchParams = {
          q: query.trim(),
          source,
        };
        const [result, highlightedResult] = await Promise.all([
          searchArtworks({
            ...searchParams,
            highlighted: false,
            limit: SEARCH_LIMIT,
            offset: nextOffset,
          }),
          append
            ? Promise.resolve(null)
            : searchArtworks({
                ...searchParams,
                highlighted: true,
                limit: HIGHLIGHTED_LIMIT,
                offset: 0,
              }),
        ]);

        if (requestIdRef.current !== requestId) return;

        if (highlightedResult) {
          setHighlightedItems(
            filterAndSortArtworksByRating(highlightedResult.items),
          );
        }

        setItems((current) => {
          const nextItems = append
            ? [...current, ...result.items]
            : result.items;
          return filterAndSortArtworksByRating(nextItems);
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
        const img = await imageEditorTools.addImageFromUrl({
          url: artwork.image.url,
          width,
          fit: isSvg ? undefined : "cover",
          crossOrigin: "anonymous",
        });

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
  const featuredItems = highlightedItems;
  const galleryItems = items;
  const hasItems = featuredItems.length > 0 || galleryItems.length > 0;

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
                    <div className={styles.masonry}>
                      {galleryItems.map((artwork) => (
                        <ArtworkCard
                          key={artwork.id}
                          artwork={artwork}
                          isSelected={selectedArtwork?.id === artwork.id}
                          onSelect={setSelectedArtwork}
                        />
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
                        <InlineLoading description={<Trans>Loading...</Trans>} />
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
            isAdding={Boolean(
              selectedArtwork && addingId === selectedArtwork.id,
            )}
            onUse={(artwork) => void addArtwork(artwork)}
          />
        </div>

        {selectedArtwork && (
          <div className={styles.mobileDetailOverlay}>
            <ArtworkDetail
              artwork={selectedArtwork}
              isAdding={addingId === selectedArtwork.id}
              onUse={(artwork) => void addArtwork(artwork)}
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
  const { darkMode, modalOpen, setModalOpen }: any = useEditor();
  const isOpen = modalOpen === "artBrowser";
  const classes = classnames(styles.artPortalModal, {
    "force-darkmode": darkMode,
  });
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
