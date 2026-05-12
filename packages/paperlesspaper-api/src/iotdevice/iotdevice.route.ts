import { Router } from "express";
import {
  auth,
  buildRouterAndDocs,
  type RouteSpec,
} from "@internetderdinge/api";
import { z } from "zod";
import iotdeviceController from "./iotdevice.controller.js";

const eventsResponseSchema = z.object({
  message: z.array(z.record(z.string(), z.unknown())).optional(),
});

const shadowResponseSchema = z.record(z.string(), z.unknown());

const shadowAlarmUpdateResponseSchema = z.record(z.string(), z.unknown());

const getEventsSchema = {
  params: z.object({
    deviceId: z.string().openapi({ description: "Device serial number" }),
  }),
  query: z.object({
    DateStart: z.string().datetime({ offset: true }).optional().openapi({
      description: "Filter events from this date (ISO 8601)",
      example: "2025-05-01T00:00:00Z",
    }),
    DateEnd: z.string().datetime({ offset: true }).optional().openapi({
      description: "Filter events until this date (ISO 8601)",
      example: "2025-05-31T23:59:59Z",
    }),
    TypeFilter: z.string().optional().openapi({
      description: "Optional event type filter",
    }),
  }),
};

const getShadowSchema = {
  params: z.object({
    deviceId: z.string().openapi({ description: "Device serial number" }),
    shadowName: z.string().openapi({
      description: "Shadow name (e.g. settings, alarm)",
    }),
  }),
};

const shadowAlarmUpdateSchema = {
  params: z.object({
    deviceId: z.string().openapi({ description: "Device serial number" }),
  }),
  body: z.record(z.string(), z.unknown()).openapi({
    description: "Shadow state update payload",
  }),
};

export const iotdeviceRouteSpecs: RouteSpec[] = [
  {
    method: "get",
    path: "/events/:deviceId",
    validate: [auth("getUsers")],
    requestSchema: getEventsSchema,
    responseSchema: eventsResponseSchema,
    handler: iotdeviceController.getEvents,
    summary: "Get device events",
    description:
      "Retrieve historical events for an IoT device, optionally filtered by date range and event type.",
    docs: ["paperlesspaper"],
  },
  {
    method: "get",
    path: "/shadow/:deviceId/:shadowName",
    validate: [auth("getUsers")],
    requestSchema: getShadowSchema,
    responseSchema: shadowResponseSchema,
    handler: iotdeviceController.getShadow,
    summary: "Get device shadow",
    description: "Retrieve the named shadow state for an IoT device.",
    docs: ["paperlesspaper"],
  },
  {
    method: "post",
    path: "/device/shadowAlarmUpdate/:deviceId",
    validate: [auth("getUsers")],
    requestSchema: shadowAlarmUpdateSchema,
    responseSchema: shadowAlarmUpdateResponseSchema,
    handler: iotdeviceController.shadowAlarmUpdate,
    summary: "Update device shadow",
    description: "Update the shadow state for an IoT device.",
    docs: ["paperlesspaper"],
  },
];

const router: Router = Router();
buildRouterAndDocs(router, iotdeviceRouteSpecs, "/iotdevice", ["IoT Devices"]);

export default router;
