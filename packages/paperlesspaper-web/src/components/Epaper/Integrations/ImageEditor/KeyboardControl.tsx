import React from "react";
import * as fabric from "fabric";
import { useImageEditorContext } from "./ImageEditor";

export default function KeyboardControl() {
  const { fabricRef }: any = useImageEditorContext();

  // Fabric.js image function
  /*function canvasImage(url) {
    console.log("Adding image from URL", url);
    const img = new fabric.Image(url);
    img.set({
      left: 0,
      top: 0,
    });
    img.scaleToWidth(300);
    //fabricRef.current.add(img).setActiveObject(img).renderAll();

    fabric.Image.fromURL(url, function (img) {
      fabricRef.current.add(img);
      console.log("Added image", img);
    });
  }*/

  React.useEffect(() => {
    // Keydown handler (copy, cut, undo, redo, select all, duplicate, move, etc.)
    const handleKeyDown = async (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      // Copy (only selected object(s))
      if (ctrl && e.key.toLowerCase() === "c") {
        // ...existing code...
        const activeObject = fabricRef?.current?.getActiveObject?.();
        if (activeObject) {
          e.preventDefault();
          await new Promise<void>((resolve) => {
            activeObject.clone(async function (cloned: any) {
              try {
                const json = JSON.stringify(cloned.toObject());
                await navigator.clipboard.writeText(json);
              } catch (err) {
                console.error("Failed to copy to clipboard", err);
              }
              resolve();
            });
          });
        }
        return;
      }

      // Cut (only selected object(s))
      if (ctrl && e.key.toLowerCase() === "x") {
        // ...existing code...
        const activeObject = fabricRef?.current?.getActiveObject?.();
        if (activeObject) {
          e.preventDefault();
          await new Promise<void>((resolve) => {
            activeObject.clone(async function (cloned: any) {
              try {
                const json = JSON.stringify(cloned.toObject());
                await navigator.clipboard.writeText(json);
                if (!fabricRef?.current) return resolve();
                fabricRef.current.getActiveObjects().forEach((o) => {
                  fabricRef.current.remove(o);
                });
              } catch (err) {
                console.error("Failed to cut to clipboard", err);
              }
              resolve();
            });
          });
        }
        return;
      }

      // Undo
      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (fabricRef.current.undo) fabricRef.current.undo();
        return;
      }

      // Redo (Ctrl+Shift+Z or Ctrl+Y)
      if (
        (ctrl && e.key.toLowerCase() === "y") ||
        (ctrl && e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        if (fabricRef.current.redo) fabricRef.current.redo();
        return;
      }

      // Select all
      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const objs = fabricRef.current.getObjects();
        if (objs.length) {
          fabricRef.current.discardActiveObject();
          const sel = new fabric.ActiveSelection(objs, {
            canvas: fabricRef.current,
          });
          fabricRef.current.setActiveObject(sel);
          fabricRef.current.requestRenderAll();
        }
        return;
      }

      // Duplicate (only selected object(s))
      if (ctrl && e.key.toLowerCase() === "d") {
        // ...existing code...
        const activeObject = fabricRef?.current?.getActiveObject?.();
        if (activeObject) {
          e.preventDefault();
          activeObject.clone(function (clonedObj: any) {
            fabricRef.current.discardActiveObject();
            clonedObj.set({
              left: clonedObj.left + 10,
              top: clonedObj.top + 10,
              evented: true,
            });
            if (clonedObj.type === "activeSelection") {
              clonedObj.canvas = fabricRef.current;
              clonedObj.forEachObject(function (obj: any) {
                fabricRef.current.add(obj);
              });
              clonedObj.setCoords();
            } else {
              fabricRef.current.add(clonedObj);
            }
            fabricRef.current.setActiveObject(clonedObj);
            fabricRef.current.requestRenderAll();
          });
        }
        return;
      }

      // Escape: deselect
      if (e.key === "Escape") {
        if (fabricRef?.current?.getActiveObject?.()) {
          e.preventDefault();
          fabricRef.current.discardActiveObject?.();
          fabricRef.current.requestRenderAll?.();
        }
        return;
      }

      // Move with arrow keys
      const moveKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (moveKeys.includes(e.key)) {
        const activeObjects = fabricRef?.current?.getActiveObjects?.();
        if (!activeObjects?.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        activeObjects.forEach((obj: any) => {
          switch (e.key) {
            case "ArrowUp":
              obj.top -= step;
              break;
            case "ArrowDown":
              obj.top += step;
              break;
            case "ArrowLeft":
              obj.left -= step;
              break;
            case "ArrowRight":
              obj.left += step;
              break;
          }
          if (typeof obj.setCoords === "function") obj.setCoords();
        });
        fabricRef.current.requestRenderAll?.();
      }
    };

    // Paste handler for window paste event
    const handlePasteAnywhere = async (e: ClipboardEvent) => {
      // Only handle if not in input/textarea/select/contenteditable
      const tag = document.activeElement?.tagName;
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      // Try to read clipboard items (for images)
      if (e.clipboardData && e.clipboardData.items) {
        let handled = false;
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (blob) {
              const url = URL.createObjectURL(blob);
              fabric.Image.fromURL(url, (img: any) => {
                if (!fabricRef?.current) return;
                img.set({
                  left: 100,
                  top: 100,
                  evented: true,
                });
                fabricRef.current.add(img);
                fabricRef.current.setActiveObject(img);
                fabricRef.current.requestRenderAll();
              });
              handled = true;
              e.preventDefault();
              break;
            }
          }
        }
        if (handled) return;
      }

      // fallback to text-based paste (object)
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      let objData;
      try {
        objData = JSON.parse(text);
      } catch {
        // Not valid JSON, ignore
        return;
      }
      if (!fabricRef?.current) return;
      fabric.util.enlivenObjects([objData], function (enlivenedObjects: any[]) {
        if (!enlivenedObjects.length) return;
        const clonedObj = enlivenedObjects[0];
        fabricRef.current.discardActiveObject();
        clonedObj.set({
          left: clonedObj.left + 10,
          top: clonedObj.top + 10,
          evented: true,
        });
        if (clonedObj.type === "activeSelection") {
          clonedObj.canvas = fabricRef.current;
          clonedObj.forEachObject(function (obj: any) {
            fabricRef.current.add(obj);
          });
          clonedObj.setCoords();
        } else {
          fabricRef.current.add(clonedObj);
        }
        fabricRef.current.setActiveObject(clonedObj);
        fabricRef.current.requestRenderAll();
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePasteAnywhere);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePasteAnywhere);
    };
  }, [fabricRef]);

  return null;
}
