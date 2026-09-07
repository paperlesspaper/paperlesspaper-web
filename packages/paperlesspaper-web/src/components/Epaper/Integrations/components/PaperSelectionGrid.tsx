import {
  faCheck,
  faTriangleExclamation,
} from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LibraryCard } from "components/Epaper/PaperLibrary";
import { devicesApi } from "ducks/devices";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { haveDifferentFrameSizes } from "./frameSize";
import styles from "./paperSelectionGrid.module.scss";

type PaperSelectionGridProps = {
  papers: any[];
  organization?: string;
  selectedPaperIds?: Record<string, boolean>;
  onTogglePaper: (paperId: string) => void;
  inputType?: "checkbox" | "radio";
  inputName?: string;
  expectedFrameKind?: string;
};

export default function PaperSelectionGrid({
  papers,
  organization,
  selectedPaperIds = {},
  onTogglePaper,
  inputType = "checkbox",
  inputName = "paper-selection",
  expectedFrameKind,
}: PaperSelectionGridProps) {
  const { t } = useTranslation();
  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization },
  );

  const deviceLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    devices.data?.forEach((device: any) => {
      if (device?.id) {
        lookup[device.id] = device;
      }
    });
    return lookup;
  }, [devices.data]);

  return (
    <div className={styles.paperSelector}>
      {papers.map((paper: any) => {
        const isSelected = Boolean(selectedPaperIds?.[paper.id]);
        const paperDevice = paper?.deviceId
          ? deviceLookup[paper.deviceId]
          : undefined;
        const paperFrameKind = paper?.meta?.frameKind || paperDevice?.kind;
        const hasDifferentSize = haveDifferentFrameSizes(
          expectedFrameKind,
          paperFrameKind,
        );

        return (
          <div key={paper.id} className={styles.paper}>
            <label
              className={`${styles.checkboxCard} ${
                isSelected ? styles.checkboxCardSelected : ""
              }`}
            >
              <input
                type={inputType}
                name={inputName}
                className={styles.checkboxInput}
                checked={isSelected}
                onChange={() => onTogglePaper(paper.id)}
              />

              <LibraryCard
                paper={paper}
                organization={organization || ""}
                deviceName={
                  paperDevice?.name ||
                  paperDevice?.deviceId ||
                  paperDevice?.id
                }
                disableNavigation
              />

              {hasDifferentSize && (
                <span
                  className={styles.warningBadge}
                  role="img"
                  aria-label={t("Different size")}
                  title={t("Different size")}
                >
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                </span>
              )}

              <span className={styles.checkBadge} aria-hidden="true">
                <FontAwesomeIcon icon={faCheck} />
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
