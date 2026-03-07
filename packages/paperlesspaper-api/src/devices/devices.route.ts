import { Router } from "express";
import multer from "multer";
import {
  auth,
  buildRouterAndDocs,
  devicesRoute as sharedDevicesRoute,
  uploadSingleImageFromWebsiteSchema,
  validateDevice,
} from "@internetderdinge/api";
import type { RouteSpec } from "@internetderdinge/api";
import { z } from "zod";
import devicesController from "./devices.controller";
import {
  getImageSchema,
  updateSingleImageMetaSchema,
  uploadSingleImageSchema,
} from "./devices.validation.js";

const uploadFromWebsiteResponseSchema = z.object({
  deviceMeta: z.any(),
  deviceUpdate: z.any(),
  iotUpload: z.any(),
});

const uploadResponseSchema = z.object({
  deviceMeta: z.any().optional(),
  deviceUpdate: z.any().optional(),
  iotUpload: z.any().optional(),
  url: z.string().optional(),
});

const imageResponseSchema = z.object({
  url: z.string(),
});

const upload = multer({
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

export const devicesRouteSpecs: RouteSpec[] = [
  {
    method: "get",
    path: "/image/:deviceId/:uuid",
    validate: [auth("getUsers"), validateDevice],
    requestSchema: getImageSchema,
    responseSchema: imageResponseSchema,
    handler: devicesController.getImageById,
    summary: "Fetch an image by UUID",
    description:
      "Download a previously uploaded image for the device by its UUID.",
  },
  {
    method: "post",
    path: "/updateSingleImageMeta/:deviceId",
    validate: [auth("getUsers"), validateDevice],
    requestSchema: updateSingleImageMetaSchema,
    responseSchema: uploadResponseSchema,
    handler: devicesController.updateSingleImageMeta,
    summary: "Update image metadata",
    description:
      "Modify metadata (e.g., title, tags) for an existing device image.",
  },
  {
    method: "post",
    path: "/uploadSingleImage/:deviceId",
    validate: [auth("getUsers"), upload.array("picture", 2), validateDevice],
    requestSchema: uploadSingleImageSchema,
    responseSchema: uploadResponseSchema,
    handler: devicesController.uploadSingleImage,
    summary: "Upload one or two images",
    description:
      "Upload up to two image files to the device for processing or storage.",
  },
  {
    method: "post",
    path: "/updateSingleImageFromWebsite/:deviceId",
    validate: [auth("getUsers"), validateDevice],
    requestSchema: uploadSingleImageFromWebsiteSchema,
    responseSchema: uploadFromWebsiteResponseSchema,
    handler: devicesController.uploadSingleImageFromWebsite,
    summary: "Upload image from website URL",
    description:
      "Fetch and upload an image to the device by providing its URL.",
  },
];

const router: Router = Router();
router.use("/", sharedDevicesRoute);
buildRouterAndDocs(router, devicesRouteSpecs, "/devices", ["Devices"]);

export default router;
