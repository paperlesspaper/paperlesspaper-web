import httpStatus from "http-status";
import type { Request, Response } from "express";
import pick from "@internetderdinge/api/src/utils/pick";
import ApiError from "@internetderdinge/api/src/utils/ApiError";
import catchAsync from "@internetderdinge/api/src/utils/catchAsync";
import papersService from "./papers.service.js";
import devicesService from "@internetderdinge/api/src/devices/devices.service";
import iotDevicesService from "@internetderdinge/api/src/iotdevice/iotdevice.service";
import renderService from "../render/render.service";
import googleCalendarService from "./googleCalendar.service.js";
import { createToken } from "@internetderdinge/api/src/tokens/tokens.service";
import Token from "@internetderdinge/api/src/tokens/tokens.model";
import crypto from "crypto";
//import fs from 'fs';
//import path from 'path';

export const createEntry = catchAsync(async (req: Request, res: Response) => {
  const meta = req.body.meta || {};
  const { calendarAuth, calendarData } =
    await googleCalendarService.updateGoogleCalendarEvents({
      ...req.body,
      meta,
    });

  const paper = await papersService.createPaper({
    ...req.body,
    meta: {
      ...meta,
      calendarData,
      googleCalendar: { ...meta.googleCalendar, ...calendarAuth },
    },
  });

  res.status(httpStatus.CREATED).send(paper);
});

export const getEntries = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ["name", "role"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await papersService.queryPapers(filter, options);
  res.send(result);
});

export const queryPapersByDevice = catchAsync(
  async (req: Request, res: Response) => {
    const filter = pick(req.query, [
      "name",
      "role",
      "organization",
      "deviceId",
    ]);
    const options = pick(req.query, ["sortBy", "limit", "page"]);

    const result = await papersService.queryPapersByDevice(filter, {
      ...options,
      timestamps: true,
    });
    res.send(result);
  },
);

export const getEntry = catchAsync(async (req: Request, res: Response) => {
  const paper = await papersService.getById(req.params.paperId);
  if (!paper) {
    throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
  }
  res.send(paper);
});

export const getCalendarByEntry = catchAsync(
  async (req: Request, res: Response) => {
    const paper = await papersService.getById(req.params.paperId);
    let googleCalendar;
    if (paper.kind === "google-calendar") {
      googleCalendar = await googleCalendarService.getCalendarEvents(paper);
    }

    if (!paper) {
      throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
    }
    res.send(googleCalendar);
  },
);

// Lightweight endpoint for refreshing calendar data without mutating the paper document
export const getCalendarPreview = catchAsync(
  async (req: Request, res: Response) => {
    const { selectedCalendars, dayRange, maxEvents } = req.body || {};
    const paper = await papersService.getById(req.params.paperId);

    if (!paper) {
      throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
    }

    if (paper.kind !== "google-calendar") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Calendar preview is only available for Google Calendar papers",
      );
    }

    const plainPaper =
      typeof paper.toObject === "function" ? paper.toObject() : paper;

    const mergedMeta: Record<string, any> = {
      ...plainPaper.meta,
      selectedCalendars:
        selectedCalendars || plainPaper.meta?.selectedCalendars,
    };

    if (typeof dayRange !== "undefined") {
      mergedMeta.dayRange = dayRange;
    }

    if (typeof maxEvents !== "undefined") {
      mergedMeta.maxEvents = maxEvents;
    }

    const preview = await googleCalendarService.updateGoogleCalendarEvents({
      ...plainPaper,
      meta: mergedMeta,
    });

    res.send(preview);
  },
);

export const updateEntry = catchAsync(async (req: Request, res: Response) => {
  const meta = req.body.meta || {};
  const { calendarAuth, calendarData } =
    await googleCalendarService.updateGoogleCalendarEvents({
      ...req.body,
      meta,
    });

  const paper = await papersService.updateById(req.params.paperId, {
    ...req.body,
    meta: {
      ...meta,
      calendarData,
      googleCalendar: { ...meta.googleCalendar, ...calendarAuth },
    },
  });
  res.send(paper);
});

export const deleteEntry = catchAsync(async (req: Request, res: Response) => {
  const entry = await papersService.deleteById(req.params.paperId);
  res.send(entry);
});

