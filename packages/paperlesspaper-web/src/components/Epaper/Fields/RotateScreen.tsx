import React from "react";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/pro-solid-svg-icons";
import useEditor from "../Integrations/ImageEditor/useEditor";
import { Trans } from "react-i18next";

export default function RotateScreen() {
  const { form, rotationList } = useEditor();
  const orientation = form?.watch("meta.orientation") || "portrait";

  const rotateScreen = () => {
    const selectedRotation = Object.values(rotationList).find(
      (e) => e.name !== orientation
    );

    form?.setValue("meta.orientation", selectedRotation.name);
  };

  return (
    <EditorButton
      id="rotate"
      onClick={rotateScreen}
      kind="secondary"
      text={<Trans>Rotate</Trans>}
      icon={<FontAwesomeIcon icon={faRotate} />}
    />
  );
}
