import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import useEditor from "./useEditor";
import EditorButton from "./EditorButton";
import { faXmark } from "@fortawesome/pro-solid-svg-icons";

export default function DeleteCurrent() {
  const { fabricRef }: any = useEditor();
  const deleteCurrent = () => {
    fabricRef.current.getActiveObjects().forEach((o) => {
      fabricRef.current.remove(o);
    });
  };

  return (
    <EditorButton
      id="deleteCurrent"
      onClick={deleteCurrent}
      kind="secondary"
      text="Löschen"
      icon={<FontAwesomeIcon icon={faXmark} />}
    />
  );
}
