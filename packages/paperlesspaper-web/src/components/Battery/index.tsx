import React, { useState } from "react";
import classNames from "classnames";
import { InlineLoading } from "@progressiveui/react";

import styles from "./battery.module.scss";
import { devicesApi } from "ducks/devices";
import { deviceByKind, deviceKindHasFeature } from "helpers/devices/deviceList";
import { differenceInDays, format } from "date-fns";
import { Trans } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWifi, faWifiSlash } from "@fortawesome/pro-solid-svg-icons";

export const scaleBatteryRange = ({
  value = 3300,
  istart = 3300,
  istop = 3900,
  ostart = 0,
  ostop = 100,
}: {
  value?: number;
  istart?: number;
  istop?: number;
  ostart?: number;
  ostop?: number;
}) => {
  const calcValue =
    ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  return calcValue > 100 ? 100 : calcValue;
};

export const useBatteryStatus = ({
  currentDeviceClass,
  level,
  lastSeen,
}: any) => {
  const deviceKindData = deviceByKind(currentDeviceClass);

  const levelScaled = scaleBatteryRange({
    value: level,
    istart: deviceKindData?.battery?.min,
    istop: deviceKindData?.battery?.max,
  });

  const color =
    levelScaled >= 50 ? "green" : levelScaled >= 30 ? "orange" : "red";
  const batteryUnknown = lastSeen > 2 && currentDeviceClass !== "memo";
  return { batteryUnknown, color, levelScaled };
};

interface BatteryProps {
  device: any;
  className?: string;
  currentDeviceClass?: string;
  level?: number;
  showPercentage?: boolean;
  style?: any;
  wrapperClassName?: string;
}

