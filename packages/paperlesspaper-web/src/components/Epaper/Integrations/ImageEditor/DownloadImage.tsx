import React from "react";
import { Button, Modal } from "@progressiveui/react";
import { faDownload } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Capacitor } from "@capacitor/core";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";
import { exportImage, type ImageExportFormat } from "./exportImage";
import {
  canShareImage,
  downloadImage,
  isShareCancelled,
  shareImage,
} from "./saveExportedImage";
import styles from "./downloadImage.module.scss";

export default function DownloadImage() {
  const { t } = useTranslation();
  const { fabricRef, imageEditorTools }: any = useImageEditorContext();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<ImageExportFormat>("jpeg");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const busyRef = React.useRef(false);
  const native = Capacitor.isNativePlatform();
  const mobile = native || isMobile;
  const share = mobile && file && canShareImage(file);
  const toolsRef = React.useRef(imageEditorTools);
  toolsRef.current = imageEditorTools;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFile(null);
    setError(false);
    setDownloaded(false);
    void Promise.resolve()
      .then(() =>
        exportImage(
          fabricRef.current,
          toolsRef.current.getCanvasSize(),
          format,
        ),
      )
      .then((result) => {
        if (!cancelled) setFile(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, format, attempt, fabricRef]);

  const save = async (forceDownload = false) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    try {
      if (share && !forceDownload) {
        await shareImage(file);
        setOpen(false);
      } else {
        downloadImage(file);
        if (mobile) setDownloaded(true);
        else setOpen(false);
      }
    } catch (cause) {
      if (!isShareCancelled(cause)) setError(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <EditorButton
        id="downloadImage"
        text={t("Download")}
        icon={<FontAwesomeIcon icon={faDownload} />}
        disabled={imageEditorTools.isLoadingImageData || Boolean(imageEditorTools.imageLoadError)}
        onClick={() => {
          setFile(null);
          setError(false);
          setFormat("jpeg");
          setOpen(true);
        }}
      />
      <Modal
        open={open}
        passiveModal
        kindMobile="dialog"
        modalHeading={t("Download image")}
        onRequestClose={() => {
          if (!busyRef.current) setOpen(false);
        }}
      >
        <div className={styles.content}>
          <fieldset disabled={busy} className={styles.formats}>
            <legend>
              {t("In which format would you like to download the image?")}
            </legend>
            {(["jpeg", "png"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="imageExportFormat"
                  value={value}
                  checked={format === value}
                  onChange={() => {
                    setFile(null);
                    setFormat(value);
                  }}
                />
                {value.toUpperCase()}
              </label>
            ))}
          </fieldset>
          {mobile && file && (
            <p>
              {share && !downloaded
                ? t(
                    "Choose Save Image or your photos app in the share menu to save the image to your gallery.",
                  )
                : t(
                    "The image is saved to Downloads. Open it there and use Share or Save Image to add it to your gallery.",
                  )}
            </p>
          )}
          {!file && !error && <p role="status">{t("Preparing image…")}</p>}
          {downloaded && <p role="status">{t("Image downloaded.")}</p>}
          {error && (
            <p role="alert">
              {t("The image could not be saved. Please try again.")}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("Cancel")}
            </Button>
            {error && !file ? (
              <Button onClick={() => setAttempt((value) => value + 1)}>
                {t("Try again")}
              </Button>
            ) : (
              <Button disabled={!file || busy} onClick={() => void save()}>
                {share ? t("Save / Share") : t("Download")}
              </Button>
            )}
            {share && !native && (
              <Button
                kind="tertiary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {t("Download file")}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
