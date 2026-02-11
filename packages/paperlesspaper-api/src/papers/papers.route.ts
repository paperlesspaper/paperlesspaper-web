import { Router } from "express";
import {
  auth,
  buildRouterAndDocs,
  validateDeviceIsInOrganization,
  validateDeviceOrOrganizationQuery,
} from "@internetderdinge/api";
import {
  createPaperSchema,
  updatePaperSchema,
  getPaperSchema,
  getPaperByIdSchema,
  deletePaperSchema,
  queryPapersByDeviceSchema,
  calendarPreviewRequestSchema,
} from "./papers.validation.js";
import {
  paperResponseSchema,
  queryPapersByDeviceResponseSchema,
  calendarPreviewResponseSchema,
} from "./papers.schemas.js";
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
} from "./papers.controller.js";
import { validatePaper } from "../middlewares/validatePaper";
import multer from "multer";
import type { RouteSpec } from "@internetderdinge/api";
import { request } from "https";

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
  {
    method: "post",
    path: "/uploadSingleImage/:paperId",
    validate: [
      auth("getUsers"),
      validatePaper,
      multer({ limits: { fieldSize: 40 * 1024 * 1024 } }).array("picture", 2),
    ],
    handler: uploadSingleImage,
    requestSchema: getPaperSchema,
    responseSchema: paperResponseSchema,
    summary: "Upload a single image for a paper",
    description:
      "Handles uploading one or more images and attaches them to the specified paper.",
    docs: ["paperlesspaper"],
  },
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

buildRouterAndDocs(router, papersRouteSpecs, "/papers", ["Papers"]);

export default router;
