import { faImage } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import useEditor from "./useEditor";
import styles from "./addImage.module.scss";
import { fabric } from "fabric";
import EditorButton from "./EditorButton";

export default function AddImage() {
  const { fabricRef, setCurrentObjectActive, size }: any = useEditor();
  const hiddenFileInput = React.useRef(null);

  const addPhoto = () => {
    hiddenFileInput.current.click();
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
    const reader = new FileReader();

    // Make sure a file is selected
    if (e.target.files.length < 1) return;

    const file = e.target.files[0];

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

      setCurrentObjectActive();
    };
  };

  return (
    <>
      <input
        id="uploader"
        type="file"
        className={styles.hiddenFileInput}
        onChange={addImage}
        ref={hiddenFileInput}
      />
      <EditorButton
        id="addImage"
        text="Foto"
        onClick={addPhoto}
        kind="secondary"
        icon={<FontAwesomeIcon icon={faImage} />}
      />
    </>
  );
}
