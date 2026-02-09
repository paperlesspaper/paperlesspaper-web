import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Trans } from "react-i18next";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import styles from "./sleepTimeSlider.module.scss";
import { useIsDesktop } from "@internetderdinge/web";
import { Callout } from "@progressiveui/react";

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
  const isDesktop = useIsDesktop();

  if (!options || options.length === 0) return null;

  const preferredDefaultIndex = options.findIndex(
    (option) => option.key === 3600
  );
  const defaultIndex = preferredDefaultIndex >= 0 ? preferredDefaultIndex : 0;
  const normalizedValue = value ?? options[defaultIndex].key;
  const selectedIndex = options.findIndex(
    (option) => `${option.key}` === `${normalizedValue}`
  );
  const safeIndex = selectedIndex >= 0 ? selectedIndex : defaultIndex;
  const selectedOption = options[safeIndex] ?? options[defaultIndex];
  const isOneMinuteSelected = selectedOption?.key === 60;
  const selectionClassName = isOneMinuteSelected
    ? `${styles.selection} ${styles.selectionWarning}`
    : styles.selection;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = Number(event.target.value);
    const option = options[newIndex];
    if (option) {
      onChange(option.key.toString());
    }
  };

  return (
    <div className={styles.wrapper}>
      <input
        className={styles.range}
        type="range"
        min={0}
        max={Math.max(options.length - 1, 0)}
        step={1}
        value={safeIndex}
        onChange={handleChange}
        onBlur={onBlur}
        name={name}
        ref={inputRef}
        aria-valuemin={0}
        aria-valuemax={Math.max(options.length - 1, 0)}
        aria-valuenow={safeIndex}
        aria-valuetext={selectedOption.name}
      />

      <div
        className={styles.marks}
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
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
