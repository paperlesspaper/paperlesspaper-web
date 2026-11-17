import {
  accountsService,
  config,
  devicesService,
  devicesNotificationsService,
  iotDevicesService,
  usersService,
  i18n,
} from "@internetderdinge/api";
import { differenceInDays } from "date-fns";
import * as Sentry from "@sentry/node";
import { BatteryPreference } from "../batteryNotifications/batteryNotifications.model.js";
import {
  getBatteryWarning,
  supportsBatteryWarning,
} from "../batteryNotifications/batteryPolicy.js";
import { deliverBatteryOnce } from "../batteryNotifications/batteryDelivery.service.js";
import { readBatteryPreference } from "../batteryNotifications/batteryPreference.js";
import { getBatteryMessage } from "../batteryNotifications/batteryMessages.js";
import { sendTransactionalEmail } from "../utils/transactionalEmail.js";
import { sendPushNotification } from "./notifications.push.js";

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
        new Date(entry.original.lastReachableAgo)
      ),
    }
  );

export const messageTitleBattery = (entry: any, lng: string) =>
  getBatteryMessage(entry.original.meta?.name || "paperlesspaper", lng).title;
export const messageBodyBattery = (_entry: any, lng: string) =>
  getBatteryMessage("", lng).body;

export const cronjobBattery = async (jobData?: { organization?: string }) => {
  const summary = { checked: 0, low: 0, empty: 0, sent: 0, errors: 0 };
  // Manual local jobs must not deliver real email or push notifications either.
  if (config.env !== "production")
    return { ...summary, skipped: "non-production" };
  const preferences = await BatteryPreference.find({
    $or: [
      { "low.email": true },
      { "low.push": true },
      { "empty.email": true },
      { "empty.push": true },
      { email: true },
      { push: true },
    ],
  }).lean();
  const optedIn = new Set(preferences.map((p: any) => p._id));
  if (!optedIn.size) return summary;
  const devices = (await devicesService.getAllDevices()).filter(
    (device: any) =>
      device.deviceId &&
      device.organization &&
      supportsBatteryWarning(device.kind) &&
      (!jobData?.organization ||
        String(device.organization) === String(jobData.organization))
  );
  const members = new Map<string, Promise<any[]>>();
  const accounts = new Map<string, Promise<any>>();
  const reportError = (error: unknown) => {
    summary.errors++;
    Sentry.captureException(error);
  };
  const processDevice = async (device: any) => {
    try {
      const organization = String(device.organization);
      if (!members.has(organization))
        members.set(
          organization,
          usersService.getUsersByOrganization(organization)
        );
      const users = (await members.get(organization)!).filter(
        (user: any) =>
          user.owner &&
          optedIn.has(user.owner) &&
          (user.role !== "onlyself" ||
            (device.user != null && String(user._id) === String(device.user)))
      );
      const recipients = [
        ...new Set(users.map((user: any) => user.owner as string)),
      ];
      if (!recipients.length) return;
      const status = await iotDevicesService.getDeviceStatus(
        device.deviceId,
        device.kind
      );
      summary.checked++;
      const warning = getBatteryWarning(device.kind, status);
      if (!warning) return;
      summary[warning]++;
      for (const user of recipients) {
        for (const channel of ["email", "push"] as const) {
          try {
            const sent = await deliverBatteryOnce(
              {
                organization,
                device: String(device._id),
                user,
                channel,
                warning,
              },
              async () => {
                // Read preferences at delivery time, including disabling a channel mid-run.
                const preference = await BatteryPreference.findById(
                  user
                ).lean();
                if (!readBatteryPreference(preference)[warning][channel])
                  return false;
                const notification =
                  await devicesNotificationsService.getByUser(user);
                const tokens =
                  notification?.tokens?.filter((token: any) => token?.token) ||
                  [];
                if (channel === "push" && !tokens.length) return false;
                if (!accounts.has(user))
                  accounts.set(user, accountsService.getAccountById(user));
                const response = await accounts.get(user)!;
                const account = response?.data || response;
                const language = account?.app_metadata?.language || "en";
                const message = getBatteryMessage(
                  device.meta?.name || "paperlesspaper",
                  language,
                  warning
                );
                const path = `/${organization}/devices/${device._id}`;
                if (channel === "email") {
                  if (
                    !account?.email ||
                    notification?.bounceEmail === account.email
                  )
                    return false;
                  await sendTransactionalEmail({
                    ...message,
                    subject: `${message.title} – paperlesspaper`,
                    email: account.email,
                    url: new URL(
                      path,
                      process.env.PAPERLESSPAPER_APP_URL ||
                        "https://web.paperlesspaper.de"
                    ).href,
                  });
                  return true;
                }
                const result = await sendPushNotification({
                  ...message,
                  user,
                  kind: "battery",
                  url: path,
                  lng: language,
                  urgent: false,
                  deviceNotifications: {
                    user,
                    tokens,
                    settings: { battery: { push: true, email: false } },
                  },
                });
                if (!Array.isArray(result) || result.length === 0)
                  throw new Error("No battery push notification was accepted");
                return true;
              }
            );
            if (sent) summary.sent++;
          } catch (error) {
            reportError(error);
          }
        }
      }
    } catch (error) {
      reportError(error);
    }
  };
  // Bound IoT/API traffic; one failing device or channel must not stop the others.
  for (let index = 0; index < devices.length; index += 5)
    await Promise.all(devices.slice(index, index + 5).map(processDevice));
  return summary;
};

export default {
  cronjobBattery,
  messageTitleBattery,
  messageBodyBattery,
  messageTitleOffline,
  messageBodyOffline,
};
