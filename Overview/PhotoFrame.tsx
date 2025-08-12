import NewEntryButton from "components/Calendar/NewEntryButton";
import AddIcon from "components/Settings/components/AddIcon";
import { useActiveUserDevice } from "helpers/useUsers";
import React, { useEffect, useState } from "react";
import { Trans } from "react-i18next";
import styles from "./photoFrame.module.scss";
import { papersApi } from "ducks/papersApi";
import ButtonRouter from "components/ButtonRouter";
import { useParams } from "react-router-dom";
import classNames from "classnames";
import formatDistanceShort, {
  distanceInDaysFunc,
} from "helpers/formatDistanceShort";
import { Button, Empty, Tag } from "@progressiveui/react";
import { applicationsByKind } from "@wirewire/helpers";
import useEditor from "../Integrations/ImageEditor/useEditor";
import qs from "qs";
import useContainerDimensions from "helpers/useContainerDimensions";
import useLocaleDate from "helpers/useLocaleDate";
import { isFuture } from "date-fns";
import useRotationList from "../Integrations/ImageEditor/useRotationList";

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

  const [animationImageProcess, setAnimationImageProcess] = useState<boolean>();

  const params = useParams();

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
      skip: activeUserDevices.data?.id === undefined,
    }
  );

  console.log("showEmpty", showEmpty);

  const { form, setModalOpen } = useEditor();
  const watchAll = form ? form.watch() : {};

  const applicationSettings = applicationsByKind(watchAll?.kind);

  useEffect(() => {
    refreshAnimation();
  }, [image.data?.signedUrl]);

  const classes = classNames(styles.frame, {
    [styles.first]: index === 0,
    [styles.other]: index !== 0,
    // [styles.animationImageProcess]: animationImageProcess,
    [styles.simpleWrapper]: hideEdit,
  });

  const iframeRef = React.useRef(null);

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

    const iframe = iframeRef.current;

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

  const orientation =
    watchAll?.meta?.orientation === "landscape" ? "landscape" : "portrait";

  const rotationList = useRotationList();

  const size = Object.values(rotationList).find((r) => r.name === orientation);

  const { dimensions, containerRef } = useContainerDimensions();

  let scaleFactor = dimensions.width / size.width;

  // make sure the scaleFactor is calculated on the with of the container
  // and not on the width of the image, so that it fits in the container
  // and the aspect ratio is correct
  if (fitScale) {
    scaleFactor = Math.min(
      dimensions.width / size.width,
      dimensions.height / size.height
    );
  }

  const aspectRatio = size.height / size.width;
  const wrapperHeight = dimensions.width * aspectRatio;

  const keysToKeep = applicationSettings?.settings
    ? Object.keys(applicationSettings.settings)
    : [];

  const selectedMeta = watchAll?.meta
    ? Object.fromEntries(
        Object.entries(watchAll?.meta).filter(([key]) =>
          keysToKeep.includes(key)
        )
      )
    : {};

  const selectedPostMeta = watchAll?.meta?.calendarData?.events;

  useEffect(() => {
    if (
      iframeRef.current &&
      iframeRef.current.contentWindow &&
      selectedPostMeta
    ) {
      iframeRef.current.contentWindow.postMessage(
        { cmd: "message", data: selectedPostMeta },
        "*"
      );
    }
  }, [selectedPostMeta, watchAll]);

  const localeDate = useLocaleDate();

  const distanceString = formatDistanceShort(
    new Date(activeUserDevices.data?.deviceStatus?.nextDeviceSync),
    new Date(),

    localeDate.locale
  );

  const distanceInDaysValue = distanceInDaysFunc(
    new Date(activeUserDevices.data?.deviceStatus?.nextDeviceSync),
    new Date()
  );

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [image.data?.signedUrl]);

  const url = watchAll?.meta?.url
    ? watchAll?.meta?.url
    : import.meta.env.MODE === "development"
      ? applicationSettings?.url?.replace(
          "https://apps.paperlesspaper.de",
          "http://localhost:3001"
        )
      : applicationSettings?.url;

  const urlWithParams = url ? url + "?" + qs.stringify(selectedMeta) : null;

  const componentsOverride = { ...components };

  return (
    <>
      <div className={classes}>
        <div
          className={styles.imageWrapper}
          onClick={() => refreshAnimation()}
          ref={containerRef}
        >
          {activeUserDevices.isLoading === false &&
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
                <componentsOverride.EmptyMessage />
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
          ) : imageError === true ? (
            <Empty title={<Trans>Image not loaded</Trans>}>
              <Trans>Failed loading the image</Trans>
            </Empty>
          ) : null}
        </div>
      </div>
      {!hideEdit && (
        <div className={styles.meta}>
          <div className={styles.date}>
            {paper?.updatedAt && new Date(paper.updatedAt)?.toLocaleString()}

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
                ) : distanceInDaysValue < -1 ? (
                  <Trans i18nKey="DEVICE_OFFLINE_SINCE">
                    Device offline since{" "}
                    {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
                  </Trans>
                ) : isFuture(
                    new Date(
                      activeUserDevices.data?.deviceStatus?.nextDeviceSync
                    )
                  ) ? (
                  <Trans i18nKey="IMAGE_UPDATED_AGO">
                    Will be updated in{" "}
                    {{ NO_TRANSLATE_SYNC_VARIABLE: distanceString }}
                  </Trans>
                ) : (
                  <>
                    <Trans>Trying to sync...</Trans>
                  </>
                )}
              </div>
            )}
          </div>

          <ButtonRouter
            withOrganization
            isPlain
            to={`/calendar/${params.kind}/${params.entry}/${paper?.id}`}
            kind="primary"
          >
            <Trans>Edit</Trans>
          </ButtonRouter>
        </div>
      )}
    </>
  );
}
