import React, { useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Trans } from "react-i18next";
import { Button, Empty, InlineLoading } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InlineLoadingLarge from "components/InlineLoadingLarge";
import { papersApi } from "ducks/ePaper/papersApi";
import { devicesApi } from "ducks/devices";
import { formatDistanceToNow } from "date-fns";
import { applicationsOnlyIcons } from "../Integrations/applications";
import styles from "./library.module.scss";
import IntegrationEditor from "../EditorWrapper/IntegrationEditor";
import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import { faFrame } from "@fortawesome/pro-light-svg-icons";
import ImagePreviewOverlay, {
  type ImagePreviewData,
} from "./ImagePreviewOverlay";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

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
};

const LONG_PRESS_MS = 450;

export function LibraryCard({
  paper,
  organization,
  deviceName,
  disableNavigation = false,
  onPreview,
}: LibraryCardProps) {
  const history = useHistory();
  const integrationIcon = paper?.kind
    ? applicationsOnlyIcons[paper.kind]?.iconSimple
    : null;

  const suppressNextClickRef = useRef(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: "original.png" },
    },
    { skip: !paper?.id },
  );

  const updatedAt = paper?.imageUpdatedAt || paper?.updatedAt;
  const relativeUpdatedAt = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
    : null;

  const onOpen = (event?: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event?.preventDefault();
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

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const startLongPressTimer = () => {
    if (!onPreview) return;
    if (!image.data?.signedUrl) return;
    if (!paper?.deviceId) return;

    clearLongPressTimer();
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;

      // Provide tactile feedback right when the long-press activates.
      // Safe no-op on unsupported platforms.
      if (
        Capacitor.isNativePlatform() &&
        Capacitor.isPluginAvailable("Haptics")
      ) {
        void Haptics.impact({ style: ImpactStyle.Medium }).catch((error) => {
          console.warn("Haptics.impact failed", error);
        });
      } else {
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

  const onTouchStartPreview: React.TouchEventHandler<HTMLImageElement> = (
    e,
  ) => {
    if (isDisabled) return;
    if (disableNavigation) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    startLongPressTimer();
  };

  const onTouchMovePreview: React.TouchEventHandler<HTMLImageElement> = (e) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearLongPressTimer();
    }
  };

  const onTouchEndPreview: React.TouchEventHandler<HTMLImageElement> = () => {
    touchStartPosRef.current = null;
    clearLongPressTimer();
  };

  const onTouchCancelPreview: React.TouchEventHandler<
    HTMLImageElement
  > = () => {
    touchStartPosRef.current = null;
    clearLongPressTimer();
  };

  return (
    <a
      type="button"
      className={`${styles.card} ${isDisabled ? styles.disabled : ""}`}
      onClick={onOpen}
      onContextMenu={(e) => e.preventDefault()}
      // disabled={isDisabled}
      aria-disabled={isDisabled || disableNavigation}
    >
      <div className={styles.preview}>
        {image.isFetching ? (
          <InlineLoading />
        ) : image.data?.signedUrl ? (
          <img
            src={image.data.signedUrl}
            alt={paper.name || paper.kind || "Paper preview"}
            className={styles.previewImage}
            draggable={false}
            onTouchStart={onTouchStartPreview}
            onTouchMove={onTouchMovePreview}
            onTouchEnd={onTouchEndPreview}
            onTouchCancel={onTouchCancelPreview}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          />
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

  const entries = papers.data || [];

  if (!entries.length) {
    return (
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
    );
  }

  return (
    <>
      <IntegrationEditor />
      <ImagePreviewOverlay preview={preview} onClose={() => setPreview(null)} />
      <div className={styles.libraryPage}>
        <div className={styles.header}>
          <h3>
            <Trans>Library</Trans>
          </h3>

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
        </div>

        <div className={styles.grid}>
          {entries.map((paper: PaperEntry) => (
            <LibraryCard
              key={paper.id}
              paper={paper}
              organization={organization}
              deviceName={
                paper?.deviceId ? deviceLookup[paper.deviceId] : undefined
              }
              onPreview={(data) => setPreview(data)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
