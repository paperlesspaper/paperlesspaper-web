import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./designSettings.module.scss";
import ColorSelector from "../../Fields/ColorSelector";

const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <div className={styles.editor}>
      <Select
        labelText="Kind"
        className={styles.input}
        {...form.register("meta.kind")}
      >
        <SelectItem value="default" text={t("Default")} />
        <SelectItem value="big-headline" text={t("Big Headline")} />
      </Select>

      <ColorSelector />
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
