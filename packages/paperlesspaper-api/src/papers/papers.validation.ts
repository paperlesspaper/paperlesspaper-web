import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  zObjectId,
  zObjectIdFor,
  zPagination,
} from "@internetderdinge/api/src/utils/zValidations";

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
  query: zPagination.query.extend({
    //deviceId: zObjectId,
    deviceId: zObjectIdFor("deviceId").optional(),
    organization: zObjectIdFor("organization"),
  }),
};

export const calendarPreviewRequestSchema = {
  params: z.object({
    paperId: zObjectIdFor("paperId"),
  }),
  body: z
    .object({
      selectedCalendars: z.record(z.boolean()).optional(),
      dayRange: z.coerce.number().min(1).max(100).optional(),
      maxEvents: z.coerce.number().min(1).max(200).optional(),
    })
    .openapi({
      example: {
        selectedCalendars: { primary: true },
        dayRange: 7,
        maxEvents: 10,
      },
    }),
};
