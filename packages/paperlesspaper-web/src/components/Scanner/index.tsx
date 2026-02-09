import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BrowserDatamatrixCodeReader,
} from "@zxing/browser";
import styles from "./styles.module.scss";

import { Empty, InlineLoading, Select } from "@progressiveui/react";
import classNames from "classnames";
//import Empty from "components/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/pro-light-svg-icons";
import { isMobile, isTablet } from "react-device-detect";
import { Trans } from "react-i18next";
import prepareScan from "./prepareScan";
import { useIsDesktop } from "@internetderdinge/web";
import { useDebug } from "helpers/useCurrentUser";
import i18next from "i18next";

interface ScannerProps {
  closeModal: () => void;
  kind: "data_matrix" | "qr_code";
  onChange: (value?: { search?: string; data?: any }) => void;
  open: boolean;
  scale?: number;
  description?: React.ReactNode;
}

export default function Scanner({
  closeModal,
  kind,
  onChange,
  description,
  open,
  scale = 0.7,
}: ScannerProps) {
  const [points, setPoints] = useState<any>();
  const mobile = isMobile || isTablet;
  const [videoInputDevices, setVideoInputDevices] = useState<any>([]);
  //const [scan, setScan] = useState<boolean>();
  const [scanError, setScanError] = useState<boolean>();
  const [controls] = useState<any>();
  const [loading, setLoading] = useState<any>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDesktop = useIsDesktop();
  const [scannerDimensions, setScannerDimensions] = useState<any>({
    width: 640 * 2, //Math.min(window.innerWidth, 640),
    height: 480 * 2,
    facingMode: isDesktop ? "portrait" : "environment",
  });

  const codeReader =
    kind === "data_matrix"
      ? new BrowserDatamatrixCodeReader()
      : new BrowserMultiFormatReader();

  useEffect(() => {
    if (open === true) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startReader();
      } else {
        alert("getUserMedia() is not supported by your browser");
      }
    } else if (open === false) {
      console.log("stop reader");
      stopReader(true);
    }
  }, [open]);

  async function stopReader(close?: boolean) {
    if (controls) controls.stop();

    const videoElement: any = document.querySelector("#video");
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getVideoTracks().forEach((track) => track.stop());
    }
    // Close camera
    if (close) closeModal();

    return true;
  }

  async function startReader(videoId?: any) {
    try {
      setPoints(null);
      //setScan(false);
      onChange(null);

      const devices = await navigator.mediaDevices.enumerateDevices();

      setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));

      //setScannerDimensions({ ...scannerDimensions, facingMode: "portrait" });
      canvasRef.current
        .getContext("2d")
        .clearRect(0, 0, scannerDimensions.width, scannerDimensions.height);

      const currentDeviceData = await streamVideo(videoId);

      await decodeNow(currentDeviceData);
    } catch (e) {
      console.log("Scan error", e);
      setScanError(true);
    }
  }

  async function streamVideo(videoId) {
    const size = {
      //width: 1920,
      //height: 1080,
      width: 640 * 2,
      height: 480 * 2,
      facingMode: "environment",
    };
    const calculatedConstraints = videoId
      ? { video: { deviceId: { exact: videoId }, ...size } }
      : { video: size };

    return calculatedConstraints;
  }

  function changeDevice(e) {
    const videoId = e.target.value;
    stopReader();
    startReader(videoId);
  }

  function scanFrame(currentDeviceData) {
    // if (videoStream) {
    if (canvasRef.current === null) return null;
    if (videoRef.current === null) return null;

    const context2d = canvasRef.current.getContext("2d");
    if (!context2d) return null;

    const sourceWidth = videoRef.current.videoWidth || currentDeviceData.width;
    const sourceHeight =
      videoRef.current.videoHeight || currentDeviceData.height;
    const destWidth = canvasRef.current.width;
    const destHeight = canvasRef.current.height;

    if (!sourceWidth || !sourceHeight || !destWidth || !destHeight) return null;

    // Keep aspect ratio by center-cropping the source to the destination aspect.
    const sourceAspect = sourceWidth / sourceHeight;
    const destAspect = destWidth / destHeight;

    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceAspect > destAspect) {
      // Source is wider than dest: crop width.
      cropWidth = sourceHeight * destAspect;
      cropHeight = sourceHeight;
    } else {
      // Source is taller than dest: crop height.
      cropWidth = sourceWidth;
      cropHeight = sourceWidth / destAspect;
    }

    // Apply optional zoom (scale < 1 => zoom in) while preserving aspect ratio.
    const zoom = Math.max(0.05, Math.min(1, scale));
    cropWidth *= zoom;
    cropHeight *= zoom;

    const cropX = (sourceWidth - cropWidth) / 2;
    const cropY = (sourceHeight - cropHeight) / 2;

    context2d.drawImage(
      videoRef.current,
      // source x, y, w, h:
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      // dest x, y, w, h:
      0,
      0,
      destWidth,
      destHeight,
    );

    setTimeout(() => {
      scanFrame(currentDeviceData);
    }, 300);

    let result = null;
    try {
      result = codeReader.decodeFromCanvas(canvasRef.current);
    } catch {
      // console.log("Code couldn't be read");
    }
    if (result) {
      try {
        console.log("result of scan", result, prepareScan(result.text));
        onChange(prepareScan(result));
      } catch (error) {
        console.log("Code couldn't be prepared", error);
      }
    }
  }

  async function decodeNow(currentDeviceData) {
    const videoElement: any = document.querySelector("#video");

    navigator.mediaDevices
      .getUserMedia(currentDeviceData)
      .then((stream) => {
        videoElement.srcObject = stream;
        const streamSettings = stream.getVideoTracks()[0].getSettings();
        setScannerDimensions({
          ...scannerDimensions,
          width: streamSettings.width,
          height: streamSettings.height,
        });
        videoElement.play();
        setTimeout(() => {
          setLoading(false);
        }, 500);
        scanFrame({
          width: streamSettings.width,
          height: streamSettings.height,
        });
      })
      .catch((error) => {
        if (error.name === "NotAllowedError") {
          console.error(
            "Camera access denied by user. Please enable access to continue.",
          );
          // Optionally, update the UI to notify the user
          alert(
            i18next.t(
              "Camera access is denied. Please enable camera permissions in your settings.",
            ),
          );
          setLoading(false); // If applicable, adjust state or UI elements accordingly
        } else {
          console.error("An error occurred while accessing the camera:", error);
          // Optionally, handle other types of errors
          alert(
            i18next.t(
              "Unable to access the camera. Please check your device settings and try again.",
            ),
          );
          setLoading(false); // If applicable
        }
      });
  }

  const path = [];
  if (points)
    points.forEach((e) => {
      path.push(`${Math.round(e.x)} ${Math.round(e.y)}`);
    });

  const classes = classNames(
    {
      //TODO: [styles.isScanned]: scan,
      [styles.isEnvironment]:
        mobile || scannerDimensions?.facingMode === "environment", // TODO: improve mirror handler
    },
    styles.scanner,
  );

  const isDebug = useDebug();

  return (
    <div className={classes}>
      <div className={styles.videoel}>
        <div className={styles.toolbar}>
          {videoInputDevices.length > 1 &&
            scannerDimensions?.facingMode !== "environment" && (
              <Select
                onChange={changeDevice}
                className={styles.select}
                value={scannerDimensions.deviceId}
              >
                {videoInputDevices.map((e, i) => (
                  <option key={i} value={e.deviceId}>
                    {e.label}
                  </option>
                ))}
              </Select>
            )}
        </div>
        {scanError ? (
          <Empty kind="large" title={<Trans>Error</Trans>}>
            <Trans>Please allow camera access</Trans>
          </Empty>
        ) : (
          <div
            className={`${styles.videoScale} ${
              loading ? styles.loading : styles.finished
            }`}
          >
            {loading && (
              <div className={styles.loadingElement}>
                <InlineLoading description={<Trans>Loading camera...</Trans>} />
              </div>
            )}
            <canvas
              id="canvas"
              className={`${styles.canvas} ${
                isDebug ? styles.debugCanvas : ""
              }`}
              width={scannerDimensions.width * scale}
              height={scannerDimensions.height * scale}
              ref={canvasRef}
            />

            <div className={styles.videoWrapper}>
              <video
                id="video"
                width={scannerDimensions.width}
                height={scannerDimensions.height}
                playsInline
                muted
                className={styles.video}
                ref={videoRef}
              />

              {!loading && <div className={styles.overlay} />}
              <svg
                width={scannerDimensions.width}
                height={scannerDimensions.height}
                viewBox={`0 0 ${scannerDimensions.width} ${scannerDimensions.height}`}
                className={styles.points}
              >
                <polygon
                  points={path.join(" ")}
                  className={styles.pointsPolygon}
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* TODO: Check !scan && ( Ü/ */}
      <Empty
        className={styles.empty}
        kind="large"
        icon={<FontAwesomeIcon icon={faQrcode} />}
      >
        {description ? description : <Trans>Scan the code on the case</Trans>}
      </Empty>

      {/*<div className={styles.results}>
        <pre>{scan && JSON.stringify(scan, null, " ")}</pre>
      </div>*/}
    </div>
  );
}
