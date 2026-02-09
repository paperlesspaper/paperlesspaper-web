import httpStatus from "http-status";
import Paper from "./papers.model.js";
import ApiError from "@internetderdinge/api/src/utils/ApiError";
import {
  S3Client,
  CopyObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedFileUrl } from "@internetderdinge/api/src/files/upload.service";
import renderService from "../render/render.service";
import iotDevicesService, {
  SIMILARITY_THRESHOLD,
} from "@internetderdinge/api/src/iotdevice/iotdevice.service";
import devicesService from "@internetderdinge/api/src/devices/devices.service";
import { compareImages } from "@internetderdinge/api/src/utils/comparePapers.service";
import axios from "axios";
import { applications, applicationsByKind } from "@wirewire/helpers";
import googleCalendar from "./googleCalendar.service.js";
import qs from "qs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePossiblyRelativeUrl } from "@internetderdinge/api/src/utils/urlUtils";

import type { ObjectId } from "mongoose";
import type { QueryResult } from "./types.js"; // Assuming QueryResult is defined in a types file

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
    device.paper = paperId as any;
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

  await iotDevicesService.uploadSingleImage({
    buffer: dithered.buffer,
    bufferOriginal: resized.buffer,
    id: paper.id,
    deviceName: device.deviceId,
  });

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

const generateSignedFileUrl = async (
  id: string,
  kind = ".png",
): Promise<string> => {
  const fileName = `ePaperImages/${id}${kind}`;
  const url = await getSignedFileUrl({ fileName });
  return url;
};

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data, "binary");
};

const uploadSingleImageFromWebsite = async ({
  paperId,
  parentPaperId,
  device,
}: {
  paperId: string;
  parentPaperId?: string;
  device?: any;
}): Promise<void> => {
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
      return { similarityPercentage: 0, uploadSingleImageResult: null };
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

    const payload = {
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
    let size: { width: number; height: number } | null = null;
    try {
      const renderResult = await renderService.generateImageFromUrl({
        url: renderPageResolved,
        orientation: paper.meta?.orientation,
        scroll: paper.meta?.scroll,
        css: paper.meta?.css,
        data: payload,
        kind: device?.kind,
      });
      originalBuffer = renderResult.buffer;
      size = renderResult.size;
    } catch (error) {
      if (parentPaperId == "696eafb78a9e139345ed8adc")
        console.log("Render failed, skipping upload for paper", paperId, error);
      return { similarityPercentage: 0, uploadSingleImageResult: null };
    }

    if (!originalBuffer || !size) {
      if (parentPaperId == "696eafb78a9e139345ed8adc")
        console.log(
          "Render returned empty buffer, skipping upload for paper",
          paperId,
        );
      return { similarityPercentage: 0, uploadSingleImageResult: null };
    }

    const { buffer: ditheredBuffer } = await renderService.ditherImage({
      buffer: originalBuffer,
      size,
    });

    let similarityPercentage = 0;
    try {
      const currentSignedUrl = await generateSignedFileUrl(
        currentPaperId,
        "original.png",
      );
      const buffer = await downloadImage(currentSignedUrl);
      similarityPercentage = await compareImages(buffer, originalBuffer);
    } catch (error) {
      if (parentPaperId == "696eafb78a9e139345ed8adc")
        console.log(
          "error",
          "Downloading image for comparison failed, assuming 0% similarity",
        );
    }

    if (similarityPercentage < SIMILARITY_THRESHOLD) {
      await iotDevicesService.uploadSingleImage({
        buffer: ditheredBuffer,
        bufferOriginal: originalBuffer,
        id: currentPaperId,
        deviceName: device.deviceId,
      });
    }

    return { similarityPercentage, uploadSingleImageResult: null };
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
  let size: { width: number; height: number } | null = null;
  try {
    if (currentPaperId == "696eafb78a9e139345ed8adc")
      console.log(
        "Rendering page for paper:",
        paperId,
        "with meta:",
        selectedMeta,
      );
    const renderResult = await renderService.generateImageFromUrl({
      url:
        paper.meta?.url ||
        applicationSettings.url + "?" + qs.stringify(selectedMeta),
      orientation: paper.meta?.orientation,
      scroll: paper.meta?.scroll,
      css: paper.meta?.css,
      data: data,
      kind: device?.kind,
    });
    originalBuffer = renderResult.buffer;
    size = renderResult.size;
  } catch (error) {
    if (currentPaperId == "696eafb78a9e139345ed8adc")
      console.log("Render failed, skipping upload for paper", paperId, error);
    return { similarityPercentage: 0, uploadSingleImageResult: null };
  }

  if (!originalBuffer || !size) {
    // console.log('Render returned empty buffer, skipping upload for paper', paperId);
    return { similarityPercentage: 0, uploadSingleImageResult: null };
  }

  // console.log('uploadSingleImageFromWebsite', paper, paperId, parentPaperId, currentPaperId);

  const { buffer: ditheredBuffer } = await renderService.ditherImage({
    buffer: originalBuffer,
    size,
  });

  let similarityPercentage = 0;
  try {
    const currentSignedUrl = await generateSignedFileUrl(
      currentPaperId,
      "original.png",
    );
    const buffer = await downloadImage(currentSignedUrl);
    similarityPercentage = await compareImages(buffer, originalBuffer);
  } catch (error) {
    // console.log('error', 'Downloading image for comparison failed, assuming 0% similarity');
  }
  var uploadSingleImageResult = null;
  if (currentPaperId == "696eafb78a9e139345ed8adc")
    console.log("similarityPercentage", similarityPercentage);
  if (similarityPercentage < SIMILARITY_THRESHOLD) {
    await iotDevicesService.uploadSingleImage({
      buffer: ditheredBuffer,
      bufferOriginal: originalBuffer,
      id: currentPaperId,
      deviceName: device.deviceId,
    });
  }
  return { similarityPercentage, uploadSingleImageResult };
};

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
    console.error("Error copying file:", error);
    throw error;
  }

  return destinationKey;
};

