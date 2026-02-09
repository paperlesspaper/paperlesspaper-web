import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TextInput } from "@progressiveui/react";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";
import styles from "./cssEditor.module.scss";

const ModalComponent = () => {
  const { form }: any = useEditor();

  const kind = form.watch("kind");

  return (
    <TextInput
      labelText={<Trans>RSS-Feed URL</Trans>}
      helperText={<Trans>Enter an URL to display on the epaper</Trans>}
      placeholder="https://example.com/feed.xml"
      className={styles.cssEditor}
      {...form.register(kind === "rss" ? "meta.feed" : "meta.url")}
    />
  );
};

export default function RssFeedName({ text = "RSS-Feed" }: any) {
  return (
    <EditorButton
      id="website"
      kind="secondary"
      text={text}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
    />
  );
}
