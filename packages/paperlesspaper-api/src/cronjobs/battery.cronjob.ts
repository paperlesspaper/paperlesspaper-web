import httpStatus from "http-status";
import {
  devicesService,
  iotDevicesService,
  // Messages,
  i18n,
} from "@internetderdinge/api";
// import { getDeviceStatus } from "../iotdevice/iotdevice.service";
import { subHours, differenceInDays } from "date-fns";
import { addMessages } from "./addMessages.service";
// import Messages from "../messages/messages.service";

const validation = async (entry: any) => {
  /*const jobs = await Messages.findMessage({
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

export const messageTitleOffline = (entry: any, lng: string) =>
  i18n.t("DEVICE_IS_OFFLINE", `{{deviceName}} is offline`, {
    lng,
    deviceName: entry.original.meta?.name
      ? entry.original.meta?.name
      : "Device",
  });

export const messageBodyOffline = (entry: any, lng: string) =>
  i18n.t(
    "DEVICE_IS_OFFLINE_MESSAGE",
    `The device is offline since {{daysCount}} days. Please recharge it.`,
    {
      lng,
      daysCount: differenceInDays(
        new Date(),
        new Date(entry.original.lastReachableAgo),
      ),
    },
  );

export const messageTitleBattery = (entry: any, lng: string) =>
  entry.original.batLevel < 3450
    ? i18n.t("DEVICE_IS_EMPTY", `{{deviceName}} is empty.`, {
        lng,
        deviceName: entry.original.meta?.name
          ? entry.original.meta?.name
          : "Device",
      })
    : i18n.t("DEVICE_IS_ALMOST_EMPTY", `{{deviceName}} is almost empty.`, {
        lng,
        deviceName: entry.original.meta?.name
          ? entry.original.meta?.name
          : "Device",
      });

export const messageBodyBattery = (entry: any, lng: string) =>
  entry.original.batLevel < 3450
    ? i18n.t(
        "DEVICE_IS_EMPTY_MESSAGE",
        `The battery of the device {{deviceName}} is empty and needs to be charged.`,
        {
          lng,
          deviceName: entry.original.meta?.name
            ? entry.original.meta?.name
            : "Device",
        },
      )
    : i18n.t(
        "DEVICE_IS_ALMOST_EMPTY_MESSAGE",
        `The battery of the device {{deviceName}} is almost empty and needs to be charged.`,
        {
          lng,
          deviceName: entry.original.meta?.name
            ? entry.original.meta?.name
            : "Device",
        },
      );

export const cronjobBattery = async (jobData?: { organization?: string }) => {
  const notifications: any[] = [];
  return null;
  let devices: Device[] = await devicesService.getAllDevices();

  if (jobData?.organization) {
    devices = devices.filter((e) =>
      e.organization.equals(jobData.organization),
    );
  }

  await Promise.all(
    devices.map(async (e) => {
      if (e.deviceId) {
        const result = await iotDevicesService.getDeviceStatus(
          e.deviceId,
          e.kind,
        );

        if (e.kind === "PPPP") {
          if (
            result &&
            result.lastReachableAgo &&
            differenceInDays(new Date(), new Date(result.lastReachableAgo)) >
              2 &&
            differenceInDays(new Date(), new Date(result.lastReachableAgo)) < 5
          ) {
            const original = e.toObject();
            notifications.push({
              organization: original.organization,
              original: {
                ...original,
                batLevel: result.batLevel,
                lastReachableAgo: result.lastReachableAgo,
              },
              originalId: original._id,
              kind: "offline",
              image: "https://memo.wirewire.de/network.png",
              iotDeviceStatus: result,
              url: `/${original.organization}/devices/${original._id}`,
            });
          } else if (result && result.batLevel && result.batLevel < 3500) {
            const original = e.toObject();
            notifications.push({
              organization: original.organization,
              original: {
                ...original,
                batLevel: result.batLevel,
                lastReachableAgo: result.lastReachableAgo,
              },
              originalId: original._id,
              kind: "battery",
              image: "https://memo.wirewire.de/battery-status.png",
              iotDeviceStatus: result,
              url: `/${original.organization}/devices/${original._id}`,
            });
          }
        }
      }
    }),
  );

  return { results: notifications, validation };
};

export default {
  cronjobBattery,
  messageTitleBattery,
  messageBodyBattery,
  messageTitleOffline,
  messageBodyOffline,
};
