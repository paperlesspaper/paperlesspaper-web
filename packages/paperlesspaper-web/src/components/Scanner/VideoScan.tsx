import React, { useEffect, useRef, useState } from "react";
import styles from "./videoScan.module.scss";

import { Button, Empty, InlineLoading, Select } from "@progressiveui/react";
import classNames from "classnames";
//import Empty from "components/Empty";
import { isMobile, isTablet } from "react-device-detect";
import { Trans } from "react-i18next";
import { useIsDesktop } from "@internetderdinge/web";
import axios from "axios";
import AudioPlayer from "./AudioPlayer";
import Face from "./Face";
import { ScreenOrientation } from "@capacitor/screen-orientation";

interface ScannerProps {
  closeModal: () => void;
  kind: "data_matrix" | "qr_code";
  onChange: (value?: { search?: string; data?: any }) => void;
  open: boolean;
  scale?: number;
}

export default function VideoScanner({
  closeModal,

  onChange = () => {},
  open = true,
  scale = 0.2,
}: ScannerProps) {
  const mobile = isMobile || isTablet;
  const [videoInputDevices, setVideoInputDevices] = useState<any>([]);
  //const [scan, setScan] = useState<boolean>();
  const [scanError, setScanError] = useState<boolean>();
  const [controls] = useState<any>();
  const [aiResult, setAiResult] = useState<any>();
  const [loading, setLoading] = useState<any>(true);
  const [aiLoading, setAiLoading] = useState<any>(false);
  const [currentDeviceDataState, setCurrentDeviceDateState] = useState<any>();

  const [recordings, setRecordings] = useState<any>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDesktop = useIsDesktop();
  const [scannerDimensions, setScannerDimensions] = useState<any>({
    width: 640 * 2, //Math.min(window.innerWidth, 640),
    height: 480 * 2,
    facingMode: isDesktop ? "portrait" : "environment",
  });

  useEffect(() => {
    (async () => {
      await ScreenOrientation.lock({ orientation: "landscape" });
    })();

    return () => {
      (async () => {
        await ScreenOrientation.unlock();
      })();
    };
  }, []);

  useEffect(() => {
    if (open === true) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startReader();
      } else {
        alert("getUserMedia() is not supported by your browser");
      }
    } else if (open === false) {
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
      onChange(null);

      const devices = await navigator.mediaDevices.enumerateDevices();

      setVideoInputDevices(devices.filter((d) => d.kind === "videoinput"));

      //setScannerDimensions({ ...scannerDimensions, facingMode: "portrait" });
      canvasRef.current
        .getContext("2d")
        .clearRect(0, 0, scannerDimensions.width, scannerDimensions.height);

      const currentDeviceData = await streamVideo(videoId);

      setCurrentDeviceDateState(currentDeviceData);
      await decodeNow(currentDeviceData);
    } catch (e) {
      console.log("Scan error", e);
      setScanError(true);
    }
  }

  async function streamVideo(videoId) {
    const size = {
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

  const scanFrame = () => {
    console.log("currentDeviceDataState", currentDeviceDataState);
    canvasRef.current
      .getContext("2d")
      .drawImage(
        videoRef.current,
        0,
        0,
        currentDeviceDataState.video.width,
        currentDeviceDataState.video.height,
        0,
        0,
        currentDeviceDataState.video.width * scale,
        currentDeviceDataState.video.height * scale
      );

    const base64Canvas = canvasRef.current.toDataURL("image/jpeg");

    setRecordings((recordings) => {
      return [...recordings, base64Canvas];
    });
  };

  const sendResults = async () => {
    setAiLoading(true);
    const { data } = await axios.post(
      `${import.meta.env.REACT_APP_SERVER_BASE_URL}ai`,
      {
        images: recordings.splice(-30),
        detect: "intake", //"fall",
      }
    );
    setAiLoading(false);

    setRecordings([]);

    setAiResult(data);
  };

  async function decodeNow(currentDeviceData) {
    const videoElement: any = document.querySelector("#video");

    navigator.mediaDevices.getUserMedia(currentDeviceData).then((stream) => {
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
    });
  }

  const classes = classNames(
    {
      [styles.isEnvironment]:
        mobile || scannerDimensions?.facingMode === "environment",
    },
    styles.scanner
  );

  const [timer, setTimer] = useState(0);
  const increment = useRef(null);

  const handleStart = () => {
    setAiResult(false);
    increment.current = setInterval(() => {
      setTimer((timer) => timer + 1);
      scanFrame();
    }, 400);
  };

  const handleReset = () => {
    sendResults();
    clearInterval(increment.current);
    setTimer(0);
  };

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    setIsRecording(true);

    // Request access to the microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Initialize MediaRecorder
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    // Capture data from the media recorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    // Start recording
    mediaRecorder.start();
  };

  const stopRecording = () => {
    setIsRecording(false);

    // Stop the media recorder
    mediaRecorderRef.current.stop();

    // Combine audio chunks into a single Blob
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

    // Send the Blob to the server or handle it as needed
    sendAudioBlob(audioBlob);

    // Clear the audio chunks for the next recording
    audioChunksRef.current = [];
  };

  const sendAudioBlob = (blob) => {
    const reader: any = new FileReader();

    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1]; // Extract Base64 string from Data URL

      const payload = {
        audio: base64String,
        filename: "recording.webm",
      };

      fetch(`${import.meta.env.REACT_APP_SERVER_BASE_URL}ai/generate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => console.log("Success:", data))
        .catch((error) => {
          console.error("Error:", error);
        });
    };

    reader.readAsDataURL(blob); // Read blob as Data URL
  };
  return (
    <div className={classes}>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      <div className={styles.videoel}>
        <div className={styles.imageDebug}>
          {recordings.map((image, k) => (
            <img key={k} src={image} />
          ))}
        </div>

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
              className={`${styles.canvas} ${styles.debugCanvas}`}
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
            </div>
          </div>
        )}
      </div>

      <div className={styles.aiResult}>
        <Button
          onClick={() => {
            if (timer === 0) {
              handleStart();
            } else {
              handleReset();
            }
          }}
        >
          {timer === 0 ? "Start scan" : "Stop scan"} {timer}
        </Button>

        <AudioPlayer text={aiResult?.answer} />

        {aiResult ? (
          <>
            <div className={styles.result}>
              <div className={styles.title}>Probability</div>
              <div className={styles.value}>{aiResult.probability}%</div>
              <div className={styles.reason}>{aiResult.reason}</div>

              <div className={styles.reason}>{aiResult.answer}</div>
            </div>

            {aiResult.withWaterProbability && (
              <div className={styles.result}>
                <div className={styles.title}>Taken with water</div>
                <div className={styles.value}>
                  {aiResult.withWaterProbability}%
                </div>
              </div>
            )}
          </>
        ) : timer !== 0 ? (
          <div className={styles.loading}>
            <InlineLoading description="Scanning environment..." />
          </div>
        ) : aiLoading ? (
          <div className={styles.loading}>
            <InlineLoading description="AI results loading..." />
          </div>
        ) : (
          <div className={styles.loading}>Waiting for start...</div>
        )}
      </div>
      <Face expression={aiResult?.expression} text={aiResult?.answer} />
    </div>
  );
}
