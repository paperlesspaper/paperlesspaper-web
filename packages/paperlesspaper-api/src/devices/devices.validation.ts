import { zObjectIdFor } from "@internetderdinge/api";
import { z } from "zod";

export const getImageSchema = {
  params: z.object({
    deviceId: zObjectIdFor("deviceId").openapi({
      description: "Device ObjectId",
    }),
    uuid: z.string().openapi({ description: "Image UUID" }),
  }),
};

export const updateSingleImageMetaSchema = {
  params: z.object({
    deviceId: zObjectIdFor("deviceId").openapi({
      description: "Device ObjectId",
    }),
  }),
  body: z
    .object({
      meta: z.record(z.string(), z.any()).optional(),
      uuid: z.string().optional(),
    })
    .openapi({ description: "Image metadata updates" }),
};

export const uploadSingleImageSchema = {
  params: z.object({
    deviceId: zObjectIdFor("deviceId").openapi({
      description: "Device ObjectId",
    }),
  }),
  body: z
    .object({
      uuid: z
        .string()
        .optional()
        .openapi({ description: "Optional image UUID", example: "mock-uuid" }),
    })
    .openapi({
      description: "Multipart body is mocked during tests.",
      example: { uuid: "mock-uuid" },
    }),
};
