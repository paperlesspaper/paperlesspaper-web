import mongoose from "mongoose";
import * as Sentry from "@sentry/node";
import devicesNotifications from "@internetderdinge/api/src/devicesNotifications/devicesNotifications.service";
import config from "@internetderdinge/api/src/config/config";
import usersService from "@internetderdinge/api/src/users/users.service";

import type { Agenda } from "agenda";
import { sendEmail } from "@internetderdinge/api/src/email/email.service";

export const addMessage = async (
  { result, validation }: { result: Result; validation: ValidationFunction },
  agenda: Agenda,
) => {
  const message = await validation(result);

  if (message) return "validation already exists";
  const users = await usersService.getUsersByOrganization(result.organization);

  const messageResponse = await Promise.all(
    users.map(async (user) => {
      let output = null;
      if (user.owner) {
        const account = await devicesNotifications.getByUser(user.owner);

        // TODO: Skip users with role 'onlyself'
        if (user.role === "onlyself" && user.id !== result.user) {
          sendEmail({
            title: `Skipped notification for user ${user.id}`,
            body: `Skipped notification for user ${user.id}--${user._id} with for result ${result.user} 'onlyself<br/><br/><br/>'${JSON.stringify(user)}<br/><br/><br/>  ${JSON.stringify(result)}`,
            email: "robert@wirewire.de",
          });
          return null;
        }

        const scheduleData = {
          deviceNotifications: account,
          original: result.original,
          kind: result.kind,
          remindDate: result.remindDate,
          user: new mongoose.Types.ObjectId(user.id),
          organization: result.organization,
          url: result.url,
          image: result.image,
          repeat: result.repeat,
          originalId: result.original.id,
        };

        if (result.remindDate && config.env === "production") {
          scheduleData.remindDate = new Date(result.remindDate);
          output = await agenda.schedule(
            scheduleData.remindDate,
            `sendPushNotification`,
            scheduleData,
          );
        } else {
          output = await agenda.now(`sendPushNotification`, scheduleData);
        }
      }
      return output;
    }),
  );

  return messageResponse;
};

export const addMessages = async (
  {
    results,
    validation,
  }: { results: Result[]; validation: ValidationFunction },
  agenda: Agenda,
) => {
  try {
    //console.log('Adding messages:', results.length, 'results');
    const messages = await Promise.all(
      results.map(async (e) => {
        return addMessage({ result: e, validation }, agenda);
      }),
    );
    return messages;
  } catch (error) {
    console.error("Error in addMessages:", error);
    Sentry.captureException(error);

    /* await sendEmail({
      title: `AddMessages entries error ${error.name}`,
      body: `AddMessages entries error ${error.message} <br/> ${error}<br/><h3>Stack:</h3><pre>${error.stack}</pre>`,
      email: 'robert@wirewire.de',
    }); */
    return error;
  }
};

export default { addMessages, addMessage };
