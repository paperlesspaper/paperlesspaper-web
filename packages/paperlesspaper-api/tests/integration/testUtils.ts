import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import type { Express } from "express";
import type { AddressInfo } from "net";

type RecordedResponse = {
  test: string;
  step: string;
  status: number;
  body: unknown;
};

const schemaExampleIds = {
  organization: "682fd0d7d4a6325d9d45b86e",
  user: "682fd0d7d4a6325d9d45b86d",
  device: "682fd0d7d4a6325d9d45b86f",
  paper: "682fd0d7d4a6325d9d45b870",
  deviceSerial: "nrf-schemathesis-example",
};

const iotDeviceMock = vi.hoisted(() => ({
  SIMILARITY_THRESHOLD: 99.995,
  activateDevice: async () => ({ activation_status: "success" }),
  getEvents: async () => ({ message: [] }),
  getById: async () => null,
  updateById: async () => null,
  deleteById: async () => null,
  getApiStatus: async () => ({ status: "ok" }),
  getDevice: async (deviceIds: string[] = []) => ({
    message: deviceIds.map((serialNumber) => ({ serialNumber })),
  }),
  uploadSingleImage: async () => ({
    key: "mock-key",
    similarityPercentage: null,
    skippedUpload: false,
  }),
  liveEventsWs: async () => undefined,
  shadowAlarmGet: async () => ({}),
  shadowAlarmUpdate: async () => ({}),
  ledLightHint: async () => ({ status: "ok" }),
  getDeviceStatus: async () => ({ status: "ok" }),
  getDeviceStatusList: async () => [],
  subscribeToLiveEvents: async () => undefined,
  pingDevice: async () => ({ status: "ok" }),
  resetDevice: async () => ({ status: "ok" }),
  rebootDevice: async () => ({ status: "ok" }),
  updateDevice: async () => ({ status: "ok" }),
}));

const auth0ServiceMock = vi.hoisted(() => {
  const buildUser = (id: string, email = "mock@example.com") => ({
    user_id: id,
    email,
    app_metadata: { language: "en", devices: [] },
    identities: [{ isSocial: false }],
  });

  const auth0 = {
    users: {
      get: async ({ id }: { id: string }) => ({ data: buildUser(id) }),
      update: async ({ id }: { id: string }, body: Record<string, any>) => ({
        data: { ...buildUser(id), ...body },
      }),
      delete: async () => ({ data: { success: true } }),
      deleteAuthenticationMethods: async () => ({ data: { success: true } }),
      getAll: async () => ({ data: [] }),
    },
    usersByEmail: {
      getByEmail: async ({ email }: { email: string }) => ({
        data: [{ user_id: "auth0|test", email }],
      }),
    },
    jobs: {
      verifyEmail: async () => ({ status: "ok" }),
    },
    guardian: {
      createEnrollmentTicket: async () => ({ data: { ticket: "mock-ticket" } }),
    },
    getUsers: async () => [],
  };

  const getUsersByIds = async (ids: string[]) => ({
    data: ids.filter(Boolean).map((id) => buildUser(id)),
  });

  const getUserIdByEmail = async (email: string) => ({
    data: [{ user_id: "auth0|test", email }],
  });

  const getUserById = async (userId: string) => ({ data: buildUser(userId) });

  return {
    auth0,
    getAuth0Token: async () => "mock-token",
    getAuth0ManagementToken: async () => "mock-token",
    getUsersByIds,
    getUserIdByEmail,
    getUserById,
    sendVerificationEmail: async () => undefined,
    avatar: async (userId: string) => ({ data: buildUser(userId) }),
    mfaEnrollAccount: async () => ({ data: { ticket: "mock-ticket" } }),
    mfaDisableAccount: async () => ({ success: true }),
  };
});

