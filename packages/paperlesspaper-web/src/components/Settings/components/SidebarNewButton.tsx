import React from "react";
import ButtonRouter from "components/ButtonRouter";
import { Trans, useTranslation } from "react-i18next";
import { useIsDesktop } from "@internetderdinge/web";
import AddIcon from "./AddIcon";

const SidebarNewButton = ({ newLink, name, contentNewText }: any) => {
  const isDesktop = useIsDesktop();
  const { t } = useTranslation();
  if (!isDesktop) {
    return (
      <ButtonRouter to={newLink} icon={<AddIcon />}>
        {contentNewText ? (
          contentNewText
        ) : (
          <Trans i18nKey="AddNewNameSingular">
            Create {{ NAME: t(`${name}-SINGULAR`) }}
          </Trans>
        )}
      </ButtonRouter>
    );
  }
  return null;
};

export default SidebarNewButton;
