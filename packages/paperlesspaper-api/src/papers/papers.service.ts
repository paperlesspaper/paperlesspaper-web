import httpStatus from "http-status";
import Paper from "./papers.model";
import {
  ApiError,
  devicesService,
  getSignedFileUrl,
  resolvePossiblyRelativeUrl,
} from "@internetderdinge/api";
import {
  S3Client,
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import renderService from "../render/render.service";
import { applications, applicationsByKind } from "@paperlesspaper/helpers";
import googleCalendar from "./googleCalendar.service";
import qs from "qs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rrule from "rrule";

import type { ObjectId } from "mongoose";
import type { QueryResult } from "./types"; // Assuming QueryResult is defined in a types file
import iotdeviceService, {
  ORIGINAL_IMAGE_JPEG_KIND,
  ORIGINAL_IMAGE_PNG_KIND,
  THUMBNAIL_IMAGE_JPEG_KIND,
} from "../iotdevice/iotdevice.service";
import { aitjcizeSpectra6Palette } from "epdoptimize";

const { rrulestr } = rrule;

type WebsiteImageUploadResult = {
  similarityPercentage: number | null;
  uploadSingleImageResult: unknown;
  skippedUpload?: boolean;
};

const CURRENT_FRAME_PENDING_META_KEY = "currentFrameImageSyncPending";

const mergeUrlWithQueryParams = (
  baseUrl?: string | null,
  params?: Record<string, unknown>,
) => {
  if (!baseUrl) return null;

  const [urlWithoutHash, hash = ""] = baseUrl.split("#", 2);
  const [pathname, existingQuery = ""] = urlWithoutHash.split("?", 2);

  const mergedQuery = qs.stringify(
    {
      ...qs.parse(existingQuery, { ignoreQueryPrefix: true }),
      ...(params || {}),
    },
    { addQueryPrefix: true },
  );

  return `${pathname}${mergedQuery}${hash ? `#${hash}` : ""}`;
};

const syncDevicePaperRelation = async ({
  deviceId,
  paperId,
}: {
  deviceId?: string | ObjectId;
  paperId: ObjectId;
}): Promise<void> => {
  const deviceIdString = deviceId?.toString();
  if (!deviceIdString) return;

  const device = await devicesService.getById(deviceIdString);
  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
  }

  const currentPaperId = device.paper ? device.paper.toString() : undefined;
  if (currentPaperId !== paperId.toString()) {
    const deviceStatus = await devicesService.populateDeviceStatus(device);
    await snapshotCurrentFrameImageIfSynced({
      device,
      paperId: currentPaperId,
      deviceStatus,
    });
    device.paper = paperId as any;
    markCurrentFrameImageSyncPendingOnDevice({
      device,
      paperId,
      deviceStatus,
    });
    await device.save();
  }
};

const extractSelectedPaperIds = (
  meta: Record<string, any> | undefined,
): string[] => {
  if (
    !meta ||
    typeof meta !== "object" ||
    !meta.selectedPapers ||
    typeof meta.selectedPapers !== "object"
  ) {
    return [];
  }

  return Object.entries(meta.selectedPapers)
    .filter(([, isSelected]) => Boolean(isSelected))
    .map(([paperId]) => paperId);
};

const sanitizeSelectedPapers = async ({
  meta,
  organizationId,
  deviceId,
}: {
  meta?: Record<string, any>;
  organizationId?: string | ObjectId;
  deviceId?: string | ObjectId;
}): Promise<Record<string, any> | undefined> => {
  if (!meta || typeof meta !== "object") {
    return meta;
  }

  const selectedPaperIds = extractSelectedPaperIds(meta);
  if (!selectedPaperIds.length) {
    return meta;
  }

  const selectedPapers = await Paper.find({ _id: { $in: selectedPaperIds } })
    .select("_id organization deviceId")
    .lean();

  const organizationIdString = organizationId?.toString();
  const deviceIdString = deviceId?.toString();

  const allowedIds = new Set(
    selectedPapers
      .filter((selectedPaper: any) => {
        const sameOrganization =
          organizationIdString &&
          selectedPaper.organization?.toString() === organizationIdString;
        const sameDevice =
          deviceIdString &&
          selectedPaper.deviceId?.toString() === deviceIdString;
        return sameOrganization || sameDevice;
      })
      .map((paper: any) => paper._id.toString()),
  );

  const sanitizedSelected = Object.fromEntries(
    Object.entries(meta.selectedPapers || {}).filter(
      ([id, isSelected]) => Boolean(isSelected) && allowedIds.has(id),
    ),
  );

  return { ...meta, selectedPapers: sanitizedSelected };
};

