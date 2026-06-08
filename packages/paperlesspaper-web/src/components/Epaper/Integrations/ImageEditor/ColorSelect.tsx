import React from "react";
import styles from "./colorSelect.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFill } from "@fortawesome/pro-regular-svg-icons";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import { useImageEditorContext } from "./ImageEditor";

const HEX_COLOR_REGEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHexColor(value?: string) {
  const color = value?.trim();
  const match = color?.match(HEX_COLOR_REGEX);

  if (!match) return null;

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((d) => `${d}${d}`)
      .join("")}`.toUpperCase();
  }

  return `#${hex}`.toUpperCase();
}

function ModalComponent() {
  const { colors, setLastColor, lastColor, fabricRef, imageEditorTools }: any =
    useImageEditorContext();
  const [customColor, setCustomColor] = React.useState(
    normalizeHexColor(lastColor) || "#000000",
  );

  React.useEffect(() => {
    const normalized = normalizeHexColor(lastColor);
    if (normalized) setCustomColor(normalized);
  }, [lastColor]);

  const changeColor = (color) => {
    const nextColor = normalizeHexColor(color) || color;

    setLastColor(nextColor);

    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = nextColor;
    }

    const activeObject = fabricRef.current?.getActiveObject?.();
    if (activeObject?.type === "path") {
      activeObject.set({
        stroke: nextColor,
        fill: "",
      });
    } else if (activeObject) {
      activeObject.set("fill", nextColor);
    } else if (imageEditorTools?.activeObject?.type === "drawing") {
      imageEditorTools.prepareDrawingBrush?.();
    }

    fabricRef.current?.renderAll();
  };

  const handleCustomColorChange = (color) => {
    setCustomColor(normalizeHexColor(color) || color);
    changeColor(color);
  };

  if (!colors) return null;

  const normalizedLastColor = normalizeHexColor(lastColor);
  const normalizedCustomColor = normalizeHexColor(customColor) || "#000000";
  const customColorIsActive = !colors.some(
    (d) => normalizeHexColor(d) === normalizedLastColor,
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.colors}>
        {colors.map((d, i) => (
          <button
            type="button"
            key={i}
            className={`${styles.color} ${
              normalizedLastColor === normalizeHexColor(d)
                ? styles.active
                : ""
            }`}
            style={{ backgroundColor: d }}
            onClick={() => changeColor(d)}
            aria-label={`Select color ${d}`}
          />
        ))}

        <label
          className={`${styles.color} ${styles.customColor} ${
            customColorIsActive ? styles.active : ""
          }`}
          style={{
            backgroundColor: normalizedCustomColor,
          }}
          aria-label="Select custom color"
        >
          <input
            className={styles.colorInput}
            type="color"
            value={normalizedCustomColor}
            onChange={(e) => handleCustomColorChange(e.target.value)}
            aria-label="Custom color"
          />
        </label>
      </div>
    </div>
  );
}

export default function ColorSelect() {
  return (
    <EditorButton
      id="color"
      kind="secondary"
      text={<Trans>Color</Trans>}
      icon={<FontAwesomeIcon icon={faFill} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
