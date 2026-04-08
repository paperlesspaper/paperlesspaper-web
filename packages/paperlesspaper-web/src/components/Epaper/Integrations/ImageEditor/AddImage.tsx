import { faImage } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./addImage.module.scss";
import EditorButton from "./EditorButton";
import { Trans } from "react-i18next";
import { useImageEditorContext } from "./ImageEditor";
import { prepareImageFileForEditor } from "./imageDataUrl";
import useEditor from "./useEditor";

export default function AddImage() {
  const { fabricRef, imageEditorTools }: any = useImageEditorContext();
  const { size } = useEditor();
  const hiddenFileInput = React.useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  const addPhoto = () => {
    hiddenFileInput.current?.click();
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

    const resizedImage = await prepareImageFileForEditor(file);

    if (!fabricRef.current) return;

    await imageEditorTools.addImageFromUrl({
      url: resizedImage,
      width: size.width,
    });

    imageEditorTools.setCurrentObjectActive();
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
