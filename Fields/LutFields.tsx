import { faDroplet } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { InputGroup } from "@progressiveui/react";
import { colorList } from "components/SettingsDevices/EpaperDisplay";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";
import MultiCheckbox from "components/MultiCheckbox";

const ModalComponent = () => {
  const { form }: any = useEditor();
  const colors = Object.entries(colorList).filter(([i, f]: any) => f.show);

  return (
    <InputGroup>
      {colors.map(([i, f]: any) => (
        <MultiCheckbox
          key={f.key}
          labelText={<Trans>{f.name}</Trans>}
          description={<Trans>{f.description}</Trans>}
          kind="vertical"
          icon={<FontAwesomeIcon icon={f.icon} />}
          type="radio"
          value={i}
          {...form.register("meta.lut")}
        />
      ))}
    </InputGroup>
  );
};

export default function LutFields({ onChange /*setOpen*/ }: any) {
  const [open, setOpen] = React.useState(false);

  const { form }: any = useEditor();

  const openLutSelection = () => {
    setOpen(true);
  };

  return (
    <EditorButton
      id="lut"
      onClick={openLutSelection}
      kind="secondary"
      text={<Trans>Quality</Trans>}
      icon={<FontAwesomeIcon icon={faDroplet} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Select quality</Trans>}
    />
  );
}
