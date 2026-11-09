import React from "react";
import {
  Button,
  Callout,
  Modal,
  Select,
  SelectItem,
  Story,
} from "@progressiveui/react";
import { Trans, useTranslation } from "react-i18next";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import OverlayLoading from "components/OverlayLoading";
import { devicesApi } from "ducks/devices";
import { papersApi } from "ducks/ePaper/papersApi";
import { useActiveUserDevice } from "helpers/useUsers";
import {
  prepareImageFileForEditor,
  resizeImageDataUrl,
} from "../ImageEditor/imageDataUrl";
import ImageEditor, {
  ImageEditorHandle,
  ImageEditorState,
} from "../ImageEditor/ImageEditor";
import useQs from "helpers/useQs";
import {
  getShareTargetImageDataUrl,
  getShareTargetPayload,
} from "helpers/shareTarget";

type EditorParams = {
  organization: string;
  page: string;
  entry: string;
};

type SelectedImage = {
  id: string;
  fileName: string;
  imageUrl: string;
  editorState?: ImageEditorState;
  status?: "pending" | "uploading" | "failed" | "uploaded";
};

export default function MultiImageUploadEditor() {
  const history = useHistory();
  const location = useLocation();
  const params = useParams<EditorParams>();
  const { shareTargetId } = useQs();
  const { t } = useTranslation();
  const activeUserDevices = useActiveUserDevice();

  const devices = devicesApi.useGetAllDevicesQuery(
    { organizationId: params.organization },
    { skip: !params.organization || Boolean(activeUserDevices.data?.id) }
  );
  const [uploadErrors, setUploadErrors] = React.useState<
    Record<string, string>
  >({});
  const [preparationErrors, setPreparationErrors] = React.useState<string[]>(
    []
  );
  const [isPreparingImages, setIsPreparingImages] = React.useState(false);
  const operationInProgress = React.useRef(false);
  const createdPaperIds = React.useRef<Record<string, string>>({});
  const [updatePaper] = papersApi.useUpdateSinglePapersMutation();
  const [createPaper] = papersApi.useCreateSinglePapersMutation();
  const [uploadSingleImage] = papersApi.useUploadSingleImageMutation();

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const editorRef = React.useRef<ImageEditorHandle | null>(null);
  const pendingEditor = React.useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const mounted = React.useRef(true);
  const [activeEditor, setActiveEditor] = React.useState<{
    id: string;
    mode: "edit" | "upload";
  } | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState({
    current: 0,
    total: 0,
    name: "",
  });
  const [selectedImages, setSelectedImages] = React.useState<SelectedImage[]>(
    []
  );

  const isBusy = isUploading || isPreparingImages;
  const remainingImages = selectedImages.filter(
    (image) => image.status !== "uploaded"
  );
  const editorImage = selectedImages.find(
    (image) => image.id === activeEditor?.id
  );
  const onEditorReady = React.useCallback((error?: Error) => {
    const pending = pendingEditor.current;
    if (!pending) return;
    pendingEditor.current = null;
    if (error) pending.reject(error);
    else pending.resolve();
  }, []);

  const closeEditor = () => {
    const editorState = editorRef.current?.getEditorState();
    if (editorState) {
      setSelectedImages((previous) =>
        previous.map((image) =>
          image.id === activeEditor?.id ? { ...image, editorState } : image
        )
      );
    }
    setActiveEditor(null);
  };

  const exportSelectedImage = async (image: SelectedImage) => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      await new Promise<void>((resolve, reject) => {
        pendingEditor.current = { resolve, reject };
        timer = setTimeout(() => {
          pendingEditor.current = null;
          reject(new Error("Image editor timed out"));
        }, 35_000);
        setActiveEditor({ id: image.id, mode: "upload" });
      });
      const data = await editorRef.current?.exportImageData();
      if (!data) throw new Error("Image editor is not ready");
      return data;
    } finally {
      clearTimeout(timer);
      pendingEditor.current = null;
      setActiveEditor(null);
    }
  };

  const overviewUrl = `/${params.organization}/${params.page}/device/${params.entry}`;

  const openPicker = () => {
    if (!operationInProgress.current && !activeEditor)
      inputRef.current?.click();
  };

  const selectDevice = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const device = devices.data?.find((item) => item.id === event.target.value);
    if (!device) return;
    const query = new URLSearchParams(location.search);
    query.set("frameKind", device.kind);
    history.replace({
      pathname: `/${params.organization}/${params.page}/device/${device.id}/new/image-multi-upload`,
      search: `?${query.toString()}`,
    });
  };

  const uploadImagesAsNewPapers = async () => {
    if (
      operationInProgress.current ||
      activeEditor ||
      !activeUserDevices.data?.id ||
      remainingImages.length === 0
    )
      return;

    operationInProgress.current = true;
    setIsUploading(true);
    setUploadErrors({});
    const failedImages: Record<string, string> = {};

    try {
      for (const [index, selectedImage] of remainingImages.entries()) {
        if (!mounted.current) break;
        setProgress({
          current: index + 1,
          total: remainingImages.length,
          name: selectedImage.fileName,
        });
        setSelectedImages((previous) =>
          previous.map((image) =>
            image.id === selectedImage.id
              ? { ...image, status: "uploading" }
              : image
          )
        );
        try {
          const editorData = await exportSelectedImage(selectedImage);
          if (!mounted.current) break;

          const values = {
            organization: params.organization,
            kind: "image",
            name: selectedImage.fileName,
            deviceId: activeUserDevices.data.id,
            meta: {
              id: uuidv4(),
              lut: "default",
              ...editorData.meta,
              frameKind: activeUserDevices.data.kind,
            },
          };
          let paperId = createdPaperIds.current[selectedImage.id];
          if (paperId) {
            await updatePaper({ id: paperId, values }).unwrap();
          } else {
            const paper = await createPaper({ values }).unwrap();
            if (!paper?.id) throw new Error("Could not create image");
            paperId = paper.id;
            createdPaperIds.current[selectedImage.id] = paperId;
          }

          const formData = new FormData();
          formData.append(
            "picture",
            editorData.dataDirect,
            selectedImage.fileName
          );
          formData.append(
            "picture",
            editorData.dataOriginal,
            selectedImage.fileName
          );
          formData.append("pictureEditable", editorData.dataEditable);

          await uploadSingleImage({
            id: paperId,
            body: formData,
            deviceId: activeUserDevices.data.id,
          }).unwrap();

          // Keep the result in selection order, but release the image and editor data.
          delete createdPaperIds.current[selectedImage.id];
          setSelectedImages((previous) =>
            previous.map((image) =>
              image.id === selectedImage.id
                ? {
                    ...image,
                    status: "uploaded",
                    imageUrl: "",
                    editorState: undefined,
                  }
                : image
            )
          );
        } catch (error) {
          console.error(
            "Multi image upload failed",
            selectedImage.fileName,
            error
          );
          failedImages[selectedImage.id] = selectedImage.fileName;
          setSelectedImages((previous) =>
            previous.map((image) =>
              image.id === selectedImage.id
                ? { ...image, status: "failed" }
                : image
            )
          );
          setUploadErrors({ ...failedImages });
        }
      }

      setUploadErrors(failedImages);
      if (
        mounted.current &&
        Object.keys(failedImages).length === 0 &&
        preparationErrors.length === 0
      )
        history.push(overviewUrl);
    } finally {
      operationInProgress.current = false;
      setIsUploading(false);
    }
  };

  const onFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    // Reset before awaiting so selecting the same file again always fires change.
    input.value = "";
    if (!files.length || operationInProgress.current) return;

    operationInProgress.current = true;
    setIsPreparingImages(true);
    setPreparationErrors([]);
    const nextSelected: SelectedImage[] = [];
    const failedFiles: string[] = [];

    try {
      // Decode one original at a time to limit peak memory use on phones.
      for (const [index, file] of files.entries()) {
        if (!mounted.current) break;
        setProgress({
          current: index + 1,
          total: files.length,
          name: file.name,
        });
        const isImage = file.type
          ? file.type.toLowerCase().startsWith("image/")
          : /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?|svg)$/i.test(
              file.name
            );
        if (!isImage) {
          failedFiles.push(file.name);
          continue;
        }
        try {
          const imageUrl = await prepareImageFileForEditor(file);
          nextSelected.push({
            id: uuidv4(),
            fileName: file.name,
            imageUrl,
          });
        } catch (error) {
          console.error("Could not prepare image", file.name, error);
          failedFiles.push(file.name);
        }
      }
      setSelectedImages((previous) => [...previous, ...nextSelected]);
      setPreparationErrors(failedFiles);
    } finally {
      operationInProgress.current = false;
      setIsPreparingImages(false);
    }
  };

  const removeImage = (id: string) => {
    setUploadErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    if (activeEditor?.id === id) setActiveEditor(null);
    setSelectedImages((previous) =>
      previous.filter((image) => image.id !== id)
    );
  };

  React.useEffect(() => {
    let isMounted = true;
    const payload = getShareTargetPayload(shareTargetId);
    if (!payload?.images?.length) return;

    operationInProgress.current = true;
    setIsPreparingImages(true);
    void (async () => {
      const sharedImages: SelectedImage[] = [];
      const failedFiles: string[] = [];
      try {
        for (const [index, image] of payload.images.entries()) {
          if (!isMounted) return;
          const fileName = image.name || "shared-image.png";
          setProgress({
            current: index + 1,
            total: payload.images.length,
            name: fileName,
          });
          try {
            const imageUrl = await resizeImageDataUrl(
              1280,
              await getShareTargetImageDataUrl(image),
              image.mimeType
            );
            sharedImages.push({ id: uuidv4(), fileName, imageUrl });
          } catch {
            failedFiles.push(fileName);
          }
        }
        if (!isMounted) return;
        setSelectedImages((previous) =>
          previous.length ? previous : sharedImages
        );
        setPreparationErrors(failedFiles);
      } finally {
        if (isMounted) {
          operationInProgress.current = false;
          setIsPreparingImages(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [shareTargetId]);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingEditor.current?.reject(new Error("Import closed"));
      pendingEditor.current = null;
    };
  }, []);

  return (
    <>
      {isBusy && (
        <OverlayLoading
          description={
            <span role="status">
              {isPreparingImages ? (
                <Trans>Preparing images...</Trans>
              ) : (
                <Trans>Uploading images and creating papers...</Trans>
              )}{" "}
              {progress.current}/{progress.total}: {progress.name}
            </span>
          }
          fullscreen
        />
      )}

      <Modal
        open
        modalHeading={<Trans>Multi Image Upload</Trans>}
        primaryButtonText={<Trans>Upload images</Trans>}
        primaryButtonDisabled={
          isBusy ||
          Boolean(activeEditor) ||
          !activeUserDevices.data?.id ||
          remainingImages.length === 0
        }
        secondaryButtonText={<Trans>Add images</Trans>}
        kindMobile="fullscreen"
        overscrollBehavior="inside"
        onRequestClose={() => {
          if (!isBusy) history.push(overviewUrl);
        }}
        onRequestSubmit={uploadImagesAsNewPapers}
        onSecondarySubmit={() => {
          if (!isBusy && activeUserDevices.data?.id) openPicker();
        }}
      >
        <Story>
          {!activeUserDevices.data?.id && (
            <Select
              id="multi-upload-device"
              labelText={<Trans>Select picture frame</Trans>}
              value=""
              onChange={selectDevice}
              disabled={devices.isLoading || isBusy}
            >
              <SelectItem value="" text={t("Select picture frame")} />
              {(devices.data || []).map((device) => (
                <SelectItem
                  key={device.id}
                  value={device.id}
                  text={device.name || device.deviceId || device.id}
                />
              ))}
            </Select>
          )}
          {preparationErrors.length > 0 && (
            <Callout
              kind="error"
              title={<Trans>Some images could not be loaded</Trans>}
            >
              <Trans>
                The following files could not be read as images. Try selecting
                them again or export them as JPEG or PNG. Other images can still
                be uploaded.
              </Trans>
              <ul>
                {preparationErrors.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
            </Callout>
          )}
          {Object.keys(uploadErrors).length > 0 && (
            <Callout kind="error" title={<Trans>Upload failed</Trans>}>
              <Trans>
                Some images could not be uploaded. Please try again.
                Successfully uploaded images will not be uploaded again.
              </Trans>
              <ul>
                {Object.entries(uploadErrors).map(([id, name]) => (
                  <li key={id}>{name}</li>
                ))}
              </ul>
            </Callout>
          )}
          <p>
            <Trans>
              Select multiple images from your device. Every uploaded image will
              create a separate new paper.
            </Trans>
          </p>
          {selectedImages.length > 0 && (
            <p>
              {remainingImages.length} <Trans>image(s) selected</Trans>
            </p>
          )}
          <Button
            kind="secondary"
            onClick={openPicker}
            disabled={isBusy || !activeUserDevices.data?.id}
          >
            <Trans>Select images</Trans>
          </Button>
          {selectedImages.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {selectedImages.map((image, index) => (
                <div key={image.id} style={{ marginBottom: 16 }}>
                  <p>
                    {index + 1}. {image.fileName} —{" "}
                    {t(
                      image.status === "uploaded"
                        ? "Uploaded"
                        : image.status === "failed"
                        ? "Upload failed"
                        : image.status === "uploading"
                        ? "Uploading…"
                        : "Pending"
                    )}
                  </p>
                  {image.status !== "uploaded" && (
                    <img
                      loading="lazy"
                      src={image.imageUrl}
                      alt={image.fileName}
                      style={{ width: "100%", maxWidth: 360 }}
                    />
                  )}
                  {image.status !== "uploaded" && (
                    <div style={{ marginTop: 8 }}>
                      <Button
                        kind="secondary"
                        onClick={() =>
                          setActiveEditor({ id: image.id, mode: "edit" })
                        }
                        disabled={isBusy || Boolean(activeEditor)}
                      >
                        <Trans>Edit</Trans>
                      </Button>
                      <Button
                        kind="danger-ghost"
                        onClick={() => removeImage(image.id)}
                        disabled={isBusy}
                      >
                        <Trans>Remove</Trans>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {editorImage && (
            <div
              style={
                activeEditor.mode === "upload"
                  ? {
                      position: "fixed",
                      left: -10000,
                      width: 360,
                      pointerEvents: "none",
                    }
                  : undefined
              }
              aria-hidden={activeEditor.mode === "upload" || undefined}
            >
              <ImageEditor
                key={editorImage.id}
                ref={editorRef}
                open={activeEditor.mode === "edit"}
                inline={activeEditor.mode === "upload"}
                image={editorImage.imageUrl}
                initialState={editorImage.editorState}
                onSourceReady={onEditorReady}
                onRequestCloseOverride={closeEditor}
              />
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={isBusy}
            style={{ display: "none" }}
            onChange={onFilesSelected}
          />
        </Story>
      </Modal>
    </>
  );
}
