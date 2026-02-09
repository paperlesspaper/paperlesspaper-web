import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./calendarDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";

const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <>
      <LanguageSelector />

      <Select
        labelText={<Trans>Design</Trans>}
        helperText={
          <Trans>Choose either a simple calendar design or some quotes</Trans>
        }
        className={styles.input}
        {...form.register("meta.kind")}
      >
        <SelectItem value="default" text={t("Default")} />
        <SelectItem value="funny" text={t("funny quotes")} />
        <SelectItem
          value="demotivational"
          text={t("Demotivational calendar with quotes")}
        />
      </Select>

      <ColorSelector />
    </>
  );
};

export default function CalendarDesign() {
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
