import { Router } from "express";
import {
  auth,
  bearerAuth,
  buildRouterAndDocs,
  registry,
  validateZod,
  validateDeviceIsInOrganization,
  validateDeviceOrOrganizationQuery,
  xApiKey,
} from "@internetderdinge/api";
import {
  createPaperSchema,
  updatePaperSchema,
  getPaperSchema,
  uploadSingleImageSchema,
  uploadSingleImageMultipartBodySchema,
  getPaperByIdSchema,
  deletePaperSchema,
  queryPapersByDeviceSchema,
  calendarPreviewRequestSchema,
} from "./papers.validation";
import {
  paperResponseSchema,
  queryPapersByDeviceResponseSchema,
  calendarPreviewResponseSchema,
} from "./papers.schemas";
import {
  createEntry,
  queryPapersByDevice,
  getEntry,
  updateEntry,
  deleteEntry,
  uploadSingleImageFromWebsite,
  getCalendarByEntry,
  getCalendarPreview,
  generateSignedFileUrl,
  uploadSingleImage,
  createPluginRedirectToken,
  redeemPluginRedirectToken,
} from "./papers.controller";
import { validatePaper } from "../middlewares/validatePaper";
import multer from "multer";
import type { RouteSpec } from "@internetderdinge/api";

export const papersRouteSpecs: RouteSpec[] = [
  {
    method: "post",
    path: "/",
    validate: [auth("manageUsers"), validateDeviceIsInOrganization],
    requestSchema: createPaperSchema,
    responseSchema: paperResponseSchema,
    handler: createEntry,
    summary: "Create a new paper entry",
    description:
      "Creates a new screen (paper) to be displayed on the ePaper device.",
    docs: ["paperlesspaper"],
  },
  {
    method: "get",
    path: "/",
    validate: [auth("getUsers"), validateDeviceOrOrganizationQuery],
    requestSchema: queryPapersByDeviceSchema,
    responseSchema: queryPapersByDeviceResponseSchema,
    handler: queryPapersByDevice,
    summary: "Query papers by device or organization",
    description:
      "Retrieves paper entries (screens) filtered by device or by organization when no device is provided.",
    docs: ["paperlesspaper"],
  },
  {
    method: "get",
    path: "/:paperId",
    validate: [auth("getUsers"), validatePaper],
    requestSchema: getPaperSchema,
    responseSchema: paperResponseSchema,
    handler: getEntry,
    summary: "Get a paper entry by ID",
    description: "Fetches the details of a single paper (screen) by its ID.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/:paperId",
    validate: [
      auth("manageUsers"),
      validateDeviceIsInOrganization,
      validatePaper,
    ],
    requestSchema: updatePaperSchema,
    responseSchema: paperResponseSchema,
    handler: updateEntry,
    summary: "Update a paper entry by ID",
    description:
      "Updates the content or settings of an existing paper (screen).",
    docs: ["paperlesspaper"],
  },
  {
    method: "delete",
    path: "/:paperId",
    validate: [auth("manageUsers"), validatePaper],
    requestSchema: deletePaperSchema,
    handler: deleteEntry,
    summary: "Delete a paper entry by ID",
    description: "Removes a paper (screen) from the system by its ID.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/updateSingleImageFromWebsite/:paperId",
    validate: [auth("getUsers"), validatePaper],
    handler: uploadSingleImageFromWebsite,
    summary: "Upload a single image from a website for a paper",
    description:
      "Downloads an image from a provided URL and attaches it to the specified paper.",
    docs: ["paperlesspaper"],
  },
  {
    method: "get",
    path: "/calendar/:paperId",
    validate: [auth("getUsers"), validatePaper],
    requestSchema: getPaperByIdSchema,
    responseSchema: paperResponseSchema,
    handler: getCalendarByEntry,
    summary: "Get calendar data for a paper entry",
    description:
      "Generates and returns calendar view data for the given paper.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/:paperId/calendar-preview",
    validate: [auth("getUsers"), validatePaper],
    requestSchema: calendarPreviewRequestSchema,
    responseSchema: calendarPreviewResponseSchema,
    handler: getCalendarPreview,
    summary: "Preview Google Calendar data",
    description:
      "Fetches the latest Google Calendar events for the specified paper without persisting any other paper changes.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/image/:paperId",
    validate: [auth("getUsers"), validatePaper],
    requestSchema: getPaperSchema,
    responseSchema: paperResponseSchema,
    handler: generateSignedFileUrl,
    summary: "Generate a signed file URL for a paper image",
    description:
      "Creates a temporary signed URL for uploading an image to storage.",
    docs: ["paperlesspaper"],
  },

  /*

  POST /papers/uploadSingleImage/:paperId now supports a few upload styles, so the easiest way to think about it is:

picture: your normal source image
pictureDevice: optional device-ready image
pictureEditable: optional JSON string for the editor state
settings: optional JSON string merged into paper.meta before upload
The route lives in papers.route.ts (line 150), and the logic is in papers.controller.ts (line 206).

How It Behaves
If you send only picture, the backend treats it as the source image, resizes it to the device, and dithers it.

If you send picture and pictureDevice, the backend uses:

pictureDevice as the final upload to the device
picture as the original reference image
If you send pictureEditable, it is stored as the editable JSON payload.

If you send settings, it is merged into paper.meta first, so values like lut or orientation affect this upload immediately.

1. Simple Upload
Send just a normal image:

curl -X POST "https://YOUR_API/papers/uploadSingleImage/PAPER_ID" \
  -H "Authorization: Bearer TOKEN" \
  -F "picture=@/path/to/image.png"
Result:

server resizes + dithers
if (deviceReadyFile) {
  formData.append("pictureDevice", deviceReadyFile);
}

if (editableJson) {
  formData.append("pictureEditable", JSON.stringify(editableJson));
}

if (settings) {
  formData.append("settings", JSON.stringify(settings));
}

await uploadSingleImage({
  id: paperId,
  body: formData,
  deviceId,
});

**/
  {
    method: "post",
    path: "/:paperId/plugin-redirect-token",
    validate: [auth("getUsers"), validatePaper],
    handler: createPluginRedirectToken,
    summary: "Create a short-lived integration redirect token",
    description:
      "Creates a single-use token (default 10 minutes) to authorize a plugin redirect back into the app.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/:paperId/plugin-redirect-redeem",
    validate: [auth("getUsers"), validatePaper],
    handler: redeemPluginRedirectToken,
    summary: "Redeem a short-lived integration redirect token",
    description: "Marks the token as used and verifies it has not expired.",
    docs: ["paperlesspaper"],
  },
];

