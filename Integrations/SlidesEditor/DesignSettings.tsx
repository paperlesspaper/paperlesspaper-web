import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NumberInput, Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./designSettings.module.scss";
import { useActiveUserDevice } from "helpers/useUsers";
import { papersApi } from "ducks/papersApi";

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

  return (
    <div>
      <Select
        labelText={<Trans>Slide Display Order</Trans>}
        helperText={<Trans>Sequence in which the images will appear</Trans>}
        className={styles.input}
        {...form.register("meta.order")}
      >
        <SelectItem value="default" text={t("Chronological Order")} />
        <SelectItem value="random" text={t("Random Order")} />
      </Select>

      {/* <NumberInput
        labelText="Current slide"
        helperText="Current slide number"
        className={styles.input}
        {...form.register("meta.currentSlide")}
      /> */}
    </div>
  );
};

export default function DesignSettings({ text = "Settings" }: any) {
  return (
    <EditorButton
      id="design-settings"
      kind="secondary"
      text={<Trans>{text}</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
    />
  );
}
