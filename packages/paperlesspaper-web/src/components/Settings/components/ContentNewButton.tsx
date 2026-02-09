import React from "react";
import ButtonRouter from "components/ButtonRouter";
import { useTranslation, Trans } from "react-i18next";
import AddIcon from "./AddIcon";

const ContentNewButton = ({ newLink, name, contentNewText }: any) => {
  const { t } = useTranslation();
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
};

export default ContentNewButton;
