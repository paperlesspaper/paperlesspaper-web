import React from "react";
import { Trans } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQrcode } from "@fortawesome/pro-solid-svg-icons";
import {
  Checkbox,
  PasswordInput,
  Select,
  SelectItem,
  TextInput,
} from "@progressiveui/react";
import EditorButton from "./EditorButton";
import useEditor from "./useEditor";
import { useImageEditorContext } from "./ImageEditor";
import { faEye, faEyeSlash } from "@fortawesome/pro-regular-svg-icons";
import styles from "./qrCodeSettings.module.scss";
import type {
  QrCodeConfig,
  QrCodeMode,
  QrCodeStylePreset,
  QrCodeWifiSecurity,
} from "./qrCodeUtils";

const DEFAULT_QR_CONFIG: QrCodeConfig = {
  mode: "url",
  url: "https://",
  stylePreset: "classic",
  margin: 8,
  errorCorrectionLevel: "M",
};

function normalizeConfig(input: any): QrCodeConfig {
  const cfg: QrCodeConfig = {
    ...DEFAULT_QR_CONFIG,
    ...(input || {}),
  };

  if (cfg.mode === "wifi") {
    cfg.wifi = {
      ssid: cfg.wifi?.ssid || "",
      password: cfg.wifi?.password || "",
      security: (cfg.wifi?.security || "WPA") as QrCodeWifiSecurity,
      hidden: Boolean(cfg.wifi?.hidden),
    };
  }

  return cfg;
}

const QR_DRAFT_PATH = "qrDraft";

