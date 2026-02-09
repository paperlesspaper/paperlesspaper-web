import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import { useActiveUserDevice } from "helpers/useUsers";
import React, { useEffect, useState } from "react";
import { Trans } from "react-i18next";
import styles from "./photoFrame.module.scss";
import { papersApi } from "ducks/ePaper/papersApi";
import ButtonRouter from "components/ButtonRouter";
import { useParams } from "react-router-dom";
import classNames from "classnames";
import formatDistanceShort from "helpers/formatDistanceShort";
import { Button, Empty, InlineLoading, Tag } from "@progressiveui/react";
import { applicationsByKind } from "@wirewire/helpers";
import useEditor from "../Integrations/ImageEditor/useEditor";
import qs from "qs";
import { useContainerDimensions } from "@internetderdinge/web";
import { useLocaleDate } from "@internetderdinge/web";
import { isFuture } from "date-fns";
import useRotationList from "../Integrations/ImageEditor/useRotationList";
import { useDebug } from "helpers/useCurrentUser";
import {
  devAppsBaseReplacement,
  resolvePossiblyRelativeUrl,
} from "@internetderdinge/web";

export default function PhotoFrame({
  components,
  paper,
  index,
  hideEdit,
  preview,
  showEmpty,
  store,
  fitScale = true,
}: any) {
  const activeUserDevices = useActiveUserDevice();
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const pictureSynced = activeUserDevices.data?.deviceStatus?.pictureSynced;
  const pictureSyncedBecameFalseAtRef = React.useRef<number | null>(null);

  const [now, setNow] = useState(() => new Date());

  const [wrapperRefIsTallerThanWide, setWrapperRefIsTallerThanWide] =
    useState(false);

  const [animationImageProcess, setAnimationImageProcess] = useState<boolean>();

  const params = useParams();

  const isDebug = useDebug();

  const refreshAnimation = () => {
    setAnimationImageProcess(true);
    setTimeout(() => {
      setAnimationImageProcess(false);
    }, 2000);
  };

  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: {
        kind: "original.png",
      },
    },
    {
      skip:
        activeUserDevices.data?.id === undefined ||
        paper?.id === undefined ||
        (!paper.imageUpdatedAt &&
          new Date(paper?.updatedAt) > new Date("2025-10-12")),
    },
  );

  const imageOnDevice = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: {
        kind: ".png",
      },
    },
    {
      skip:
        activeUserDevices.data?.id === undefined ||
        paper?.id === undefined ||
        !isDebug,
    },
  );

  const { form, setModalOpen } = useEditor();
  const watchAll = form ? form.watch() : {};

  const applicationSettings = applicationsByKind(watchAll?.kind);

  useEffect(() => {
    refreshAnimation();
  }, [image.data?.signedUrl]);

  const iframeRef = React.useRef(null);

  const iframe = iframeRef.current;

  const [iframeLoadingError, setIframeLoadingError] = useState(false);
  useEffect(() => {
    const handleIframeLoadError = () => {
      console.error("Failed loading the iframe");
      setIframeLoadingError(true);
    };

    const handleIframeLoad = (state) => {
      console.error("Failed loading the iframe", state);
      setIframeLoadingError(false);
    };

    if (iframe) {
      iframe.addEventListener("load", handleIframeLoad);
      iframe.addEventListener("error", handleIframeLoadError);

      // Clean up event listeners on component unmount
      return () => {
        iframe.removeEventListener("load", handleIframeLoad);
        iframe.removeEventListener("error", handleIframeLoadError);
      };
    }
  }, [iframeRef?.current]);

  const orientation = watchAll?.meta?.orientation
    ? watchAll?.meta?.orientation === "landscape"
      ? "landscape"
      : "portrait"
    : paper?.meta?.orientation
      ? paper?.meta?.orientation
      : "portrait";

  const rotationList = useRotationList();

  const size = Object.values(rotationList).find((r) => r.name === orientation);

  const classes = classNames(styles.frame, {
    // [styles.first]: index === 0,
    [styles.other]: index !== 0,
    // [styles.animationImageProcess]: animationImageProcess,
    [styles[`${orientation}`]]: orientation,
    [styles.simpleWrapper]: hideEdit,
    [styles.wrapperRefIsTallerThanWide]: wrapperRefIsTallerThanWide,
  });

  const { dimensions, containerRef } = useContainerDimensions();

  let scaleFactor = dimensions.width / size.width;

  // make sure the scaleFactor is calculated on the with of the container
  // and not on the width of the image, so that it fits in the container
  // and the aspect ratio is correct
  if (fitScale) {
    scaleFactor = Math.min(
      dimensions.width / size.width,
      dimensions.height / size.height,
    );
  }

  const aspectRatio = size.height / size.width;

  const additionalHeightBecauseOfMeta = hideEdit ? 0 : 50;
  const paddingBecauseOfFirstWrapper = index === 0 ? 100 : 0;
  /*
  const cssAspectRatio =
    size?.width && size?.height
      ? orientation === "landscape"
        ? `ccc${size.height + paddingBecauseOfFirstWrapper + additionalHeightBecauseOfMeta} / ${size.width + paddingBecauseOfFirstWrapper}`
        : `${size.width + paddingBecauseOfFirstWrapper} / ${size.height + paddingBecauseOfFirstWrapper + additionalHeightBecauseOfMeta}`
      : undefined;
      */

  const cssAspectRatio =
    size?.width && size?.height
      ? `${size.width + paddingBecauseOfFirstWrapper} / ${size.height + paddingBecauseOfFirstWrapper + additionalHeightBecauseOfMeta}`
      : undefined;

  const wrapperHeight = dimensions.width * aspectRatio;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const update = () => {
      const safeWidth = Math.max(element.clientWidth, 1);
      setWrapperRefIsTallerThanWide(
        element.clientHeight / safeWidth > aspectRatio,
      );
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [aspectRatio]);
  const keysToKeep = applicationSettings?.settings
    ? Object.keys(applicationSettings.settings)
    : [];

  const selectedMeta = watchAll?.meta
    ? Object.fromEntries(
        Object.entries(watchAll?.meta).filter(([key]) =>
          keysToKeep.includes(key),
        ),
      )
    : {};

  const selectedPostMeta = watchAll?.meta?.calendarData?.events;

  useEffect(() => {
    if (
      iframeRef.current &&
      iframeRef.current.contentWindow &&
      selectedPostMeta
    ) {
      console.log("postMessage to iframe", selectedPostMeta);
      iframeRef.current.contentWindow.postMessage(
        { cmd: "message", data: selectedPostMeta },
        "*",
      );
    }
  }, [selectedPostMeta, watchAll]);

  // Sending plugin settings via postMessage for backwards compatibility
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      console.log("postMessage to iframe", selectedMeta);
      iframeRef.current.contentWindow.postMessage(
        { cmd: "message", data: watchAll?.meta },
        "*",
      );
    }
  }, [watchAll]);

  const localeDate = useLocaleDate();

  const nextDeviceSyncValue =
    activeUserDevices.data?.deviceStatus?.nextDeviceSync;

  const nextDeviceSyncNumber =
    typeof nextDeviceSyncValue === "number"
      ? nextDeviceSyncValue
      : Number(nextDeviceSyncValue);

  const nextDeviceSyncDate = Number.isFinite(nextDeviceSyncNumber)
    ? new Date(
        nextDeviceSyncNumber < 1_000_000_000_000
          ? nextDeviceSyncNumber * 1000
          : nextDeviceSyncNumber,
      )
    : nextDeviceSyncValue
      ? new Date(nextDeviceSyncValue)
      : null;

  const nextDeviceSyncTs = nextDeviceSyncDate?.getTime() ?? null;

  const isNextSyncValid =
    !!nextDeviceSyncDate && !isNaN(nextDeviceSyncDate.getTime());

  useEffect(() => {
    // Only tick while the countdown text can be shown (avoids re-rendering
    // every PhotoFrame instance unnecessarily).
    if (!(index === 0 && !hideEdit && isNextSyncValid)) return;

    // Keep it "live" like a countdown.
    const intervalMs = 1_000;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [index, hideEdit, isNextSyncValid, nextDeviceSyncTs]);

  useEffect(() => {
    if (
      pictureSynced === false &&
      pictureSyncedBecameFalseAtRef.current == null
    )
      pictureSyncedBecameFalseAtRef.current = Date.now();

    if (pictureSynced !== false) pictureSyncedBecameFalseAtRef.current = null;
  }, [pictureSynced]);

  useEffect(() => {
    // When the device is temporarily marked as not-synced, we need to refetch
    // status for a short time; otherwise the UI can get stuck showing the
    // offline/updating message until a manual refresh.
    if (!(index === 0 && !hideEdit)) return;
    if (!activeUserDevices.refetch) return;
    if (pictureSynced !== false) return;
    if (pictureSyncedBecameFalseAtRef.current == null) return;

    const maxPollDurationMs = 5 * 60_000;

    const poll = () => {
      const startedAt = pictureSyncedBecameFalseAtRef.current;
      if (startedAt == null) return;
      if (Date.now() - startedAt > maxPollDurationMs) return;
      activeUserDevices.refetch();
    };

    poll();
    const id = window.setInterval(poll, 5_000);
    return () => window.clearInterval(id);
  }, [index, hideEdit, pictureSynced, activeUserDevices.refetch]);

  const distanceString = formatDistanceShort(
    nextDeviceSyncDate || new Date(NaN),
    now,
    localeDate.locale,
  );

  const isUpdatingNow =
    isNextSyncValid &&
    nextDeviceSyncDate &&
    !isFuture(nextDeviceSyncDate as Date) &&
    now.getTime() - (nextDeviceSyncDate as Date).getTime() < 60_000;

  const [imageError, setImageError] = useState(false);

  const [, uploadSingleImageResult] = papersApi.useUploadSingleImageMutation({
    fixedCacheKey: "upload-single-image",
  });

  //console.log("uploadSingleImageResult", uploadSingleImageResult);

  useEffect(() => {
    setImageError(false);
  }, [image.data?.signedUrl]);

  useEffect(() => {
    if (uploadSingleImageResult.fulfilledTimeStamp && activeUserDevices.refetch)
      activeUserDevices.refetch();
  }, [uploadSingleImageResult.fulfilledTimeStamp, activeUserDevices.refetch]);

  console.log("watchAll", watchAll);

  const pluginConfigUrl = devAppsBaseReplacement(
    watchAll?.meta?.pluginConfigUrl,
  );

  const url = watchAll?.meta?.pluginRenderPage
    ? resolvePossiblyRelativeUrl(
        watchAll?.meta?.pluginRenderPage,
        pluginConfigUrl || devAppsBaseReplacement(applicationSettings?.url),
      )
    : watchAll?.meta?.url
      ? watchAll?.meta?.url
      : devAppsBaseReplacement(applicationSettings?.url);

  const urlWithParams = url ? url + "?" + qs.stringify(selectedMeta) : null;

  const componentsOverride = { ...components };

  const imageWrapperClasses = classNames(styles.imageWrapper, {
    [styles.first]: index === 0,
  });

  return (
    <>
      <div className={classes} ref={wrapperRef}>
        <div
          className={styles.inner}
          style={{
            aspectRatio: cssAspectRatio,
          }}
        >
          <div
            className={imageWrapperClasses}
            onClick={() => refreshAnimation()}
            ref={containerRef}
          >
            {index === 0 && (
              <>
                <div
                  className={`${styles.corner} ${styles.cornerDecorationTopLeft}`}
                />
                <div
                  className={`${styles.corner} ${styles.cornerDecorationTopRight}`}
                />
                <div
                  className={`${styles.corner} ${styles.cornerDecorationBottomLeft}`}
                />
                <div
                  className={`${styles.corner} ${styles.cornerDecorationBottomRight}`}
                />
              </>
            )}
            {!paper?.imageUpdatedAt &&
            !preview &&
            paper?.updatedAt &&
            new Date(paper?.updatedAt) > new Date("2025-10-12") ? (
              <div className={styles.loadingImage}>
                <div>
                  <InlineLoading
                    description={<Trans>Loading image...</Trans>}
                  />
                </div>
              </div>
            ) : activeUserDevices.isLoading === false &&
              !image.data?.signedUrl &&
              !preview ? (
              <div className={styles.noImage}>
                <h3>
                  <Trans>No image</Trans>
                </h3>
                <p>
                  <Trans>Please upload a first picture</Trans>
                </p>
                <NewEntryButton
                  className={styles.addButton}
                  icon={<AddIcon />}
                  kind="primary"
                  small={false}
                  iconReverse={false}
                >
                  <Trans>New picture</Trans>
                </NewEntryButton>
              </div>
            ) : preview ? (
              <div
                className={styles.iframeContainer}
                style={{
                  height: wrapperHeight + "px",
                }}
              >
                {componentsOverride.EmptyMessage &&
                showEmpty &&
                showEmpty(store) ? (
                  <componentsOverride.EmptyMessage size={size} />
                ) : urlWithParams &&
                  url.startsWith("http") &&
                  iframeLoadingError === false ? (
                  <iframe
                    className={styles.iframePreview}
                    src={urlWithParams}
                    style={{
                      width: size.width + "px",
                      height: size.height + "px",
                      transform: `scale(${scaleFactor})`,
                    }}
                    ref={iframeRef}
                  />
                ) : urlWithParams && !url.startsWith("http") ? (
                  <Empty title={<Trans>Url incorrect</Trans>}>
                    <Trans>Please enter a correct url</Trans>
                  </Empty>
                ) : iframeLoadingError ? (
                  <Empty title={<Trans>Content not loaded</Trans>}>
                    <Trans>Failed loading the iframe</Trans>
                  </Empty>
                ) : (
                  <div className={styles.iframePreview}>
                    <h3>
                      <Trans>Please select a website</Trans>
                    </h3>
                    <span>
                      <Button onClick={() => setModalOpen("website")}>
                        <Trans>Select website</Trans>
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            ) : image.data?.signedUrl && imageError === false ? (
              <>
                {isDebug && (
                  <img
                    src={imageOnDevice.data?.signedUrl}
                    alt="Preview of the eink display"
                    className={styles.debugImage}
                    onError={() => {
                      setImageError(true);
                    }}
                  />
                )}

                <img
                  src={image.data?.signedUrl}
                  alt="Preview of the eink display"
                  className={`${styles.animationImage} ${
                    animationImageProcess ? styles.animationImageProcess : ""
                  }`}
                  onError={() => {
                    setImageError(true);
                  }}
                />
                {uploadSingleImageResult.isLoading && index === 0 && (
                  <div className={styles.loadingOverlay}>
                    <InlineLoading description={<Trans>Updating...</Trans>} />
                  </div>
                )}
              </>
            ) : imageError === true ? (
              <Empty title={<Trans>Image not loaded</Trans>}>
                <Trans>Failed loading the image</Trans>
              </Empty>
            ) : null}
          </div>
          {!hideEdit && (
            <div className={styles.meta}>
              <div className={styles.date}>
                {/* {paper?.updatedAt && new Date(paper.updatedAt)?.toLocaleString()} */}

                {index === 0 && (
                  <div className={styles.metaLeft}>
                    {activeUserDevices.data?.deviceStatus?.pictureSynced ? (
                      <>
                        <Tag type="success">
                          <Trans>Current Image</Trans>
                        </Tag>{" "}
                        {paper.kind !== "image" ? (
                          <div className={styles.nextSync}>
                            <Trans>Next sync</Trans> in {distanceString}
                            {/*format(
                          new Date(
                            activeUserDevices.data?.deviceStatus?.nextDeviceSync
                          ),
                          "dd.MM.yy HH:mm"
                        ) */}
                          </div>
                        ) : null}
                      </>
                    ) : isNextSyncValid && isUpdatingNow ? (
                      <div className={styles.nextSync}>
                        <Trans>Updating now...</Trans>
                      </div>
                    ) : isNextSyncValid &&
                      !isFuture(nextDeviceSyncDate as Date) ? (
                      <div className={styles.nextSync}>
                        <Trans i18nKey="DEVICE_OFFLINE_SINCE">
                          Device offline since{" "}
                          {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
                        </Trans>
                      </div>
                    ) : isNextSyncValid &&
                      isFuture(nextDeviceSyncDate as Date) ? (
                      <div className={styles.nextSync}>
                        <Trans i18nKey="IMAGE_UPDATED_AGO">
                          Will be updated in{" "}
                          {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
                        </Trans>
                      </div>
                    ) : (
                      <div className={styles.nextSync}>
                        <Trans>Trying to sync...</Trans>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ButtonRouter
                withOrganization
                isPlain
                to={`/calendar/${params.kind}/${params.entry}/${paper?.id}`}
                kind="primary"
                onTouchStartHandler={false}
              >
                <Trans>Edit</Trans>
              </ButtonRouter>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
