import { faLayerGroup } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TextArea } from "@progressiveui/react";
import { colorList } from "components/SettingsDevices/EpaperDisplay";
import React from "react";
import { Trans } from "react-i18next";
import EditorButton from "../Integrations/ImageEditor/EditorButton";
import useEditor from "../Integrations/ImageEditor/useEditor";
import styles from "./cssEditor.module.scss";

const ModalComponent = () => {
  const { form }: any = useEditor();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const allowTabsHandler = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const value = textareaRef.current!.value;
      const selectionStart = textareaRef.current!.selectionStart;
      const selectionEnd = textareaRef.current!.selectionEnd;
      textareaRef.current!.value =
        value.substring(0, selectionStart) +
        "  " +
        value.substring(selectionEnd);
      textareaRef.current!.selectionStart =
        selectionEnd + 2 - (selectionEnd - selectionStart);
      textareaRef.current!.selectionEnd =
        selectionEnd + 2 - (selectionEnd - selectionStart);
    }
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const value = textareaRef.current!.value;
      const selectionStart = textareaRef.current!.selectionStart;
      const selectionEnd = textareaRef.current!.selectionEnd;

      const beforeStart = value
        .substring(0, selectionStart)
        .split("")
        .reverse()
        .join("");
      const indexOfTab = beforeStart.indexOf("  ");
      const indexOfNewline = beforeStart.indexOf("\n");

      if (indexOfTab !== -1 && indexOfTab < indexOfNewline) {
        textareaRef.current!.value =
          beforeStart
            .substring(indexOfTab + 2)
            .split("")
            .reverse()
            .join("") +
          beforeStart.substring(0, indexOfTab).split("").reverse().join("") +
          value.substring(selectionEnd);

        textareaRef.current!.selectionStart = selectionStart - 2;
        textareaRef.current!.selectionEnd = selectionEnd - 2;
      }
    }
  };

  return (
    <TextArea
      onKeyDown={allowTabsHandler}
      labelText="CSS"
      helperText={
        <Trans>
          Customize the Style of the website to better fit the epaper display
        </Trans>
      }
      className={styles.cssEditor}
      {...form.register("meta.css")}
      ref={(e) => {
        form.register("meta.css").ref(e); // react-hook-form ref
        //if (textareaRef.current) {
        textareaRef.current = e; // your custom ref
        //}
      }}
    />
  );
};

export default function CssEditor({ onChange /*setOpen*/ }: any) {
  const [open, setOpen] = React.useState(false);

  const { form }: any = useEditor();

  const openLutSelection = () => {
    setOpen(true);
  };

  return (
    <EditorButton
      id="css"
      onClick={openLutSelection}
      kind="secondary"
      text="CSS"
      icon={<FontAwesomeIcon icon={faLayerGroup} />}
      modalComponent={ModalComponent}
      modalHeading={<Trans>Customize stylesheet</Trans>}
    />
  );
}
