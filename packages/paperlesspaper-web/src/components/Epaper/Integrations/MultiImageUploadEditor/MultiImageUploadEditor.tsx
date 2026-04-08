import React from "react";
import { Button, Modal, Story } from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import OverlayLoading from "components/OverlayLoading";
import { papersApi } from "ducks/ePaper/papersApi";
import { useActiveUserDevice } from "helpers/useUsers";
import { prepareImageFileForEditor } from "../ImageEditor/imageDataUrl";
import ImageEditor, { ImageEditorHandle } from "../ImageEditor/ImageEditor";

type EditorParams = {
  organization: string;
  page: string;
  entry: string;
};

type SelectedImage = {
  id: string;
  file: File;
  imageUrl: string;
};

export default function MultiImageUploadEditor() {
  const history = useHistory();
  const params = useParams<EditorParams>();
  const { t } = useTranslation();
  const activeUserDevices = useActiveUserDevice();

  const [createPaper] = papersApi.useCreateSinglePapersMutation();
  const [uploadSingleImage] = papersApi.useUploadSingleImageMutation();

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const inlineEditorRefs = React.useRef<
    Record<string, ImageEditorHandle | null>
  >({});
  const modalEditorRefs = React.useRef<
    Record<string, ImageEditorHandle | null>
  >({});
  const [isUploading, setIsUploading] = React.useState(false);
  const [editingImageId, setEditingImageId] = React.useState<string | null>(
    null,
  );
  const [selectedImages, setSelectedImages] = React.useState<SelectedImage[]>(
    [],
  );

  const overviewUrl = `/${params.organization}/${params.page}/device/${params.entry}`;

  const openPicker = () => {
    inputRef.current?.click();
  };

  const uploadImagesAsNewPapers = async () => {
    if (selectedImages.length === 0) return;

    setIsUploading(true);

    try {
      for (const selectedImage of selectedImages) {
        const file = selectedImage.file;
        const editorDataFromModal =
          await modalEditorRefs.current[selectedImage.id]?.exportImageData();
        const editorDataFromInline =
          await inlineEditorRefs.current[selectedImage.id]?.exportImageData();
        const editorData = editorDataFromModal || editorDataFromInline;

        const createdPaperResult: any = await createPaper({
          values: {
            organization: params.organization,
            kind: "image",
            deviceId: activeUserDevices.data?.id,
            meta: {
              id: uuidv4(),
              lut: "default",
              orientation: "portrait",
            },
          },
        });

        const paperId = createdPaperResult?.data?.id;
        if (!paperId) continue;

        const formData = new FormData();

        console.log("Editor data for image:", editorData);

        formData.append("picture", editorData.dataDirect, file.name);
        formData.append("picture", editorData.dataOriginal, file.name);
        formData.append("pictureEditable", editorData.dataEditable);

        await uploadSingleImage({
          id: paperId,
          body: formData,
          deviceId: activeUserDevices.data?.id,
        });
      }

      history.push(overviewUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const onFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    const validFiles = files.filter((file) =>
      Boolean(file.type && file.type.startsWith("image/")),
    );

    if (files.length > 0 && validFiles.length === 0) {
      window.alert(
        t("imageOnly", "Only image files are supported. Please select images."),
      );
      return;
    }

    const nextSelected: SelectedImage[] = await Promise.all(
      validFiles.map(async (file) => {
        const imageUrl = await prepareImageFileForEditor(file);

        return {
          id: uuidv4(),
          file,
          imageUrl,
        };
      }),
    );

    if (nextSelected.length > 0) {
      setSelectedImages((previous) => [...previous, ...nextSelected]);
    }

    if (event.target) {
      event.target.value = "";
    }
  };

  const removeImage = (id: string) => {
    delete inlineEditorRefs.current[id];
    delete modalEditorRefs.current[id];
    if (editingImageId === id) {
      setEditingImageId(null);
    }
    setSelectedImages((previous) =>
      previous.filter((image) => image.id !== id),
    );
  };

  React.useEffect(() => {
    return () => {
      inlineEditorRefs.current = {};
      modalEditorRefs.current = {};
    };
  }, []);

  return (
    <>
      {isUploading && (
        <OverlayLoading
          description={<Trans>Uploading images and creating papers...</Trans>}
          fullscreen
        />
      )}

      <Modal
        open
        modalHeading={<Trans>Multi Image Upload</Trans>}
        primaryButtonText={<Trans>Upload images</Trans>}
        primaryButtonDisabled={
          isUploading ||
          !activeUserDevices.data?.id ||
          selectedImages.length === 0
        }
        secondaryButtonText={<Trans>Add images</Trans>}
        kindMobile="fullscreen"
        overscrollBehavior="inside"
        onRequestClose={() => history.push(overviewUrl)}
        onRequestSubmit={uploadImagesAsNewPapers}
        onSecondarySubmit={openPicker}
      >
        <Story>
          <p>
            <Trans>
              Select multiple images from your device. Every uploaded image will
              create a separate new paper.
            </Trans>
          </p>
          {selectedImages.length > 0 && (
            <p>
              {selectedImages.length} <Trans>image(s) selected</Trans>
            </p>
          )}
          <Button
            kind="secondary"
            onClick={openPicker}
            disabled={isUploading || !activeUserDevices.data?.id}
          >
            <Trans>Select images</Trans>
          </Button>
          {selectedImages.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {selectedImages.map((image) => (
                <div key={image.id} style={{ marginBottom: 16 }}>
                  <img
                    src={image.imageUrl}
                    alt={image.file.name}
                    style={{ width: "100%", maxWidth: 360 }}
                  />
                  <ImageEditor
                    ref={(instance) => {
                      inlineEditorRefs.current[image.id] = instance;
                    }}
                    open={false}
                    image={image.imageUrl}
                    inline={true}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Button
                      kind="secondary"
                      onClick={() => setEditingImageId(image.id)}
                      disabled={isUploading}
                    >
                      <Trans>Edit</Trans>
                    </Button>
                    <Button
                      kind="danger-ghost"
                      onClick={() => removeImage(image.id)}
                      disabled={isUploading}
                    >
                      <Trans>Remove</Trans>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedImages.map((image) => (
            <ImageEditor
              key={`editor-${image.id}`}
              ref={(instance) => {
                modalEditorRefs.current[image.id] = instance;
              }}
              open={editingImageId === image.id}
              image={image.imageUrl}
              onRequestCloseOverride={() => setEditingImageId(null)}
            />
          ))}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={onFilesSelected}
          />
        </Story>
      </Modal>
    </>
  );
}
