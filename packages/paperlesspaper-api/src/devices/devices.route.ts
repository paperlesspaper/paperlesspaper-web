import { Router } from "express";
import {
  auth,
  buildRouterAndDocs,
  uploadSingleImageFromWebsiteSchema,
  validateDevice,
} from "@internetderdinge/api";
import type { RouteSpec } from "@internetderdinge/api";
import { z } from "zod";
import devicesController from "./devices.controller.js";

const uploadFromWebsiteResponseSchema = z.object({
  deviceMeta: z.any(),
  deviceUpdate: z.any(),
  iotUpload: z.any(),
});

export const devicesRouteSpecs: RouteSpec[] = [
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
buildRouterAndDocs(router, devicesRouteSpecs, "/devices", ["Devices"]);

export default router;
