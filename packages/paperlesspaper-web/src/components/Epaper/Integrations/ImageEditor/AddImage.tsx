import { faImage } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./addImage.module.scss";
import * as fabric from "fabric";
import EditorButton from "./EditorButton";
import { Trans } from "react-i18next";
import { useImageEditorContext } from "./ImageEditor";
import useEditor from "./useEditor";

export default function AddImage() {
  const { fabricRef, imageEditorTools }: any = useImageEditorContext();
  const { size } = useEditor();
  const hiddenFileInput = React.useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  const addPhoto = () => {
    hiddenFileInput.current?.click();
  };

  const resizeImage = (maxSize, imageUrl) => {
    return new Promise((resolve) => {
      const image: any = new Image();
      image.src = imageUrl;
      image.onload = (img) => {
        //check if resizing is required
        if (Math.max(img.target.width, img.target.height) > maxSize) {
          //create canvas
          const canvas: any = document.createElement("canvas");
          //scale image
          if (img.target.height >= img.target.width) {
            canvas.height = maxSize;
            canvas.width = (maxSize / img.target.height) * img.target.width;
          } else {
            canvas.width = maxSize;
            canvas.height = (maxSize / img.target.width) * img.target.height;
          }
          //draw to canvas
          const context: any = canvas.getContext("2d");
          context.drawImage(img.target, 0, 0, canvas.width, canvas.height);
          //assign new image url
          resolve(context.canvas.toDataURL());
        }
        resolve(imageUrl);
      };
    });
  };

  const addImage = async (e) => {
    // Guard against non-image uploads
    const file = e.target?.files?.[0];
    if (!file) return;

    const isImage = file.type && file.type.startsWith("image/"); /* ||
      (file.name && /\.((a?png|gif|bmp|webp|jpe?g|svg))$/i.test(file.name)) */

    if (!isImage) {
      window.alert(
        t(
          "imageOnly",
          "Only image files are supported. Please select an image instead.",
        ),
      );
      if (e.target) e.target.value = "";
      return;
    }

    const reader = new FileReader();

    // Read the file as base64
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;

      // Optionally, resize the image if needed (you can implement your resizeImage function if required)
      const resizedImage = await resizeImage(2048, base64Image);

      fabric.Image.fromURL(resizedImage, function (img) {
        img.set({
          left: 0,
          top: 0,
          lockUniScaling: true,
          centeredScaling: true,
        });

        img.scaleToWidth(size.width);
        img.setControlVisible("ml", false);
        img.setControlVisible("mt", false);
        img.setControlVisible("mr", false);
        img.setControlVisible("mb", false);

        fabricRef.current.add(img).setActiveObject(img).renderAll();
      });

      imageEditorTools.setCurrentObjectActive();
    };
  };

  return (
    <>
      <input
        id="uploader"
        type="file"
        className={styles.hiddenFileInput}
        accept="image/*"
        onChange={addImage}
        ref={hiddenFileInput}
      />
      <EditorButton
        id="addImage"
        text={<Trans>Photo</Trans>}
        onClick={addPhoto}
        kind="secondary"
        icon={<FontAwesomeIcon icon={faImage} />}
      />
    </>
  );
}
