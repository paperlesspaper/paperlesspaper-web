import { faRectangleVertical } from "@fortawesome/pro-regular-svg-icons";
import { faCheck } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useMemo } from "react";
import { Trans } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./slidesSettings.module.scss";
import { papersApi } from "ducks/ePaper/papersApi";
import { useParams } from "react-router-dom";
import { LibraryCard } from "components/Epaper/PaperLibrary";
import { devicesApi } from "ducks/devices";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { organization } = useParams();

  const selectedPapers = form.watch("meta.selectedPapers") || {};

  const papers = papersApi.useGetAllPapersQuery(
    {
      queryOptions: {
        organization: organization,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: !organization,
    }
  );

  const papersFiltered =
    papers.data?.filter((paper: any) => {
      return paper.kind !== "slides";
    }) ?? [];

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: organization },
    { skip: !organization }
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
    <div>
      <div className={styles.slideSelector}>
        {papersFiltered.length > 0 && (
          <>
            {papersFiltered.map((paper: any) => {
              const isSelected = Boolean(selectedPapers?.[paper.id]);

              return (
                <div key={paper.id} className={styles.paper}>
                  <label
                    className={`${styles.checkboxCard} ${
                      isSelected ? styles.checkboxCardSelected : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      {...form.register(`meta.selectedPapers.${paper.id}`)}
                    />

                    <LibraryCard
                      key={paper.id}
                      paper={paper}
                      organization={organization}
                      deviceName={
                        paper?.deviceId
                          ? deviceLookup[paper.deviceId]
                          : undefined
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
          </>
        )}
      </div>
    </div>
  );
};

export default function SlidesSettings() {
  return (
    <EditorButton
      id="slides-settings"
      kind="secondary"
      text={<Trans>Slides</Trans>}
      icon={<FontAwesomeIcon icon={faRectangleVertical} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Select slides</Trans>}
    />
  );
}