function ModalComponent({ registerPrimaryAction }: any) {
  const { fabricRef, imageEditorTools }: any = useImageEditorContext();
  const { form }: any = useEditor();
  const activeObject = imageEditorTools?.activeObject;

  if (!activeObject || activeObject?.memoElementType !== "qr") return null;

  const mode: QrCodeMode =
    form?.watch?.(`${QR_DRAFT_PATH}.mode`) ||
    normalizeConfig(activeObject.qrConfig).mode;

  const url: string =
    form?.watch?.(`${QR_DRAFT_PATH}.url`) ||
    normalizeConfig(activeObject.qrConfig).url ||
    "";

  const ssid: string =
    form?.watch?.(`${QR_DRAFT_PATH}.wifi.ssid`) ||
    normalizeConfig(activeObject.qrConfig).wifi?.ssid ||
    "";

  const password: string =
    form?.watch?.(`${QR_DRAFT_PATH}.wifi.password`) ||
    normalizeConfig(activeObject.qrConfig).wifi?.password ||
    "";

  const security: QrCodeWifiSecurity = (form?.watch?.(
    `${QR_DRAFT_PATH}.wifi.security`,
  ) ||
    normalizeConfig(activeObject.qrConfig).wifi?.security ||
    "WPA") as QrCodeWifiSecurity;

  const hidden: boolean = Boolean(
    form?.watch?.(`${QR_DRAFT_PATH}.wifi.hidden`) ??
    normalizeConfig(activeObject.qrConfig).wifi?.hidden,
  );

  const stylePreset: QrCodeStylePreset = (form?.watch?.(
    `${QR_DRAFT_PATH}.stylePreset`,
  ) || normalizeConfig(activeObject.qrConfig).stylePreset) as QrCodeStylePreset;

  const errorCorrectionLevel = (form?.watch?.(
    `${QR_DRAFT_PATH}.errorCorrectionLevel`,
  ) ??
    normalizeConfig(activeObject.qrConfig).errorCorrectionLevel ??
    "M") as NonNullable<QrCodeConfig["errorCorrectionLevel"]>;

  React.useEffect(() => {
    // when selecting a different QR element, sync form state
    if (!form?.setValue) return;

    const next = normalizeConfig(activeObject.qrConfig);

    form.setValue(`${QR_DRAFT_PATH}.mode`, next.mode, { shouldDirty: false });
    form.setValue(`${QR_DRAFT_PATH}.url`, next.url || "", {
      shouldDirty: false,
    });
    form.setValue(`${QR_DRAFT_PATH}.stylePreset`, next.stylePreset, {
      shouldDirty: false,
    });

    form.setValue(
      `${QR_DRAFT_PATH}.errorCorrectionLevel`,
      next.errorCorrectionLevel || "M",
      { shouldDirty: false },
    );

    form.setValue(`${QR_DRAFT_PATH}.wifi.ssid`, next.wifi?.ssid || "", {
      shouldDirty: false,
    });
    form.setValue(`${QR_DRAFT_PATH}.wifi.password`, next.wifi?.password || "", {
      shouldDirty: false,
    });
    form.setValue(
      `${QR_DRAFT_PATH}.wifi.security`,
      (next.wifi?.security || "WPA") as QrCodeWifiSecurity,
      { shouldDirty: false },
    );
    form.setValue(`${QR_DRAFT_PATH}.wifi.hidden`, Boolean(next.wifi?.hidden), {
      shouldDirty: false,
    });
  }, [activeObject]);

  const apply = React.useCallback(async () => {
    if (!form?.getValues) return;

    const draft = form.getValues(QR_DRAFT_PATH) || {};

    const next: QrCodeConfig = {
      mode: (draft.mode || mode) as QrCodeMode,
      stylePreset: (draft.stylePreset || stylePreset) as QrCodeStylePreset,
      margin: 8,
      errorCorrectionLevel: (draft.errorCorrectionLevel ??
        errorCorrectionLevel) as NonNullable<
        QrCodeConfig["errorCorrectionLevel"]
      >,
      ...((draft.mode || mode) === "url"
        ? { url: String(draft.url ?? url ?? "") }
        : {
            wifi: {
              ssid: String(draft?.wifi?.ssid ?? ssid ?? ""),
              password: String(draft?.wifi?.password ?? password ?? ""),
              security: (draft?.wifi?.security ??
                security) as QrCodeWifiSecurity,
              hidden: Boolean(draft?.wifi?.hidden ?? hidden),
            },
          }),
    };

    await imageEditorTools.updateQrCodeObject({
      obj: activeObject,
      config: next,
    });
    fabricRef.current.requestRenderAll?.();
  }, [
    activeObject,
    errorCorrectionLevel,
    fabricRef,
    form,
    hidden,
    imageEditorTools,
    mode,
    password,
    security,
    ssid,
    stylePreset,
    url,
  ]);

  React.useEffect(() => {
    if (typeof registerPrimaryAction !== "function") return;
    registerPrimaryAction(apply);
    return () => registerPrimaryAction(null);
  }, [registerPrimaryAction, apply]);

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <Select
          labelText={<Trans>Mode</Trans>}
          value={mode}
          onChange={(e) =>
            form?.setValue?.(`${QR_DRAFT_PATH}.mode`, e.target.value)
          }
        >
          <SelectItem value="url" text="URL" />
          <SelectItem value="wifi" text="WiFi" />
        </Select>
      </div>

      {mode === "url" && (
        <div className={styles.row}>
          <TextInput
            labelText={<Trans>URL</Trans>}
            helperText={<Trans>Tip: use a full URL (https://…)</Trans>}
            value={url}
            onChange={(e) =>
              form?.setValue?.(`${QR_DRAFT_PATH}.url`, e.target.value)
            }
            placeholder="https://example.com"
          />
        </div>
      )}

      {mode === "wifi" && (
        <>
          <div className={styles.row}>
            <TextInput
              labelText={<Trans>SSID</Trans>}
              value={ssid}
              onChange={(e) =>
                form?.setValue?.(`${QR_DRAFT_PATH}.wifi.ssid`, e.target.value)
              }
              placeholder="My WiFi"
            />
          </div>

          <div className={styles.row}>
            <PasswordInput
              labelText={<Trans>Password</Trans>}
              value={password}
              onChange={(e) =>
                form?.setValue?.(
                  `${QR_DRAFT_PATH}.wifi.password`,
                  e.target.value,
                )
              }
              className={styles.passwordInput}
              placeholder="••••••••"
              showPasswordLabelText={<FontAwesomeIcon icon={faEye} />}
              hidePasswordLabelText={<FontAwesomeIcon icon={faEyeSlash} />}
            />
          </div>

          <div className={styles.row}>
            <Select
              value={security}
              labelText={<Trans>Security</Trans>}
              onChange={(e) =>
                form?.setValue?.(
                  `${QR_DRAFT_PATH}.wifi.security`,
                  e.target.value,
                )
              }
            >
              <SelectItem value="WPA" text="WPA/WPA2/WPA3" />
              <SelectItem value="WEP" text="WEP" />
              <SelectItem value="nopass" text="Open (no password)" />
            </Select>
          </div>

          <Checkbox
            id="qr-wifi-hidden"
            checked={hidden}
            labelText={<Trans>Hidden network</Trans>}
            wrapperClassName={styles.checkboxRow}
            onChange={(_, checked) =>
              form?.setValue?.(`${QR_DRAFT_PATH}.wifi.hidden`, Boolean(checked))
            }
          />
        </>
      )}

      <div className={styles.row}>
        <Select
          value={stylePreset}
          labelText={<Trans>Style</Trans>}
          onChange={(e) =>
            form?.setValue?.(`${QR_DRAFT_PATH}.stylePreset`, e.target.value)
          }
        >
          <SelectItem value="classic" text="Classic" />
          <SelectItem value="dots" text="Dots" />
          <SelectItem value="rounded" text="Rounded" />
          <SelectItem value="inverted" text="Inverted" />
        </Select>
      </div>

      <div className={styles.row}>
        <Select
          labelText={<Trans>Error Correction Level</Trans>}
          value={errorCorrectionLevel}
          onChange={(e) =>
            form?.setValue?.(
              `${QR_DRAFT_PATH}.errorCorrectionLevel`,
              e.target.value,
            )
          }
        >
          <SelectItem value="L" text="Error correction: L (7%)" />
          <SelectItem value="M" text="Error correction: M (15%)" />
          <SelectItem value="Q" text="Error correction: Q (25%)" />
          <SelectItem value="H" text="Error correction: H (30%)" />
        </Select>
      </div>
    </div>
  );
}

export default function QrCodeSettings() {
  const { fabricRef }: any = useImageEditorContext();

  const activeObject = fabricRef?.current?.getActiveObject?.();
  console.log("activeObject", activeObject);
  //  if (!activeObject || activeObject?.memoElementType !== "qr") return null;

  const buttonLabel = activeObject?.qrConfig ? (
    <Trans>Change</Trans>
  ) : (
    <Trans>QR Code</Trans>
  );

  return (
    <EditorButton
      id="qrCodeSettings"
      kind="secondary"
      text={buttonLabel}
      icon={<FontAwesomeIcon icon={faQrcode} />}
      modalComponent={ModalComponent}
      modalHeading={buttonLabel}
    />
  );
}
