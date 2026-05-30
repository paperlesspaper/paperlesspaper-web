import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Trans } from "react-i18next";
import { Button, Empty, InlineLoading, Modal } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InlineLoadingLarge from "components/InlineLoadingLarge";
import { papersApi } from "ducks/ePaper/papersApi";
import { devicesApi } from "ducks/devices";
import { applicationsOnlyIcons } from "../Integrations/applications";
import styles from "./library.module.scss";
import IntegrationEditor from "../EditorWrapper/IntegrationEditor";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import MultiCheckbox from "components/MultiCheckbox";
import MultiCheckboxWrapper from "components/MultiCheckbox/MultiCheckboxWrapper";
import { faFrame } from "@fortawesome/pro-light-svg-icons";
import { faCheck, faTimes } from "@fortawesome/pro-solid-svg-icons";
import {
  faRectangleVertical,
  faTrashAlt,
} from "@fortawesome/pro-regular-svg-icons";
import ImagePreviewOverlay, {
  type ImagePreviewData,
} from "./ImagePreviewOverlay";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { isMobile } from "react-device-detect";
import { v4 as uuidv4 } from "uuid";

type PaperEntry = {
  id: string;
  name?: string;
  kind?: string;
  meta?: Record<string, any>;
  deviceId?: string;
  organization?: string;
  updatedAt?: string;
  imageUpdatedAt?: string;
};

type LibraryCardProps = {
  paper: PaperEntry;
  organization: string;
  deviceName?: string;
  disableNavigation?: boolean;
  onPreview?: (data: ImagePreviewData) => void;
  isSelecting?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (paperId: string) => void;
  onStartSelection?: (
    paperId: string,
    point?: { x: number; y: number },
  ) => void;
};

type SelectionPaintGesture = {
  active: boolean;
  action: "select" | "deselect";
  didMove: boolean;
  lastPaperId?: string;
  pointerId?: number | null;
  startPaperId: string;
  startX: number;
  startY: number;
};

const LONG_PRESS_MS = 450;
const IMAGE_GENERATION_PENDING_MS = 30_000;
const NEW_SLIDESHOW_VALUE = "__new-slideshow__";

const getSelectedPaperIds = (meta?: Record<string, any>) => {
  if (!meta?.selectedPapers || typeof meta.selectedPapers !== "object") {
    return [];
  }

  return Object.entries(meta.selectedPapers)
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([paperId]) => paperId);
};

function SlideshowOptionThumb({ paper }: { paper?: PaperEntry }) {
  const [imageElementFailed, setImageElementFailed] = useState(false);
  const hasGeneratedImage = Boolean(paper?.imageUpdatedAt);

  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: "original.png" },
    },
    { skip: !paper?.id || !hasGeneratedImage },
  );

  useEffect(() => {
    setImageElementFailed(false);
  }, [image.data?.signedUrl, paper?.id, paper?.imageUpdatedAt]);

  if (image.data?.signedUrl && !imageElementFailed) {
    return (
      <img
        src={image.data.signedUrl}
        alt=""
        className={styles.slideshowPreviewImage}
        draggable={false}
        onError={() => setImageElementFailed(true)}
      />
    );
  }

  return (
    <span className={styles.slideshowPreviewPlaceholder}>
      <FontAwesomeIcon icon={faFrame} />
    </span>
  );
}

function SlideshowOptionIcon({
  paperIds,
  entryLookup,
}: {
  paperIds: string[];
  entryLookup: Record<string, PaperEntry>;
}) {
  const previewPapers = paperIds
    .slice(-4)
    .map((paperId) => entryLookup[paperId])
    .filter((paper): paper is PaperEntry => Boolean(paper));

  if (!previewPapers.length) {
    return (
      <span className={styles.emptySlideshowPreview}>
        <FontAwesomeIcon icon={faRectangleVertical} />
      </span>
    );
  }

  return (
    <span className={styles.slideshowPreviewGrid}>
      {previewPapers.map((paper) => (
        <SlideshowOptionThumb key={paper.id} paper={paper} />
      ))}
    </span>
  );
}

