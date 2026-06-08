import { faCheck } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { LibraryCard } from "components/Epaper/PaperLibrary";
import { devicesApi } from "ducks/devices";
import React, { useMemo } from "react";
import styles from "./paperSelectionGrid.module.scss";

type PaperSelectionGridProps = {
  papers: any[];
  organization?: string;
  selectedPaperIds?: Record<string, boolean>;
  onTogglePaper: (paperId: string) => void;
  inputType?: "checkbox" | "radio";
  inputName?: string;
};

export default function PaperSelectionGrid({
  papers,
  organization,
  selectedPaperIds = {},
  onTogglePaper,
  inputType = "checkbox",
  inputName = "paper-selection",
}: PaperSelectionGridProps) {
  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization },
  );

  const deviceLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    devices.data?.forEach((device: any) => {
      const label = device?.name || device?.deviceId || device?.id;
      if (device?.id) {
        lookup[device.id] = label;
      }
    });
    return lookup;
  }, [devices.data]);

  return (
    <div className={styles.paperSelector}>
      {papers.map((paper: any) => {
        const isSelected = Boolean(selectedPaperIds?.[paper.id]);

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
                  paper?.deviceId ? deviceLookup[paper.deviceId] : undefined
                }
                disableNavigation
              />

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
