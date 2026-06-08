import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { zObjectId, zObjectIdFor, zPagination } from "@internetderdinge/api";

export const createPaperSchema = {
  body: z.object({
    deviceId: zObjectIdFor("deviceId"),
    devicePaperId: zObjectId.optional(),
    kind: z.string(),
    meta: z.any(),
    organization: zObjectIdFor("organization"),
  }),
};

extendZodWithOpenApi(z);

export const updatePaperSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z.object({
    deviceId: zObjectIdFor("deviceId"),
    devicePaperId: zObjectId.optional(),
    kind: z.string(),
    meta: z.any(),
    organization: zObjectIdFor("organization"),
  }),
};

export const getPaperSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z.object({
    kind: z.string().optional(),
    return: z.string().optional(),
  }),
};

export const generateSignedFileUrlSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z
    .object({
      kind: z.string().optional().openapi({ example: ".png" }),
      return: z.string().optional(),
    })
    .openapi({
      example: {
        kind: ".png",
      },
    }),
};

export const uploadSingleImageSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z.object({
    picture: z.any().optional(),
    pictureEditable: z.string().optional(),
    snapshotCurrentFrame: z.string().optional(),
    settings: z.string().optional(),
  }),
};

export const uploadSingleImageMultipartBodySchema = z.object({
  picture: z.any().optional().openapi({
    type: "string",
    format: "binary",
    description: "Source image file. (Older clients may send this field twice)",
  }),
  pictureDevice: z.any().optional().openapi({
    type: "string",
    format: "binary",
    description:
      "Optional device-ready image uploaded without extra processing.",
  }),
  pictureEditable: z.string().optional().openapi({
    description: "Optional JSON string with editable fabric.js state.",
  }),
  snapshotCurrentFrame: z.string().optional().openapi({
    description:
      "Set to true only when the target frame was already showing this paper before upload.",
  }),
  settings: z.string().optional().openapi({
    description: "Optional JSON string merged into paper.meta before upload.",
  }),
});

export const getPaperByIdSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
};

export const deletePaperSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
};

export const queryPapersByDeviceSchema = {
  ...zPagination,
  query: zPagination.query
    .extend({
      //deviceId: zObjectId,
      deviceId: zObjectIdFor("deviceId").optional(),
      organization: zObjectIdFor("organization").optional(),
    })
    .refine((query) => Boolean(query.deviceId || query.organization), {
      message: "At least one of deviceId or organization is required",
    }),
};

export const calendarPreviewRequestSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z
    .object({
      selectedCalendars: z.record(z.string(), z.boolean()).optional(),
      dayRange: z.coerce.number().min(1).max(100).optional(),
      maxEvents: z.coerce.number().min(1).max(200).optional(),
      code: z.string().optional(),
      googleCalendar: z.record(z.string(), z.any()).optional(),
    })
    .openapi({
      example: {
        selectedCalendars: { primary: true },
        dayRange: 7,
        maxEvents: 10,
      },
    }),
};
