import { faPalette } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Select, SelectItem, TextInput } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../EditorButton";
import { useImageEditorContext } from "../ImageEditor";
import useEditor from "../useEditor";
import { getArtworkCreator, searchArtworks } from "./api";
import styles from "./artBrowser.module.scss";
import type { Artwork, ArtworkSource } from "./types";

const SEARCH_LIMIT = 24;

const sourceOptions: Array<{
  value: "" | ArtworkSource;
  label: string;
}> = [
  { value: "", label: "All" },
  { value: "svgrepo", label: "SVG Repo" },
  { value: "met", label: "Met Museum" },
  { value: "artic", label: "Art Institute" },
  { value: "wikimedia", label: "Wikimedia" },
];

function ModalComponent({ setModalOpen }: any) {
  const { imageEditorTools }: any = useImageEditorContext();
  const { size }: any = useEditor();
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState<"" | ArtworkSource>("");
  const [items, setItems] = React.useState<Artwork[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [addingId, setAddingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);

  const fetchArtworks = React.useCallback(
    async ({
      nextOffset,
      append,
    }: {
      nextOffset: number;
      append: boolean;
    }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const result = await searchArtworks({
          q: query.trim(),
          source,
          limit: SEARCH_LIMIT,
          offset: nextOffset,
        });

        if (requestIdRef.current !== requestId) return;

        setItems((current) =>
          append ? [...current, ...result.items] : result.items,
        );
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
        const width = Math.min(size?.width || canvasSize.width, canvasSize.width);
        const img = await imageEditorTools.addImageFromUrl({
          url: artwork.image.url,
          width,
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

        setModalOpen(false);
      } catch (e) {
        console.error(e);
        setError(t("Could not add artwork. Please try another image."));
      } finally {
        setAddingId(null);
      }
    },
    [addingId, imageEditorTools, setModalOpen, size?.width, t],
  );

  const hasMore = items.length < total;

  return (
    <div className={styles.artBrowser}>
      <div className={styles.controls}>
        <TextInput
          labelText={<Trans>Search</Trans>}
          placeholder={t("Landscape, icon, flower...")}
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(event.target.value)
          }
        />
        <Select
          labelText={<Trans>Source</Trans>}
          value={source}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            setSource(event.target.value as "" | ArtworkSource)
          }
        >
          {sourceOptions.map((option) => (
            <SelectItem
              key={option.value || "all"}
              value={option.value}
              text={t(option.label)}
            />
          ))}
        </Select>
      </div>

      <div className={styles.filters}>
        <div className={styles.resultsMeta}>
          {isLoading ? (
            <Trans>Loading...</Trans>
          ) : (
            t("{{count}} artworks", { count: total })
          )}
        </div>
      </div>

      {error && <div className={styles.message}>{error}</div>}

      {!error && items.length === 0 && !isLoading && (
        <div className={styles.message}>
          <Trans>No artworks found.</Trans>
        </div>
      )}

      {!error && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((artwork) => {
            const creator = getArtworkCreator(artwork);
            const isAdding = addingId === artwork.id;

            return (
              <button
                key={artwork.id}
                type="button"
                className={styles.item}
                disabled={isAdding}
                onClick={() => void addArtwork(artwork)}
              >
                <img
                  className={styles.preview}
                  src={artwork.image.url}
                  alt={artwork.title}
                  loading="lazy"
                />
                <div className={styles.itemTitle}>{artwork.title}</div>
                <div className={styles.itemMeta}>
                  {creator && <div>{creator}</div>}
                  <div>{artwork.license}</div>
                  <div>{artwork.source}</div>
                </div>
                <div className={styles.itemAction}>
                  {isAdding ? <Trans>Adding...</Trans> : <Trans>Add</Trans>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className={styles.footer}>
          <div className={styles.actions}>
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
              <Trans>Load more</Trans>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArtBrowser() {
  return (
    <EditorButton
      id="artBrowser"
      kind="secondary"
      text={<Trans>Art</Trans>}
      icon={<FontAwesomeIcon icon={faPalette} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Art browser</Trans>}
    />
  );
}
