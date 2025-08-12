import React from "react";
import DeleteCurrent from "./DeleteCurrent";
import useEditor from "./useEditor";
import styles from "./activeObject.module.scss";
import EditorButton from "./EditorButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/pro-solid-svg-icons";
import { finished } from "stream";

export default function ActiveObject({ children, type }: any) {
  const { activeObject, fabricRef }: any = useEditor();

  const bringForward = () => {
    fabricRef.current.getActiveObjects().forEach((o) => {
      fabricRef.current.bringForward(o);
    });
    fabricRef.current.renderAll();
  };

  const sendBackwards = () => {
    fabricRef.current.getActiveObjects().forEach((o) => {
      fabricRef.current.sendBackwards(o);
    });
    fabricRef.current.renderAll();
  };

  if (activeObject?.type === type)
    return (
      <div className={styles.activeObject}>
        {/* activeObject?.type */}
        {children}
        {activeObject?.type && (
          <>
            <EditorButton
              onClick={bringForward}
              kind="secondary"
              text="hoch"
              icon={<FontAwesomeIcon icon={faChevronUp} />}
            />
            <EditorButton
              onClick={sendBackwards}
              kind="secondary"
              text="runter"
              icon={<FontAwesomeIcon icon={faChevronDown} />}
            />
            <DeleteCurrent />
          </>
        )}
      </div>
    );
  return null;
}