export function LibraryCard({
  paper,
  organization,
  disableNavigation = false,
  onPreview,
  isSelecting = false,
  isSelected = false,
  onToggleSelection,
  onStartSelection,
}: LibraryCardProps) {
  const history = useHistory();
  const integrationIcon = paper?.kind
    ? applicationsOnlyIcons[paper.kind]?.iconSimple
    : null;

  const suppressNextClickRef = useRef(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [imageElementFailed, setImageElementFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hasGeneratedImage = Boolean(paper?.imageUpdatedAt);

  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: "original.png" },
    },
    { skip: !paper?.id || !hasGeneratedImage },
  );

  const onOpen = (event?: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event?.preventDefault();
      return;
    }

    if (isSelecting) {
      event?.preventDefault();
      onToggleSelection?.(paper.id);
      return;
    }

    if (disableNavigation) {
      event?.preventDefault();
      return;
    }

    if (!paper?.deviceId) return;
    history.push(
      `/${organization}/library/device/${paper.deviceId}/${paper.id}`,
    );
  };

  const isDisabled = !paper?.deviceId;
  const hasSignedUrl = Boolean(image.data?.signedUrl);
  const updatedAtTime = paper?.updatedAt ? Date.parse(paper.updatedAt) : NaN;
  const imageGenerationPendingUntil = Number.isNaN(updatedAtTime)
    ? 0
    : updatedAtTime + IMAGE_GENERATION_PENDING_MS;
  const imageGenerationPending =
    !hasGeneratedImage && imageGenerationPendingUntil > now;
  const imageLoading =
    imageGenerationPending ||
    (!hasSignedUrl && (image.isLoading || image.isFetching));

  useEffect(() => {
    setImageElementFailed(false);
  }, [image.data?.signedUrl, paper.id, paper.imageUpdatedAt]);

  useEffect(() => {
    setNow(Date.now());
  }, [paper.id, paper.updatedAt]);

  useEffect(() => {
    if (!imageGenerationPending) return undefined;

    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, imageGenerationPendingUntil - now);

    return () => window.clearTimeout(timeout);
  }, [imageGenerationPending, imageGenerationPendingUntil, now]);

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const triggerLongPressHaptic = () => {
    if (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable("Haptics")
    ) {
      void Haptics.impact({ style: ImpactStyle.Medium }).catch((error) => {
        console.warn("Haptics.impact failed", error);
      });
    }
  };

  const startLongPressTimer = () => {
    if (isSelecting) return;

    if (onStartSelection && paper?.id) {
      clearLongPressTimer();
      longPressTimeoutRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = true;
        triggerLongPressHaptic();
        onStartSelection(paper.id, pressStartPosRef.current || undefined);
      }, LONG_PRESS_MS);
      return;
    }

    if (!onPreview) return;
    if (imageLoading) return;
    if (!image.data?.signedUrl) return;
    if (!paper?.deviceId) return;

    clearLongPressTimer();
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;

      // Provide tactile feedback right when the long-press activates.
      // Safe no-op on unsupported platforms.
      triggerLongPressHaptic();
      if (
        !Capacitor.isNativePlatform() ||
        !Capacitor.isPluginAvailable("Haptics")
      ) {
        // Helpful when testing in desktop browsers / mobile Safari.
        // Also indicates a missing native plugin integration (e.g. iOS Podfile / Android sync).
        console.debug("Haptics unavailable", {
          isNative: Capacitor.isNativePlatform(),
          hasPlugin: Capacitor.isPluginAvailable("Haptics"),
          platform: Capacitor.getPlatform(),
        });
      }

      onPreview({
        url: image.data!.signedUrl,
        alt: paper.name || paper.kind || "Paper preview",
        onEdit: () => {
          history.push(
            `/${organization}/library/device/${paper.deviceId}/${paper.id}`,
          );
        },
      });
    }, LONG_PRESS_MS);
  };

  const canStartLongPress = () => {
    if (isDisabled && !onStartSelection) return;
    if (disableNavigation) return;
    if (isSelecting) return;

    return true;
  };

  const onPointerDownCard: React.PointerEventHandler<HTMLAnchorElement> = (
    e,
  ) => {
    if (e.button !== 0) return;
    if (!canStartLongPress()) return;

    activePointerIdRef.current = e.pointerId;
    pressStartPosRef.current = { x: e.clientX, y: e.clientY };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is not available in every WebView/browser.
    }

    startLongPressTimer();
  };

  const onPointerMoveCard: React.PointerEventHandler<HTMLAnchorElement> = (
    e,
  ) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    if (!pressStartPosRef.current) return;

    const dx = Math.abs(e.clientX - pressStartPosRef.current.x);
    const dy = Math.abs(e.clientY - pressStartPosRef.current.y);
    if (dx > 12 || dy > 12) {
      clearLongPressTimer();
    }
  };

  const clearPressGesture = (pointerId?: number) => {
    if (
      pointerId !== undefined &&
      activePointerIdRef.current !== null &&
      activePointerIdRef.current !== pointerId
    ) {
      return;
    }

    pressStartPosRef.current = null;
    activePointerIdRef.current = null;
    clearLongPressTimer();
  };

  const onPointerEndCard: React.PointerEventHandler<HTMLAnchorElement> = (
    e,
  ) => {
    clearPressGesture(e.pointerId);
  };

  const onTouchStartCardCapture: React.TouchEventHandler<HTMLAnchorElement> = (
    e,
  ) => {
    if (!canStartLongPress()) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    pressStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    activePointerIdRef.current = null;
    startLongPressTimer();
  };

  const onTouchMoveCardCapture: React.TouchEventHandler<HTMLAnchorElement> = (
    e,
  ) => {
    if (!pressStartPosRef.current) return;
    if (e.touches.length !== 1) {
      clearPressGesture();
      return;
    }

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - pressStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - pressStartPosRef.current.y);
    if (dx > 12 || dy > 12) {
      clearLongPressTimer();
    }
  };

  const onTouchEndCardCapture = () => {
    clearPressGesture();
  };

  const onContextMenuCard: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();

    if (!canStartLongPress()) return;
    if (!onStartSelection || !paper?.id) return;

    suppressNextClickRef.current = true;
    clearPressGesture();
    triggerLongPressHaptic();
    onStartSelection(paper.id, pressStartPosRef.current || undefined);
  };

  return (
    <a
      type="button"
      className={`${styles.card} ${isDisabled ? styles.disabled : ""} ${
        isSelecting ? styles.cardSelecting : ""
      } ${isSelected ? styles.cardSelected : ""}`}
      onClick={onOpen}
      onContextMenu={onContextMenuCard}
      onPointerDown={onPointerDownCard}
      onPointerMove={onPointerMoveCard}
      onPointerUp={onPointerEndCard}
      onPointerCancel={onPointerEndCard}
      onLostPointerCapture={onPointerEndCard}
      onTouchStartCapture={onTouchStartCardCapture}
      onTouchMoveCapture={onTouchMoveCardCapture}
      onTouchEndCapture={onTouchEndCardCapture}
      onTouchCancelCapture={onTouchEndCardCapture}
      // disabled={isDisabled}
      aria-disabled={isSelecting ? false : isDisabled || disableNavigation}
      aria-pressed={isSelecting ? isSelected : undefined}
      data-paper-id={paper.id}
    >
      <div className={styles.preview}>
        {image.data?.signedUrl && !imageElementFailed ? (
          <img
            key={`${paper.imageUpdatedAt || ""}-${image.data.signedUrl}`}
            src={image.data.signedUrl}
            alt={paper.name || paper.kind || "Paper preview"}
            className={styles.previewImage}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onError={() => {
              setImageElementFailed(true);
            }}
          />
        ) : imageLoading ? (
          <div className={styles.loadingImage}>
            <InlineLoading description={<Trans>Loading image...</Trans>} />
          </div>
        ) : (
          <div className={styles.previewPlaceholder}>
            <Trans>No preview available</Trans>
          </div>
        )}
        {integrationIcon ? (
          <span className={styles.integrationIcon} aria-hidden="true">
            <FontAwesomeIcon icon={integrationIcon} />
          </span>
        ) : null}
        {isSelecting ? (
          <span className={styles.selectionBadge} aria-hidden="true">
            {isSelected ? <FontAwesomeIcon icon={faCheck} /> : null}
          </span>
        ) : null}
      </div>
      {/*<div className={styles.meta}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            {paper?.name || <Trans>Untitled paper</Trans>}
          </div>
          {paper?.kind ? (
            <span className={styles.kind}>{paper.kind}</span>
          ) : null}
        </div>
     <div className={styles.metaRow}>
          <span className={styles.device}>
            {deviceName || <Trans>Unknown device</Trans>}
          </span>
          {relativeUpdatedAt ? (
            <span className={styles.updated}>
              <Trans>Updated</Trans> {relativeUpdatedAt}
            </span>
          ) : null}
        </div> 
      </div>*/}
    </a>
  );
}

