import { getSignedFileUrl, iotDevicesService } from "@internetderdinge/api";
import iotdeviceService from "../iotdevice/iotdevice.service";

const getImageById = async (
  deviceId: string,
  uuid: string,
): Promise<{ url: string }> => {
  const fileName = `ePaperImages/${deviceId}+${uuid}.png`;
  const url = await getSignedFileUrl({ fileName });
  return { url };
};

const updateSingleImageMeta = async (
  deviceId: string,
  shadowNew: any,
): Promise<any> => {
  const shadowBody = {
    state: {
      reported: shadowNew,
    },
  };

  return iotDevicesService.shadowAlarmUpdate(deviceId, shadowBody, "settings");
};

const uploadSingleImage = async ({
  deviceName,
  buffer,
  deviceId,
  uuid,
}: {
  deviceName: string;
  buffer: Buffer;
  deviceId: string;
  uuid: string;
}): Promise<any> => {
  return iotdeviceService.uploadSingleImage({
    deviceName,
    buffer,
    deviceId,
    uuid,
  });
};

export default {
  getImageById,
  updateSingleImageMeta,
  uploadSingleImage,
};
