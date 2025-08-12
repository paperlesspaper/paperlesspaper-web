import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./wikipediaDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const { t } = useTranslation();

  return (
    <>
      <LanguageSelector allowedLanguages={["de", "en"]} />
      <Select
        labelText={t("Kind of Wikipedia article")}
        helperText={t(
          "This will determine the content of the Wikipedia article"
        )}
        className={styles.input}
        {...form.register("meta.kind")}
      >
        <SelectItem value="default" text={t("Article of the day")} />
        <SelectItem value="onthisday" text={t("On this day")} />
      </Select>
      <ColorSelector />
    </>
  );
};

export default function WikipediaDesign() {
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
