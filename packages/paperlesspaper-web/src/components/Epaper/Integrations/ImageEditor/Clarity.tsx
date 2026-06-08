import { faAperture } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import {
  ensureEpdImageAdjustmentsFilter,
  getSettingsFromFilter,
  registerEpdImageAdjustmentsIfNeeded,
  useCanvas2dFilterBackend,
} from "./imageAdjustmentFilters";
import { useImageEditorContext } from "./ImageEditor";
import ValueChanger from "./ValueChanger";

export const registerClarityIfNeeded = registerEpdImageAdjustmentsIfNeeded;

function getActiveImage(fabricRef: any) {
  const img = fabricRef?.current?.getActiveObject?.();
  if (!img || img.type !== "image") return null;
  img.filters ||= [];
  return img;
}

const ModalComponent = () => {
  const { fabricRef }: any = useImageEditorContext();
  const applyTimeout = React.useRef<number | null>(null);

  const getCurrentClarityValue = () => {
    const img = getActiveImage(fabricRef);
    const filter = img ? ensureEpdImageAdjustmentsFilter(img) : null;
    return getSettingsFromFilter(filter).clarityAmount.toString();
  };

  const updateClarity = (value: number) => {
    const img = getActiveImage(fabricRef);
    if (!img) return;

    const filter = ensureEpdImageAdjustmentsFilter(img);
    if (!filter) return;

    filter.clarityAmount = value;
    filter.clarityRadius = filter.clarityRadius ?? 1.5;
    filter.clarityMidtone = filter.clarityMidtone ?? 1.2;

    if (applyTimeout.current !== null) {
      window.clearTimeout(applyTimeout.current);
    }

    applyTimeout.current = window.setTimeout(() => {
      useCanvas2dFilterBackend();
      img.applyFilters?.();
      fabricRef.current?.requestRenderAll?.();
      applyTimeout.current = null;
    }, 70);
  };

  useEffect(
    () => () => {
      if (applyTimeout.current !== null) {
        window.clearTimeout(applyTimeout.current);
      }
    },
    [],
  );

  return (
    <ValueChanger
      defaultValue={getCurrentClarityValue()}
      min="-1"
      max="1"
      step="0.02"
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(event.target.value);
        updateClarity(Number.isNaN(value) ? 0 : value);
      }}
    >
      <Trans>Clarity</Trans>
    </ValueChanger>
  );
};

export default function Clarity() {
  useEffect(() => {
    registerEpdImageAdjustmentsIfNeeded();
    useCanvas2dFilterBackend();
  }, []);

  return (
    <EditorButton
      id="clarity"
      kind="secondary"
      text={<Trans>Clarity</Trans>}
      icon={<FontAwesomeIcon icon={faAperture} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
