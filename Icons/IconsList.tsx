import React from "react";
import { fabric } from "fabric";
import useEditor from "../Integrations/ImageEditor/useEditor";
import styles from "./iconsList.module.scss";
import Icon from "./Icon";

const iconsRaw = import.meta.glob("./optimized/**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const iconsSvg = import.meta.glob("./optimized/**/*.svg", {
  query: "?react",
  import: "default",
  eager: true,
});

export default function IconsList({ setModalOpen }: any) {
  const { fabricRef, setCurrentObjectActive }: any = useEditor();
  const maxWidth = 100;
  const maxHeight = 100;

  const addIcon = (mySvgRaw) => {
    fabric.loadSVGFromString(mySvgRaw, (objects, options) => {
      const svgGroup = new fabric.Group(objects, options);

      // Calculate scale factor
      const scaleX = maxWidth / svgGroup.width;
      const scaleY = maxHeight / svgGroup.height;
      const scaleFactor = Math.min(scaleX, scaleY);

      // Apply scale to the group
      svgGroup.scale(scaleFactor);

      fabricRef.current.centerObject(svgGroup);
      svgGroup.setCoords();

      fabricRef.current.add(svgGroup);
      fabricRef.current.renderAll();
      setTimeout(() => {
        setCurrentObjectActive();
      }, 1000);
    });

    setModalOpen(false);
  };

  return (
    <div className={styles.iconList}>
      {Object.entries(iconsSvg).map(([index, icon]) => (
        <>
          <Icon
            icon={icon}
            index={index}
            raw={iconsRaw[index]}
            addIcon={addIcon}
            className={styles.icon}
          />
        </>
      ))}
    </div>
  );
}
