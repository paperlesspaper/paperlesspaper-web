import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./upcomingMoviesDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
const ModalComponent = () => {
  const { form }: any = useEditor();
  const { t } = useTranslation();

  return (
    <>
      <LanguageSelector />

      <ColorSelector />
    </>
  );
};

export default function UpcomingMoviesDesign() {
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
