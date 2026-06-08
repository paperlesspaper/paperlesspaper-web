import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { isMobile, isTablet } from "react-device-detect";
import styles from "./valueChanger.module.scss";

type ValueChangerProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  defaultPoint?: number | string;
  minimal?: boolean;
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

function getStepValue(
  step: React.InputHTMLAttributes<HTMLInputElement>["step"]
) {
  if (step === "any") return null;
  const parsed = Number(step ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

const TICK_COUNT = 49;

type ValueChangerInputProps = Omit<
  ValueChangerProps,
  "children" | "defaultPoint" | "minimal"
>;

function useValueChanger({
  min = "-1",
  max = "1",
  step,
  value,
  defaultValue = "0",
  defaultPoint,
  onChange,
}: Omit<ValueChangerProps, "children">) {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const minValue = numberFromValue(min, -1);
  const maxValue = numberFromValue(max, 1);
  const initialValue = value ?? defaultValue;
  const [currentValue, setCurrentValue] = useState(() =>
    numberFromValue(initialValue, 0)
  );
  const currentValueRef = useRef(currentValue);

  useEffect(() => {
    if (value === undefined) return;
    setCurrentValue((previousValue) => {
      const nextValue = numberFromValue(value, previousValue);
      currentValueRef.current = nextValue;
      return nextValue;
    });
  }, [value]);

  const defaultMarkerValue = useMemo(() => {
    if (defaultPoint !== undefined) {
      return numberFromValue(defaultPoint, minValue);
    }
    return minValue <= 0 && maxValue >= 0 ? 0 : minValue;
  }, [defaultPoint, maxValue, minValue]);

  const range = maxValue - minValue || 1;
  const valuePercent = clampPercent(((currentValue - minValue) / range) * 100);
  const defaultPercent = clampPercent(
    ((defaultMarkerValue - minValue) / range) * 100
  );
  const stepValue = getStepValue(step);
  const inputPrecision = Math.max(
    getDecimalPlaces(step),
    getDecimalPlaces(min),
    getDecimalPlaces(max)
  );
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
    const nextValue = numberFromValue(event.target.value, currentValue);
    currentValueRef.current = nextValue;
    setCurrentValue(nextValue);
    onChange?.(event);
  };

  const normalizeValue = (nextValue: number) => {
    const clampedValue = Math.min(Math.max(nextValue, minValue), maxValue);
    const snappedValue =
      stepValue === null
        ? clampedValue
        : minValue +
          Math.round((clampedValue - minValue) / stepValue) * stepValue;

    return Number(
      Math.min(Math.max(snappedValue, minValue), maxValue).toFixed(
        inputPrecision
      )
    );
  };

  const emitInputValue = (nextValue: number) => {
    const input = inputRef.current;
    if (!input) return;

    const normalizedValue = normalizeValue(nextValue);
    const nextInputValue = normalizedValue.toString();
    currentValueRef.current = normalizedValue;
    setCurrentValue(normalizedValue);

    const inputWindow = input.ownerDocument.defaultView;
    const valueSetter = inputWindow
      ? Object.getOwnPropertyDescriptor(
          inputWindow.HTMLInputElement.prototype,
          "value"
        )?.set
      : undefined;

    if (valueSetter) {
      valueSetter.call(input, nextInputValue);
    } else {
      input.value = nextInputValue;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const getValueAtClientX = (clientX: number, rect: DOMRect) => {
    return minValue + ((clientX - rect.left) / (rect.width || 1)) * range;
  };

  return {
    currentValue,
    defaultMarkerValue,
    defaultPercent,
    displayValue,
    emitInputValue,
    getValueAtClientX,
    handleChange,
    inputRef,
    labelId,
    max,
    min,
    step,
    ticks,
    value,
    valuePercent,
    defaultValue,
    range,
  };
}

function ValueChangerInput({
  inputProps,
  state,
}: {
  inputProps: ValueChangerInputProps;
  state: ReturnType<typeof useValueChanger>;
}) {
  return (
    <input
      {...inputProps}
      ref={state.inputRef}
      type="range"
      min={state.min}
      max={state.max}
      step={state.step}
      value={state.value}
      defaultValue={state.value === undefined ? state.defaultValue : undefined}
      onChange={state.handleChange}
      aria-labelledby={state.labelId}
      className={styles.input}
    />
  );
}

function MobileValueChanger({
  children,
  inputProps,
  minimal = false,
  state,
}: {
  children: React.ReactNode;
  inputProps: ValueChangerInputProps;
  minimal?: boolean;
  state: ReturnType<typeof useValueChanger>;
}) {
  const dragRef = useRef<{
    hasMoved: boolean;
    pointerId: number;
    startValue: number;
    startX: number;
    width: number;
  } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inputProps.disabled) return;

    state.inputRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      hasMoved: false,
      pointerId: event.pointerId,
      startValue: state.currentValue,
      startX: event.clientX,
      width: event.currentTarget.getBoundingClientRect().width || 1,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dragDistance = event.clientX - drag.startX;
    if (!drag.hasMoved && Math.abs(dragDistance) < 2) return;

    drag.hasMoved = true;
    state.emitInputValue(
      drag.startValue - (dragDistance / drag.width) * state.range
    );
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.hasMoved) {
      state.emitInputValue(
        state.getValueAtClientX(
          event.clientX,
          event.currentTarget.getBoundingClientRect()
        )
      );
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const rootClassName = [
    styles.imageAdjust,
    minimal ? styles.minimal : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <div className={styles.alignment}>
        <div className={styles.header}>
          <div id={state.labelId} className={styles.alignmentTitle}>
            {children}
          </div>
        </div>

        <div
          className={[styles.slider, styles.mobileSlider].join(" ")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          style={
            {
              "--value-percent": `${state.valuePercent}%`,
            } as React.CSSProperties
          }
        >
          <div className={styles.tickViewport} aria-hidden="true">
            <div className={styles.tickScale}>
              {state.ticks.map(({ index, tickPercent, isDefault, isMajor }) => (
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
              {state.displayValue}
            </output>
            <span className={styles.centerMarker} aria-hidden="true" />
          </div>
          <ValueChangerInput inputProps={inputProps} state={state} />
        </div>
      </div>
    </div>
  );
}

function DesktopValueChanger({
  children,
  inputProps,
  minimal = false,
  state,
}: {
  children: React.ReactNode;
  inputProps: ValueChangerInputProps;
  minimal?: boolean;
  state: ReturnType<typeof useValueChanger>;
}) {
  const pointerIdRef = useRef<number | null>(null);
  const activeLeft = Math.min(state.defaultPercent, state.valuePercent);
  const activeWidth = Math.abs(state.valuePercent - state.defaultPercent);

  const emitValueAtPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    state.emitInputValue(
      state.getValueAtClientX(
        event.clientX,
        event.currentTarget.getBoundingClientRect()
      )
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inputProps.disabled) return;

    state.inputRef.current?.focus({ preventScroll: true });
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    emitValueAtPointer(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    emitValueAtPointer(event);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
  };

  const rootClassName = [
    styles.imageAdjust,
    minimal ? styles.minimal : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <div className={styles.alignment}>
        <div className={styles.header}>
          <div id={state.labelId} className={styles.alignmentTitle}>
            {children}
          </div>
        </div>

        <div
          className={[styles.slider, styles.desktopSlider].join(" ")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          style={
            {
              "--value-percent": `${state.valuePercent}%`,
            } as React.CSSProperties
          }
        >
          <output className={styles.desktopValue} aria-live="polite">
            {state.displayValue}
          </output>
          <div className={styles.desktopTrack} aria-hidden="true">
            <span className={styles.desktopRail} />
            <span
              className={styles.desktopActiveRail}
              style={{
                left: `${activeLeft}%`,
                width: `${activeWidth}%`,
              }}
            />
            <span
              className={styles.desktopDefaultMarker}
              style={{ left: `${state.defaultPercent}%` }}
            />
            <span
              className={styles.desktopHandle}
              style={{ left: `${state.valuePercent}%` }}
            />
          </div>
          <ValueChangerInput inputProps={inputProps} state={state} />
        </div>
      </div>
    </div>
  );
}

export default function ValueChanger({
  children,
  min = "-1",
  max = "1",
  step,
  value,
  defaultValue = "0",
  defaultPoint,
  minimal = false,
  onChange,
  ...inputProps
}: ValueChangerProps) {
  const state = useValueChanger({
    min,
    max,
    step,
    value,
    defaultValue,
    defaultPoint,
    onChange,
  });
  const isTouchDevice = isMobile || isTablet;

  if (isTouchDevice) {
    return (
      <MobileValueChanger
        inputProps={inputProps}
        minimal={minimal}
        state={state}
      >
        {children}
      </MobileValueChanger>
    );
  }

  return (
    <DesktopValueChanger
      inputProps={inputProps}
      minimal={minimal}
      state={state}
    >
      {children}
    </DesktopValueChanger>
  );
}