const googleCalendarMock = vi.hoisted(() => ({
  updateGoogleCalendarEvents: async () => ({
    calendarAuth: {},
    calendarData: { calendars: [], events: [] },
  }),
  getCalendarEvents: async () => ({ calendars: [], events: [] }),
  generateAuthToken: async () => ({ access_token: "mock", refresh_token: "mock" }),
}));

const renderServiceMock = vi.hoisted(() => ({
  generateImageFromUrl: async () => ({
    buffer: Buffer.from("mock"),
    size: { width: 1, height: 1 },
  }),
  resizeImageToDeviceSize: async () => ({
    buffer: Buffer.from("mock"),
    size: { width: 1, height: 1, name: "portrait" },
  }),
  ditherImage: async () => ({
    buffer: Buffer.from("mock"),
    size: { width: 1, height: 1, name: "portrait" },
  }),
}));

vi.mock("@internetderdinge/api/src/iotdevice/iotdevice.service", () => ({
  __esModule: true,
  default: iotDeviceMock,
  ...iotDeviceMock,
}));
vi.mock("@internetderdinge/api/src/iotdevice/iotdevice.service.js", () => ({
  __esModule: true,
  default: iotDeviceMock,
  ...iotDeviceMock,
}));
vi.mock("@internetderdinge/api/src/accounts/auth0.service", () => ({
  __esModule: true,
  default: auth0ServiceMock,
  ...auth0ServiceMock,
}));
vi.mock("@internetderdinge/api/src/accounts/auth0.service.js", () => ({
  __esModule: true,
  default: auth0ServiceMock,
  ...auth0ServiceMock,
}));
vi.mock("@internetderdinge/api/src/email/email.service", () => ({
  __esModule: true,
  sendEmail: async () => undefined,
}));
vi.mock("@internetderdinge/api/src/email/email.service.js", () => ({
  __esModule: true,
  sendEmail: async () => undefined,
}));
vi.mock("../../src/papers/googleCalendar.service", () => ({
  __esModule: true,
  default: googleCalendarMock,
  ...googleCalendarMock,
}));
vi.mock("../../src/papers/googleCalendar.service.js", () => ({
  __esModule: true,
  default: googleCalendarMock,
  ...googleCalendarMock,
}));
vi.mock("../../src/render/render.service", () => ({
  __esModule: true,
  default: renderServiceMock,
  ...renderServiceMock,
}));
vi.mock("../../src/render/render.service.js", () => ({
  __esModule: true,
  default: renderServiceMock,
  ...renderServiceMock,
}));
vi.mock("multer", () => ({
  __esModule: true,
  default: () => ({
    array: () => (req: any, _res: any, next: any) => {
      req.files = [
        { buffer: Buffer.from("mock") },
        { buffer: Buffer.from("mock") },
      ];
      next();
    },
  }),
}));

const resultDir =
  process.env.TEST_RESULT_DIR ||
  path.resolve(process.cwd(), "../../test-results");

const formatRunId = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const runId = process.env.TEST_RUN_ID || formatRunId(new Date());

const initEnvironment = (): void => {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URL =
    process.env.MONGODB_URL || "mongodb://localhost:27017/paperlesspaper-api";
  process.env.PORT = process.env.PORT || "0";
  process.env.API_KEY_ADMIN = process.env.API_KEY_ADMIN || "true";
  process.env.SCHEMA_STRICT_EXAMPLES =
    process.env.SCHEMA_STRICT_EXAMPLES || "false";
};

const connectDatabase = async () => {
  const { default: config } = await import(
    "@internetderdinge/api/src/config/config"
  );
  const mongooseModule = await import(
    "@internetderdinge/api/node_modules/mongoose"
  );
  const db = mongooseModule.default;
  await db.connect(config.mongoose.url, config.mongoose.options);
  return db;
};

const connectLocalDatabase = async () => {
  const { default: config } = await import(
    "@internetderdinge/api/src/config/config"
  );
  const mongooseModule = await import("mongoose");
  const db = mongooseModule.default;
  if (db.connection.readyState !== 1) {
    await db.connect(config.mongoose.url, config.mongoose.options);
  }
  return db;
};

