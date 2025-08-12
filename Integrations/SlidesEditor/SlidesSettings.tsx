import {
  faGlobe,
  faRectangleVertical,
} from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./slidesSettings.module.scss";
import { useActiveUserDevice } from "helpers/useUsers";
import { papersApi } from "ducks/papersApi";
import PhotoFrame from "components/EpaperOverview/Overview/PhotoFrame";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { t } = useTranslation();

  const activeUserDevices = useActiveUserDevice();

  const papers = papersApi.useGetAllPapersQuery(
    {
      deviceId: activeUserDevices.data?.id,
      queryOptions: {
        deviceId: activeUserDevices.data?.id,
        sortBy: "updatedAt:desc",
      },
    },
    {
      skip: activeUserDevices.data?.id === undefined,
    }
  );

  const papersFiltered = papers.data?.filter((paper: any) => {
    return paper.kind !== "slides";
  });

  return (
    <div>
      <div className={styles.slideSelector}>
        {papers.data && papers.data.length > 0 && (
          <>
            {papersFiltered.map((paper: any, i: number) => (
              <div key={paper.id} className={styles.paper}>
                <Checkbox
                  key={i}
                  labelText={<PhotoFrame paper={paper} key={i} hideEdit />}
                  className={styles.input}
                  {...form.register(`meta.selectedPapers[${paper.id}]`)}
                />
              </div>
            ))}
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
    />
  );
}
