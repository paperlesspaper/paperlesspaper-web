import React from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faPlus,
  faPen,
  faTrash,
  faCheck,
} from "@fortawesome/pro-solid-svg-icons";
import type { SelectedImage } from "./MultiImageUploadEditor";
import styles from "./multiImageUploadEditor.module.scss";

type Props = {
  images: SelectedImage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  disabled: boolean;
};

export default function ImageUploadCarousel({
  images,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
  onAdd,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const trackRef = React.useRef<HTMLDivElement>(null);
  const thumbnailRef = React.useRef<HTMLButtonElement>(null);
  const index = Math.max(
    0,
    images.findIndex((image) => image.id === selectedId)
  );
  const current = images[index];
  const indexRef = React.useRef(index);
  indexRef.current = index;
  const status = (image: SelectedImage) =>
    t(
      image.status === "uploaded"
        ? "Uploaded"
        : image.status === "failed"
        ? "Upload failed"
        : image.status === "uploading"
        ? "Uploading…"
        : "Pending"
    );

  // Native scroll snapping supports touch, trackpads and browser zoom without
  // turning vertical scrolling into a custom drag gesture.
  React.useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const align = () =>
      track.scrollTo?.({
        left: indexRef.current * track.clientWidth,
        behavior: "instant",
      });
    align();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    observer?.observe(track);
    return () => observer?.disconnect();
  }, [images.length]);

  React.useEffect(() => {
    thumbnailRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [current?.id]);

  const select = (next: number) => {
    if (!disabled && images[next]) {
      trackRef.current?.scrollTo?.({
        left: next * trackRef.current.clientWidth,
        behavior: "instant",
      });
      onSelect(images[next].id);
    }
  };

  if (!current) return null;

  return (
    <section className={styles.carousel} aria-label={t("Selected images")}>
      <div className={styles.stage}>
        <div className={styles.counter} aria-live="polite" aria-atomic="true">
          {index + 1} / {images.length}
        </div>
        <div
          className={styles.track}
          ref={trackRef}
          tabIndex={0}
          aria-label={t("Image preview")}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            select(index + (event.key === "ArrowRight" ? 1 : -1));
          }}
          onScroll={() => {
            const track = trackRef.current;
            if (!track?.clientWidth || disabled) return;
            const next = Math.round(track.scrollLeft / track.clientWidth);
            if (next !== index && images[next]) onSelect(images[next].id);
          }}
        >
          {images.map((image, i) => (
            <figure
              className={styles.slide}
              key={image.id}
              aria-hidden={i !== index}
            >
              {image.status === "uploaded" ? (
                <div className={styles.uploaded}>
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t("Uploaded")}</span>
                </div>
              ) : (
                <img
                  src={image.editorState?.previewUrl || image.imageUrl}
                  alt={image.fileName}
                  loading={i === index ? "eager" : "lazy"}
                  draggable={false}
                />
              )}
              <figcaption className={styles.srOnly}>
                <p>
                  {i + 1}. {image.fileName} — {status(image)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.previous}`}
              aria-label={t("Previous image")}
              onClick={() => select(index - 1)}
              disabled={disabled || index === 0}
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.next}`}
              aria-label={t("Next image")}
              onClick={() => select(index + 1)}
              disabled={disabled || index === images.length - 1}
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </>
        )}
      </div>
      <div className={styles.details}>
        <div className={styles.imageStatus}>
          <span
            className={
              current.status === "failed" ? styles.failed : styles.status
            }
          >
            {status(current)}
          </span>
        </div>
        {current.status !== "uploaded" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.editButton}
              disabled={disabled}
              onClick={() => onEdit(current.id)}
            >
              <FontAwesomeIcon icon={faPen} />
              {t("Edit")}
            </button>
            <button
              type="button"
              className={styles.removeButton}
              disabled={disabled}
              aria-label={t("Remove")}
              title={t("Remove")}
              onClick={() => onRemove(current.id)}
            >
              <FontAwesomeIcon icon={faTrash} />
              <span className={styles.srOnly}>{t("Remove")}</span>
            </button>
          </div>
        )}
      </div>
      <div className={styles.filmstrip} aria-label={t("Selected images")}>
        {images.map((image, i) => (
          <button
            type="button"
            key={image.id}
            ref={i === index ? thumbnailRef : undefined}
            className={styles.thumbnail}
            aria-label={`${i + 1}. ${image.fileName}`}
            aria-pressed={i === index}
            disabled={disabled}
            onClick={() => select(i)}
            style={
              image.status !== "uploaded"
                ? {
                    backgroundImage: `url("${
                      image.editorState?.previewUrl || image.imageUrl
                    }")`,
                  }
                : undefined
            }
          >
            {image.status === "uploaded" ? (
              <FontAwesomeIcon icon={faCheck} />
            ) : (
              <span>{i + 1}</span>
            )}
            {image.status === "failed" && (
              <span
                className={styles.errorDot}
                aria-label={t("Upload failed")}
              />
            )}
          </button>
        ))}
        <button
          type="button"
          className={styles.addButton}
          onClick={onAdd}
          disabled={disabled}
          aria-label={t("Add images")}
          title={t("Add images")}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      </div>
    </section>
  );
}
