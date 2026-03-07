import { z } from "zod";

export const adminSearchSchema = {
  query: z.object({
    search: z.string().min(2).max(120),
    limit: z.coerce.number().min(1).max(50).optional(),
  }),
};

export const adminStatsSchema = {
  query: z.object({}),
};

export const adminIotDevicesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(500).optional(),
    updatedSince: z.string().datetime().optional(),
  }),
};

export const adminDevicesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(500).optional(),
    updatedSince: z.string().datetime().optional(),
  }),
};
