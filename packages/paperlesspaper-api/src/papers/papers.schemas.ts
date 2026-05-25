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

export const signedFileUrlResponseSchema = z
  .object({
    signedUrl: z.string().url(),
  })
  .openapi({
    example: {
      signedUrl:
        "https://memo-assets.s3.eu-central-1.amazonaws.com/ePaperImages/69f977fff91bf2491a793205.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA24WT4ARSBVFXUSWQ%2F20260521%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20260521T185051Z&X-Amz-Expires=7200&X-Amz-Signature=99857e1275276c15a15098a80f90001a3d84ca807fdd4d847ea89c873d9a3484&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
    },
  });

export const calendarPreviewResponseSchema = z.object({
  calendarAuth: z.record(z.any()).optional(),
  calendarData: z
    .object({
      calendars: z.array(z.any()),
      events: z.array(z.any()),
    })
    .optional(),
});
