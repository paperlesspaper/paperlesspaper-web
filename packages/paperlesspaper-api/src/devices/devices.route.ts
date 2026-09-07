import { Router } from "express";
import multer from "multer";
import {
  auth,
  buildRouterAndDocs,
  createDevicesRoute,
  uploadSingleImageFromWebsiteSchema,
  validateAdmin,
  validateDevice,
} from "@internetderdinge/api";
import type { RouteSpec } from "@internetderdinge/api";
import { z } from "zod";
import devicesController from "./devices.controller";
import {
  deleteDeviceByDeviceIdSchema,
  getDeviceUploadLogsSchema,
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

const deviceUploadLogsResponseSchema = z.object({
  results: z.array(z.any()),
});

const deviceDeactivationPreviewSchema = z.object({
  device: z.object({
    id: z.string(),
    deviceId: z.string(),
    kind: z.string().nullable(),
    organizationId: z.string().nullable(),
  }),
  papersToDetach: z.object({
    count: z.number().int().nonnegative(),
    ids: z.array(z.string()),
  }),
  iotDeviceWillBeDeactivated: z.literal(true),
  confirmationToken: z.string(),
});

const deactivatedDeviceResponseSchema = z.object({
  dryRun: z.boolean(),
  deactivated: z.boolean(),
  preview: deviceDeactivationPreviewSchema,
  deleted: z
    .object({
      devices: z.number().int().nonnegative(),
    })
    .optional(),
  updated: z
    .object({
      papers: z.number().int().nonnegative(),
    })
    .optional(),
  iotDeviceDeactivated: z.literal(true).optional(),
});

const upload = multer({
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

export const devicesRouteSpecs: RouteSpec[] = [
  {
    method: "get",
    path: "/upload-logs/:deviceId",
    validate: [auth("getUsers"), validateDevice],
    requestSchema: getDeviceUploadLogsSchema,
    responseSchema: deviceUploadLogsResponseSchema,
    handler: devicesController.getUploadLogs,
    summary: "Fetch recent device upload attempts",
    description:
      "Return recent image upload decisions and diagnostics for the selected device.",
  },
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
  {
    method: "delete",
    path: "/by-device-id/:deviceId",
    validate: [auth("manageUsers"), validateAdmin],
    requestSchema: deleteDeviceByDeviceIdSchema,
    responseSchema: deactivatedDeviceResponseSchema,
    handler: devicesController.deleteByDeviceId,
    summary: "Deactivate Device",
    description:
      "Admin-only, dry-run-first deactivation by epd DeviceId. A dry run is the default and returns the papers currently attached plus a confirmationToken. Papers and their cross-paper references are preserved. To execute, repeat with dryRun=false and that token. After a confirmed IoT reset, cleanup can be retried with the same token without resetting the device again; a completed request returns its saved result. Cleanup only affects the original database device and detaches its remaining paper references. Change counts describe the successful cleanup attempt.",
  },
];

const router: Router = Router();
router.use(
  "/",
  createDevicesRoute({
    routeSpecs: (specs: RouteSpec[]) =>
      specs.map((spec) =>
        spec.method === "get" && spec.path === "/events/:deviceId"
          ? {
              ...spec,
              description: `
Fetch a chronological list of events generated by the specified device.

This includes activate events sent on every device wake-up containing
current settings and states, as well as update state events such as:

EventType: \`state\`:

- \`update_checked_nopicture\`
- \`update_checked_ok\`
- \`download_ok\`
- \`update_ok\`
- \`update_failed\`

EventType: \`activate\`:
- \`json\`
- \`AwsTopic\`

Examples:
json: \`{"file":"1722482048","fw":"b3.0.10","bat":"3749","wake":"BUTTON","wifi":"1, -45","usb":"1","orient":"2","timeout":"300","timeoutPredict":"296","timeoutRecentSetting":300}\`
AwsTopic: \`$aws/things/epd13-0000000000/activateepaper\`

The latest update state is also available in the device information
payload under the updatePending property.
`,
            }
          : spec,
      ),
  }),
);
buildRouterAndDocs(router, devicesRouteSpecs, "/devices", ["Devices"]);

export default router;
