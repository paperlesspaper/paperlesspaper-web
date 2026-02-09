import agenda from "./agenda.service.js";
import config from "@internetderdinge/api/src/config/config";

(async function () {
  await agenda.start();

  if (config.env === "development") {
    console.log("Starting cronjobs in development mode");
    // await messagesService.deleteAllEntriesFromOrganization('614fb1d709dd9f6de85d6373');
    // await agenda.now('batteryCronjob');
    // await agenda.now('papersCronjob');
  }
  // await messagesService.deleteOldEntries();
  if (config.env === "production") {
    console.log("Starting cronjobs in production mode");
    await agenda.now("batteryCronjob");
    await agenda.every("1 hours", "batteryCronjob");
    await agenda.every("3 minutes", "papersCronjob");
  }
})();
