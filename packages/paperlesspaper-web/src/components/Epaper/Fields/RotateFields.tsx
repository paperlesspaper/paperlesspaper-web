import { faLandscape, faPortrait } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";

export default function RotateFields({ onChange, setOpen }: any) {
  return (
    <>
      <Button
        onClick={() => {
          setOpen(false);
          onChange("portrait");
        }}
        icon={<FontAwesomeIcon icon={faPortrait} />}
      >
        <Trans>Portrait</Trans>
      </Button>
      <Button
        onClick={() => {
          setOpen(false);
          onChange("landscape");
        }}
        icon={<FontAwesomeIcon icon={faLandscape} />}
      >
        <Trans>Landscape</Trans>
      </Button>
    </>
  );
}
