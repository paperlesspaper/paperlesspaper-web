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

export const getDeviceUploadLogsSchema = {
  params: z.object({
    deviceId: zObjectIdFor("deviceId").openapi({
      description: "Device ObjectId",
    }),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({
      description: "Maximum number of upload attempts to return",
      example: 50,
    }),
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

export const deleteDeviceByDeviceIdSchema = {
  params: z.object({
    deviceId: z
      .string()
      .min(1)
      .openapi({
        description: "Device serial / DeviceId",
        example: process.env.SCHEMA_EXAMPLE_DEVICE_SERIAL || "epd-0000000000",
      }),
  }),
};
