import { faFont } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox } from "@progressiveui/react";
import React from "react";
import { Controller } from "react-hook-form";
import { Trans } from "react-i18next";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";

const ModalComponent = () => {
  const { form }: any = useEditor();

  return (
    <>
      <Controller
        control={form.control}
        name="meta.protectTextAndGraphics"
        render={({ field }) => (
          <Checkbox
            id="website-protect-text-and-graphics"
            name={field.name}
            checked={field.value !== false}
            onChange={(_event, checked) => field.onChange(Boolean(checked))}
            onBlur={field.onBlur}
            labelText={<Trans>Protect text and graphics (experimental)</Trans>}
          />
        )}
      />
      <p>
        <Trans>
          Keep text and flat graphics clear while dithering photos and gradients.
          Results depend on the website and display colors.
        </Trans>
      </p>
      <p>
        <Trans>
          Changes will be only visible when sending the website to the epaper
          panel (not in the preview).
        </Trans>
      </p>
    </>
  );
};

export default function WebsiteImageProcessing() {
  return (
    <EditorButton
      id="website-image-processing"
      kind="secondary"
      text={<Trans>Text and graphics</Trans>}
      icon={<FontAwesomeIcon icon={faFont} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Text and graphics</Trans>}
    />
  );
}