const loadApp = async (): Promise<Express> => {
  const appModule = await import("../../src/app");
  return appModule.default;
};

const applyTestRequestShims = (app: Express): void => {
  const shim = (req: any, _res: any, next: any) => {
    if (
      req.method === "POST" &&
      typeof req.path === "string" &&
      req.path.includes("/uploadSingleImage/")
    ) {
      const files = (req as { files?: Array<{ buffer: Buffer }> }).files;
      if (!files || files.length === 0) {
        (req as { files?: Array<{ buffer: Buffer }> }).files = [
          { buffer: Buffer.from("mock") },
          { buffer: Buffer.from("mock") },
        ];
      }
    }
    next();
  };

  app.use(shim);
  const router = (app as unknown as { _router?: { stack?: any[] } })._router;
  if (router?.stack?.length) {
    const layer = router.stack.pop();
    if (layer) {
      router.stack.unshift(layer);
    }
  }
};

const writeResponses = async (
  suiteName: string,
  responses: RecordedResponse[],
): Promise<void> => {
  if (!responses.length) return;
  await fs.mkdir(resultDir, { recursive: true });
  const outputPath = path.join(
    resultDir,
    `${suiteName}-responses-${runId}.json`,
  );
  await fs.writeFile(
    outputPath,
    JSON.stringify({ runId, suite: suiteName, responses }, null, 2),
  );
};

const buildAuthHeaders = (apiKey: string, bearerToken?: string) => {
  const headers: string[] = [];
  if (apiKey) {
    headers.push(`x-api-key:${apiKey}`);
  }
  if (bearerToken) {
    headers.push(`Authorization:Bearer ${bearerToken}`);
  }
  return headers;
};

export const setupIntegrationTest = (suiteName: string) => {
  let app: Express;
  let apiKey = "";
  let db: typeof import("mongoose");
  let localDb: typeof import("mongoose");
  const responses: RecordedResponse[] = [];
  let seedData: {
    organizationId: string;
    userId: string;
    deviceId: string;
    deviceObjectId: string;
    paperId: string;
  } | null = null;

  const recordResponse = (
    test: string,
    step: string,
    response: { status: number; body: unknown },
  ) => {
    responses.push({
      test,
      step,
      status: response.status,
      body: response.body,
    });
  };

  beforeAll(async () => {
    initEnvironment();
    db = await connectDatabase();
    localDb = await connectLocalDatabase();
    const { initDeviceList } = await import(
      "@internetderdinge/api/src/utils/deviceUtils"
    );
    const { deviceList } = await import("@wirewire/helpers");
    initDeviceList({ list: deviceList });
    app = await loadApp();
    applyTestRequestShims(app);
  }, 30000);

  beforeEach(async () => {
    const { createToken } = await import(
      "@internetderdinge/api/src/tokens/tokens.service"
    );
    const token = await createToken({
      name: `test-token-${suiteName}`,
      owner: `test-owner-${suiteName}`,
    });
    apiKey = token.raw;

    const { default: organizationsService } = await import(
      "@internetderdinge/api/src/organizations/organizations.service"
    );
    const organizationsModelModule = await import(
      "@internetderdinge/api/src/organizations/organizations.model"
    );
    const usersService = await import(
      "@internetderdinge/api/src/users/users.service"
    );
    const usersModelModule = await import(
      "@internetderdinge/api/src/users/users.model"
    );
    const devicesService = await import(
      "@internetderdinge/api/src/devices/devices.service"
    );
    const papersServiceModule = await import("../../src/papers/papers.service");
    const papersService = papersServiceModule.default;
    const papersModelModule = await import("../../src/papers/papers.model");

    const organization = await organizationsService.createOrganization({
      name: `Test Org ${suiteName}`,
      kind: "private-wirewire",
    });

    const user = await usersService.createUser({
      organization: organization._id,
      owner: token.owner,
      role: "admin",
      category: "relative",
      status: "accept",
      timezone: "Europe/Berlin",
      name: `Test User ${suiteName}`,
    });

    const device = await devicesService.createDevice({
      organization: organization._id,
      deviceId: `DEVICE-${suiteName.toUpperCase()}`,
      kind: "anabox-smart",
      meta: { sleepTime: "3600", orientation: "portrait" },
    });

    const paper = await papersService.createPaper({
      deviceId: device._id,
      kind: "calendar",
      meta: { selectedCalendars: {}, orientation: "portrait" },
      organization: organization._id,
      name: `Test Paper ${suiteName}`,
    });

    seedData = {
      organizationId: organization._id.toString(),
      userId: user._id.toString(),
      deviceId: device.deviceId || "",
      deviceObjectId: device._id.toString(),
      paperId: paper._id.toString(),
    };
  }, 30000);

  afterAll(async () => {
    await db.disconnect();
    if (localDb?.connection?.readyState === 1) {
      await localDb.disconnect();
    }
    await writeResponses(suiteName, responses);
  }, 30000);

  return {
    getApp: () => app,
    getApiKey: () => apiKey,
    getAuthHeaders: () => {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }
      const bearer = process.env.TEST_BEARER_TOKEN;
      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
      }
      return headers;
    },
    getSeedData: () => seedData,
    recordResponse,
  };
};

