import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/sharp-solid-svg-icons";
import classNames from "classnames";
import React, { useLayoutEffect, useRef, useState } from "react";
import styles from "./styles.module.scss";
import screenOnboarding from "./screen-onboarding.png";

export default function EpaperFrame({ heading, text, icon, kind }: any) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      const frame = frameRef.current;
      if (!wrapper || !frame) return;

      const naturalWidth = frame.offsetWidth || 1;
      const naturalHeight = frame.offsetHeight || 1;

      const containerWidth = wrapper.clientWidth || naturalWidth;
      const containerHeight = wrapper.clientHeight - 30 || naturalHeight;

      const nextScale = Math.min(
        1,
        containerWidth / naturalWidth,
        containerHeight / naturalHeight
      );

      setScale((prev) =>
        Math.abs(nextScale - prev) > 0.001 ? nextScale : prev
      );
    };

    const resizeObserver = new ResizeObserver(updateScale);
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }
    updateScale();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const classes = classNames({
    [styles.frameOuter]: true,
    [styles[kind]]: !!kind,
  });

  return (
    <div className={classes} ref={wrapperRef}>
      <div
        className={styles.frame}
        ref={frameRef}
        style={{ transform: `scale(${scale})` }}
      >
        <img src={screenOnboarding} alt="E-Paper Frame" />
        <div className={styles.frameInside}>
          <div className={styles.qrCode}>
            <FontAwesomeIcon icon={icon || faQrcode} />
          </div>
          <h4>{heading}</h4>
          <p>{text}</p>
        </div>
      </div>
    </div>
  );
}
