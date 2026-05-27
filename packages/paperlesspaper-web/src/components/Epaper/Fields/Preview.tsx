import React from "react";
import PreviewDitheringTool from "./PreviewDitheringTool";
import styles from "./preview.module.scss";
import type {
  PreviewDitheringDebugInfo,
  PreviewDitheringSettings,
} from "./PreviewDitheringTool/types";

type PreviewProps = {
  previewImage: string;
  previewImageRef: React.RefObject<HTMLImageElement>;
  ditheringSettings: PreviewDitheringSettings;
  previewDebugInfo?: PreviewDitheringDebugInfo | null;
  isDebug?: boolean;
  isRefreshingPreview?: boolean;
  onDitheringSettingsChange: (settings: PreviewDitheringSettings) => void;
  onRefreshPreview: () => void | Promise<void>;
};

export default function Preview({
  previewImage,
  previewImageRef,
  ditheringSettings,
  previewDebugInfo,
  isDebug,
  isRefreshingPreview,
  onDitheringSettingsChange,
  onRefreshPreview,
}: PreviewProps) {
  const [zoom, setZoom] = React.useState(false);
  return (
    <div className={styles.previewLayout}>
      <div
        className={`${styles.previewWrapper} ${
          zoom ? styles.zoomIn : styles.zoomOut
        }`}
      >
        <img
          alt="Preview for the epaper display"
          src={previewImage}
          className={styles.previewImage}
          ref={previewImageRef}
          onClick={() => setZoom(!zoom)}
        />
      </div>
      <div className={styles.settingsPane}>
        <PreviewDitheringTool
          className={styles.settingsTool}
          settings={ditheringSettings}
          debugInfo={previewDebugInfo}
          isDebug={isDebug}
          isRefreshing={isRefreshingPreview}
          onChange={onDitheringSettingsChange}
          onRefreshPreview={onRefreshPreview}
        />
      </div>
    </div>
  );
}
