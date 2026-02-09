import React from "react";
import ButtonRouter from "components/ButtonRouter";
import { Trans } from "react-i18next";
import AddIcon from "./AddIcon";

const SidebarHeaderButton = ({
  customButtons,
  contentNewText,
  organizationId,
  duckName,
  name,
}: any) => {
  return (
    <>
      {customButtons ? (
        customButtons
      ) : (
        <ButtonRouter
          to={`/${organizationId}/${duckName || name}/new`}
          icon={<AddIcon />}
        >
          {contentNewText ? contentNewText : <Trans>New</Trans>}
        </ButtonRouter>
      )}
    </>
  );
};

export default SidebarHeaderButton;
