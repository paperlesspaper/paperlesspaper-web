import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./daysLeftDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
import DateInput from "components/inputs/TimeInput/DateInput";
import { TextInput } from "@progressiveui/react";
const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <>
      <DateInput
        control={form.control}
        name="meta.from"
        className={styles.input}
        dateProps={{
          showYearDropdown: true,
          dropdownMode: "select",
          openToDate: new Date(),
        }}
        labelText={<Trans>Start date</Trans>}
        helperText={t("The date from which the days are counted")}
      />

      <DateInput
        control={form.control}
        name="meta.date"
        className={styles.input}
        dateProps={{
          showYearDropdown: true,
          dropdownMode: "select",
          openToDate: new Date(),
        }}
        labelText={<Trans>End date</Trans>}
        helperText={t("The date until which the days are counted")}
      />

      <TextInput
        labelText={t("Description")}
        className={styles.input}
        {...form.register("meta.description")}
      />

      <LanguageSelector />

      <ColorSelector />
    </>
  );
};

export default function DaysLeftDesign() {
  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Settings</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
      // modalHeading={<Trans>Website</Trans>}
    />
  );
}
