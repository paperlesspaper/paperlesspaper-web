import mongoose from "mongoose";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Real registration, cache invalidation and upload services; real local MongoDB.
// External IoT/Auth0/S3 are in-memory fakes; no physical device is changed.
const state = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  activateDevice: vi.fn(),
  put: vi.fn(),
}));
vi.mock("@internetderdinge/api", async () => {
  const { default: Device } =
    await import("@internetderdinge/api/src/devices/devices.model.ts");
  return {
    Device,
    ApiError: class extends Error {
      constructor(
        public statusCode: number,
        message: string,
      ) {
        super(message);
      }
    },
    iotDevicesService: { activateDevice: state.activateDevice },
    usersService: { getById: vi.fn() },
    paginate: () => {},
    toJSON: () => {},
    SIMILARITY_THRESHOLD: 99.995,
    compareImages: async (a: Buffer, b: Buffer) =>
      Buffer.from(a).equals(Buffer.from(b)) ? 100 : 0,
    getSignedFileUrl: async ({ fileName }: { fileName: string }) =>
      `https://storage.invalid/${encodeURIComponent(fileName)}`,
  };
});
vi.mock("@aws-sdk/client-s3", async (original) => ({
  ...(await original<any>()),
  S3Client: class {
    async send(command: any) {
      state.objects.delete(command.input.Key);
    }
    destroy() {}
  },
}));
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(private options: any) {}
    async done() {
      state.objects.set(this.options.params.Key, this.options.params.Body);
    }
  },
}));
vi.mock("auth0", () => ({
  AuthenticationClient: class {
    oauth = {
      clientCredentialsGrant: async () => ({
        data: { access_token: "fake", expires_in: 3600 },
      }),
    };
  },
}));
vi.mock("axios", () => ({
  default: {
    get: async (url: string) => {
      const key = decodeURIComponent(new URL(url).pathname.slice(1));
      if (!state.objects.has(key))
        throw Object.assign(new Error("Missing image"), {
          response: { status: 404 },
        });
      return { data: state.objects.get(key) };
    },
    post: async () => ({ data: { uploadURL: "https://iot.invalid/upload" } }),
    put: state.put,
  },
}));
vi.mock("../../src/devicesLogs/devicesLogs.service.js", () => ({
  sanitizeDeviceLogValue: (x: unknown) => x,
  saveDeviceUploadLog: async () => true,
  serializeDeviceLogError: (e: any) => ({ message: e?.message }),
}));
import { Device } from "@internetderdinge/api";
import Paper from "../../src/papers/papers.model.js";
import { registerDevice } from "../../src/devices/deviceRegistration.service.js";
import { uploadSingleImage } from "../../src/iotdevice/iotdevice.service.js";

const url = process.env.REGISTRATION_TEST_MONGODB_URL;
describe.skipIf(!url)("image upload after same-owner reactivation", () => {
  const serial = "epd7-reset-image-test";
  const organization = new mongoose.Types.ObjectId();
  let previous: any;
  let paper: any;
  let image: Buffer;
  beforeAll(async () => {
    if (!new URL(url!).pathname.startsWith("/paperless-registration-test-"))
      throw new Error(
        "Use a disposable database named paperless-registration-test-*",
      );
    const testUrl = new URL(url!);
    testUrl.pathname += "-reset-image";
    await mongoose.connect(testUrl.toString());
    await Device.init();
    image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    await Device.deleteMany({});
    await Paper.deleteMany({});
    state.objects.clear();
    state.activateDevice.mockReset();
    state.put.mockReset().mockResolvedValue({ data: {} });
    previous = await Device.create({
      deviceId: serial,
      organization,
      kind: "epd7",
      meta: { name: "Reset regression" },
    });
    paper = await Paper.create({
      organization,
      deviceId: previous._id,
      name: "Existing image",
    });
    state.objects.set(`ePaperDeviceImages/${serial}.png`, image);
    state.objects.set(`ePaperImages/${paper._id}.png`, image);
  });
  async function reactivate() {
    state.activateDevice
      .mockResolvedValueOnce({ activation_status: "reset" })
      .mockResolvedValueOnce({ activation_status: "pending" });
    expect(
      (
        await registerDevice(serial, {
          organization: String(organization),
          enable: true,
        })
      ).registrationCompleted,
    ).toBe(false);
    expect(state.objects.get(`ePaperDeviceImages/${serial}.png`)).toEqual(
      image,
    );
    state.activateDevice.mockResolvedValue({
      success: true,
      activation_status: "success",
      key: "fake-proof",
    });
    const completed = await registerDevice(serial, {
      organization: String(organization),
      enable: false,
    });
    expect(completed.registrationCompleted).toBe(true);
    expect(completed.createdDevice._id).toEqual(previous._id);
    expect(state.objects.get(`ePaperImages/${paper._id}.png`)).toEqual(image);
    return completed;
  }
  it("reactivation and another start preserve one listed device and its paper", async () => {
    await reactivate();
    const repeated = await registerDevice(serial, {
      organization: String(organization),
      enable: true,
    });
    expect(repeated.createdDevice._id).toEqual(previous._id);
    expect(
      await Device.countDocuments({ deviceId: serial, organization }),
    ).toBe(1);
    expect((await Paper.findById(paper._id))?.deviceId).toEqual(previous._id);
  });
  it.each([
    { label: "same image without force", different: false, forceUpload: false },
    {
      label: "different image without force",
      different: true,
      forceUpload: false,
    },
    { label: "same image with force", different: false, forceUpload: true },
  ])(
    "sends $label after same-account reactivation",
    async ({ different, forceUpload }) => {
      await reactivate();
      const buffer = different
        ? await sharp({
            create: { width: 8, height: 8, channels: 3, background: "black" },
          })
            .png()
            .toBuffer()
        : image;
      const result = await uploadSingleImage({
        deviceName: serial,
        deviceId: String(previous._id),
        id: String(paper._id),
        buffer,
        forceUpload,
      });
      expect(result.skippedUpload).toBe(false);
      expect(state.put).toHaveBeenCalledOnce();
    },
  );
  it("resumes similarity skipping after the first post-reset upload", async () => {
    await reactivate();
    const input = {
      deviceName: serial,
      deviceId: String(previous._id),
      id: String(paper._id),
      buffer: image,
    };
    expect((await uploadSingleImage(input)).skippedUpload).toBe(false);
    expect((await uploadSingleImage(input)).skippedUpload).toBe(true);
    expect(state.put).toHaveBeenCalledOnce();
  });
});
