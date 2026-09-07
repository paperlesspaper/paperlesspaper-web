import { applicationsByKind } from "@paperlesspaper/helpers";
import {
  devAppsBaseReplacement,
  resolvePossiblyRelativeUrl,
  useLocaleDate,
  useVisibility,
} from "@internetderdinge/web";
import classNames from "classnames";
import { devicesApi } from "ducks/devices";
import { papersApi } from "ducks/ePaper/papersApi";
import formatDistanceShort from "helpers/formatDistanceShort";
import { useDebug } from "helpers/useCurrentUser";
import { useActiveUserDevice } from "helpers/useUsers";
import React, {
  type ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import useEditor from "../Integrations/ImageEditor/useEditor";
import useRotationList, {
  type Rotation,
} from "../Integrations/ImageEditor/useRotationList";
import FrameViewport from "./FrameViewport";
import IntegrationPreview from "./IntegrationPreview";
import PhotoFrameContent from "./PhotoFrameContent";
import PhotoFrameMeta from "./PhotoFrameMeta";
import styles from "./photoFrame.module.scss";
import {
  deriveDeviceImageSyncState,
  deriveDeviceSyncDisplayState,
  type FrameFinish,
  mergeUrlWithQueryParams,
  normalizeFrameFinish,
  toValidDate,
} from "./photoFrameModel";

const IMAGE_GENERATION_CUTOFF = new Date("2025-10-12");
const PENDING_SYNC_POLL_DURATION_MS = 5 * 60_000;
const PENDING_SYNC_POLL_INTERVAL_MS = 5_000;
const PENDING_SYNC_RESUME_DELAY_MS = 1_500;

export type PhotoFrameVariant = "primary" | "secondary" | "preview";

export type PhotoFramePaper = {
  id?: string;
  imageUpdatedAt?: string;
  meta?: Record<string, unknown>;
  updatedAt?: string | number | Date;
  [key: string]: unknown;
};

type PhotoFrameComponents = {
  EmptyMessage?: ComponentType<{ size: Rotation }>;
};

type PhotoFrameProps = {
  components?: PhotoFrameComponents;
  frameFinish?: FrameFinish;
  paper?: PhotoFramePaper;
  showEmpty?: (store: unknown) => boolean;
  store?: unknown;
  variant?: PhotoFrameVariant;
};

export default function PhotoFrame({
  components,
  frameFinish,
  paper,
  showEmpty,
  store,
  variant = "primary",
}: PhotoFrameProps) {
  const activeUserDevices = useActiveUserDevice();
  const foreground = useVisibility();
  const isDebug = useDebug();
  const params = useParams<{ kind?: string; entry?: string }>();
  const localeDate = useLocaleDate();
  const isPrimary = variant === "primary";
  const isPreview = variant === "preview";
  const resolvedFrameFinish = normalizeFrameFinish(
    frameFinish ?? activeUserDevices.data?.meta?.frameFinish
  );

  const deviceStatus = activeUserDevices.data?.deviceStatus;
  const { latestImageIsOnDevice, latestImageSyncIsPending } =
    deriveDeviceImageSyncState(deviceStatus);
  const imageSyncBecamePendingAtRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: "original.jpg" },
    },
    {
      skip:
        isPreview ||
        activeUserDevices.data?.id === undefined ||
        paper?.id === undefined ||
        (!paper.imageUpdatedAt &&
          new Date(paper.updatedAt as string | number | Date) >
            IMAGE_GENERATION_CUTOFF),
    }
  );

  const imageOnDevice = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: ".png" },
    },
    {
      skip:
        isPreview ||
        activeUserDevices.data?.id === undefined ||
        paper?.id === undefined ||
        !isDebug,
    }
  );

  const currentFrameImage = devicesApi.useGetImageQuery(
    {
      id: activeUserDevices.data?.id,
      uuid: "current-frame-thumbnail",
    },
    {
      skip: !isPrimary || !activeUserDevices.data?.id,
    }
  );

  const { form, setModalOpen } = useEditor();
  const watchAll = form ? form.watch() : {};
  const applicationSettings = applicationsByKind(watchAll?.kind);
  const requestedOrientation =
    watchAll?.meta?.orientation ?? paper?.meta?.orientation;
  const orientation =
    requestedOrientation === "landscape" ? "landscape" : "portrait";
  const rotationList = useRotationList();
  const size = rotationList[orientation];

  const nextDeviceSyncDate = toValidDate(deviceStatus?.nextDeviceSync);
  const nextDeviceSyncTimestamp = nextDeviceSyncDate?.getTime() ?? null;

  useEffect(() => {
    if (!isPrimary || nextDeviceSyncTimestamp === null) return;

    const intervalId = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [isPrimary, nextDeviceSyncTimestamp]);

  useEffect(() => {
    if (
      latestImageSyncIsPending &&
      imageSyncBecamePendingAtRef.current == null
    ) {
      imageSyncBecamePendingAtRef.current = Date.now();
    }

    if (!latestImageSyncIsPending) {
      imageSyncBecamePendingAtRef.current = null;
    }
  }, [latestImageSyncIsPending]);

  useEffect(() => {
    if (!foreground || !isPrimary || !activeUserDevices.refetch) return;
    if (!latestImageSyncIsPending) return;
    if (imageSyncBecamePendingAtRef.current == null) return;

    const poll = () => {
      const startedAt = imageSyncBecamePendingAtRef.current;
      if (startedAt == null) return;
      if (Date.now() - startedAt > PENDING_SYNC_POLL_DURATION_MS) return;
      activeUserDevices.refetch();
    };

    let intervalId: number | undefined;
    const resumeDelayId = window.setTimeout(() => {
      poll();
      intervalId = window.setInterval(poll, PENDING_SYNC_POLL_INTERVAL_MS);
    }, PENDING_SYNC_RESUME_DELAY_MS);

    return () => {
      window.clearTimeout(resumeDelayId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [
    activeUserDevices.refetch,
    foreground,
    isPrimary,
    latestImageSyncIsPending,
  ]);

  const [, uploadSingleImageResult] = papersApi.useUploadSingleImageMutation({
    fixedCacheKey: "upload-single-image",
  });
  const [, updatePaperMetaResult] = papersApi.useUpdateSinglePapersMutation({
    fixedCacheKey: "update-paper-meta",
  });

  useEffect(() => {
    if (
      uploadSingleImageResult.fulfilledTimeStamp &&
      activeUserDevices.refetch
    ) {
      activeUserDevices.refetch();
    }
  }, [activeUserDevices.refetch, uploadSingleImageResult.fulfilledTimeStamp]);

  const keysToKeep = applicationSettings?.settings
    ? Object.keys(applicationSettings.settings)
    : [];
  const legacySelectedMeta: Record<string, unknown> = watchAll?.meta
    ? Object.fromEntries(
        Object.entries(watchAll.meta).filter(([key]) =>
          keysToKeep.includes(key)
        )
      )
    : {};
  const pluginConfigUrl = devAppsBaseReplacement(
    watchAll?.meta?.pluginConfigUrl
  );
  const resolvedUrl = watchAll?.meta?.pluginRenderPage
    ? resolvePossiblyRelativeUrl(
        watchAll.meta.pluginRenderPage,
        pluginConfigUrl || devAppsBaseReplacement(applicationSettings?.url)
      )
    : watchAll?.meta?.url || devAppsBaseReplacement(applicationSettings?.url);
  const url = typeof resolvedUrl === "string" ? resolvedUrl : null;
  const urlWithParams = mergeUrlWithQueryParams(url, legacySelectedMeta, {
    includeParams: !watchAll?.meta?.pluginRenderPage,
  });
  const shouldShowEmptyMessage = Boolean(
    components?.EmptyMessage && showEmpty && showEmpty(store)
  );
  const previewInitData = useMemo<Record<string, unknown>>(
    () => ({
      ...paper,
      meta: { ...paper?.meta, ...watchAll?.meta },
    }),
    [paper, watchAll?.meta]
  );

  const currentImageUrl = image.data?.signedUrl;
  const isSendingImage =
    isPrimary &&
    (uploadSingleImageResult.isLoading || updatePaperMetaResult.isLoading);
  const isWaitingForGeneratedImage =
    !paper?.imageUpdatedAt &&
    Boolean(paper?.updatedAt) &&
    new Date(paper?.updatedAt as string | number | Date) >
      IMAGE_GENERATION_CUTOFF;
  const showImageLoadingPlaceholder =
    isWaitingForGeneratedImage ||
    (!currentImageUrl &&
      (isSendingImage || image.isLoading || image.isFetching));
  const distanceString = formatDistanceShort(
    nextDeviceSyncDate || new Date(NaN),
    now,
    localeDate.locale
  );
  const syncDisplayState = deriveDeviceSyncDisplayState({
    latestImageIsOnDevice,
    nextDeviceSync: nextDeviceSyncDate,
    now,
  });
  const classes = classNames(styles.frame, {
    [styles.other]: variant === "secondary",
    [styles.simpleWrapper]: isPreview,
  });

  return (
    <div className={classes}>
      <FrameViewport
        decorated={isPrimary}
        frameFinish={resolvedFrameFinish}
        size={size}
      >
        {({ scale }) =>
          isPreview ? (
            <IntegrationPreview
              calendarPostData={watchAll?.meta?.calendarData}
              emptyMessage={components?.EmptyMessage}
              initData={previewInitData}
              onSelectWebsite={() => setModalOpen("website")}
              scale={scale}
              shouldShowEmptyMessage={shouldShowEmptyMessage}
              size={size}
              url={urlWithParams}
            />
          ) : (
            <PhotoFrameContent
              currentImageUrl={currentImageUrl}
              debugImageUrl={imageOnDevice.data?.signedUrl}
              deviceIsLoading={activeUserDevices.isLoading !== false}
              showDebugImage={isDebug}
              showLoadingOverlay={Boolean(currentImageUrl) && isSendingImage}
              showLoadingPlaceholder={showImageLoadingPlaceholder}
            />
          )
        }
      </FrameViewport>

      {!isPreview && (
        <PhotoFrameMeta
          distanceString={distanceString}
          editTo={`/calendar/${params.kind}/${params.entry}/${paper?.id}`}
          latestImageIsOnDevice={latestImageIsOnDevice}
          showDeviceStatus={isPrimary}
          status={syncDisplayState}
          thumbnailUrl={currentFrameImage.data?.url}
        />
      )}
    </div>
  );
}
