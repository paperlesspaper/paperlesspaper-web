import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Select, SelectItem } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./babyBirthDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
import DateInput from "components/TimeInput/DateInput";

const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <>
      <LanguageSelector />

      <ColorSelector />

      <DateInput
        control={form.control}
        name="meta.birthdate"
        dateProps={{
          showYearDropdown: true,
          dropdownMode: "select",
          openToDate: new Date(),
        }}
        labelText={<Trans>Birthdate</Trans>}
      />
    </>
  );
};

export default function BabyBirthDesign() {
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
