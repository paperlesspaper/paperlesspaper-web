import Hammer from "hammerjs";

export default function touchHandler({ canvas }) {
  // --------------------------
  let currentScale = null;
  let currentScaleX = null;
  let currentScaleY = null;
  let currentRotation = null;
  let adjustScale = 1;
  let adjustScaleX = 1;
  let adjustScaleY = 1;
  let adjustRotation = 0;

  const hammer = new Hammer.Manager(canvas.upperCanvasEl);
  const rotate = new Hammer.Rotate();
  const pinch = new Hammer.Pinch();
  hammer.add([pinch, rotate]);
  hammer.get("rotate").set({ enable: true });
  hammer.get("pinch").set({ enable: true });

  hammer.on("pinchstart rotatestart", (e) => {
    console.log("start");
    adjustRotation -= e.rotation;

    if (canvas.getActiveObject()) {
      const object = canvas.getActiveObject();
      adjustScaleX = object.scaleX;
      adjustScaleY = object.scaleY;
    }
  });

  hammer.on("pinchmove rotatemove", (e) => {
    currentRotation = adjustRotation + e.rotation;
    currentScale = adjustScale * e.scale;

    if (canvas.getActiveObject()) {
      const object = canvas.getActiveObject();

      currentScaleX = adjustScaleX * e.scale;
      currentScaleY = adjustScaleY * e.scale;

      // Blocks object from being resized too small (and maintains aspect ratio)
      if (
        !(
          currentScaleX > object.minScaleLimit &&
          currentScaleY > object.minScaleLimit
        )
      ) {
        currentScaleX = object.scaleX;
        currentScaleY = object.scaleY;
      }

      object.set({ lockMovementX: true, lockMovementY: true });

      object.set("scaleX", currentScaleX);
      object.set("scaleY", currentScaleY);
      object.rotate(currentRotation);
      object.setCoords();
      canvas.renderAll();
    }
  });

  hammer.on("pinchend rotateend", () => {
    adjustScale = currentScale;
    adjustRotation = currentRotation;
    adjustScaleX = currentScaleX;
    adjustScaleY = currentScaleY;

    if (canvas.getActiveObject()) {
      const object = canvas.getActiveObject();

      // Timeout is to smooth out jitteryness, especially on iOS (iPad)
      setTimeout(function () {
        object.set({
          lockMovementX: false,
          lockMovementY: false,
        });
      }, 300);
    }

    canvas.renderAll();
  });
}
