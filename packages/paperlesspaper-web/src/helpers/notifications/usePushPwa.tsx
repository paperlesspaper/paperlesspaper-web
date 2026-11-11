import usePushSettings from "./usePushSettings";
import { webPush } from "./webPush";

export default function usePushNotificationsPwa() {
  return usePushSettings(webPush);
}
