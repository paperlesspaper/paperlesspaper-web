import React from "react";
import { Trans } from "react-i18next";
import IntegrationModal from "../IntegrationModal";
import ImageEditorElements from "./ImageEditorElements";
import Editor from "./Editor";
import useIntegrationForm from "../useIntegrationForm";
import useImageEditorTools from "./useImageEditorTools";

const ImageEditorContext = React.createContext(null);

export const colorsSpectra6alt = [
  "#191E21", // black
  "#e8e8e8", // white
  "#2157ba", // blue
  "#125f20", // green
  "#b21318", // red
  "#efde44", // orange
  // "#F3CF11", // yellow
];

export const colorsSpectra6 = [
  "#1F2226",
  "#B9C7C9",
  "#233F8E",
  "#35563A",
  "#62201E",
  "#C1BB1E",
];

export const colorsSpectra6Native = [
  "#000", // black
  "#fff", // white
  "#0000FF", // blue
  "#00FF00", // green
  "#FF0000", // red
  //"#FF8000", // orange
  "#FFFF00", // yellow
];

// const initWidth = 600;
// const initHeight = 448;

//const diffusionOptions = ["errorDiffusion", "ordered", "random", "noDither"];

export const ogColors = [
  "#212122",
  "#b9b1b1",
  "#4152a0",
  "#193d1e",
  "#b70b0b",
  "#c8af4b",
];

/*
const ogColors = [
  "#000000",
  "#FFFFFF",
  "#0000FF",
  "#00FF00",
  "#FF0000",
  "#FFFF00",
];
*/

export const useImageEditorContext = () => {
  return React.useContext(ImageEditorContext);
};

export default function ImageEditor() {
  const fabricRef = React.useRef(null);

  const canvasRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  // track the logical (unscaled) canvas size and the currently applied scale
  const baseCanvasSizeRef = React.useRef({ width: 0, height: 0 });
  const currentScaleRef = React.useRef(1);
  const [pageWidth, setPageWidth] = React.useState(0);
  const previewCanvasRef = React.useRef(null);
  const previewImageRef = React.useRef(null);
  const renderCanvasRef = React.useRef(null);
  const [preview, setPreview] = React.useState(false);

  const [lastColor, setLastColor] = React.useState("#000000");
  const [brushWidth, setBrushWidth] = React.useState(9);

  const [previewImage, setPreviewImage] = React.useState(false);
  const [ditheringType, setDitheringType] = React.useState("errorDiffusion");

  //const [isLoadingImageData, setIsLoadingImageData] = React.useState(false);

  const store = useIntegrationForm({ defaultValues: { kind: "image" } });
  const [modalOpen, setModalOpen] = React.useState(false);
  const colors = colorsSpectra6;

  const imageEditorTools = useImageEditorTools({
    fabricRef,
    store,
    canvasRef,
    wrapperRef,
    baseCanvasSizeRef,
    currentScaleRef,
    pageWidth,
    setPageWidth,
    previewCanvasRef,
    previewImageRef,
    renderCanvasRef,
    preview,
    setPreview,
    lastColor,
    setLastColor,
    brushWidth,
    modalOpen,
    setModalOpen,
    ditheringType,
    setDitheringType,
    previewImage,
    setPreviewImage,
  });

  const submitImage = async () => {
    if (imageEditorTools.isLoadingImageData) return;
    const fabricCanvas = fabricRef.current;
    if (fabricCanvas) {
      fabricCanvas.discardActiveObject();
      if (typeof fabricCanvas.requestRenderAll === "function") {
        fabricCanvas.requestRenderAll();
      } else {
        fabricCanvas.renderAll();
      }
    }

    await imageEditorTools.generatePreview();
    const savedCanvas = fabricRef.current.toObject();

    const blob = await new Promise<Blob>((resolve) =>
      renderCanvasRef.current.toBlob((b) => resolve(b!)),
    );
    const blobPreview = await new Promise<Blob>((resolve) =>
      previewCanvasRef.current.toBlob((b) => resolve(b!)),
    );

    store.form.setValue("dataDirect", blob);
    store.form.setValue("dataOriginal", blobPreview);
    store.form.setValue("dataEditable", JSON.stringify(savedCanvas));

    /*store.form.setValues({
      dataDirect: blob,
      dataOriginal: blobPreview,
      dataEditable: JSON.stringify(savedCanvas),
      kind: "image",
      meta: {
        lut: colorList[lut].lut,
        // sleepTime,
        size: store.size,
        orientation: store.size.name,
      },
    });*/

    imageEditorTools.resizeCanvas({ source: "submitImage" });
  };
  return (
    <ImageEditorContext.Provider
      value={{
        fabricRef,
        lastColor,
        setLastColor,
        brushWidth,
        colors,
        setBrushWidth,
        imageEditorTools,
        canvasRef,
        wrapperRef,
        baseCanvasSizeRef,
        currentScaleRef,
        pageWidth,
        setPageWidth,
        previewCanvasRef,
        previewImageRef,
        renderCanvasRef,
        preview,
        setPreview,
        ditheringType,
        setDitheringType,
        previewImage,
        setPreviewImage,
      }}
    >
      <IntegrationModal
        modalHeading={<Trans>Editor</Trans>}
        elements={ImageEditorElements}
        store={store}
        beforeFrameSelection={submitImage}
        openPreviewImage={imageEditorTools.openPreviewImage}
        isLoadingImageData={imageEditorTools.isLoadingImageData}
        setIsLoadingImageData={imageEditorTools.setIsLoadingImageData}
        // passiveModal
      >
        <Editor />
      </IntegrationModal>
    </ImageEditorContext.Provider>
  );
}

/*


const EditorWithIntegrationModal = (props: any) => {
  return (
    <IntegrationModal
      modalHeading={<Trans>Editor</Trans>}
      /* onRequestSubmit={submitImage}
      onSecondarySubmit={openPreviewImage}
      defaultValues={{ kind: "image" }}
      context={{
        activeObject,
        fabricRef,
        canvasRef,
        darkMode: true,
        colors,
        setLastColor,
        lastColor,
        brushWidth,
        setBrushWidth,
        toggleDrawingMode,
        disableDrawingMode,
        setCurrentObjectActive,
        control,
        rotateCanvas,
        rotateScreen,
        size,
        isLoadingImageData,
        setIsLoadingImageData,
        ...store,
        modalOpen,
        setModalOpen,
        // form: store.form,
      }}
      // store={store}
      elements={Elements}
      containerRef={containerRef} 
    >
      <Editor {...props} />
    </IntegrationModal>
  );
};


*/