const Battery = ({
  device,
  className,
  currentDeviceClass,
  // level,
  showPercentage,
  style,
  wrapperClassName,
}: BatteryProps) => {
  const [random] = useState(Math.random());
  const result = devicesApi.useGetSingleDevicesQuery(device?.id, {
    skip: !device?.id || deviceKindHasFeature("analog", device?.kind),
  });

  const { data, isLoading } = result;

  const lastSeen = differenceInDays(
    new Date(),
    new Date(data?.deviceStatus?.lastReachableAgo)
  );

  const { batteryUnknown, color, levelScaled } = useBatteryStatus({
    currentDeviceClass: device?.kind || currentDeviceClass,
    level:
      data?.deviceStatus?.batLevel /* ? data.deviceStatus?.batLevel : level*/,
    lastSeen,
  });

  if (deviceKindHasFeature("battery-offline", device?.kind)) {
    const lastSeen = differenceInDays(
      new Date(),
      new Date(data?.deviceStatus?.lastReachableAgo)
    );

    if (lastSeen && lastSeen >= 2) {
      return (
        <div className={classNames(styles.batteryWrapper, wrapperClassName)}>
          <span className={classNames(styles.deviceWifiStatus, styles[color])}>
            <FontAwesomeIcon
              icon={faWifiSlash}
              className={styles.noBatteryOnline}
            />
          </span>
        </div>
      );
    }

    return (
      <div className={classNames(styles.batteryWrapper, wrapperClassName)}>
        <span className={classNames(styles.deviceWifiStatus, styles[color])}>
          <FontAwesomeIcon icon={faWifi} className={styles.noBattery} />
        </span>
      </div>
    );
  }

  if (!deviceKindHasFeature("battery-level", device?.kind)) return;

  const batteryWidth = levelScaled;

  const batteryClasses = classNames(className, {
    [styles.battery]: true,
    [styles[color]]: true,
    [styles.batteryUnknown]: batteryUnknown,
  });

  const batteryWrapperClasses = classNames(wrapperClassName, {
    [styles.batteryWrapper]: true,
  });

  if (isLoading) {
    return <InlineLoading />;
  }

  if (levelScaled <= -400) {
    return null;
  }

  const hasEpaperFeature = deviceKindHasFeature("epaper", device?.kind);

  if (
    deviceByKind(device?.kind)?.analog === true ||
    deviceKindHasFeature("battery-offline", device?.kind)
  )
    return null;

  let battery = null;

  const rectMask = (
    <rect
      x="0"
      y="0"
      className={styles.boltMaskBackground}
      width="700"
      height="320"
      fill="black"
      clipRule="evenodd"
    />
  );

  /*if (data.deviceStatus?.chargerState) {
    batteryLoadIndicator = (
      <g
        id="Website"
        stroke="none"
        strokeWidth="1"
        fill="none"
        fillRule="evenodd"
      >
        <path
          d="M397.506 -26.6674C406.47 -19.9891 409.66 -7.9985 405.254 2.32253L346.917 138.469H443.69C454.021 138.469 463.136 144.844 466.63 154.558C469.973 162.906 467.086 175.048 459.186 181.575L252.574 351.568C243.914 358.55 231.457 358.854 222.494 352.175C213.53 345.497 210.34 333.506 214.746 323.185L273.083 185.673H176.31C165.979 185.673 156.864 180.664 153.369 170.95C150.027 161.236 152.914 150.46 160.814 143.933L367.426 -26.0603C376.086 -34.4082 388.543 -33.3458 397.506 -26.6674Z"
          fill="black"
        />
        <mask id="boltMask">
          <path
            d="M409.85 4.29182L409.853 4.28551C415.156 -8.13867 411.327 -22.6053 400.494 -30.6769C390.157 -38.3788 374.962 -40.1203 364.105 -29.8025L157.637 140.072L157.629 140.079C148.075 147.971 144.642 160.952 148.642 172.577L148.653 172.61L148.665 172.642C153.033 184.788 164.388 190.673 176.31 190.673H265.531L210.147 321.222C210.146 321.224 210.145 321.226 210.145 321.228C204.845 333.651 208.674 348.114 219.506 356.185C230.315 364.238 245.292 363.862 255.712 355.461L255.731 355.445L255.751 355.429L462.363 185.436L462.371 185.429C467.246 181.402 470.443 175.77 471.959 170.025C473.46 164.334 473.418 158.122 471.306 152.783C467.072 141.12 456.089 133.469 443.69 133.469H354.499L409.85 4.29182Z"
            fill="black"
            stroke="black"
            stroke-width="10"
          />
        </mask>
      </g>
    );
  }*/

  if (lastSeen > 2 || isNaN(levelScaled)) {
    battery = (
      <svg
        className={batteryClasses}
        viewBox="0 0 640 320"
        version="1.1"
        style={style}
      >
        <path d="M287.091797,253.662109 L287.091797,238.037109 C287.091797,220.133374 290.346973,205.240945 296.857422,193.359375 C303.367871,181.477805 314.760986,169.189517 331.037109,156.494141 C350.405696,141.194585 362.897433,129.313193 368.512695,120.849609 C374.127958,112.386025 376.935547,102.29498 376.935547,90.5761719 C376.935547,76.9042285 372.378301,66.4062866 363.263672,59.0820312 C354.149043,51.7577759 341.04696,48.0957031 323.957031,48.0957031 C308.494714,48.0957031 294.171941,50.2929468 280.988281,54.6875 C267.804622,59.0820532 254.946677,64.3717139 242.414062,70.5566406 L221.90625,27.5878906 C254.94678,9.19587158 290.346816,0 328.107422,0 C360.008623,0 385.317615,7.81242188 404.035156,23.4375 C422.752698,39.0625781 432.111328,60.6281177 432.111328,88.1347656 C432.111328,100.341858 430.320981,111.206007 426.740234,120.727539 C423.159487,130.249071 417.747758,139.322874 410.504883,147.949219 C403.262008,156.575564 390.770271,167.80592 373.029297,181.640625 C357.892502,193.522195 347.760768,203.369102 342.633789,211.181641 C337.50681,218.99418 334.943359,229.492122 334.943359,242.675781 L334.943359,253.662109 L287.091797,253.662109 Z M277.082031,331.542969 C277.082031,306.966023 289.044802,294.677734 312.970703,294.677734 C324.689512,294.677734 333.641245,297.89222 339.826172,304.321289 C346.011099,310.750358 349.103516,319.82416 349.103516,331.542969 C349.103516,343.099016 345.970409,352.254198 339.704102,359.008789 C333.437794,365.76338 324.52675,369.140625 312.970703,369.140625 C301.414656,369.140625 292.544302,365.84476 286.359375,359.25293 C280.174448,352.6611 277.082031,343.424539 277.082031,331.542969 Z" />

        <g transform="translate(0 .94)">
          <path d="M500,60.0605469 L500,28.0605469 L560,28.0605469 C586.51,28.0605469 608,49.5505469 608,76.0605469 L608,92.0605469 L616,92.0605469 C629.255,92.0605469 640,102.805547 640,116.060547 L640,260.060547 C640,273.315547 629.255,284.060547 616,284.060547 L608,284.060547 L608,300.060547 C608,326.570547 586.51,348.060547 560,348.060547 L416,348.060547 L416,316.060547 L560,316.060547 C568.823,316.060547 576,308.883547 576,300.060547 L576,252.060547 L608,252.060547 L608,124.060547 L576,124.060547 L576,76.0605469 C576,67.2375469 568.823,60.0605469 560,60.0605469 L500,60.0605469 Z M142,60.0605469 L48,60.0605469 C39.177,60.0605469 32,67.2375469 32,76.0605469 L32,300.060547 C32,308.883547 39.177,316.060547 48,316.060547 L215,316.060547 L215,348.060547 L48,348.060547 C21.49,348.060547 0,326.570547 0,300.060547 L0,76.0605469 C0,49.5505469 21.49,28.0605469 48,28.0605469 L142,28.0605469 L142,60.0605469 Z M52,86.0605469 L52,295.060547 L52,86.0605469 Z" />
        </g>
      </svg>
    );
  } else {
    battery = (
      <svg
        className={batteryClasses}
        viewBox="0 0 640 320"
        version="1.1"
        style={style}
      >
        <g
          id="Website"
          stroke="none"
          strokeWidth="1"
          fill="none"
          fillRule="evenodd"
          mask={`url(#boltMask+${random})`}
        >
          <g id="battery-empty-light">
            <path
              d="M560,32 C568.823,32 576,39.177 576,48 L576,96 L608,96 L608,224 L576,224 L576,272 C576,280.823 568.823,288 560,288 L48,288 C39.177,288 32,280.823 32,272 L32,48 C32,39.177 39.177,32 48,32 L560,32 L560,32 Z M560,0 L48,0 C21.49,0 0,21.49 0,48 L0,272 C0,298.51 21.49,320 48,320 L560,320 C586.51,320 608,298.51 608,272 L608,256 L616,256 C629.255,256 640,245.255 640,232 L640,88 C640,74.745 629.255,64 616,64 L608,64 L608,48 C608,21.49 586.51,0 560,0 Z"
              fill="#000000"
              fillRule="nonzero"
            ></path>
            <rect
              className={styles.batteryStatus}
              fill="#D8D8D8"
              x="52"
              y="58"
              width={batteryWidth * 5}
              height="209"
            ></rect>
          </g>
        </g>
        {data && data?.deviceStatus?.chargerState === "charging" && (
          <g
            id="Website"
            stroke="none"
            strokeWidth="1"
            fill="none"
            fillRule="evenodd"
          >
            <path
              d="M397.506 -26.6674C406.47 -19.9891 409.66 -7.9985 405.254 2.32253L346.917 138.469H443.69C454.021 138.469 463.136 144.844 466.63 154.558C469.973 162.906 467.086 175.048 459.186 181.575L252.574 351.568C243.914 358.55 231.457 358.854 222.494 352.175C213.53 345.497 210.34 333.506 214.746 323.185L273.083 185.673H176.31C165.979 185.673 156.864 180.664 153.369 170.95C150.027 161.236 152.914 150.46 160.814 143.933L367.426 -26.0603C376.086 -34.4082 388.543 -33.3458 397.506 -26.6674Z"
              fill="black"
            />
            <mask id={`boltMask+${random}`}>
              {rectMask}
              <path
                className={styles.boltMask}
                d="M409.85 4.29182L409.853 4.28551C415.156 -8.13867 411.327 -22.6053 400.494 -30.6769C390.157 -38.3788 374.962 -40.1203 364.105 -29.8025L157.637 140.072L157.629 140.079C148.075 147.971 144.642 160.952 148.642 172.577L148.653 172.61L148.665 172.642C153.033 184.788 164.388 190.673 176.31 190.673H265.531L210.147 321.222C210.146 321.224 210.145 321.226 210.145 321.228C204.845 333.651 208.674 348.114 219.506 356.185C230.315 364.238 245.292 363.862 255.712 355.461L255.731 355.445L255.751 355.429L462.363 185.436L462.371 185.429C467.246 181.402 470.443 175.77 471.959 170.025C473.46 164.334 473.418 158.122 471.306 152.783C467.072 141.12 456.089 133.469 443.69 133.469H354.499L409.85 4.29182Z"
                fill="white"
                stroke="white"
                strokeWidth="60"
                clipRule="evenodd"
              />
            </mask>
          </g>
        )}
        {((data && data.deviceStatus?.chargerState === "done") ||
          (data && data.deviceStatus?.chargerState === "connected")) && (
          <g stroke="none" strokeWidth="1" fill="none">
            <path
              d="M347.625 119.333L426.125 119.333C437.649 119.333 447 110.025 447 98.5C447 86.994 437.65 77.6667 426.125 77.6667L347.625 77.6667L347.625 58.8333C347.625 47.328 338.294 38 326.75 38C315.542 38 306.421 46.7923 305.899 57.8333L287 57.8333C238.715 57.8333 198.942 91.8571 188.808 137.167L128 137.167L127 137.167L127 138.167L127 177.833L127 178.833L128 178.833L188.808 178.833C198.942 224.124 238.715 258.167 287 258.167L305.899 258.167C306.42 269.225 315.542 278 326.75 278C338.294 278 347.625 268.691 347.625 257.167L347.625 238.333L426.125 238.333C437.649 238.333 447 229.025 447 217.5C447 205.975 437.649 196.667 426.125 196.667L347.625 196.667L347.625 119.333Z"
              fill="black"
              stroke="white"
            />
            <mask id={`boltMask+${random}`}>
              {rectMask}
              <path
                className={styles.boltMask}
                d="M347.625 119.333L426.125 119.333C437.649 119.333 447 110.025 447 98.5C447 86.994 437.65 77.6667 426.125 77.6667L347.625 77.6667L347.625 58.8333C347.625 47.328 338.294 38 326.75 38C315.542 38 306.421 46.7923 305.899 57.8333L287 57.8333C238.715 57.8333 198.942 91.8571 188.808 137.167L128 137.167L127 137.167L127 138.167L127 177.833L127 178.833L128 178.833L188.808 178.833C198.942 224.124 238.715 258.167 287 258.167L305.899 258.167C306.42 269.225 315.542 278 326.75 278C338.294 278 347.625 268.691 347.625 257.167L347.625 238.333L426.125 238.333C437.649 238.333 447 229.025 447 217.5C447 205.975 437.649 196.667 426.125 196.667L347.625 196.667L347.625 119.333Z"
                fill="black"
                stroke="white"
                strokeWidth="50"
              />
            </mask>
          </g>
        )}
      </svg>
    );
  }

  return (
    <div className={batteryWrapperClasses}>
      {battery}{" "}
      {showPercentage && (
        <span className={styles.percentage}>
          {lastSeen > 2 ? (
            <>
              <Trans>last seen</Trans>{" "}
              {device?.deviceStatus?.lastReachableAgo &&
                format(
                  new Date(device?.deviceStatus?.lastReachableAgo),
                  "dd.MM.yy"
                )}
            </>
          ) : isNaN(levelScaled) ? (
            <Trans>no battery level available</Trans>
          ) : data?.deviceStatus?.chargerState === "charging" ? (
            <Trans>charging</Trans>
          ) : (
            <>{Math.round(levelScaled)}%</>
          )}
        </span>
      )}
    </div>
  );
};

export default Battery;
