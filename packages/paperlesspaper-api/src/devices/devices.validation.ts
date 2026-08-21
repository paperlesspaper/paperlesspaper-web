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
      .regex(/^epd[a-z0-9]*-[a-z0-9][a-z0-9-]*$/, {
        message: "deviceId must be an epd device serial",
      })
      .max(128)
      .openapi({
        description: "Epaper device serial / DeviceId",
        example: process.env.SCHEMA_EXAMPLE_DEVICE_SERIAL || "epd-0000000000",
      }),
  }),
  query: z.object({
    dryRun: z.enum(["true", "false"]).default("true").openapi({
      description:
        "Defaults to true. Set to false only after obtaining a confirmationToken from a dry run.",
      example: "true",
    }),
    confirmationToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
      .openapi({
        description:
          "Confirmation token returned by the latest dry run. Required when dryRun=false.",
      }),
  }),
};
