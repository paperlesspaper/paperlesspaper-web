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
import useRotationList from "./useRotationList";
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

const initWidth = 600;
const initHeight = 448;

//const diffusionOptions = ["errorDiffusion", "ordered", "random", "noDither"];

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
      </ActiveObject>

      <ActiveObject type="group" />

      <ActiveObject>
        <EditorElements />
        <DeletePaper />
      </ActiveObject>
    </>
  );
};

export const EditorContext: any = React.createContext("editor");

export const rotationList = {
  portrait: {
    name: "portrait",
    value: 9,
    width: initHeight,
    height: initWidth,
  },
  landscape: {
    name: "landscape",
    value: 0,
    width: initWidth,
    height: initHeight,
  },
};

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

  const { t } = useTranslation();

  const history = useHistory();
  const params = useParams();

  const [generateImageUrlAlt, generateImageUrlAltResult] =
    papersApi.useGenerateImageUrlAltMutation();

  const loadeImageData = async () => {
    const data = await generateImageUrlAlt({
      id: params.paper,
      body: { kind: "editable.json", return: "json" },
    });

    // Modify the `loadFromJSON` method to restore the original width and height for images
    //fabricRef.current.fromObject(data.data);

    // Load the canvas JSON data
    console.log("data.data", data.data);
    fabricRef.current.loadFromJSON(data.data);
    // fabricRef.current.loadFromJSON(data.data, () => {
    // After loading the JSON, restore the image dimensions for any image objects on the canvas
    /*fabricRef.current.getObjects("image").forEach((img) => {
        if (img.originalWidth && img.originalHeight) {
          // Restore original width and height
          img.set({
            width: img.originalWidth,
            height: img.originalHeight,
          });

          // Optionally, if you need to scale the image according to the device pixel ratio
          /* const devicePixelRatio = window.devicePixelRatio || 1;
          img.set({
            width: img.originalWidth * devicePixelRatio,
            height: img.originalHeight * devicePixelRatio,
          });
          

          // Scale the image to the correct size (if needed)
          img.scaleToWidth(img.originalWidth * devicePixelRatio);
          img.scaleToHeight(img.originalHeight * devicePixelRatio);
        }
      });*/
    //});
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
      /* fabric.Image.prototype.toObject = (function (toObject) {
        return function () {
          // Check if the src is already a data URL or a file path.
          let src = this._element.src;

          // If the src is a file path or a regular URL, convert it to a base64 data URL
          if (!src.startsWith("data:image")) {
            const self = this;
            const imgElement = this._element;

            const toDataURLPromise = new Promise((resolve, reject) => {
              // Create an Image to load and convert to Data URL
              const tempImage = new Image();
              tempImage.onload = function () {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = tempImage.width;
                canvas.height = tempImage.height;
                ctx.drawImage(tempImage, 0, 0);
                const dataURL = canvas.toDataURL();
                resolve(dataURL);
              };
              tempImage.onerror = reject;
              tempImage.src = imgElement.src; // Use the original image source
            });

            // Update the src in the object when the image is loaded
            toDataURLPromise.then((dataURL) => {
              // Extend the object with the embedded data URL
              return fabric.util.object.extend(toObject.call(self), {
                src: dataURL,
              });
            });
            return {}; // Return empty, as the promise handles the update.
          } else {
            // If it's already a base64 image, just return it directly
            return fabric.util.object.extend(toObject.call(this), {
              src: src,
            });
          }
        };
      })(fabric.Image.prototype.toObject);
      */

      /* fabric.Image.fromObject = function (object, callback) {
        if (object.src) {
          fabric.Image.fromURL(object.src, function (img) {
            // Set the original width and height (before scaling for high DPI)
            img.set({
              width: object.originalWidth,
              height: object.originalHeight,
            });

            // Optionally set the image scaling, if needed
            img.set({
              scaleX: img.width / object.originalWidth,
              scaleY: img.height / object.originalHeight,
            });

            callback(img);
          });
        } else {
          callback(new fabric.Image());
        }
      };*/

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

  const replaceColors = ({
    colorsReplace,
    ref,
    width = size.width,
    height = size.height,
  }) => {
    const destCtx = ref.current.getContext("2d");
    const imageData = destCtx.getImageData(0, 0, width, height);

    colors.forEach((color, f) => {
      const colorRgb = hex(color);
      const colorMapRgb = hex(colorsReplace[f]);

      for (let i = 0; i < imageData.data.length; i += 4) {
        if (
          imageData.data[i] == colorRgb[0] &&
          imageData.data[i + 1] == colorRgb[1] &&
          imageData.data[i + 2] == colorRgb[2]
        ) {
          imageData.data[i] = colorMapRgb[0];
          imageData.data[i + 1] = colorMapRgb[1];
          imageData.data[i + 2] = colorMapRgb[2];
        }
      }
    });
    destCtx.putImageData(imageData, 0, 0);
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
      ditheringType,
      palette: colors, //colors,
    };
    await dither(ref.current, ref.current, options);
  };

  const generatePreview = async () => {
    discardSelect();

    const destCtx = previewCanvasRef.current.getContext("2d");
    destCtx.drawImage(
      canvasRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    await canvasToDither({ ref: previewCanvasRef });

    replaceColors({
      colorsReplace: lut === "bw" ? colorsBw : colorsSlightlyReal,
      ref: previewCanvasRef,
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

    resizeCanvas({
      width: size.width,
      height: size.height,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
    });

    await generatePreview();
    const savedCanvas = fabricRef.current.toObject();

    console.log("savedCanvas", savedCanvas);

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
    replaceColors({
      colorsReplace: colorsMap,
      ref: renderCanvasRef,
      width: initWidth,
      height: initHeight,
    });

    renderCanvasRef.current.toBlob((blob) => {
      previewCanvasRef.current.toBlob((blobPreview) => {
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
      });
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

          <div className={styles.preview}>
            <canvas
              className={styles.renderCanvas}
              ref={renderCanvasRef}
              id="caaann2"
              height={initHeight}
              width={initWidth}
            />
            <canvas
              ref={previewCanvasRef}
              id="caaann"
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