export default function PaperLibrary() {
  const { organization } = useParams<{ organization: string }>();

  const [preview, setPreview] = useState<ImagePreviewData | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [slideshowModalOpen, setSlideshowModalOpen] = useState(false);
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>(
    NEW_SLIDESHOW_VALUE,
  );
  const [newSlideshowName, setNewSlideshowName] = useState("");
  const [isSavingSlideshow, setIsSavingSlideshow] = useState(false);
  const [slideshowError, setSlideshowError] = useState<string | null>(null);
  const selectionPaintRef = useRef<SelectionPaintGesture | null>(null);
  const suppressNextSelectionClickRef = useRef(false);

  const [deletePaper] = papersApi.useDeleteSinglePapersMutation();
  const [createPaper] = papersApi.useCreateSinglePapersMutation();
  const [updatePaper] = papersApi.useUpdateSinglePapersMutation();
  const [uploadSingleImage] = papersApi.useUploadSingleImageMutation();

  const papers = papersApi.useGetAllPapersQuery(
    {
      organizationId: organization,
      queryOptions: {
        sortBy: "updatedAt:desc",
      },
    },
    { skip: !organization },
  );

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization },
  );

  const deviceLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    devices.data?.forEach((device: any) => {
      const label = device?.name || device?.deviceId || device?.id;
      if (device?.id) {
        lookup[device.id] = label;
      }
    });
    return lookup;
  }, [devices.data]);

  const entries = papers.data || [];
  const entryLookup = useMemo(() => {
    const lookup: Record<string, PaperEntry> = {};
    entries.forEach((paper: PaperEntry) => {
      lookup[paper.id] = paper;
    });
    return lookup;
  }, [entries]);
  const slideshowEntries = useMemo(
    () =>
      entries.filter(
        (paper: PaperEntry) =>
          paper.kind === "slides" && !selectedPaperIds.has(paper.id),
      ),
    [entries, selectedPaperIds],
  );
  const selectedSlideSourcePapers = useMemo(
    () =>
      Array.from(selectedPaperIds)
        .map((paperId) => entryLookup[paperId])
        .filter(
          (paper): paper is PaperEntry =>
            Boolean(paper) && paper.kind !== "slides",
        ),
    [entryLookup, selectedPaperIds],
  );
  const selectedCount = selectedPaperIds.size;
  const selectedSlideSourceCount = selectedSlideSourcePapers.length;
  const selectionMode = isSelecting;

  const clearSelection = () => {
    setIsSelecting(false);
    setSelectedPaperIds(new Set());
    setDeleteError(null);
    setSlideshowError(null);
  };

  const togglePaperSelection = (paperId: string) => {
    if (suppressNextSelectionClickRef.current) {
      suppressNextSelectionClickRef.current = false;
      return;
    }

    setSelectedPaperIds((current) => {
      const next = new Set(current);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });

    if (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable("Haptics")
    ) {
      void Haptics.impact({ style: ImpactStyle.Light }).catch((error) => {
        console.warn("Haptics.impact failed", error);
      });
    }
  };

  const setPaperSelection = (paperId: string, shouldSelect: boolean) => {
    setSelectedPaperIds((current) => {
      if (shouldSelect && current.has(paperId)) return current;
      if (!shouldSelect && !current.has(paperId)) return current;

      const next = new Set(current);
      if (shouldSelect) {
        next.add(paperId);
      } else {
        next.delete(paperId);
      }
      return next;
    });
  };

  const getPaperIdAtPoint = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y);
    if (!(target instanceof HTMLElement)) return undefined;
    return target.closest<HTMLElement>("[data-paper-id]")?.dataset.paperId;
  };

  const beginSelectionPaint = ({
    paperId,
    x,
    y,
    pointerId = null,
    action,
    didMove = false,
  }: {
    paperId: string;
    x: number;
    y: number;
    pointerId?: number | null;
    action?: "select" | "deselect";
    didMove?: boolean;
  }) => {
    const nextAction =
      action || (selectedPaperIds.has(paperId) ? "deselect" : "select");

    selectionPaintRef.current = {
      active: true,
      action: nextAction,
      didMove,
      lastPaperId: didMove ? paperId : undefined,
      pointerId,
      startPaperId: paperId,
      startX: x,
      startY: y,
    };

    if (didMove) {
      suppressNextSelectionClickRef.current = true;
      setPaperSelection(paperId, nextAction === "select");
    }
  };

  const paintSelectionAtPoint = (x: number, y: number) => {
    const gesture = selectionPaintRef.current;
    if (!gesture?.active) return false;

    const dx = Math.abs(x - gesture.startX);
    const dy = Math.abs(y - gesture.startY);
    if (!gesture.didMove && Math.max(dx, dy) <= 8) return false;

    if (!gesture.didMove) {
      gesture.didMove = true;
      suppressNextSelectionClickRef.current = true;
      setPaperSelection(gesture.startPaperId, gesture.action === "select");
    }

    const paperId = getPaperIdAtPoint(x, y);
    if (!paperId || paperId === gesture.lastPaperId) return gesture.didMove;

    gesture.lastPaperId = paperId;
    setPaperSelection(paperId, gesture.action === "select");
    return true;
  };

  const endSelectionPaint = (pointerId?: number | null) => {
    const gesture = selectionPaintRef.current;
    if (!gesture) return;
    if (
      pointerId !== undefined &&
      gesture.pointerId !== null &&
      gesture.pointerId !== pointerId
    ) {
      return;
    }

    if (gesture.didMove) {
      suppressNextSelectionClickRef.current = true;
      window.setTimeout(() => {
        suppressNextSelectionClickRef.current = false;
      }, 350);
    }

    selectionPaintRef.current = null;
  };

  const startPaperSelection = (
    paperId: string,
    point?: { x: number; y: number },
  ) => {
    setIsSelecting(true);
    setDeleteError(null);
    setPaperSelection(paperId, true);

    if (point) {
      suppressNextSelectionClickRef.current = true;
      beginSelectionPaint({
        paperId,
        x: point.x,
        y: point.y,
        action: "select",
        didMove: true,
      });
    }
  };

  const startSelectionPaintFromPoint = (
    x: number,
    y: number,
    pointerId?: number | null,
  ) => {
    if (!selectionMode) return;
    const paperId = getPaperIdAtPoint(x, y);
    if (!paperId) return;

    beginSelectionPaint({ paperId, x, y, pointerId });
  };

  const onGridPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (e.button !== 0) return;
    startSelectionPaintFromPoint(e.clientX, e.clientY, e.pointerId);
  };

  const onGridPointerMoveCapture: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    const gesture = selectionPaintRef.current;
    if (!gesture?.active) return;
    if (gesture.pointerId !== null && gesture.pointerId !== e.pointerId) return;

    if (paintSelectionAtPoint(e.clientX, e.clientY)) {
      e.preventDefault();
    }
  };

  const onGridPointerEndCapture: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    endSelectionPaint(e.pointerId);
  };

  const onGridTouchStartCapture: React.TouchEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startSelectionPaintFromPoint(touch.clientX, touch.clientY, null);
  };

  const onGridTouchMoveCapture: React.TouchEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (e.touches.length !== 1) {
      endSelectionPaint();
      return;
    }

    const touch = e.touches[0];
    if (paintSelectionAtPoint(touch.clientX, touch.clientY)) {
      e.preventDefault();
    }
  };

  const onGridTouchEndCapture = () => {
    endSelectionPaint();
  };

  const deleteSelectedPapers = async () => {
    const ids = Array.from(selectedPaperIds);
    if (!ids.length || isDeletingSelected) return;

    setIsDeletingSelected(true);
    setDeleteError(null);

    try {
      await Promise.all(ids.map((id) => deletePaper({ id }).unwrap()));
      setConfirmDeleteOpen(false);
      clearSelection();
    } catch (error) {
      console.error("Failed to delete selected papers", error);
      setDeleteError("Could not delete the selected pictures.");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const openSlideshowModal = () => {
    setSelectedSlideshowId(slideshowEntries[0]?.id || NEW_SLIDESHOW_VALUE);
    setNewSlideshowName("");
    setSlideshowError(null);
    setSlideshowModalOpen(true);
  };

  const getSelectedPapersMap = () =>
    Object.fromEntries(
      selectedSlideSourcePapers.map((paper) => [paper.id, true]),
    );

  const addSelectedPapersToSlideshow = async () => {
    if (!selectedSlideSourceCount || isSavingSlideshow) return;

    setIsSavingSlideshow(true);
    setSlideshowError(null);

    try {
      const selectedPapersMap = getSelectedPapersMap();
      let targetSlideshow: PaperEntry | undefined;

      if (selectedSlideshowId === NEW_SLIDESHOW_VALUE) {
        const targetDeviceId = selectedSlideSourcePapers.find(
          (paper) => paper.deviceId,
        )?.deviceId;
        const targetDevice = targetDeviceId
          ? devices.data?.find((device: any) => device.id === targetDeviceId)
          : null;
        const sourceOrientation =
          selectedSlideSourcePapers.find((paper) => paper.meta?.orientation)
            ?.meta?.orientation || "portrait";

        const createdPaper = await createPaper({
          values: {
            name: newSlideshowName.trim() || undefined,
            organization,
            kind: "slides",
            deviceId: targetDeviceId,
            meta: {
              id: uuidv4(),
              lut: "default",
              orientation: sourceOrientation,
              frameKind: targetDevice?.kind,
              deviceId: targetDeviceId,
              selectedPapers: selectedPapersMap,
              currentSlide: 0,
            },
          },
        }).unwrap();

        targetSlideshow = createdPaper;
      } else {
        const slideshow = entryLookup[selectedSlideshowId];
        if (!slideshow) {
          throw new Error("Slideshow not found");
        }

        const slideshowMeta = slideshow.meta || {};
        const nextSelectedPapers = {
          ...(slideshowMeta.selectedPapers || {}),
          ...selectedPapersMap,
        };

        await updatePaper({
          id: slideshow.id,
          values: {
            deviceId: slideshow.deviceId,
            kind: slideshow.kind,
            organization: slideshow.organization,
            meta: {
              ...slideshowMeta,
              selectedPapers: nextSelectedPapers,
              currentSlide: Number.isInteger(slideshowMeta.currentSlide)
                ? slideshowMeta.currentSlide
                : 0,
            },
          },
        }).unwrap();

        targetSlideshow = {
          ...slideshow,
          meta: {
            ...slideshowMeta,
            selectedPapers: nextSelectedPapers,
          },
        };
      }

      if (targetSlideshow?.id && targetSlideshow.deviceId) {
        await uploadSingleImage({
          body: new FormData(),
          id: targetSlideshow.id,
          deviceId: targetSlideshow.deviceId,
        }).unwrap();
      }

      setSlideshowModalOpen(false);
      clearSelection();
    } catch (error) {
      console.error("Failed to add selected papers to slideshow", error);
      setSlideshowError(
        "Could not add the selected pictures to the slideshow.",
      );
    } finally {
      setIsSavingSlideshow(false);
    }
  };

  useEffect(() => {
    if (!selectedPaperIds.size) return;

    if (!entries.length) {
      setSelectedPaperIds(new Set());
      return;
    }

    const entryIds = new Set(entries.map((paper: PaperEntry) => paper.id));
    setSelectedPaperIds((current) => {
      const next = new Set(
        Array.from(current).filter((paperId) => entryIds.has(paperId)),
      );

      if (next.size === current.size) return current;
      return next;
    });
  }, [entries, selectedPaperIds.size]);

  if (papers.isLoading || devices.isLoading) {
    return (
      <InlineLoadingLarge description={<Trans>Loading library...</Trans>} />
    );
  }

  if (papers.isError || devices.isError) {
    return (
      <Empty
        title={<Trans>Could not load the library</Trans>}
        button={
          <Button onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>
        }
      >
        <Trans>Please check your connection and try again.</Trans>
      </Empty>
    );
  }

  return (
    <>
      <IntegrationEditor />
      <ImagePreviewOverlay preview={preview} onClose={() => setPreview(null)} />
      {confirmDeleteOpen ? (
        <Modal
          open
          modalHeading={<Trans>Delete pictures</Trans>}
          primaryButtonText={
            isDeletingSelected ? (
              <Trans>Deleting...</Trans>
            ) : (
              <Trans>Delete</Trans>
            )
          }
          secondaryButtonText={<Trans>Cancel</Trans>}
          onRequestSubmit={deleteSelectedPapers}
          onSecondarySubmit={() => setConfirmDeleteOpen(false)}
          onRequestClose={() => setConfirmDeleteOpen(false)}
          primaryButtonDisabled={!selectedCount || isDeletingSelected}
          danger
        >
          <p>
            <Trans values={{ count: selectedCount }}>
              Are you sure that you want to delete the selected pictures?
            </Trans>
          </p>
          {deleteError ? (
            <p className={styles.deleteError}>{deleteError}</p>
          ) : null}
        </Modal>
      ) : null}
      {slideshowModalOpen ? (
        <Modal
          open
          modalHeading={<Trans>Add to slideshow</Trans>}
          primaryButtonText={
            isSavingSlideshow ? (
              <Trans>Adding...</Trans>
            ) : selectedSlideshowId === NEW_SLIDESHOW_VALUE ? (
              <Trans>Create slideshow</Trans>
            ) : (
              <Trans>Add to slideshow</Trans>
            )
          }
          secondaryButtonText={<Trans>Cancel</Trans>}
          onRequestSubmit={addSelectedPapersToSlideshow}
          onSecondarySubmit={() => setSlideshowModalOpen(false)}
          onRequestClose={() => setSlideshowModalOpen(false)}
          primaryButtonDisabled={
            !selectedSlideSourceCount || isSavingSlideshow
          }
        >
          <div className={styles.slideshowModal}>
            <p className={styles.slideshowIntro}>
              <Trans values={{ count: selectedSlideSourceCount }}>
                Add {{ count: selectedSlideSourceCount }} selected pictures to a
                slideshow.
              </Trans>
            </p>

            <MultiCheckboxWrapper className={styles.slideshowChoices}>
              {slideshowEntries.map((paper: PaperEntry) => (
                <MultiCheckbox
                  key={paper.id}
                  type="radio"
                  name="slideshowSelection"
                  value={paper.id}
                  checked={selectedSlideshowId === paper.id}
                  onChange={() => setSelectedSlideshowId(paper.id)}
                  disabled={isSavingSlideshow}
                  labelText={null}
                  aria-label={paper.name || "Slideshow"}
                  title={paper.name || "Slideshow"}
                  icon={
                    <SlideshowOptionIcon
                      paperIds={getSelectedPaperIds(paper.meta)}
                      entryLookup={entryLookup}
                    />
                  }
                  className={styles.slideshowChoice}
                  fullWidth
                />
              ))}

              <MultiCheckbox
                type="radio"
                name="slideshowSelection"
                value={NEW_SLIDESHOW_VALUE}
                checked={selectedSlideshowId === NEW_SLIDESHOW_VALUE}
                onChange={() => setSelectedSlideshowId(NEW_SLIDESHOW_VALUE)}
                disabled={isSavingSlideshow}
                labelText={null}
                aria-label="Create new slideshow"
                title="Create new slideshow"
                icon={
                  <SlideshowOptionIcon
                    paperIds={selectedSlideSourcePapers.map(
                      (paper) => paper.id,
                    )}
                    entryLookup={entryLookup}
                  />
                }
                className={styles.slideshowChoice}
                fullWidth
              />
            </MultiCheckboxWrapper>

            {selectedSlideshowId === NEW_SLIDESHOW_VALUE ? (
              <label className={styles.modalField}>
                <span>
                  <Trans>Name</Trans>
                </span>
                <input
                  className={styles.textInput}
                  value={newSlideshowName}
                  onChange={(event) =>
                    setNewSlideshowName(event.currentTarget.value)
                  }
                  placeholder="Slideshow"
                  disabled={isSavingSlideshow}
                />
              </label>
            ) : null}

            {selectedCount > selectedSlideSourceCount ? (
              <p className={styles.slideshowNote}>
                <Trans>
                  Selected slideshow papers will be skipped.
                </Trans>
              </p>
            ) : null}

            {slideshowError ? (
              <p className={styles.deleteError}>{slideshowError}</p>
            ) : null}
          </div>
        </Modal>
      ) : null}
      <div className={styles.libraryPage}>
        <div className={styles.header}>
          <h3>
            {selectionMode ? (
              <Trans values={{ count: selectedCount }}>
                {{ count: selectedCount }} selected
              </Trans>
            ) : (
              <Trans>Library</Trans>
            )}
          </h3>

          <div className={styles.headerActions}>
            {selectionMode ? (
              <>
                <Button
                  kind="secondary"
                  onClick={clearSelection}
                  icon={<FontAwesomeIcon icon={faTimes} />}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  kind="secondary"
                  disabled={!selectedSlideSourceCount || isSavingSlideshow}
                  onClick={openSlideshowModal}
                  aria-label="Add selected pictures to slideshow"
                  title="Add selected pictures to slideshow"
                  icon={<FontAwesomeIcon icon={faRectangleVertical} />}
                >
                  <Trans>Add to slideshow</Trans>
                </Button>
                {isMobile ? (
                  <Button
                    kind="danger"
                    disabled={!selectedCount}
                    onClick={() => setConfirmDeleteOpen(true)}
                    aria-label="Delete selected pictures"
                    title="Delete selected pictures"
                    className={styles.deleteButton}
                    icon={<FontAwesomeIcon icon={faTrashAlt} />}
                  >
                    <span className={styles.deleteButtonText}>
                      <Trans>Delete</Trans>
                    </span>
                  </Button>
                ) : (
                  <Button
                    kind="danger"
                    disabled={!selectedCount}
                    onClick={() => setConfirmDeleteOpen(true)}
                    aria-label="Delete selected pictures"
                    title="Delete selected pictures"
                    className={styles.deleteButton}
                    icon={<FontAwesomeIcon icon={faTrashAlt} />}
                  />
                )}
              </>
            ) : (
              <>
                {entries.length ? (
                  <Button
                    kind="secondary"
                    onClick={() => setIsSelecting(true)}
                    aria-label="Select pictures"
                    title="Select pictures"
                    className={styles.iconOnlyButton}
                    icon={<FontAwesomeIcon icon={faCheck} />}
                  />
                ) : null}
                <NewEntryButton
                  className={styles.addButton}
                  icon={<AddIcon />}
                  kind="primary"
                  small={false}
                  iconReverse={false}
                  to={`/${organization}/library/device/new/new`}
                >
                  <Trans>New picture</Trans>
                </NewEntryButton>
              </>
            )}
          </div>
        </div>
        {!entries.length ? (
          <Empty
            title={<Trans>No pictures yet</Trans>}
            icon={<FontAwesomeIcon icon={faFrame} size="4x" />}
            button={
              <Button onClick={() => window.location.reload()}>
                <Trans>Refresh</Trans>
              </Button>
            }
          >
            <Trans>
              Create a picture see it appear here. We will show a preview once
              something is available.
            </Trans>
          </Empty>
        ) : (
          <div
            className={`${styles.grid} ${
              selectionMode ? styles.gridSelecting : ""
            }`}
            onPointerDownCapture={onGridPointerDownCapture}
            onPointerMoveCapture={onGridPointerMoveCapture}
            onPointerUpCapture={onGridPointerEndCapture}
            onPointerCancelCapture={onGridPointerEndCapture}
            onTouchStartCapture={onGridTouchStartCapture}
            onTouchMoveCapture={onGridTouchMoveCapture}
            onTouchEndCapture={onGridTouchEndCapture}
            onTouchCancelCapture={onGridTouchEndCapture}
          >
            {entries.map((paper: PaperEntry) => (
              <LibraryCard
                key={paper.id}
                paper={paper}
                organization={organization}
                deviceName={
                  paper?.deviceId ? deviceLookup[paper.deviceId] : undefined
                }
                onPreview={(data) => setPreview(data)}
                disableNavigation={selectionMode}
                isSelecting={selectionMode}
                isSelected={selectedPaperIds.has(paper.id)}
                onToggleSelection={togglePaperSelection}
                onStartSelection={startPaperSelection}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