const router: Router = Router();

const uploadSingleImageMiddlewares = [
  auth("getUsers"),
  validatePaper,
  multer({ limits: { fieldSize: 40 * 1024 * 1024 } }).fields([
    {
      // Backwards compatible: older clients send two files under the same
      // "picture" field (device-ready image first, original image second).
      name: "picture",
      maxCount: 2,
    },
    {
      // Newer clients can provide a dedicated device-ready image that
      // should be uploaded directly without extra optimization.
      name: "pictureDevice",
      maxCount: 1,
    },
  ]),
  validateZod(uploadSingleImageSchema),
];

router.post(
  "/uploadSingleImage/:paperId",
  ...uploadSingleImageMiddlewares,
  uploadSingleImage,
);

registry.registerPath({
  method: "post",
  path: "/papers/uploadSingleImage/{paperId}",
  summary: "Upload a single image for a paper",
  description:
    "Handles uploading one or more images and attaches them to the specified paper.",
  request: {
    params: uploadSingleImageSchema.params,
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: uploadSingleImageMultipartBodySchema,
        },
      },
    },
  },
  security: [{ [bearerAuth.name]: [] }, { [xApiKey.name]: [] }],
  responses: {
    200: {
      description: "Object with user data.",
      content: {
        "application/json": { schema: paperResponseSchema },
      },
    },
  },
  tags: ["Papers"],
});

buildRouterAndDocs(router, papersRouteSpecs, "/papers", ["Papers"]);

export default router;
