import React, { useCallback, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLoader } from "@fortawesome/pro-regular-svg-icons";
import { faRectangleVertical } from "@fortawesome/pro-regular-svg-icons";
import { Trans } from "react-i18next";
import styles from "./styles.module.scss";

type PullToRefreshProps = {
  className?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
};

const PULL_THRESHOLD = 80;
const MAX_PULL = 140;

export default function PullToRefresh({
  className,
  children,
  onRefresh,
}: PullToRefreshProps) {
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isInsideModal = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(target.closest(".wfp--modal"));
  }, []);

  const canStartPull = useCallback(() => {
    return window.scrollY <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (isRefreshing || !canStartPull() || isInsideModal(event.target))
        return;
      startYRef.current = event.touches[0].clientY;
      isPullingRef.current = true;
      setIsPulling(true);
    },
    [canStartPull, isInsideModal, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isPullingRef.current || startYRef.current === null) return;
      if (isInsideModal(event.target)) return;
      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      if (!canStartPull()) return;
      event.preventDefault();
      setPullDistance(Math.min(delta, MAX_PULL));
    },
    [canStartPull, isInsideModal]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      if (onRefresh) {
        onRefresh();
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 150);
      }
      return;
    }

    setPullDistance(0);
  }, [isRefreshing, onRefresh, pullDistance]);

  const indicatorState = isRefreshing
    ? "refreshing"
    : pullDistance >= PULL_THRESHOLD
      ? "release"
      : "pull";

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
        transition: isPulling ? "none" : "transform 180ms ease",
      }}
    >
      <div className={styles.pullIndicator} aria-live="polite">
        {indicatorState === "refreshing" ? (
          <span className={styles.pullIndicatorContent}>
            <FontAwesomeIcon
              icon={faLoader}
              className={`${styles.pullIcon} ${styles.pullIconSpin}`}
            />
            <Trans>Refreshing...</Trans>
          </span>
        ) : indicatorState === "release" ? (
          <span className={styles.pullIndicatorContent}>
            <FontAwesomeIcon
              icon={faRectangleVertical}
              className={styles.pullIcon}
              style={{
                transform: `rotate(${Math.min(pullDistance, MAX_PULL) * 2}deg)`,
              }}
            />
            <Trans>Release to refresh</Trans>
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