export const uploadSingleImage = catchAsync(
  async (req: Request, res: Response) => {
    //  console.log('uploadSingleImage called', req.params);
    const paper = await papersService.getById(req.params.paperId);
    const device = await devicesService.getById(paper.deviceId);

    const shadowBody = {
      state: {
        reported: {
          lut: paper.meta?.lut || "default",
          clearScreen: true,
        },
      },
    };

    const shadowNew = await iotDevicesService.shadowAlarmUpdate(
      device.deviceId,
      shadowBody,
      "settings",
    );

    let iotUpload;
    let bufferEditable;
    if (paper.kind === "image" || paper.kind === "printer") {
      if (req.body.pictureEditable) {
        bufferEditable = Buffer.from(req.body.pictureEditable, "utf8");
      }

      const uploadedBuffer = req.files?.[0]?.buffer;
      if (!uploadedBuffer) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No image file uploaded");
      }

      const providedOriginalBuffer = req.files?.[1]?.buffer;

      let buffer = uploadedBuffer;
      let bufferOriginal = providedOriginalBuffer;

      // Backwards compatible: if the frontend only sends one file, treat it as the original,
      // then resize it to the device resolution and dither it server-side.
      if (!bufferOriginal) {
        const orientation = (paper.meta?.orientation ||
          device.meta?.orientation ||
          "portrait") as "portrait" | "landscape";

        const resized = await renderService.resizeImageToDeviceSize({
          buffer: uploadedBuffer,
          kind: device.kind,
          orientation,
        });

        bufferOriginal = resized.buffer;
        const dithered = await renderService.ditherImage({
          buffer: bufferOriginal,
          size: resized.size,
        });
        buffer = dithered.buffer;
      }

      iotUpload = await iotDevicesService.uploadSingleImage({
        buffer,
        bufferOriginal,
        bufferEditable,
        id: paper.id,
        deviceName: device.deviceId,
      });
      // Debug: save buffers to disk
      /* if (process.env.NODE_ENV === 'development') {
      const debugDir = path.join(process.cwd(), '../../debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, `${paper.id}_original.png`), req.files[1].buffer);
      fs.writeFileSync(path.join(debugDir, `${paper.id}_processed.png`), req.files[0].buffer);
      fs.writeFileSync(path.join(debugDir, `${paper.id}_editable.json`), bufferEditable);
    } */
    } else if (paper.kind === "slides") {
      const paperB = await papersService.getById(req.params.paperId);
      iotUpload = await papersService.updateNextSlide(paperB, device);
    } else {
      iotUpload = await papersService.uploadSingleImageFromWebsite({
        paperId: paper._id,
      });
    }

    // Update lastEdit on paper
    await papersService.updateById(paper._id, { imageUpdatedAt: new Date() });

    res.send(iotUpload);
  },
);

export const uploadSingleImageFromWebsite = catchAsync(
  async (req: Request, res: Response) => {
    const paper = await papersService.getById(req.params.paperId);
    const device = await devicesService.getById(paper.deviceId);

    const ditheredBuffer = await renderService.generateImageFromUrl({
      url: device.meta?.url,
      orientation: device.meta?.orientation,
      scroll: device.meta?.scroll,
      kind: device.kind,
    });

    const iotUpload = await iotDevicesService.uploadSingleImage({
      id: paper.id,
      buffer: ditheredBuffer,
      deviceId: req.params.deviceId,
    });

    res.send(iotUpload);
  },
);

export const createPluginRedirectToken = catchAsync(
  async (req: Request, res: Response) => {
    const paper = await papersService.getById(req.params.paperId);
    if (!paper) {
      throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
    }

    const owner = (req as any)?.user?.id || (req as any)?.user?._id;
    if (!owner) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const token = await createToken({
      name: "integrationRedirect",
      owner: String(owner),
      expiresAt,
      usedAt: null,
      meta: {
        paperId: String(req.params.paperId),
      },
    });

    res.send({
      tempToken: token.raw,
      expiresAt,
    });
  },
);

export const redeemPluginRedirectToken = catchAsync(
  async (req: Request, res: Response) => {
    const owner = (req as any)?.user?.id || (req as any)?.user?._id;
    if (!owner) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const tempToken = (req.body?.tempToken || req.body?.token) as
      | string
      | undefined;
    if (!tempToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Missing tempToken");
    }

    // The model stores only the SHA-256 hash (see tokens.service.ts)
    const hashed = crypto.createHash("sha256").update(tempToken).digest("hex");

    const tokenDoc = await Token.findOne({
      name: "integrationRedirect",
      owner: String(owner),
      value: hashed,
      "meta.paperId": String(req.params.paperId),
    });

    if (!tokenDoc) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
    }

    const now = new Date();
    if (tokenDoc.get("usedAt")) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Token already used");
    }
    const expiresAt = tokenDoc.get("expiresAt") as Date | undefined;
    if (expiresAt && now > expiresAt) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Token expired");
    }

    tokenDoc.set("usedAt", now);
    await tokenDoc.save();

    res.send({ ok: true });
  },
);

export const generateSignedFileUrl = catchAsync(
  async (req: Request, res: Response) => {
    const signedUrl = await papersService.generateSignedFileUrl(
      req.params.paperId,
      req.body.kind,
    );

    if (req.body.return === "json") {
      const jsonResult = await fetch(signedUrl);
      const jsonResultText = await jsonResult.json();
      res.send(jsonResultText);
    } else {
      res.send({ signedUrl });
    }
  },
);

export default {
  createEntry,
  getEntries,
  queryPapersByDevice,
  getEntry,
  updateEntry,
  deleteEntry,
  getCalendarByEntry,
  getCalendarPreview,
  generateSignedFileUrl,
  uploadSingleImage,
  uploadSingleImageFromWebsite,
  createPluginRedirectToken,
  redeemPluginRedirectToken,
};
