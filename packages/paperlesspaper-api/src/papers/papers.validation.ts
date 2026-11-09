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
      kind: z
        .enum([
          ".png",
          "original.png",
          "original.jpg",
          "thumbnail.jpg",
          "editable.json",
        ])
        .optional()
        .openapi({ example: ".png" }),
      return: z.literal("json").optional(),
    })
    .refine((body) => body.return !== "json" || body.kind === "editable.json", {
      message: "JSON is only available for editable image data",
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
    forceUpload: z.string().optional(),
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
  pictureDevice: z
    .any()
    .optional()
    .openapi({
      type: "string",
      format: "binary",
      description:
        "Supported public file field for a device-ready PNG or JPEG, at most 10 MiB (10,485,760 bytes). " +
        "Use native panel dimensions: epd7 800x480; openpaper13 1600x1200, even for portrait content. " +
        "Apply rotation to the pixels before upload; EXIF orientation other than 1 is rejected. " +
        "Our renderer rotates portrait content 90 degrees clockwise for both models; landscape content 180 degrees for epd7 and 0 degrees for openpaper13. " +
        "These are the renderer conventions, not a promise of sensor compensation. The backend does not apply the orientation setting to this field. " +
        "For pre-dithered images, use an opaque 8-bit RGB/RGBA PNG; JPEG is lossy. " +
        "Our Spectra 6 renderer outputs #000000, #FFFFFF, #FF0000, #00FF00, #0000FF and #FFFF00. " +
        "Palette values are not validated or remapped; other colors pass through without a guaranteed panel appearance. " +
        "Send picture as well for an undithered preview; otherwise the preview is generated from pictureDevice.",
    }),
  pictureEditable: z.string().optional().openapi({
    description: "Optional JSON string with editable fabric.js state.",
  }),
  forceUpload: z.string().optional().openapi({
    description:
      "Set to true to bypass similarity against the last uploaded device image, including for pictureDevice. This does not confirm display on the frame.",
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
