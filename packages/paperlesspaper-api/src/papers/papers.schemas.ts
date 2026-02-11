import { z } from "zod";
import { zPagination, zPaginationResponse } from "@internetderdinge/api";

export const paperResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  author: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  imageUpdatedAt: z.string().optional(),
});

export const queryPapersByDeviceResponseSchema = zPaginationResponse();

export const calendarPreviewResponseSchema = z.object({
  calendarAuth: z.record(z.any()).optional(),
  calendarData: z
    .object({
      calendars: z.array(z.any()),
      events: z.array(z.any()),
    })
    .optional(),
});
