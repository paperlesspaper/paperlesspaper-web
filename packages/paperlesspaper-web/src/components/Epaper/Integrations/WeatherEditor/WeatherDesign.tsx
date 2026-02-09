import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, Select, SelectItem, TextInput } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./weatherDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { t } = useTranslation();

  return (
    <>
      <TextInput
        labelText={<Trans>Location</Trans>}
        helperText={<Trans>Enter the location you want to display</Trans>}
        placeholder="Berlin, Tokio, New York..."
        className={styles.input}
        {...form.register("meta.location")}
      />

      <LanguageSelector />

      <Select
        labelText={<Trans>Display</Trans>}
        className={styles.input}
        {...form.register("meta.kind")}
      >
        <SelectItem
          value="forecast-summary"
          text={t("Current weather and forecast")}
        />
        <SelectItem value="simple" text={t("Simple view of todays weather")} />
        <SelectItem value="forecast" text={t("Forecast only")} />
      </Select>

      <ColorSelector />

      <Select
        labelText={<Trans>Icon style</Trans>}
        className={styles.input}
        {...form.register("meta.iconstyle")}
      >
        <SelectItem value="normal" text={t("Colored")} />
        <SelectItem value="light" text={t("Light monochrome")} />
      </Select>

      <Checkbox
        labelText={
          <>
            <Trans>Display last updated time</Trans>
          </>
        }
        className={styles.input}
        {...form.register("meta.displayLastUpdated")}
      />
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
    />
  );
}
