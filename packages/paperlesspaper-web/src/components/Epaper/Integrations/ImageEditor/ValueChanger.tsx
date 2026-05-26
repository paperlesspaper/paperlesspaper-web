import React, { useEffect, useId, useMemo, useState } from "react";
import styles from "./valueChanger.module.scss";

type ValueChangerProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  defaultPoint?: number | string;
};

function numberFromValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDecimalPlaces(
  step: React.InputHTMLAttributes<HTMLInputElement>["step"]
) {
  if (typeof step !== "string" && typeof step !== "number") return 0;
  const value = step.toString();
  if (value === "any") return 2;
  return value.includes(".") ? value.split(".")[1].length : 0;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

const TICK_COUNT = 49;

export default function ValueChanger({
  children,
  min = "-1",
  max = "1",
  step,
  value,
  defaultValue = "0",
  defaultPoint,
  onChange,
  ...other
}: ValueChangerProps) {
  const labelId = useId();
  const minValue = numberFromValue(min, -1);
  const maxValue = numberFromValue(max, 1);
  const initialValue = value ?? defaultValue;
  const [currentValue, setCurrentValue] = useState(() =>
    numberFromValue(initialValue, 0)
  );

  useEffect(() => {
    if (value === undefined) return;
    setCurrentValue((previousValue) => numberFromValue(value, previousValue));
  }, [value]);

  const defaultMarkerValue = useMemo(() => {
    if (defaultPoint !== undefined) {
      return numberFromValue(defaultPoint, minValue);
    }
    return minValue <= 0 && maxValue >= 0 ? 0 : minValue;
  }, [defaultPoint, maxValue, minValue]);

  const range = maxValue - minValue || 1;
  const valuePercent = clampPercent(((currentValue - minValue) / range) * 100);
  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const tickPercent = (index / (TICK_COUNT - 1)) * 100;
        const tickValue = minValue + range * (index / (TICK_COUNT - 1));
        const tickDistance = Math.abs(tickValue - defaultMarkerValue);
        const tickStep = range / (TICK_COUNT - 1);

        return {
          index,
          tickPercent,
          isDefault: tickDistance <= tickStep / 2,
          isMajor: index % 4 === 0,
        };
      }),
    [defaultMarkerValue, minValue, range]
  );
  const decimals = getDecimalPlaces(step);
  const roundedValue = currentValue.toFixed(decimals);
  const displayValue =
    defaultMarkerValue === 0 && currentValue > 0
      ? `+${roundedValue}`
      : roundedValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(numberFromValue(event.target.value, currentValue));
    onChange?.(event);
  };

  return (
    <div className={styles.imageAdjust}>
      <div className={styles.alignment}>
        <div className={styles.header}>
          <div id={labelId} className={styles.alignmentTitle}>
            {children}
          </div>
        </div>

        <div
          className={styles.slider}
          style={
            {
              "--value-percent": `${valuePercent}%`,
            } as React.CSSProperties
          }
        >
          <div className={styles.tickViewport} aria-hidden="true">
            <div className={styles.tickScale}>
              {ticks.map(({ index, tickPercent, isDefault, isMajor }) => (
                <span
                  key={index}
                  className={[
                    styles.tick,
                    isMajor ? styles.majorTick : "",
                    isDefault ? styles.defaultTick : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    {
                      "--tick-percent": `${tickPercent}%`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>
          <div className={styles.centerIndicator}>
            <output className={styles.value} aria-live="polite">
              {displayValue}
            </output>
            <span className={styles.centerMarker} aria-hidden="true" />
          </div>
          <input
            {...other}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={handleChange}
            aria-labelledby={labelId}
            className={styles.input}
          />
        </div>
      </div>
    </div>
  );
}
