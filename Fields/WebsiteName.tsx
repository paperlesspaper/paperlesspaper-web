import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TextInput } from "@progressiveui/react";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";
import styles from "./cssEditor.module.scss";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const kind = form.watch("kind");

  const {
    formState: { errors },
  } = form;

  console.log("form", form);

  const { t } = useTranslation();

  return (
    <>
      <TextInput
        labelText={<Trans>Website</Trans>}
        helperText={<Trans>Enter an URL to display on the epaper</Trans>}
        className={styles.cssEditor}
        placeholder="https://"
        {...form.register(kind === "rss" ? "meta.feed" : "meta.url", {
          validate: (value) => {
            if (!value) {
              return t("Please enter a valid URL");
            }
            if (!value.match(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i)) {
              return t("Please enter a valid URL");
            }
            return true;
          },
        })}
        invalid={errors.meta?.url}
        invalidText={errors.meta?.url?.message}
      />
    </>
  );
};

export default function WebsiteName({ text = "Website" }: any) {
  return (
    <EditorButton
      id="website"
      kind="secondary"
      text={text}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
      // modalHeading={<Trans>Website</Trans>}
    />
  );
}
