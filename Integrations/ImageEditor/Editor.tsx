/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import { fabric } from "fabric";
import { Button, InlineLoading, Modal } from "@progressiveui/react";
import { useForm } from "react-hook-form";
import dither from "../../dither";
import styles from "./editor.module.scss";

import { Trans, useTranslation } from "react-i18next";
import { useHistory } from "react-router";
import { useParams } from "react-router";
import Preview from "../../Fields/Preview";
import touchHandler from "./touchEditor";

import {
  colorList,
  //colorsReal,
  colorsMap,
  colorsSlightlyReal,
  colorsBw,
  colorsBwSlightlyReal,
} from "../../../SettingsDevices/EpaperDisplay";
import ActiveObject from "./ActiveObject";
import ColorSelect from "./ColorSelect";
import Brightness from "./Brightness";
import Contrast from "./Contrast";
import Saturation from "./Saturation";
import EditorElements from "./EditorElements";
import FontStyles from "./FontStyles";
import { papersApi } from "ducks/papersApi";
import DeleteModal from "components/DeleteModal";
import DeletePaper from "./DeletePaper";
import IntegrationModal from "../IntegrationModal";
import useIntegrationForm from "../useIntegrationForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCross } from "@fortawesome/pro-regular-svg-icons";
import { faXmark } from "@fortawesome/pro-light-svg-icons";
import { faCheck } from "@fortawesome/pro-solid-svg-icons";
import LineHeight from "./LineHeight";
import { useActiveDevice } from "helpers/devices/useDevices";
import { useActiveUserDevice } from "helpers/useUsers";
import useRotationList from "./useRotationList";
import { deviceByKind } from "helpers/devices/deviceList";
import { EditorContextType } from "./useEditor";
import { useDebug } from "helpers/useCurrentUser";
import {
  ditherImage,
  getDefaultPalettes,
  getDeviceColors,
  replaceColors,
} from "epdoptimize";
import { spec } from "node:test/reporters";
const hex = (h) => {
  return h
    .replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (_, r, g, b) => "#" + r + r + g + g + b + b
    )
    .substring(1)
    .match(/.{2}/g)
    .map((x) => parseInt(x, 16));
};

// const initWidth = 600;
// const initHeight = 448;

//const diffusionOptions = ["errorDiffusion", "ordered", "random", "noDither"];

