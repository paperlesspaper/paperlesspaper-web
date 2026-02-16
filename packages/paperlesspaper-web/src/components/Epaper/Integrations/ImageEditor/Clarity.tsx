import { faCircleHalfStroke } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import EditorButton from "./EditorButton";
import ValueChanger from "./ValueChanger";
import * as fabric from "fabric";
import { useImageEditorContext } from "./ImageEditor";

// Choose a stable slot in your filter chain
const CLARITY_FILTER_INDEX = 9;

export const registerClarityIfNeeded = () => {
  const hasClarity = (fabric as any).Image?.filters?.Clarity;
  if (hasClarity) return;

  (fabric as any).Image.filters.Clarity = fabric.util.createClass(
    fabric.Image.filters.BaseFilter,
    {
      type: "Clarity",
      initialize: function (options: any = {}) {
        this.amount = options.amount ?? 0.35; // -1..1
        this.radius = options.radius ?? 2; // 1..4 sensible
        this.midtone = options.midtone ?? 1.2;
      },
      toObject: function () {
        return fabric.util.object.extend(this.callSuper("toObject"), {
          amount: this.amount,
          radius: this.radius,
          midtone: this.midtone,
        });
      },
      applyTo2d: function (opts: any) {
        const { imageData } = opts;
        const { data, width, height } = imageData;
        const src = new Uint8ClampedArray(data);

        // separable box blur
        const r = Math.max(1, Math.min(4, Math.round(this.radius)));
        const tmp = new Uint8ClampedArray(data.length);
        const blurred = new Uint8ClampedArray(data.length);

        // horizontal
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sR = 0,
              sG = 0,
              sB = 0,
              sA = 0,
              c = 0;
            for (let k = -r; k <= r; k++) {
              const xi = Math.max(0, Math.min(width - 1, x + k));
              const i = (y * width + xi) * 4;
              sR += src[i];
              sG += src[i + 1];
              sB += src[i + 2];
              sA += src[i + 3];
              c++;
            }
            const o = (y * width + x) * 4;
            tmp[o] = sR / c;
            tmp[o + 1] = sG / c;
            tmp[o + 2] = sB / c;
            tmp[o + 3] = sA / c;
          }
        }
        // vertical
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            let sR = 0,
              sG = 0,
              sB = 0,
              sA = 0,
              c = 0;
            for (let k = -r; k <= r; k++) {
              const yi = Math.max(0, Math.min(height - 1, y + k));
              const i = (yi * width + x) * 4;
              sR += tmp[i];
              sG += tmp[i + 1];
              sB += tmp[i + 2];
              sA += tmp[i + 3];
              c++;
            }
            const o = (y * width + x) * 4;
            blurred[o] = sR / c;
            blurred[o + 1] = sG / c;
            blurred[o + 2] = sB / c;
            blurred[o + 3] = sA / c;
          }
        }

        const amt = this.amount;
        const gamma = this.midtone;

        for (let i = 0; i < data.length; i += 4) {
          const r0 = src[i],
            g0 = src[i + 1],
            b0 = src[i + 2];

          const hpR = r0 - blurred[i];
          const hpG = g0 - blurred[i + 1];
          const hpB = b0 - blurred[i + 2];

          // midtone mask
          const L = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
          let w = 1 - Math.abs(2 * L - 1);
          w = Math.pow(Math.max(0, Math.min(1, w)), gamma);

          const r1 = r0 + amt * hpR * w;
          const g1 = g0 + amt * hpG * w;
          const b1 = b0 + amt * hpB * w;

          data[i] = r1 < 0 ? 0 : r1 > 255 ? 255 : r1 | 0;
          data[i + 1] = g1 < 0 ? 0 : g1 > 255 ? 255 : g1 | 0;
          data[i + 2] = b1 < 0 ? 0 : b1 > 255 ? 255 : b1 | 0;
        }
      },
    },
  );

  (fabric as any).Image.filters.Clarity.fromObject = function (
    obj: any,
    cb?: (f: any) => void,
  ) {
    const inst = new (fabric as any).Image.filters.Clarity(obj);
    return cb ? cb(inst) : inst;
  };
};

// ---------- Modal (slider) ----------
const ModalComponent = () => {
  const { fabricRef }: any = useImageEditorContext();

  function withActiveImage(fn: (img: any) => void) {
    const canvas = fabricRef?.current;
    const img = canvas?.getActiveObject?.();
    if (!img || img.type !== "image") return;
    fn(img);
    img.applyFilters();
    canvas.renderAll?.();
  }

  function ensureClarity(img: any) {
    img.filters ||= [];
    const F = (fabric as any).Image.filters.Clarity;
    if (!(img.filters[CLARITY_FILTER_INDEX] instanceof F)) {
      img.filters[CLARITY_FILTER_INDEX] = new F({
        amount: 0.35,
        radius: 2,
        midtone: 1.2,
      });
    }
    return img.filters[CLARITY_FILTER_INDEX];
  }

  return (
    <ValueChanger
      defaultValue="0.35"
      min="-1"
      max="1"
      step="0.02"
      onChange={(e: any) => {
        const v = parseFloat(e.target.value);
        withActiveImage((img) => {
          const clarity = ensureClarity(img);
          // optional non-linear mapping for nicer feel
          const amount = Math.sign(v) * Math.pow(Math.abs(v), 1.1);
          clarity.amount = amount;
        });
      }}
    >
      <Trans>Clarity</Trans>
    </ValueChanger>
  );
};

export default function Clarity() {
  const { fabricRef }: any = useImageEditorContext();

  // Register filter + force Canvas2D backend when this component mounts
  useEffect(() => {
    registerClarityIfNeeded();

    // Force Canvas2D (no WebGL)
    const Canvas2dFB =
      (fabric as any).Canvas2dFilterBackend ||
      (fabric as any).Canvas2DFilterBackend;
    if (Canvas2dFB) {
      (fabric as any).filterBackend = new Canvas2dFB();
    }

    // If a canvas and active image already exist, re-apply to reflect backend swap
    const canvas = fabricRef?.current;
    const img = canvas?.getActiveObject?.();
    if (img && img.type === "image") {
      img.applyFilters();
      canvas.requestRenderAll?.();
    }
  }, [fabricRef]);

  return (
    <EditorButton
      id="clarity"
      kind="secondary"
      text={<Trans>Clarity</Trans>}
      icon={<FontAwesomeIcon icon={faCircleHalfStroke} />}
      modalComponent={ModalComponent}
      modalKind="slider"
    />
  );
}
