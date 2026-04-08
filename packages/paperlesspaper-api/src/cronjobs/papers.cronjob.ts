import httpStatus from "http-status";
import ApiError from "../utils/ApiError.ts";
import { devicesService } from "@internetderdinge/api";
import papersService from "../papers/papers.service.ts";
import { subHours, differenceInDays } from "date-fns";
// import Messages from "../messages/messages.service.ts";

import type { Job } from "some-job-type"; // Replace with the actual type if available
import type { Device, Paper } from "../types"; // Replace with the actual types if available

const validation = async (entry: any): Promise<any> => {
  /* const jobs = await Messages.findMessage({
    name: "sendPushNotification",
    "data.original._id": entry.original._id,
    "data.organization": entry.organization,
    "data.kind": entry.kind,
    lastRunAt: {
      $gt: subHours(new Date(), 48),
    },
  });
  return jobs; */ return false;
};

export const cronjobPapers = async (
  job: Job,
): Promise<{
  results: any[];
  validation: typeof validation;
  meta: {
    job: { id?: string; name?: string };
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    batchSize: number;
    devices: {
      totalFetched: number;
      processed: number;
      skippedNoDeviceId: number;
      withPaper: number;
      nonImagePaper: number;
      dueForSync: number;
    };
    actions: {
      uploadsTriggered: number;
      slidesAdvanced: number;
      singleImageUploads: number;
    };
    updatedEntries: Array<{
      deviceId: string;
      organizationId?: string;
      paperId?: string;
      action: "slides" | "single-image";
    }>;
    errors: Array<{ deviceId?: string; message: string }>;
  };
}> => {
  const startedAt = new Date();
  console.log("run Papers Cronjob");
  const notifications: any[] = [];
  const errors: Array<{ deviceId?: string; message: string }> = [];
  const updatedEntries: Array<{
    deviceId: string;
    organizationId?: string;
    paperId?: string;
    action: "slides" | "single-image";
  }> = [];

  const metrics = {
    totalFetched: 0,
    processed: 0,
    skippedNoDeviceId: 0,
    withPaper: 0,
    nonImagePaper: 0,
    dueForSync: 0,
    uploadsTriggered: 0,
    slidesAdvanced: 0,
    singleImageUploads: 0,
  };

  const devices = await devicesService.queryDevicesByUser(
    {
      kind: { $in: ["epaper", "epd7"] },
    },
    { limit: -1 },
  );
  metrics.totalFetched = devices.results.length;

  const DEVICE_BATCH_SIZE = 300;

  const processDevice = async (device: Device) => {
    // console.log('Checking device for new papers:', device._id);
    // TODO: Remove hardcoded device ID

    if (!device.deviceId) {
      metrics.skippedNoDeviceId += 1;
      return;
    }

    metrics.processed += 1;

    try {
      if (device.deviceId != "epd7-b43a459ab258") {
        // console.log("Found device to process:", device.deviceId);
        // return null;
      }

      // console.log("Processing devicedddddd:", device.deviceId);
      const papers = await papersService.queryPapersByDevice(
        { deviceId: device.id },
        { limit: 1, sortBy: "-updatedAt" },
      );

      // console.log("Papers for device:", papers.results);
      if (papers.results.length > 0) {
        metrics.withPaper += 1;
        const resultPaper: Paper = papers.results[0];

        metrics.id = resultPaper._id?.toString() || "unknown";

        if (resultPaper.kind !== "image") {
          metrics.nonImagePaper += 1;
          const deviceStatus =
            await devicesService.populateDeviceStatus(device);

          const differenceInMinutes =
            (new Date(deviceStatus?.nextDeviceSync).getTime() -
              new Date().getTime()) /
            1000 /
            60;

          /*if (differenceInMinutes < 7 && differenceInMinutes > 3)
            console.log(
              `Device ${device.deviceId} next sync in ${differenceInMinutes.toFixed(
                2,
              )} minutes`,
              {
                deviceId: device.deviceId,
                organizaton: device.organization?.toString(),
                nextDeviceSync: deviceStatus?.nextDeviceSync,
                differenceInMinutes,
              },
            ); */

          if (differenceInMinutes < 5 && differenceInMinutes > 0) {
            metrics.dueForSync += 1;
            if (resultPaper.kind === "slides") {
              metrics.uploadsTriggered += 1;
              metrics.slidesAdvanced += 1;
              // console.log("Advancing slides for paper:", resultPaper._id);
              const updateNextSlideResult = await papersService.updateNextSlide(
                resultPaper,
                device,
              );

              // console.log("updateNextSlideResult:", updateNextSlideResult);
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId: resultPaper._id?.toString(),
                action: "slides",
                updateResult: updateNextSlideResult,
              });
            } else {
              metrics.uploadsTriggered += 1;
              metrics.singleImageUploads += 1;
              const uploadSingleImageFromWebsiteResult =
                await papersService.uploadSingleImageFromWebsite({
                  paperId: resultPaper._id,
                });
              updatedEntries.push({
                deviceId: device.id,
                organizationId: device.organization?.toString(),
                paperId: resultPaper._id?.toString(),
                action: "dynamic-integration",
                updateResult: uploadSingleImageFromWebsiteResult,
              });
            }
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";
      errors.push({
        deviceId: device.deviceId,
        message,
      });
    }
  };

  console.log(
    `Processing ${devices.results.length} devices in batches of ${DEVICE_BATCH_SIZE}...`,
  );

  // console.log(devices.results);

  // check if devices.results has a value with deviceId epd7-b43a459ab258
  const hasTargetDevice = devices.results.some(
    (device) => device.deviceId === "epd7-b43a459ab258",
  );

  console.log(
    `Device with ID "epd7-b43a459ab258" ${
      hasTargetDevice ? "found" : "not found"
    } in devices.results`,
  );

  for (let i = 0; i < devices.results.length; i += DEVICE_BATCH_SIZE) {
    const batch = devices.results.slice(i, i + DEVICE_BATCH_SIZE);

    console.log(
      `Processing batch ${i / DEVICE_BATCH_SIZE + 1} (${batch.length} devices)...`,
    );
    await Promise.all(batch.map(processDevice));
  }

  const finishedAt = new Date();

  return {
    results: notifications,
    validation,
    meta: {
      job: {
        id: job?.id,
        name: job?.name,
      },
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      batchSize: DEVICE_BATCH_SIZE,
      devices: {
        totalFetched: metrics.totalFetched,
        processed: metrics.processed,
        skippedNoDeviceId: metrics.skippedNoDeviceId,
        withPaper: metrics.withPaper,
        nonImagePaper: metrics.nonImagePaper,
        dueForSync: metrics.dueForSync,
      },
      actions: {
        uploadsTriggered: metrics.uploadsTriggered,
        slidesAdvanced: metrics.slidesAdvanced,
        singleImageUploads: metrics.singleImageUploads,
      },
      updatedEntries,
      errors,
    },
  };
};

export default {
  cronjobPapers,
};