const streamToBuffer = async (
  stream: NodeJS.ReadableStream,
): Promise<Buffer> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
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

const uploadSingleImageFromAny = async (
  paper: any,
  parentPaper: any,
  device: any,
): Promise<void> => {
  // console.log('uploadSingleImageFromAny', paper._id, parentPaper._id, device.deviceId);
  if (paper.kind === "image") {
    const sourceKeyOriginal = "ePaperImages/" + paper._id + "original.png";
    const sourceKey = "ePaperImages/" + paper._id + ".png";

    const bufferOriginal = await getObjectBuffer(sourceKeyOriginal);
    const buffer = await getObjectBuffer(sourceKey);

    // console.log('Uploading image from paper', paper._id, 'to parent paper', parentPaper._id);

    await iotDevicesService.uploadSingleImage({
      buffer: buffer,
      bufferOriginal: bufferOriginal,
      id: parentPaper._id,
      deviceName: device.deviceId,
    });
  } else {
    await uploadSingleImageFromWebsite({
      paperId: paper._id,
      parentPaperId: parentPaper._id,
      device,
    });
  }
};

const updateNextSlide = async (paper: any, device: any): Promise<void> => {
  const organizationId =
    paper?.organization?.toString?.() || paper?.organization;
  if (!organizationId) {
    // console.log('updateNextSlide skipped: missing organization', paper?._id);
    return;
  }

  const selectedPapers = paper?.meta?.selectedPapers;
  if (!selectedPapers || typeof selectedPapers !== "object") {
    // console.log('updateNextSlide skipped: missing selectedPapers', paper?._id);
    return;
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
    selectedSlide =
      selectedPapersArrayOnlyExisting[
        Math.floor(Math.random() * selectedPapersArrayOnlyExisting.length)
      ];
  } else {
    const currentSlide =
      typeof paper.meta.currentSlide === "number" ? paper.meta.currentSlide : 0;

    selectedSlide = selectedPapersArrayOnlyExisting[currentSlide];
    paper.meta.currentSlide =
      (currentSlide + 1) % selectedPapersArrayOnlyExisting.length;

    await updateById(paper._id, { meta: { ...paper.meta } });
  }

  if (selectedSlide?.key) {
    // console.log('Updating slide to', selectedSlide.key);
    const selectedPaper = await getById(selectedSlide?.key);

    await uploadSingleImageFromAny(selectedPaper, paper, device);
  }
};

export default {
  createPaper,
  getById,
  queryPapersByDevice,
  getPaperByEmail,
  updateById,
  deleteById,
  uploadSingleImageFromWebsite,
  uploadSingleImageFromAny,
  updateNextSlide,
  generateSignedFileUrl,
};
