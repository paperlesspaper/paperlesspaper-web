import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import EditorButton from "./EditorButton";
import { faTrashAlt } from "@fortawesome/pro-regular-svg-icons";
import DeleteModal from "components/DeleteModal";
import { Trans } from "react-i18next";
import useEditor from "./useEditor";

export default function DeletePaper() {
  const store: any = useEditor();

  if (store.urlId === "new") {
    return null;
  }

  return (
    <DeleteModal
      {...store}
      customDeleteQuestionTitle={<Trans>Delete</Trans>}
      customButton={
        <EditorButton
          id="delete"
          kind="secondary"
          text={<Trans>Delete</Trans>}
          icon={<FontAwesomeIcon icon={faTrashAlt} />}
        />
      }
    />
  );
}
