import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import EditorButton from "./EditorButton";
import { faXmark } from "@fortawesome/pro-solid-svg-icons";
import { Trans } from "react-i18next";
import { useImageEditorContext } from "./ImageEditor";

export default function DeleteCurrent() {
  const { fabricRef, imageEditorTools }: any = useImageEditorContext();

  const deleteLastDrawnPath = () => {
    const canvas = fabricRef?.current;
    if (!canvas) return false;

    const paths = canvas.getObjects("path");
    const lastPath = paths[paths.length - 1];

    if (!lastPath) return false;

    canvas.remove(lastPath);
    canvas.renderAll?.();
    return true;
  };

  const deleteCurrent = () => {
    const canvas = fabricRef?.current;
    if (!canvas) return;

    if (imageEditorTools?.activeObject?.type === "drawing") {
      const removedPath = deleteLastDrawnPath();
      if (removedPath) return;
    }

    const activeObjects = canvas.getActiveObjects?.() || [];
    if (!activeObjects.length) return;

    activeObjects.forEach((o) => {
      canvas.remove(o);
    });
    canvas.discardActiveObject?.();
    canvas.renderAll?.();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        const isDrawingMode =
          imageEditorTools?.activeObject?.type === "drawing";
        const hasActiveObjects =
          fabricRef?.current?.getActiveObjects?.()?.length > 0;

        if (isDrawingMode || hasActiveObjects) {
          e.preventDefault();
          deleteCurrent();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fabricRef, imageEditorTools?.activeObject?.type]);

  return (
    <EditorButton
      id="deleteCurrent"
      onClick={deleteCurrent}
      kind="secondary"
      text={<Trans>Delete</Trans>}
      icon={<FontAwesomeIcon icon={faXmark} />}
    />
  );
}
