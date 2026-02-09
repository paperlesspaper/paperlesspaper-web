import React, { useState, useEffect, useRef } from "react";
import styles from "./rotateCanvas.module.scss";

export function useOutsideClick(ref, open, onClickOut) {
  useEffect(() => {
    let onClick = null;
    if (open) {
      onClick = ({ target }) => ref && !ref.contains(target) && onClickOut();
      document.addEventListener("click", onClick);
    }
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [open]);
}

const RotateCanvasInput = ({
  button,
  fieldComponent,
  onChange,
  value,
}: any) => {
  const [open, setOpen] = useState<boolean>(false);
  const isClickInside = useRef<any>(false);

  /*useOutsideClick(isClickInside.current, open, () => {
      // do something here
      console.log("sdssda");
      if (open === true) setOpen(false);
    });*/

  const FieldComponent = fieldComponent;

  return (
    <>
      <div onClick={() => setOpen(true)}>{button}</div>
      <div className={styles.dateInputWrapper}>
        <div
          className={`${styles.selector} ${
            open === true ? styles.open : styles.closed
          }`}
          ref={isClickInside}
        >
          <div className={styles.selectorInside}>
            <FieldComponent
              setOpen={setOpen}
              onChange={onChange}
              value={value}
            />
          </div>
        </div>
      </div>
    </>
  );
};
RotateCanvasInput.displayName = "RotateCanvasInput";

export default RotateCanvasInput;