const resolveDefaultPrinterImagePath = (): string => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    // Source execution (common in this repo: node runs .ts files directly)
    path.join(__dirname, "paperlessprinter.png"),
    // If process cwd is packages/api
    path.resolve(process.cwd(), "paperlesspaper/papers/paperlessprinter.png"),
    // If compiled output is used
    path.resolve(
      process.cwd(),
      "dist/paperlesspaper/papers/paperlessprinter.png",
    ),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Default printer image not found. Looked in: ${candidates.join(", ")}`,
    );
  }

  return found;
};

const uploadDefaultPrinterImageIfNeeded = async (paper: any): Promise<void> => {
  if (!paper || paper.kind !== "printer") return;
  if (!paper.deviceId) return;

  const device = await devicesService.getById(paper.deviceId.toString());
  if (!device) return;

  const defaultImagePath = resolveDefaultPrinterImagePath();
  const uploadedBuffer = fs.readFileSync(defaultImagePath);

  const orientation = (paper.meta?.orientation ||
    device.meta?.orientation ||
    "portrait") as "portrait" | "landscape";

  const resized = await renderService.resizeImageToDeviceSize({
    buffer: uploadedBuffer,
    kind: device.kind,
    orientation,
  });

  const dithered = await renderService.ditherImage({
    buffer: resized.buffer,
    size: resized.size,
  });

  await snapshotCurrentFrameImageIfSynced({
    device,
    paperId: paper.id,
  });

  const uploadResult = await iotdeviceService.uploadSingleImage({
    buffer: dithered.buffer,
    bufferOriginal: resized.buffer,
    id: paper.id,
    deviceName: device.deviceId,
    deviceId: device._id?.toString?.() || device.id?.toString?.(),
    trigger: "default-printer-image",
    triggerMetadata: { paperKind: paper.kind },
  });
  if (uploadResult?.skippedUpload !== true) {
    await markCurrentFrameImageSyncPending({
      device,
      paperId: paper.id,
    });
  }

  paper.imageUpdatedAt = new Date();
  await paper.save();
};

/**
 * Create a paper
 * @param {Object} body
 * @returns {Promise<Paper>}
 */
const createPaper = async (body: Record<string, any>): Promise<Paper> => {
  // Always derive organization from device to prevent cross-org inconsistencies.
  if (body.deviceId) {
    const device = await devicesService.getById(body.deviceId);
    if (device && device.organization) {
      body.organization = device.organization;
    }
  }

  const sanitizedMeta = await sanitizeSelectedPapers({
    meta: body.meta,
    organizationId: body.organization,
    deviceId: body.deviceId,
  });

  const result = await Paper.create({ ...body, meta: sanitizedMeta });
  await syncDevicePaperRelation({
    deviceId: result.deviceId,
    paperId: result._id,
  });

  // For printer papers, ensure there's an initial image present.
  try {
    await uploadDefaultPrinterImageIfNeeded(result);
  } catch (error) {
    console.error("Failed to upload default printer image:", error);
  }

  return result;
};

/**
 * Query for papers
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryPapersByDevice = async (
  filter: Record<string, any>,
  options: Record<string, any>,
): Promise<QueryResult> => {
  const results = await Paper.paginate(filter, options);
  // Double check to ensure results only contain papers from the specified device or the organization
  if (filter.deviceId) {
    results.results = results.results.filter(
      (paper) => paper.deviceId.toString() === filter.deviceId,
    );
  } else if (filter.organization) {
    results.results = results.results.filter((paper) => {
      return paper.organization?.toString() === filter.organization;
    });
  }
  if (!filter.deviceId && !filter.organization) {
    results.results = [];
  }
  return results;
};

/**
 * Get paper by id
 * @param {ObjectId} id
 * @returns {Promise<Paper>}
 */
const getById = async (id: ObjectId): Promise<Paper | null> => {
  return Paper.findById(id);
};

const getByIds = async (ids: Array<string | ObjectId>): Promise<Paper[]> => {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => id?.toString()).filter(Boolean)),
  );

  if (!uniqueIds.length) {
    return [];
  }

  return Paper.find({ _id: { $in: uniqueIds } });
};

/**
 * Get paper by email
 * @param {string} email
 * @returns {Promise<Paper>}
 */
const getPaperByEmail = async (email: string): Promise<Paper | null> => {
  return Paper.findOne({ email });
};

/**
 * Update paper by id
 * @param {ObjectId} paperId
 * @param {Object} updateBody
 * @returns {Promise<Paper>}
 */
const updateById = async (
  paperId: ObjectId,
  updateBody: Record<string, any>,
): Promise<Paper> => {
  const paper = await getById(paperId);
  // Remove client-controlled organization; organization is derived from device.
  delete updateBody.organization;

  if (!paper) {
    throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
  }

  const targetDeviceId = updateBody.deviceId ?? paper.deviceId;

  // Keep organization consistent with the target device.
  if (targetDeviceId) {
    const targetDevice = await devicesService.getById(
      targetDeviceId.toString(),
    );
    if (!targetDevice) {
      throw new ApiError(httpStatus.NOT_FOUND, "Device not found");
    }
    if (targetDevice.organization) {
      updateBody.organization = targetDevice.organization;
    }
  }

  const targetMeta = await sanitizeSelectedPapers({
    meta: updateBody.meta ?? paper.meta,
    organizationId: updateBody.organization ?? paper.organization,
    deviceId: targetDeviceId,
  });

  updateBody.meta = targetMeta;

  updateBody.updatedAt = Date.now();
  Object.assign(paper, updateBody);
  await paper.save();
  await syncDevicePaperRelation({
    deviceId: paper.deviceId,
    paperId: paper._id,
  });
  return paper;
};

/**
 * Delete paper by id
 * @param {ObjectId} userId
 * @returns {Promise<Paper>}
 */
const deleteById = async (userId: ObjectId): Promise<Paper> => {
  const user = await getById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "Paper not found");
  }
  await user.deleteOne();
  return user;
};

const uploadSingleImageFromWebsite = async ({
  paperId,
  parentPaperId,
  device,
  forceUpload = false,
  trigger = "website-render",
}: {
  paperId: string;
  parentPaperId?: string;
  device?: any;
  forceUpload?: boolean;
  trigger?: string;
}): Promise<WebsiteImageUploadResult> => {
  const currentPaperId = parentPaperId || paperId;
  if (currentPaperId == "696eafb78a9e139345ed8adc")
    console.log(
      "uploadSingleImageFromWebsite",
      paperId,
      currentPaperId,
      parentPaperId,
      device?.deviceId,
    );
  const paper = await getById(paperId);
  // TODO: use device device settings instead
  const deviceFromPaper = await devicesService.getById(paper.deviceId);

  if (currentPaperId == "696eafb78a9e139345ed8adc")
    console.log("Paper kind:", paper, deviceFromPaper);
  device = device || deviceFromPaper;

  if (paper.kind === "plugin") {
    const renderPage =
      paper.meta?.pluginRenderPage || paper.meta?.pluginManifest?.renderPage;
    if (!renderPage) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Plugin paper is missing a render page.",
      );
    }
    const pluginConfigUrl =
      paper.meta?.pluginConfigUrl ||
      paper.meta?.pluginManifest?.configUrl ||
      paper.meta?.pluginManifest?.url ||
      paper.meta?.url;

    const renderPageResolved = resolvePossiblyRelativeUrl(
      renderPage,
      pluginConfigUrl,
    );
    const renderUrl = mergeUrlWithQueryParams(
      renderPageResolved,
      paper.meta?.pluginSettings || {},
    );
    const calendarData = googleCalendar.paperRequiresGoogleCalendar(paper)
      ? await googleCalendar.getCalendarEvents(paper)
      : undefined;

    const payload = {
      calendarData,
      settings: paper.meta?.pluginSettings || {},
      nativeSettings: {
        orientation: paper.meta?.orientation,
        quality: paper.meta?.quality,
        lut: paper.meta?.lut,
      },
      paper: {
        id: paper._id?.toString?.() || paper.id,
        kind: paper.kind,
        organization: paper.organization?.toString?.() || paper.organization,
      },
      device: {
        kind: device?.kind,
        deviceId: device?.deviceId,
      },
    };

    let originalBuffer: Buffer | null = null;
    let size: {
      width: number;
      height: number;
      name?: string;
      frameKind?: string;
    } | null = null;
    try {
      const renderResult = await renderService.generateImageFromUrl({
        url: renderUrl || renderPageResolved,
        orientation: paper.meta?.orientation,
        scroll: paper.meta?.scroll,
        css: paper.meta?.css,
        paper: paper,
        data: payload,
        kind: device?.kind,
      });
      originalBuffer = renderResult.buffer;
      size = renderResult.size;
    } catch (error) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        `Could not render plugin paper image: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!originalBuffer || !size) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        "Could not render plugin paper image.",
      );
    }

    const { buffer: ditheredBuffer } = await renderService.ditherImage({
      buffer: originalBuffer,
      palette: aitjcizeSpectra6Palette,
      size,
    });

    // Paper-level similarity is intentionally disabled. uploadSingleImage
    // compares the final dithered frame against the device-specific S3 image.
    // const similarityResult = forceUpload
    //   ? { skipUpload: false, similarityPercentage: null }
    //   : await iotdeviceService.evaluateSimilarityBeforeUpload(
    //       currentPaperId,
    //       originalBuffer,
    //     );
    let uploadSingleImageResult = null;
    await snapshotCurrentFrameImageIfSynced({
      device,
      paperId: currentPaperId,
    });

    uploadSingleImageResult = await iotdeviceService.uploadSingleImage({
      buffer: ditheredBuffer,
      bufferOriginal: originalBuffer,
      id: currentPaperId,
      deviceName: device.deviceId,
      deviceId: device._id?.toString?.() || device.id?.toString?.(),
      forceUpload,
      trigger,
      triggerMetadata: {
        paperKind: paper.kind,
        sourcePaperId: paperId.toString(),
        parentPaperId: parentPaperId?.toString(),
      },
    });

    if (!uploadSingleImageResult) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        "Could not upload plugin paper image.",
      );
    }
    if (!uploadSingleImageResult.skippedUpload) {
      await markCurrentFrameImageSyncPending({
        device,
        paperId: currentPaperId,
      });
    }

    const similarityPercentage = forceUpload
      ? null
      : (uploadSingleImageResult?.similarityPercentage ?? 0);

    return {
      similarityPercentage,
      uploadSingleImageResult,
      skippedUpload: Boolean(uploadSingleImageResult?.skippedUpload),
    };
  }

  const applicationSettings = applicationsByKind(paper.kind);

  let data = {};

  if (paper.kind === "google-calendar") {
    const calendarEvents = await googleCalendar.getCalendarEvents(paper);
    data = calendarEvents.events;
  }

  const keysToKeep = applicationSettings.settings
    ? Object.keys(applicationSettings.settings)
    : [];
  const selectedMeta = Object.fromEntries(
    Object.entries(paper.meta).filter(([key]) => keysToKeep.includes(key)),
  );

  let originalBuffer: Buffer | null = null;
  let size: {
    width: number;
    height: number;
    name?: string;
    frameKind?: string;
  } | null = null;
  try {
    if (currentPaperId == "696eafb78a9e139345ed8adc")
      console.log(
        "Rendering page for paper:",
        paperId,
        "with meta:",
        selectedMeta,
      );
    const renderUrl =
      mergeUrlWithQueryParams(
        paper.meta?.url || applicationSettings.url,
        selectedMeta,
      ) ||
      paper.meta?.url ||
      applicationSettings.url;

    const renderResult = await renderService.generateImageFromUrl({
      url: renderUrl,
      orientation: paper.meta?.orientation,
      scroll: paper.meta?.scroll,
      css: paper.meta?.css,
      data: data,
      paper: paper,
      kind: device?.kind,
    });
    originalBuffer = renderResult.buffer;
    size = renderResult.size;
  } catch (error) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `Could not render paper image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!originalBuffer || !size) {
    throw new ApiError(httpStatus.BAD_GATEWAY, "Could not render paper image.");
  }

  // console.log('uploadSingleImageFromWebsite', paper, paperId, parentPaperId, currentPaperId);

  const { buffer: ditheredBuffer } = await renderService.ditherImage({
    buffer: originalBuffer,
    palette: aitjcizeSpectra6Palette,
    size,
  });

  // Paper-level similarity is intentionally disabled. uploadSingleImage
  // compares the final dithered frame against the device-specific S3 image.
  // const similarityResult = forceUpload
  //   ? { skipUpload: false, similarityPercentage: null }
  //   : await iotdeviceService.evaluateSimilarityBeforeUpload(
  //       currentPaperId,
  //       originalBuffer,
  //     );
  let uploadSingleImageResult = null;
  await snapshotCurrentFrameImageIfSynced({
    device,
    paperId: currentPaperId,
  });

  uploadSingleImageResult = await iotdeviceService.uploadSingleImage({
    buffer: ditheredBuffer,
    bufferOriginal: originalBuffer,
    id: currentPaperId,
    deviceName: device.deviceId,
    deviceId: device._id?.toString?.() || device.id?.toString?.(),
    forceUpload,
    trigger,
    triggerMetadata: {
      paperKind: paper.kind,
      sourcePaperId: paperId.toString(),
      parentPaperId: parentPaperId?.toString(),
    },
  });

  if (!uploadSingleImageResult) {
    throw new ApiError(httpStatus.BAD_GATEWAY, "Could not upload paper image.");
  }
  if (!uploadSingleImageResult.skippedUpload) {
    await markCurrentFrameImageSyncPending({
      device,
      paperId: currentPaperId,
    });
  }

  const similarityPercentage = forceUpload
    ? null
    : (uploadSingleImageResult?.similarityPercentage ?? 0);
  if (currentPaperId == "696eafb78a9e139345ed8adc")
    console.log("similarityPercentage", similarityPercentage);

  return {
    similarityPercentage,
    uploadSingleImageResult,
    skippedUpload: Boolean(uploadSingleImageResult?.skippedUpload),
  };
};

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const isMissingS3ObjectError = (error: any): boolean => {
  return (
    error?.name === "NoSuchKey" ||
    error?.name === "NotFound" ||
    error?.Code === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404
  );
};

const objectExists = async (key: string): Promise<boolean> => {
  const headCommand = new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  try {
    await s3.send(headCommand);
    return true;
  } catch (error) {
    if (isMissingS3ObjectError(error)) {
      return false;
    }

    throw error;
  }
};

const getSignedFileKindCandidates = (kind: string): string[] => {
  if (kind === ORIGINAL_IMAGE_PNG_KIND) {
    return [ORIGINAL_IMAGE_PNG_KIND, ORIGINAL_IMAGE_JPEG_KIND];
  }

  if (kind === ORIGINAL_IMAGE_JPEG_KIND) {
    return [ORIGINAL_IMAGE_JPEG_KIND, ORIGINAL_IMAGE_PNG_KIND];
  }

  if (kind === THUMBNAIL_IMAGE_JPEG_KIND) {
    return [
      THUMBNAIL_IMAGE_JPEG_KIND,
      ORIGINAL_IMAGE_JPEG_KIND,
      ORIGINAL_IMAGE_PNG_KIND,
    ];
  }

  return [kind];
};

const resolveSignedFileKind = async (
  id: string,
  kind: string,
): Promise<string> => {
  const candidates = getSignedFileKindCandidates(kind);
  if (candidates.length === 1) return kind;

  for (const candidate of candidates) {
    if (await objectExists(`ePaperImages/${id}${candidate}`)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
};

const generateSignedFileUrl = async (
  id: string,
  kind = ".png",
): Promise<string> => {
  const resolvedKind = await resolveSignedFileKind(id, kind);
  const fileName = `ePaperImages/${id}${resolvedKind}`;
  const url = await getSignedFileUrl({ fileName });
  return url;
};

const copyObject = async (
  sourceKey: string,
  destinationKey: string,
): Promise<string> => {
  const copyCommand = new CopyObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    CopySource: `${process.env.AWS_S3_BUCKET_NAME}/${sourceKey}`,
    Key: destinationKey,
  });

  try {
    await s3.send(copyCommand);
    // console.log(`File copied from ${sourceKey} to ${destinationKey}`);
  } catch (error) {
    if (!isMissingS3ObjectError(error)) {
      console.error("Error copying file:", error);
    }
    throw error;
  }

  return destinationKey;
};

const copyObjectIfExists = async (
  sourceKey: string,
  destinationKey: string,
): Promise<boolean> => {
  try {
    await copyObject(sourceKey, destinationKey);
    return true;
  } catch (error) {
    if (isMissingS3ObjectError(error)) {
      console.warn("Current frame snapshot source image is missing", {
        sourceKey,
        destinationKey,
      });
      return false;
    }

    throw error;
  }
};

const copyFirstObjectIfExists = async (
  candidates: Array<{ sourceKey: string; destinationKey: string }>,
): Promise<boolean> => {
  for (const candidate of candidates) {
    try {
      await copyObject(candidate.sourceKey, candidate.destinationKey);
      return true;
    } catch (error) {
      if (isMissingS3ObjectError(error)) {
        continue;
      }

      throw error;
    }
  }

  return false;
};

const getTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const timestamp =
    typeof value === "number" ? value : new Date(value as string).getTime();

  if (!Number.isFinite(timestamp)) return null;

  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

const getNextDeviceSyncTimestamp = (deviceStatus?: any): number | null => {
  return getTimestamp(deviceStatus?.nextDeviceSync);
};

const markCurrentFrameImageSyncPendingOnDevice = ({
  device,
  paperId,
  deviceStatus,
}: {
  device?: any;
  paperId?: string | ObjectId | null;
  deviceStatus?: any;
}): boolean => {
  const paperIdString = paperId?.toString?.();
  if (!device || !paperIdString) return false;

  const nextDeviceSyncTimestamp = getNextDeviceSyncTimestamp(deviceStatus);
  const nextDeviceSync =
    nextDeviceSyncTimestamp && nextDeviceSyncTimestamp > Date.now()
      ? new Date(nextDeviceSyncTimestamp).toISOString()
      : null;

  device.meta = {
    ...(device.meta || {}),
    [CURRENT_FRAME_PENDING_META_KEY]: {
      paperId: paperIdString,
      queuedAt: new Date().toISOString(),
      nextDeviceSync,
    },
  };
  device.markModified?.("meta");

  return true;
};

const markCurrentFrameImageSyncPending = async ({
  device,
  paperId,
}: {
  device?: any;
  paperId?: string | ObjectId | null;
}): Promise<boolean> => {
  const paperIdString = paperId?.toString?.();
  const devicePaperId = device?.paper?.toString?.();
  if (!device || !paperIdString || devicePaperId !== paperIdString) {
    return false;
  }

  const deviceStatus = await devicesService.populateDeviceStatus(device);
  markCurrentFrameImageSyncPendingOnDevice({
    device,
    paperId: paperIdString,
    deviceStatus,
  });
  await device.save();

  return true;
};

const snapshotCurrentFrameImageIfSynced = async ({
  device,
  paperId,
  deviceStatus,
}: {
  device?: any;
  paperId?: string | ObjectId | null;
  deviceStatus?: any;
}): Promise<boolean> => {
  const deviceId = device?._id?.toString?.() || device?.id?.toString?.();
  const paperIdString = paperId?.toString?.();

  if (!deviceId || !paperIdString) return false;

  try {
    const resolvedDeviceStatus =
      deviceStatus ?? (await devicesService.populateDeviceStatus(device));

    if (resolvedDeviceStatus?.pictureSynced !== true) return false;

    const sourceBaseKey = `ePaperImages/${paperIdString}`;
    const destinationBaseKey = `ePaperImages/${deviceId}+current-frame`;

    const copiedDeviceImage = await copyObjectIfExists(
      `${sourceBaseKey}.png`,
      `${destinationBaseKey}.png`,
    );
    const copiedOriginalJpeg = await copyObjectIfExists(
      `${sourceBaseKey}${ORIGINAL_IMAGE_JPEG_KIND}`,
      `${destinationBaseKey}-${ORIGINAL_IMAGE_JPEG_KIND}`,
    );
    const copiedOriginalPng = await copyObjectIfExists(
      `${sourceBaseKey}${ORIGINAL_IMAGE_PNG_KIND}`,
      `${destinationBaseKey}-${ORIGINAL_IMAGE_PNG_KIND}`,
    );

    await copyFirstObjectIfExists([
      {
        sourceKey: `${sourceBaseKey}${THUMBNAIL_IMAGE_JPEG_KIND}`,
        destinationKey: `${destinationBaseKey}-${THUMBNAIL_IMAGE_JPEG_KIND}`,
      },
      {
        sourceKey: `${sourceBaseKey}${ORIGINAL_IMAGE_JPEG_KIND}`,
        destinationKey: `${destinationBaseKey}-${ORIGINAL_IMAGE_JPEG_KIND}`,
      },
      {
        sourceKey: `${sourceBaseKey}${ORIGINAL_IMAGE_PNG_KIND}`,
        destinationKey: `${destinationBaseKey}-${ORIGINAL_IMAGE_PNG_KIND}`,
      },
    ]);

    return copiedDeviceImage || copiedOriginalJpeg || copiedOriginalPng;
  } catch (error) {
    console.warn("Failed to snapshot current frame image", {
      deviceId,
      paperId: paperIdString,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const streamToBuffer = async (
  stream: NodeJS.ReadableStream,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const getObjectBuffer = async (key: string): Promise<Buffer> => {
  const getCommand = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  try {
    const response = await s3.send(getCommand);
    return await streamToBuffer(response.Body as NodeJS.ReadableStream);
  } catch (error) {
    console.error("Error getting object from S3:", error);
    throw error;
  }
};

const getObjectBufferIfExists = async (key: string): Promise<Buffer | null> => {
  const getCommand = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  try {
    const response = await s3.send(getCommand);
    return await streamToBuffer(response.Body as NodeJS.ReadableStream);
  } catch (error) {
    if (isMissingS3ObjectError(error)) {
      return null;
    }

    console.error("Error getting object from S3:", error);
    throw error;
  }
};

const getObjectBufferWithFallback = async (keys: string[]): Promise<Buffer> => {
  for (const key of keys) {
    const buffer = await getObjectBufferIfExists(key);
    if (buffer) return buffer;
  }

  throw new Error(`No S3 object found for any key: ${keys.join(", ")}`);
};

type PlaylistEntry = {
  id?: string;
  paperId?: string;
  startsAt?: string;
  durationMinutes?: number;
  rrule?: string;
};

type ActivePlaylistEntry = {
  entry: PlaylistEntry;
  occurrence: Date;
  index: number;
};

const getPlaylistOccurrence = (
  entry: PlaylistEntry,
  now: Date,
): Date | null => {
  const startsAt = entry.startsAt ? new Date(entry.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return null;

  if (entry.rrule) {
    try {
      const rule = rrulestr(entry.rrule);
      return rule.before(now, true);
    } catch (error) {
      console.warn("Invalid playlist rrule", {
        rrule: entry.rrule,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }

  return startsAt.getTime() <= now.getTime() ? startsAt : null;
};

const getActivePlaylistEntries = (
  entries: PlaylistEntry[],
  now = new Date(),
): ActivePlaylistEntry[] => {
  return entries
    .map((entry, index) => ({
      entry,
      index,
      occurrence: getPlaylistOccurrence(entry, now),
    }))
    .filter((candidate): candidate is ActivePlaylistEntry =>
      Boolean(candidate.entry.paperId && candidate.occurrence),
    )
    .sort((a, b) => {
      const timeDifference = b.occurrence.getTime() - a.occurrence.getTime();
      return timeDifference || b.index - a.index;
    });
};

const uploadSingleImageFromAny = async (
  paper: any,
  parentPaper: any,
  device: any,
  trigger = "paper-selection",
): Promise<unknown> => {
  // console.log('uploadSingleImageFromAny', paper._id, parentPaper._id, device.deviceId);
  if (paper.kind === "image") {
    const sourceBaseKey = "ePaperImages/" + paper._id;
    const sourceKey = `${sourceBaseKey}.png`;

    const bufferOriginal = await getObjectBufferWithFallback([
      `${sourceBaseKey}${ORIGINAL_IMAGE_JPEG_KIND}`,
      `${sourceBaseKey}${ORIGINAL_IMAGE_PNG_KIND}`,
    ]);
    const buffer = await getObjectBuffer(sourceKey);

    // console.log('Uploading image from paper', paper._id, 'to parent paper', parentPaper._id);

    await snapshotCurrentFrameImageIfSynced({
      device,
      paperId: parentPaper._id,
    });

    const uploadSingleImageResult = await iotdeviceService.uploadSingleImage({
      buffer: buffer,
      bufferOriginal: bufferOriginal,
      id: parentPaper._id,
      deviceName: device.deviceId,
      deviceId: device._id?.toString?.() || device.id?.toString?.(),
      trigger,
      triggerMetadata: {
        paperKind: paper.kind,
        sourcePaperId: paper._id?.toString(),
        parentPaperId: parentPaper._id?.toString(),
      },
    });

    if (uploadSingleImageResult?.skippedUpload !== true) {
      await markCurrentFrameImageSyncPending({
        device,
        paperId: parentPaper._id,
      });
    }

    return uploadSingleImageResult;
  } else {
    return uploadSingleImageFromWebsite({
      paperId: paper._id,
      parentPaperId: parentPaper._id,
      device,
      trigger,
    });
  }
};

const updatePlaylist = async (
  paper: any,
  device: any,
  trigger = "playlist",
): Promise<any> => {
  const organizationId =
    paper?.organization?.toString?.() || paper?.organization;
  if (!organizationId) {
    return { message: "Paper is missing organization, cannot update playlist" };
  }

  const entries = Array.isArray(paper?.meta?.playlistEntries)
    ? paper.meta.playlistEntries
    : [];

  if (!entries.length) {
    return { message: "Playlist has no entries" };
  }

  const activeEntries = getActivePlaylistEntries(entries);
  if (!activeEntries.length) {
    return { message: "Playlist has no active entry" };
  }

  for (const activeEntry of activeEntries) {
    const selectedPaper = await getById(activeEntry.entry.paperId as any);
    const selectedOrganizationId =
      selectedPaper?.organization?.toString?.() || selectedPaper?.organization;

    if (!selectedPaper || selectedOrganizationId !== organizationId) {
      continue;
    }

    if (selectedPaper.kind === "playlist") {
      continue;
    }

    const uploadResult = await uploadSingleImageFromAny(
      selectedPaper,
      paper,
      device,
      trigger,
    );

    return {
      selectedPaperId: selectedPaper._id?.toString(),
      occurrence: activeEntry.occurrence.toISOString(),
      uploadSingleImageFromAny: uploadResult,
    };
  }

  return { message: "Playlist has no valid active paper" };
};

const updateNextSlide = async (
  paper: any,
  device: any,
  trigger = "slideshow",
): Promise<void> => {
  var result = {};
  const organizationId =
    paper?.organization?.toString?.() || paper?.organization;
  if (!organizationId) {
    result.message = "Paper is missing organization, cannot update next slide";
    // console.log('updateNextSlide skipped: missing organization', paper?._id);
    return result;
  }

  const selectedPapers = paper?.meta?.selectedPapers;
  if (!selectedPapers || typeof selectedPapers !== "object") {
    result.message =
      "Paper is missing selectedPapers in meta, cannot update next slide";
    // console.log('updateNextSlide skipped: missing selectedPapers', paper?._id);
    return result;
  }

  const allPapersFromDevice = await queryPapersByDevice(
    { organization: organizationId },
    { limit: -1 },
  );

  // console.log(paper.organization, allPapersFromDevice);
  const selectedPapersArray = Object.entries(selectedPapers)
    .map(([key, value]) => ({ key, value }))
    .filter((paper) => paper.value === true);

  const selectedPapersArrayOnlyExisting = selectedPapersArray.filter((paper) =>
    allPapersFromDevice.results.find((p) => p._id == paper.key),
  );

  // console.log('selectedPapersArrayOnlyExisting', selectedPapersArrayOnlyExisting);

  if (!selectedPapersArrayOnlyExisting.length) {
    // console.log('updateNextSlide skipped: no matching selected papers', paper?._id);
    return;
  }

  let selectedSlide;
  if (paper.meta.order === "random") {
    const selectedSlidesCount = selectedPapersArrayOnlyExisting.length;
    const lastSelectedSlide =
      Number.isInteger(paper.meta.currentSlide) &&
      paper.meta.currentSlide >= 0 &&
      paper.meta.currentSlide < selectedSlidesCount
        ? paper.meta.currentSlide
        : null;
    const randomCandidates =
      selectedSlidesCount > 1 && lastSelectedSlide !== null
        ? selectedPapersArrayOnlyExisting.filter(
            (_slide, index) => index !== lastSelectedSlide,
          )
        : selectedPapersArrayOnlyExisting;

    selectedSlide =
      randomCandidates[Math.floor(Math.random() * randomCandidates.length)];
    paper.meta.currentSlide = selectedPapersArrayOnlyExisting.findIndex(
      (slide) => slide.key === selectedSlide?.key,
    );
    result.selectedRandom = selectedSlide;
    result.updateById = await updateById(paper._id, {
      meta: { ...paper.meta },
    });
  } else {
    const selectedSlidesCount = selectedPapersArrayOnlyExisting.length;
    const rawCurrentSlide = paper.meta.currentSlide;
    const currentSlide =
      Number.isInteger(rawCurrentSlide) &&
      rawCurrentSlide >= 0 &&
      rawCurrentSlide < selectedSlidesCount
        ? rawCurrentSlide
        : 0;

    selectedSlide = selectedPapersArrayOnlyExisting[currentSlide];

    paper.meta.currentSlide = (currentSlide + 1) % selectedSlidesCount;

    result.selectedSequential = paper.meta.currentSlide;
    result.updateById = await updateById(paper._id, {
      meta: { ...paper.meta },
    });
  }

  if (selectedSlide?.key) {
    // console.log('Updating slide to', selectedSlide.key);
    const selectedPaper = await getById(selectedSlide?.key);

    result.uploadSingleImageFromAny = await uploadSingleImageFromAny(
      selectedPaper,
      paper,
      device,
      trigger,
    );
  }
  return result;
};

export default {
  createPaper,
  getById,
  getByIds,
  queryPapersByDevice,
  getPaperByEmail,
  updateById,
  deleteById,
  uploadSingleImageFromWebsite,
  uploadSingleImageFromAny,
  updatePlaylist,
  updateNextSlide,
  generateSignedFileUrl,
  markCurrentFrameImageSyncPending,
  snapshotCurrentFrameImageIfSynced,
};
