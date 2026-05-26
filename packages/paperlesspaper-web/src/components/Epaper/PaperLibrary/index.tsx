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
import { faFrame } from "@fortawesome/pro-light-svg-icons";
import { faCheck, faTimes } from "@fortawesome/pro-solid-svg-icons";
import { faTrashAlt } from "@fortawesome/pro-regular-svg-icons";
import ImagePreviewOverlay, {
  type ImagePreviewData,
} from "./ImagePreviewOverlay";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { isMobile } from "react-device-detect";

type PaperEntry = {
  id: string;
  name?: string;
  kind?: string;
  meta?: Record<string, any>;
  deviceId?: string;
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
  const selectionPaintRef = useRef<SelectionPaintGesture | null>(null);
  const suppressNextSelectionClickRef = useRef(false);

  const [deletePaper] = papersApi.useDeleteSinglePapersMutation();

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
  const selectedCount = selectedPaperIds.size;
  const selectionMode = isSelecting;

  const clearSelection = () => {
    setIsSelecting(false);
    setSelectedPaperIds(new Set());
    setDeleteError(null);
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
