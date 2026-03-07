import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Trans } from "react-i18next";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import styles from "./sleepTimeSlider.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import { Callout } from "@progressiveui/react";
import { motion } from "framer-motion";

export type SleepTimeOption = {
  key: number;
  name: string;
  nameShort?: string;
  description: string;
  icon?: IconDefinition;
};

type SleepTimeSliderProps = {
  options: SleepTimeOption[];
  value?: string | number;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  name?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

export default function SleepTimeSlider({
  options,
  value,
  onChange,
  onBlur,
  name,
  inputRef,
}: SleepTimeSliderProps) {
  const trackInset = 20;
  const isDesktop = useIsDesktop();
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  if (!options || options.length === 0) return null;

  const preferredDefaultIndex = options.findIndex(
    (option) => option.key === 3600,
  );
  const defaultIndex = preferredDefaultIndex >= 0 ? preferredDefaultIndex : 0;
  const normalizedValue = value ?? options[defaultIndex].key;
  const selectedIndex = options.findIndex(
    (option) => `${option.key}` === `${normalizedValue}`,
  );
  const safeIndex = selectedIndex >= 0 ? selectedIndex : defaultIndex;
  const selectedOption = options[safeIndex] ?? options[defaultIndex];
  const maxIndex = Math.max(options.length - 1, 0);
  const usableTrackWidth = Math.max(trackWidth - trackInset * 2, 0);
  const ratio = maxIndex > 0 ? safeIndex / maxIndex : 0;
  const thumbX = trackInset + ratio * usableTrackWidth;
  const isOneMinuteSelected = selectedOption?.key === 60;
  const selectionClassName = isOneMinuteSelected
    ? `${styles.selection} ${styles.selectionWarning}`
    : styles.selection;

  const updateByIndex = (newIndex: number) => {
    const option = options[newIndex];
    if (option) {
      onChange(option.key.toString());
    }
  };

  const updateByClientX = (clientX: number) => {
    if (!trackRef.current || maxIndex <= 0 || usableTrackWidth <= 0) {
      return;
    }
    const rect = trackRef.current.getBoundingClientRect();
    const startX = rect.left + trackInset;
    const endX = startX + usableTrackWidth;
    const clamped = Math.min(Math.max(clientX, startX), endX);
    const newIndex = Math.round(
      ((clamped - startX) / usableTrackWidth) * maxIndex,
    );
    updateByIndex(newIndex);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    updateByClientX(event.clientX);
  };

  const handleSliderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        updateByIndex(Math.min(safeIndex + 1, maxIndex));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        updateByIndex(Math.max(safeIndex - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        updateByIndex(0);
        break;
      case "End":
        event.preventDefault();
        updateByIndex(maxIndex);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!trackRef.current) {
      return undefined;
    }

    const updateTrackWidth = () => {
      setTrackWidth(trackRef.current?.clientWidth ?? 0);
    };

    updateTrackWidth();

    const observer = new ResizeObserver(updateTrackWidth);
    observer.observe(trackRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const marksTemplate = useMemo(
    () => ({ gridTemplateColumns: `repeat(${options.length}, 1fr)` }),
    [options.length],
  );

  return (
    <div className={styles.wrapper}>
      <div
        ref={trackRef}
        className={styles.slider}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={maxIndex}
        aria-valuenow={safeIndex}
        aria-valuetext={selectedOption.name}
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLDivElement>}
        onKeyDown={handleSliderKeyDown}
        onPointerDown={handlePointerDown}
      >
        <div className={styles.track} />
        <div
          className={styles.trackFill}
          style={{
            left: 0,
            width: `${trackInset + ratio * usableTrackWidth}px`,
          }}
          aria-hidden
        />
        <motion.div
          className={styles.thumb}
          drag="x"
          dragElastic={0}
          dragMomentum={false}
          dragConstraints={{
            left: trackInset,
            right: trackInset + usableTrackWidth,
          }}
          animate={{ x: thumbX }}
          transition={{
            type: "spring",
            stiffness: 550,
            damping: 35,
            mass: 0.2,
          }}
          onDrag={(_, info) => {
            updateByClientX(info.point.x);
          }}
        />
      </div>

      <input
        type="hidden"
        name={name}
        value={selectedOption.key}
        ref={inputRef}
      />

      <div className={styles.marks} style={marksTemplate}>
        {options.map((option, index) => {
          const markClass =
            index === safeIndex
              ? `${styles.mark} ${styles.active}`
              : styles.mark;
          const displayName = isDesktop ? (
            <Trans>{option.name}</Trans>
          ) : (
            option.nameShort || <Trans>{option.name}</Trans>
          );
          return (
            <div key={option.key} className={markClass}>
              <div className={styles.tick} />
              <span className={styles.markLabel}>{displayName}</span>
            </div>
          );
        })}
      </div>

      <Callout
        className={selectionClassName}
        role="note"
        kind={isOneMinuteSelected ? "warning" : "info"}
        title={<Trans>{selectedOption.name}</Trans>}
        icon={
          selectedOption.icon && (
            <span className={styles.icon} aria-hidden>
              <FontAwesomeIcon icon={selectedOption.icon} />
            </span>
          )
        }
      >
        {/*selectedOption.icon && (
          <span className={styles.icon} aria-hidden>
            <FontAwesomeIcon icon={selectedOption.icon} />
          </span>
        ) */}

        <Trans>{selectedOption.description}</Trans>
      </Callout>
    </div>
  );
}
