import multer from "multer";
import { ApiError } from "@internetderdinge/api";
import { PICTURE_DEVICE_MAX_BYTES } from "./pictureDevice.js";

const memoryStorage = multer.memoryStorage();

// Limit pictureDevice while streaming; keep the existing picture upload behavior.
const storage: multer.StorageEngine = {
  _handleFile(req, file, callback) {
    if (file.fieldname !== "pictureDevice") {
      memoryStorage._handleFile(req, file, callback);
      return;
    }
    let chunks: Buffer[] = [];
    let size = 0;
    let finished = false;
    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      chunks = [];
      callback(error);
    };
    file.stream.on("data", (chunk: Buffer) => {
      if (finished) return;
      size += chunk.length;
      if (size > PICTURE_DEVICE_MAX_BYTES) {
        fail(new ApiError(413, "pictureDevice must not exceed 10 MiB."));
        return;
      }
      chunks.push(chunk);
    });
    file.stream.on("error", fail);
    file.stream.on("end", () => {
      if (finished) return;
      finished = true;
      callback(null, { buffer: Buffer.concat(chunks), size });
      chunks = [];
    });
  },
  _removeFile: memoryStorage._removeFile.bind(memoryStorage),
};

const parseImages = multer({
  storage,
  limits: { fieldSize: 40 * 1024 * 1024 },
}).fields([
  { name: "picture", maxCount: 2 },
  { name: "pictureDevice", maxCount: 1 },
]);

export const paperImageUpload: typeof parseImages = (req, res, next) => {
  parseImages(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      next(new ApiError(400, `Invalid image upload: ${error.message}.`));
      return;
    }
    next(error);
  });
};
