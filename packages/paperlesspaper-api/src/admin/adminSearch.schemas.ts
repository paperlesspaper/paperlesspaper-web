import { z } from "zod";

const organizationSearchEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  kind: z.string().optional(),
});

const userSearchEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  organization: organizationSearchEntrySchema.optional(),
});

const deviceSearchEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  deviceId: z.string().optional(),
  kind: z.string().optional(),
  timezone: z.string().optional(),
  eventDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  serialNumber: z.string().optional(),
  paymentId: z.string().optional(),
  batteryStatus: z.string().optional(),
  batteryLevel: z.number().optional(),
  signalStrength: z.number().optional(),
  lastReachableAgo: z.string().optional(),
  organization: organizationSearchEntrySchema.optional(),
  patient: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
});

export const adminSearchResponseSchema = z.object({
  query: z.string(),
  organizations: z.array(organizationSearchEntrySchema),
  users: z.array(userSearchEntrySchema),
  devices: z.array(deviceSearchEntrySchema),
  total: z.number(),
  tookMs: z.number(),
});

export const adminStatsResponseSchema = z.object({
  users: z.number(),
  auth0Users: z.number(),
  devices: z.number(),
  organizations: z.number(),
  total: z.number(),
  tookMs: z.number(),
});

export const adminIotDevicesResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
  total: z.number(),
  tookMs: z.number(),
});

export const adminDevicesResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
  total: z.number(),
  tookMs: z.number(),
});