export const setupSchemathesisTest = (suiteName: string) => {
  let app: Express;
  let apiKey = "";
  let db: typeof import("mongoose");
  let localDb: typeof import("mongoose");
  let server: import("http").Server | null = null;
  let baseUrl = "";

  const runSchemathesis = async (schemaUrl: string): Promise<void> => {
    if (!baseUrl) {
      throw new Error("Schemathesis baseUrl not initialized");
    }

    await new Promise<void>((resolve, reject) => {
      const bearer = process.env.SCHEMATHESIS_BEARER_TOKEN;
      const headers = buildAuthHeaders(apiKey, bearer);
      const args = [
        "run",
        schemaUrl,
        "--url",
        baseUrl,
        "--checks=not_a_server_error",
        "--phases=examples",
        "--max-failures=1",
        "--warnings=off",
      ];
      headers.forEach((header) => {
        args.push("--header", header);
      });
      const child = spawn("schemathesis", args, { stdio: "pipe" });
      let output = "";

      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
        process.stderr.write(chunk);
      });

      child.on("error", reject);
      child.on("close", async (code) => {
        const reportName = `schemathesis-${suiteName}-${runId}.log`;
        const reportPath = path.join(resultDir, reportName);
        await fs.mkdir(resultDir, { recursive: true });
        await fs.writeFile(reportPath, output || "(no output)\n");
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Schemathesis failed with exit code ${code}`));
        }
      });
    });
  };

  beforeAll(async () => {
    initEnvironment();
    db = await connectDatabase();
    localDb = await connectLocalDatabase();
    const { initDeviceList } = await import(
      "@internetderdinge/api/src/utils/deviceUtils"
    );
    const { deviceList } = await import("@wirewire/helpers");
    initDeviceList({ list: deviceList });
    const { default: organizationsService } = await import(
      "@internetderdinge/api/src/organizations/organizations.service"
    );
    const organizationsModelModule = await import(
      "@internetderdinge/api/src/organizations/organizations.model"
    );
    const usersService = await import(
      "@internetderdinge/api/src/users/users.service"
    );
    const usersModelModule = await import(
      "@internetderdinge/api/src/users/users.model"
    );
    const devicesService = await import(
      "@internetderdinge/api/src/devices/devices.service"
    );
    const devicesModelModule = await import(
      "@internetderdinge/api/src/devices/devices.model"
    );
    const papersServiceModule = await import("../../src/papers/papers.service");
    const papersService = papersServiceModule.default;
    const papersModelModule = await import("../../src/papers/papers.model");

    const { createToken } = await import(
      "@internetderdinge/api/src/tokens/tokens.service"
    );
    const token = await createToken({
      name: `schemathesis-token-${suiteName}`,
      owner: `schemathesis-owner-${suiteName}`,
    });
    apiKey = token.raw;
    process.env.SCHEMA_EXAMPLE_ACCOUNT_ID = token.owner;
    process.env.SCHEMA_STRICT_EXAMPLES = "true";
    process.env.SCHEMA_EXAMPLE_ORGANIZATION_ID = schemaExampleIds.organization;
    process.env.SCHEMA_EXAMPLE_USER_ID = schemaExampleIds.user;
    process.env.SCHEMA_EXAMPLE_DEVICE_ID = schemaExampleIds.device;
    process.env.SCHEMA_EXAMPLE_PAPER_ID = schemaExampleIds.paper;
    process.env.SCHEMA_EXAMPLE_DEVICE_SERIAL = schemaExampleIds.deviceSerial;

    await organizationsModelModule.default.deleteMany({
      _id: process.env.SCHEMA_EXAMPLE_ORGANIZATION_ID,
    });
    await usersModelModule.User.deleteMany({
      _id: process.env.SCHEMA_EXAMPLE_USER_ID,
    });
    await devicesModelModule.default.deleteMany({
      _id: process.env.SCHEMA_EXAMPLE_DEVICE_ID,
    });
    await papersModelModule.default.deleteMany({
      _id: process.env.SCHEMA_EXAMPLE_PAPER_ID,
    });

    const organization = await organizationsService.createOrganization({
      _id: process.env.SCHEMA_EXAMPLE_ORGANIZATION_ID,
      name: `Schemathesis Org ${suiteName}`,
      kind: "private-wirewire",
    });

    const user = await usersService.createUser({
      organization: organization._id,
      owner: token.owner,
      role: "admin",
      category: "relative",
      status: "accept",
      timezone: "Europe/Berlin",
      name: `Schemathesis User ${suiteName}`,
    });

    const defaultExampleId = process.env.SCHEMA_EXAMPLE_USER_ID;
    const existingPatient = await usersService.getById(defaultExampleId);
    const patientUser =
      existingPatient ||
      (await usersService.createUser({
        _id: defaultExampleId,
        organization: organization._id,
        owner: `schemathesis-patient-${suiteName}`,
        role: "patient",
        category: "patient",
        status: "accept",
        timezone: "Europe/Berlin",
        name: `Schemathesis Patient ${suiteName}`,
      }));

    await devicesModelModule.default.deleteMany({
      patient: patientUser._id,
    });

    const device = await devicesService.createDevice({
      _id: process.env.SCHEMA_EXAMPLE_DEVICE_ID,
      organization: organization._id,
      deviceId: `SCHEMA-${suiteName.toUpperCase()}`,
      kind: "anabox-smart",
      meta: { sleepTime: "3600", orientation: "portrait" },
    });

    const paper = await papersService.createPaper({
      _id: process.env.SCHEMA_EXAMPLE_PAPER_ID,
      deviceId: device._id,
      kind: "google-calendar",
      meta: { selectedCalendars: {}, orientation: "portrait" },
      organization: organization._id,
      name: `Schemathesis Paper ${suiteName}`,
    });

    process.env.SCHEMA_EXAMPLE_ORGANIZATION_ID = organization._id.toString();
    process.env.SCHEMA_EXAMPLE_USER_ID = patientUser._id.toString();
    process.env.SCHEMA_EXAMPLE_DEVICE_ID = device._id.toString();
    process.env.SCHEMA_EXAMPLE_PAPER_ID = paper._id.toString();

    app = await loadApp();
    applyTestRequestShims(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server?.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/v1`;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    await db.disconnect();
    if (localDb?.connection?.readyState === 1) {
      await localDb.disconnect();
    }
  }, 30000);

  return {
    getBaseUrl: () => baseUrl,
    runSchemathesis,
  };
};
