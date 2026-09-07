import React from "react";
import styles from "./photoFrame.module.scss";

const WOOD_RAILS = [
  { className: styles.frameWoodRailTop, side: "top" },
  { className: styles.frameWoodRailRight, side: "right" },
  { className: styles.frameWoodRailBottom, side: "bottom" },
  { className: styles.frameWoodRailLeft, side: "left" },
] as const;

const MITER_JOINTS = [
  { className: styles.cornerDecorationTopLeft, corner: "top-left" },
  { className: styles.cornerDecorationTopRight, corner: "top-right" },
  { className: styles.cornerDecorationBottomRight, corner: "bottom-right" },
  { className: styles.cornerDecorationBottomLeft, corner: "bottom-left" },
] as const;

export default function FrameDecoration() {
  return (
    <div
      aria-hidden="true"
      className={styles.frameDecoration}
      data-frame-decoration
    >
      <div className={styles.frameWoodGrain} data-frame-wood-grain>
        {WOOD_RAILS.map(({ className, side }) => (
          <span
            className={`${styles.frameWoodRail} ${className}`}
            data-frame-wood-rail={side}
            key={side}
          />
        ))}
      </div>
      <div className={styles.frameDecoratedHighlight} />
      {MITER_JOINTS.map(({ className, corner }) => (
        <span
          className={`${styles.corner} ${className}`}
          data-frame-miter-joint={corner}
          key={corner}
        />
      ))}
    </div>
  );
}
