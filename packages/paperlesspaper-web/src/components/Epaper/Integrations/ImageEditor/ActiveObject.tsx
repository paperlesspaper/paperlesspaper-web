import React, { useCallback, useEffect, useRef, useState } from "react";
import classnames from "classnames";
import DeleteCurrent from "./DeleteCurrent";
import styles from "./activeObject.module.scss";
import EditorButton from "./EditorButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/pro-solid-svg-icons";
import { Trans } from "react-i18next";
import { useImageEditorContext } from "./ImageEditor";

export default function ActiveObject({ children, type }: any) {
  const { imageEditorTools, fabricRef }: any = useImageEditorContext();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtEnd, setIsAtEnd] = useState(true);
  const [isAtStart, setIsAtStart] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollWidth - el.clientWidth <= el.scrollLeft + 1;
    setIsAtStart(atStart);
    setIsAtEnd(atEnd);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const bringForward = () => {
    fabricRef.current.getActiveObjects().forEach((o) => {
      console.log("bring forward", o);
      fabricRef.current.bringObjectForward(o);
    });
    fabricRef.current.renderAll();
  };

  const sendBackwards = () => {
    fabricRef.current.getActiveObjects().forEach((o) => {
      fabricRef.current.sendObjectBackwards(o);
    });
    fabricRef.current.renderAll();
  };

  if (imageEditorTools.activeObject?.type === type)
    return (
      <div
        ref={scrollRef}
        className={classnames(styles.activeObject, {
          [styles.atStart]: isAtStart,
          [styles.atEnd]: isAtEnd,
        })}
      >
        {/* activeObject?.type */}
        {children}
        {imageEditorTools.activeObject?.type && (
          <>
            <EditorButton
              onClick={bringForward}
              kind="secondary"
              text={<Trans>Up</Trans>}
              icon={<FontAwesomeIcon icon={faChevronUp} />}
            />
            <EditorButton
              onClick={sendBackwards}
              kind="secondary"
              text={<Trans>Down</Trans>}
              icon={<FontAwesomeIcon icon={faChevronDown} />}
            />
            <DeleteCurrent />
          </>
        )}
      </div>
    );
  return null;
}
