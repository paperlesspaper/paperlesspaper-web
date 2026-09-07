import classNames from "classnames";
import React, { useLayoutEffect, useRef, useState } from "react";
import FrameDecoration from "./FrameDecoration";
import styles from "./photoFrame.module.scss";
import {
  containFrame,
  DEFAULT_FRAME_FINISH,
  EMPTY_FRAME_DECORATION,
  type ContainedFrameLayout,
  type FrameFinish,
  type FrameSize,
  PRIMARY_FRAME_DECORATION,
} from "./photoFrameModel";

type FrameViewportProps = {
  children: (layout: ContainedFrameLayout) => React.ReactNode;
  decorated?: boolean;
  frameFinish?: FrameFinish;
  size: FrameSize;
};

const FRAME_FINISH_CLASS_NAMES: Record<FrameFinish, string> = {
  black: styles.frameFinishBlack,
  "light-wood": styles.frameFinishLightWood,
  white: styles.frameFinishWhite,
};

export default function FrameViewport({
  children,
  decorated = false,
  frameFinish = DEFAULT_FRAME_FINISH,
  size,
}: FrameViewportProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState<FrameSize>({
    width: 0,
    height: 0,
  });

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const update = () => {
      // Auto-height overview pages grow with the frame. Their current height
      // is an output of this calculation, not an available-space constraint.
      const constrainHeight =
        window
          .getComputedStyle(element)
          .getPropertyValue("--frame-constrain-height")
          .trim() !== "0";
      const nextSize = {
        width: element.clientWidth,
        height: constrainHeight ? element.clientHeight : 0,
      };

      setAvailable((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize
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
  }, []);

  const layout = containFrame(
    available,
    size,
    decorated ? PRIMARY_FRAME_DECORATION : EMPTY_FRAME_DECORATION
  );
  const chromeStyle = {
    "--frame-padding": `${layout.decoration.framePadding}px`,
    "--frame-mat-padding": `${layout.decoration.matPadding}px`,
    height: `${layout.frame.height}px`,
    width: `${layout.frame.width}px`,
  } as React.CSSProperties;

  return (
    <div className={styles.frameStage} data-frame-stage ref={stageRef}>
      <div
        className={classNames(styles.frameChrome, {
          [styles.frameChromeDecorated]: decorated,
          [FRAME_FINISH_CLASS_NAMES[frameFinish]]: decorated,
        })}
        data-frame-chrome
        data-frame-finish={decorated ? frameFinish : undefined}
        style={chromeStyle}
      >
        {decorated && <FrameDecoration />}
        <div
          className={classNames(styles.frameMat, {
            [styles.frameMatDecorated]: decorated,
          })}
          data-frame-mat
        >
          <div
            className={styles.frameViewport}
            data-frame-viewport
            style={{
              aspectRatio: `${size.width} / ${size.height}`,
              height: `${layout.viewport.height}px`,
              width: `${layout.viewport.width}px`,
            }}
          >
            {layout.scale > 0 ? children(layout) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