const ogColors = [
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
const Elements = () => {
  return (
    <>
      <ActiveObject type="rect">
        <ColorSelect />
      </ActiveObject>

      <ActiveObject type="textbox">
        <ColorSelect />
        <FontStyles />
        <LineHeight />
      </ActiveObject>

      <ActiveObject type="image">
        <Brightness />
        <Contrast />
        <Saturation />
      </ActiveObject>

      <ActiveObject type="group" />

      <ActiveObject>
        <EditorElements />
        <DeletePaper />
      </ActiveObject>
    </>
  );
};

export const EditorContext = React.createContext<EditorContextType | null>(
  null
);

const Editor = ({ uploadSingleImageResult, onSubmit }: any) => {
  const fabricRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  const [pageWidth, setPageWidth] = React.useState(0);
  const previewCanvasRef = React.useRef(null);
  const previewImageRef = React.useRef(null);
  const renderCanvasRef = React.useRef(null);
  const [preview, setPreview] = React.useState(false);
  const [lastColor, setLastColor] = React.useState("#000000");
  //const [size, setSize] = React.useState(rotationList.portrait); //600,448
  const [previewImage, setPreviewImage] = React.useState(false);
  const [ditheringType, setDitheringType] = React.useState("errorDiffusion");
  const store = useIntegrationForm({ defaultValues: { kind: "image" } });
  const isDebug = useDebug();

  const { t } = useTranslation();

  const history = useHistory();
  const params = useParams();

  const activeDevice = useActiveUserDevice();
  const deviceMeta = deviceByKind(activeDevice.data?.kind);

  const initWidth = deviceMeta?.resolution?.width || 600;
  const initHeight = deviceMeta?.resolution?.height || 448;

  const rotationList = useRotationList();

  const [generateImageUrlAlt, generateImageUrlAltResult] =
    papersApi.useGenerateImageUrlAltMutation();

  const loadeImageData = async () => {
    const data = await generateImageUrlAlt({
      id: params.paper,
      body: { kind: "editable.json", return: "json" },
    });

    fabricRef.current.loadFromJSON(data.data);
  };

  const rotationWatch = store.form.watch("meta.orientation") || "portrait";
  const size = rotationList[rotationWatch];

  useEffect(() => {
    if (params.entry !== "new") {
      loadeImageData();
    }
  }, [params.entry]);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = store.form;

  const lut = watch("meta.lut") || "default";

  const sleepTime = watch("sleepTime");

  const colors = colorList[lut].colors;

  useEffect(() => {
    setLastColor(colors[4]);
  }, [lut]);

  const [activeObject, setActiveObject] = useState(null);

  React.useEffect(() => {
    const initFabric = () => {
      fabric.Object.prototype.set({
        transparentCorners: false,
        cornerStyle: "circle",
        cornerColor: "#3880ff",
        cornerSize: 15,

        borderScaleFactor: 3,
      });

      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        backgroundColor: "#ffffff",
        imageSmoothingEnabled: false, //false,
        enableRetinaScaling: true, // false,
        preserveObjectStacking: true,
      });
      fabricRef.current.setHeight(size.height);
      fabricRef.current.setWidth(size.width);

      touchHandler({ canvas: fabricRef.current });

      fabricRef.current.filterBackend = fabric.initFilterBackend();

      resizeCanvas({});

      fabricRef.current.on({
        "selection:created": function () {
          const ao = fabricRef.current.getActiveObject();
          setActiveObject(ao);
        },
      });

      fabricRef.current.on({
        "selection:updated": function () {
          const ao = fabricRef.current.getActiveObject();
          setActiveObject(ao);
        },
      });

      fabricRef.current.on({
        "selection:cleared": function () {
          setActiveObject(null);
        },
      });
    };

    const disposeFabric = () => {
      fabricRef.current.dispose();
    };

    const getBlob = () => {
      return canvasRef.current.toBlob();
    };

    initFabric();

    return () => {
      disposeFabric();
    };
  }, []);

  // Fabric.js image function
  function canvasImage(url) {
    const img = new fabric.Image(url);
    img.set({
      left: 0,
      top: 0,
    });
    img.scaleToWidth(size.width);
    //fabricRef.current.add(img).setActiveObject(img).renderAll();

    fabric.Image.fromURL(url, function (img) {
      fabricRef.current.add(img);
    });

    /* var img = new fabric.Image(url);
    img.scale(0.75).center().setCoords();
    fabricRef.current.add(img).setActiveObject(img).renderAll();*/
  }

  const handlePasteAnywhere = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Get the data of clipboard
    const clipboardItems = event.clipboardData.items;
    const items = [].slice.call(clipboardItems).filter(function (item) {
      // Filter the image items only
      return item.type.indexOf("image") !== -1;
    });
    if (items.length === 0) {
      return;
    }

    const item = items[0];
    // Get the blob of image
    const blob = item.getAsFile();
    const imageURL = window.webkitURL.createObjectURL(blob);
    canvasImage(imageURL);
  };

  useEffect(() => {
    window.addEventListener("paste", handlePasteAnywhere);
    return () => {
      window.removeEventListener("paste", handlePasteAnywhere);
    };
  }, []);

  const setCurrentObjectActive = () => {
    const deviceAdd = fabricRef.current.getObjects();
    fabricRef.current.setActiveObject(
      fabricRef.current.item(deviceAdd.length - 1)
    );
  };

  const rotateScreen = () => {
    const selectedRotation = Object.values(rotationList).find(
      (e) => e.name !== size.name
    );

    fabricRef.current.setHeight(selectedRotation.height);
    fabricRef.current.setWidth(selectedRotation.width);

    fabricRef.current.getObjects().forEach(function (obj) {
      obj.set("left", obj.left - (size.width - selectedRotation.width) / 2);
      obj.set("top", obj.top - (size.height - selectedRotation.height) / 2);
      obj.setCoords(); // Update the coordinates
    });
    // setSize(selectedRotation);

    store.form.setValue("meta.orientation", selectedRotation.name);

    // canvas.renderAll();
  };

  const rotateCanvas = ({ colorsReplace, ref }: any) => {
    const destCtx = ref.current.getContext("2d");
    //destCtx.rotate(Math.PI / 2);

    destCtx.translate(destCtx.canvas.width * 0.5, destCtx.canvas.height * 0.5); // center
    destCtx.rotate(Math.PI * 0.5); // 90°
    destCtx.translate(
      -destCtx.canvas.width * 0.5,
      -destCtx.canvas.height * 0.5
    );

    // var imageData = destCtx.getImageData(0, 0, size.width, size.height);
    // destCtx.putImageData(imageData, 0, 0);
  };

  const canvasToDither = async ({ ref }) => {
    const options = {
      errorDiffusionMatrix: "floydSteinberg",
      ditheringType: "errorDiffusion",
      palette: ogColors,
      /*  activeDevice.data?.kind === "epd7"
          ? getDeviceColors("spectra6")
          : colors */
    };

    const dithered = await ditherImage(ref.current, ref.current, options);
  };

  const generatePreview = async () => {
    discardSelect();

    resizeCanvas({
      width: size.width,
      height: size.height,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const destCtx = previewCanvasRef.current.getContext("2d");
    destCtx.drawImage(
      canvasRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    // wait 2 seconds to ensure the canvas is rendered
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await canvasToDither({ ref: previewCanvasRef });

    const spectra6colors = getDeviceColors("spectra6");

    await new Promise((resolve) => setTimeout(resolve, 2000));
    // lut === "bw" ? colorsBw : colorsSlightlyReal
    replaceColors(previewCanvasRef.current, previewCanvasRef.current, {
      originalColors: ogColors,
      replaceColors: spectra6colors,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    replaceColors(previewCanvasRef.current, previewCanvasRef.current, {
      originalColors: spectra6colors,
      replaceColors: [
        "#191E21",
        "#F1F1F1",
        "#31318F",
        "#53A428",
        "#D20E13",
        "#F3CF11",
      ],
    });
  };

  const openPreviewImage = async (previewState = true) => {
    resizeCanvas({
      width: size.width,
      height: size.height,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
    });

    await generatePreview();

    setPreview(previewState);

    const img = previewCanvasRef.current.toDataURL("image/png");
    setPreviewImage(img);

    resizeCanvas({});
  };

  const submitImage = async () => {
    fabricRef.current.discardActiveObject().renderAll();

    await generatePreview();
    const savedCanvas = fabricRef.current.toObject();

    const destCtx = renderCanvasRef.current.getContext("2d");

    if (size.name === "portrait") {
      destCtx.translate(size.height / 2, size.width / 2);
      destCtx.rotate(90 * (Math.PI / 180));

      destCtx.drawImage(
        canvasRef.current,
        -canvasRef.current.width / 2,
        -canvasRef.current.height / 2,
        canvasRef.current.width,
        canvasRef.current.height
      );

      destCtx.rotate(-90 * (Math.PI / 180));
      destCtx.translate(-size.height / 2, -size.width / 2);
    } else {
      destCtx.translate(size.width / 2, size.height / 2);
      destCtx.rotate(180 * (Math.PI / 180));

      destCtx.drawImage(
        canvasRef.current,
        -canvasRef.current.width / 2,
        -canvasRef.current.height / 2,
        canvasRef.current.width,
        canvasRef.current.height
      );

      destCtx.rotate(-180 * (Math.PI / 180));
      destCtx.translate(-size.width / 2, -size.height / 2);
    }

    await canvasToDither({ ref: renderCanvasRef });

    const palette = getDefaultPalettes("spectra6");
    const spectra6colors = getDeviceColors("spectra6");
    const prepared = replaceColors(
      renderCanvasRef.current,
      renderCanvasRef.current,
      {
        originalColors: ogColors,
        replaceColors: [
          "#000000",
          "#FFFFFF",
          "#0000FF",
          "#00FF00",
          "#FF0000",
          "#FFFF00",
        ],
      }
    );

    // get blobs via promises to ensure rendering is complete
    const blob = await new Promise<Blob>((resolve) =>
      renderCanvasRef.current.toBlob((b) => resolve(b!))
    );
    const blobPreview = await new Promise<Blob>((resolve) =>
      previewCanvasRef.current.toBlob((b) => resolve(b!))
    );
    store.onSubmit({
      dataDirect: blob,
      dataOriginal: blobPreview,
      dataEditable: JSON.stringify(savedCanvas),
      kind: "image",
      meta: {
        lut: colorList[lut].lut,
        sleepTime,
        size: size,
        orientation: size.name,
      },
    });

    resizeCanvas({});
  };

  const scale = pageWidth ? pageWidth / size.width : 1;

  React.useEffect(() => {
    const handleResize = () => {
      resizeCanvas({});
      setPageWidth(wrapperRef?.current?.offsetWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
  });

  const containerRef = React.useRef(null);

  const handleClickOutside = (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      discardSelect();
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function resizeCanvas({
    width,
    height,
    enableRetinaScaling = true,
    imageSmoothingEnabled = false,
  }: any) {
    const initialWidth = fabricRef.current.getWidth();
    const initialHeight = fabricRef.current.getHeight();

    const containerWidth = width || wrapperRef?.current?.offsetWidth || 500;
    const containerHeight = height || wrapperRef?.current?.offsetHeight || 500;

    fabricRef.current.imageSmoothingEnabled = imageSmoothingEnabled;
    fabricRef.current.enableRetinaScaling = enableRetinaScaling;

    fabricRef.current.renderAll();

    const ratio = initialWidth / initialHeight;

    //const scale = containerWidth / fabricRef.current.getWidth();
    const scale = containerWidth / initialWidth;

    //const zoom = fabricRef.current.getZoom() * scale;
    fabricRef.current.setDimensions({
      width: containerWidth,
      height: containerWidth / ratio,
    });

    // Set zoom directly to 'scale', not multiplied by the old zoom
    //fabricRef.current.setZoom(scale);

    fabricRef.current.setViewportTransform([scale, 0, 0, scale, 0, 0]);
  }

  useEffect(() => {
    const observedDiv = wrapperRef.current;

    const onResize = (entries) => {
      resizeCanvas({});
    };

    const resizeObserver = new ResizeObserver(onResize);

    if (observedDiv) {
      resizeObserver.observe(observedDiv);
    }

    return () => {
      if (observedDiv) {
        resizeObserver.unobserve(observedDiv);
      }
      resizeObserver.disconnect();
    };
  }, []);

  const [modalOpen, setModalOpen] = useState(false);

  const discardSelect = () => {
    // If has active object
    if (fabricRef.current.getActiveObject()) {
      fabricRef.current.discardActiveObject().renderAll();
      setModalOpen(false);
    } else {
      fabricRef.current.renderAll();
    }
  };

  return (
    <>
      {preview && (
        <Modal
          modalHeading={<Trans>Preview</Trans>}
          primaryButtonText={<Trans>Back</Trans>}
          onRequestClose={() => setPreview(false)}
          onRequestSubmit={() => setPreview(false)}
          open
        >
          <Preview
            previewImage={previewImage}
            previewImageRef={previewImageRef}
          />
        </Modal>
      )}
      <IntegrationModal
        modalHeading={<Trans>Editor</Trans>}
        onRequestSubmit={submitImage}
        onSecondarySubmit={openPreviewImage}
        context={{
          activeObject,
          fabricRef,
          canvasRef,
          darkMode: true,
          colors,
          setLastColor,
          lastColor,
          setCurrentObjectActive,
          control,
          rotateCanvas,
          rotateScreen,
          size,
          ...store,
          modalOpen,
          setModalOpen,
          form: store.form,
        }}
        store={store}
        elements={Elements}
        containerRef={containerRef}
      >
        <div className={styles.editor}>
          <div className={styles.outerWrapper}>
            <div
              className={styles.wrapper}
              ref={wrapperRef}
              style={{ aspectRatio: `${size.width} /${size.height}` }}
            >
              <div
                className={styles.canvas}
                // style={{ transform: `scale(${scale})` }}
              >
                <canvas
                  ref={canvasRef}
                  className={`${styles.canvas} ${styles[lut]}`}
                  // onChange={updateImage}
                  height={size.height}
                  width={size.width}
                />
              </div>

              {activeObject && (
                <Button
                  className={styles.activeObjectDelete}
                  onClick={discardSelect}
                  kind="ghost"
                  icon={<FontAwesomeIcon icon={faCheck} />}
                  iconReverse
                >
                  Fertig
                </Button>
              )}
            </div>
          </div>

          <div className={isDebug ? styles.debugPreview : styles.preview}>
            <canvas
              className={styles.renderCanvas}
              ref={renderCanvasRef}
              id="renderCanvas"
              height={initHeight}
              width={initWidth}
            />
            <canvas
              ref={previewCanvasRef}
              id="previewCanvas"
              height={size.height}
              width={size.width}
            />
          </div>
        </div>
      </IntegrationModal>
    </>
  );
};

export default Editor;
