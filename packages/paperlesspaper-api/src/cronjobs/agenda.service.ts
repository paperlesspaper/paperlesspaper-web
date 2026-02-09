import Agenda from "agenda";
import config from "@internetderdinge/api/src/config/config";
import * as Sentry from "@sentry/node";
import { sendPushNotification } from "./notifications.push.js";
import {
  cronjobBattery,
  messageTitleBattery,
  messageBodyBattery,
  messageTitleCalibration,
  messageBodyCalibration,
  messageTitleOffline,
  messageBodyOffline,
} from "./battery.cronjob.js";
import { addMessages } from "./addMessages.service.js";
import accounts from "@internetderdinge/api/src/accounts/accounts.service";

const mongoConnectionString = config.mongoose.url;

export const agenda = new Agenda({
  defaultLockLifetime: 10000,
  lockLimit: 2000,
  db: {
    address: mongoConnectionString,
    collection: config.env === "production" ? "agendaJobs" : "agendaJobsLocal",
  },
});

console.log("\x1b[33mAgenda started! \x1b[0m");

agenda.on("fail", (err, job) => {
  console.log("error in agenda", err);
  Sentry.captureException(err);
  /* sendEmail({
    title: `Cronjob ${job.attrs.name} failed`,
    body: `Job failed with error: ${err.message}
    <br/>
    <h3>Stack</h3>
    <pre>${err.stack}</pre>`,
    email: 'robert@wirewire.de',
  }); */
  console.log(`Job failed with error: ${err.message}`, err);
});

/* 
agenda.on('ready', async () => {
  try {
    // Access the underlying Mongo collection Agenda uses internally
    const collection =
      // some versions expose a .collection property, some are the collection itself
      (agenda as any)._collection?.collection || (agenda as any)._collection;

    if (!collection) {
      console.warn('Agenda Mongo collection not available, could not create Agendash index');
      return;
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    await agenda.cancel({
      lastFinishedAt: { $lt: cutoff },
    });

    console.log('Agendash index ensured on agendaJobs collection');
  } catch (err) {
    console.error('Failed to create Agendash index', err);
  }
});
*/

agenda.define("batteryCronjob", async (job) => {
  const data = await cronjobBattery(job);
  const messages = await addMessages(data, agenda);
  return data;
});

agenda.on("complete", (job) => {
  console.log(`Job ${job.attrs.name} finished`);
});

agenda.define("papersCronjob", { shouldSaveResult: true }, async () => {
  return { results: [], validation: async () => [] };
});

agenda.define(
  "sendPushNotification",
  { shouldSaveResult: true },
  async (job) => {
    const data = job.attrs.data;

    const auth0accountPreload = data?.deviceNotifications?.user
      ? await accounts.getAccountById(data.deviceNotifications.user)
      : undefined;

    const lng = auth0accountPreload?.data.app_metadata?.language || "de";
    data.lng = lng;

    if (data.kind === "calibration") {
      data.title = await messageTitleCalibration(data, lng);
      data.body = await messageBodyCalibration(data, lng);
      await sendPushNotification(data /*, auth0accountPreload */);
    } else if (data.kind === "offline") {
      data.title = await messageTitleOffline(data, lng);
      data.body = await messageBodyOffline(data, lng);
      await sendPushNotification(data /*, auth0accountPreload*/);
    } else if (data.kind === "battery") {
      data.title = await messageTitleBattery(data, lng);
      data.body = await messageBodyBattery(data, lng);
      await sendPushNotification(data /*, auth0accountPreload*/);
    }
    console.log("send push completed");
    return { status: "unread" };
  },
);

export default agenda;
