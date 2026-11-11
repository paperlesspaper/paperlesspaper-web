import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  requests: [] as any[],
  sweeps: new Map<string, () => Promise<void>>(),
  current: null as any,
  separatePapers: false,
  paperSources: new Map<string, any>(),
  deliveries: new Map<string, any>(),
  events: new Map<string, any>(),
  connection: {
    _id: "connection",
    callbackUrl: "https://integration.example/status",
    callbackToken: "secret",
  } as any,
  devices: [] as any[],
  upload: vi.fn(),
  status: vi.fn(),
  latest: vi.fn(),
  send: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("bullmq", () => ({
  Queue: class {
    on() {}
    async setGlobalConcurrency() {}
    async upsertJobScheduler() {}
  },
  Worker: class {
    constructor(name: string, process: () => Promise<void>) {
      m.sweeps.set(name, process);
    }
    on() {}
  },
}));
vi.mock("@internetderdinge/api", () => ({
  ApiError: class extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
  Device: {
    find: async () => m.devices,
    findOne: async (q: any) => m.devices.find((d) => d._id === q._id),
  },
  devicesService: { populateDeviceStatus: m.status },
}));
vi.mock("@paperlesspaper/helpers", () => ({
  deviceKindHasFeature: () => true,
}));
vi.mock("../../src/cronjobs/bullmq.service.js", () => ({
  bullMqEnabled: true,
  getRedisConnection: vi.fn(),
}));
vi.mock("../../src/papers/papers.service.js", () => ({
  default: { uploadSingleImageFromWebsite: m.upload },
}));
vi.mock("../../src/papers/papers.model.js", () => ({
  default: { updateOne: vi.fn() },
}));
vi.mock("../../src/devicesLogs/devicesLogs.model.js", () => ({
  default: { findOne: () => ({ sort: m.latest }) },
}));
vi.mock("../../src/integrationPush/access.js", () => ({
  authorizeConnection: m.authorize,
}));
vi.mock("../../src/integrationPush/security.js", async () => ({
  ...(await vi.importActual<any>("../../src/integrationPush/security.js")),
  sendCallback: m.send,
}));
vi.mock("../../src/integrationPush/models.js", () => ({
  PushGrant: { init: vi.fn() },
  PushConnection: {
    init: vi.fn(),
    findById: () => ({ ...m.connection, select: async () => m.connection }),
  },
  PushContent: {
    init: vi.fn(),
    findById: async (id: string) =>
      m.separatePapers ? m.paperSources.get(id) : m.current,
    findOneAndUpdate: async (q: any, u: any) => {
      if (m.separatePapers) {
        m.paperSources.set(q._id, { ...u.$set });
        return m.paperSources.get(q._id);
      }
      return (m.current = { ...u.$set });
    },
  },
  PushRequest: {
    init: vi.fn(),
    find: (q: any) => ({
      sort: (sort: Record<string, number>) => ({
        limit: async (limit: number) =>
          m.requests
            .filter(
              (r) =>
                q.state.$in.includes(r.state) &&
                (!r.nextCheckAt ||
                  new Date(r.nextCheckAt) <= q.nextCheckAt.$lte)
            )
            .sort((a, b) => {
              for (const [field, direction] of Object.entries(sort)) {
                const left = a[field] instanceof Date ? +a[field] : a[field];
                const right = b[field] instanceof Date ? +b[field] : b[field];
                if (left < right) return -direction;
                if (left > right) return direction;
              }
              return 0;
            })
            .slice(0, limit),
      }),
    }),
    updateOne: async (q: any, u: any) =>
      Object.assign(
        m.requests.find((r) => r._id === q._id),
        u.$set
      ),
  },
  PushDelivery: {
    init: vi.fn(),
    find: async (q: any) =>
      [...m.deliveries.values()].filter((d) => d.requestId === q.requestId),
    updateOne: async (q: any, u: any) => {
      if (!m.deliveries.has(q._id))
        m.deliveries.set(q._id, {
          _id: q._id,
          ...u.$setOnInsert,
          state: "pending",
          attempts: 0,
          save: async () => {},
        });
    },
  },
  PushEvent: {
    init: vi.fn(),
    find: () => ({
      sort: () => ({
        limit: async () =>
          [...m.events.values()].filter((e) => e.state === "pending"),
      }),
    }),
    updateOne: async (q: any, u: any) => {
      if (!m.events.has(q._id))
        m.events.set(q._id, {
          _id: q._id,
          ...u.$setOnInsert,
          state: "pending",
          attempts: 0,
        });
      const e = m.events.get(q._id);
      Object.assign(e, u.$set);
      if (u.$inc) e.attempts += u.$inc.attempts;
    },
  },
}));
import { ApiError } from "@internetderdinge/api";
import {
  startIntegrationPushWorker,
  confirmsVersion,
  processPushRequests,
  deliverPushEvents,
} from "../../src/integrationPush/worker.js";
const req = () => ({
  _id: "request",
  connectionId: "connection",
  connectionGeneration: "generation",
  paperId: "paper",
  messageId: "one",
  text: "Hello",
  source: "trusted",
  state: "accepted",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 86400_000),
});
beforeEach(() => {
  vi.resetAllMocks();
  m.connection = {
    _id: "connection",
    source: "trusted",
    generation: "generation",
    callbackUrl: "https://integration.example/status",
    callbackToken: "secret",
  };
  m.separatePapers = false;
  m.paperSources.clear();
  m.requests = [req()];
  m.current = null;
  m.deliveries.clear();
  m.events.clear();
  m.devices = [
    { _id: "kitchen", deviceId: "serial1" },
    { _id: "living", deviceId: "serial2" },
  ];
  m.authorize.mockResolvedValue({ _id: "paper", organization: "org" });
  m.status.mockResolvedValue({ fileVersion: Date.now() - 60000 });
  m.upload.mockResolvedValue({
    uploadSingleImageResult: { uploadFailed: false },
  });
});
it("publishes one paper source and prepares all its assigned frames independently", async () => {
  await processPushRequests();
  expect(m.current).toMatchObject({ revision: "request", text: "Hello" });
  expect(m.upload).toHaveBeenCalledTimes(2);
  expect([...m.deliveries.values()].map((d) => d.state)).toEqual([
    "prepared",
    "prepared",
  ]);
  await processPushRequests();
  expect(m.upload).toHaveBeenCalledTimes(2);
});
it("never confirms an old version or another source's upload", () => {
  const startedAt = new Date("2026-09-20T10:00:00Z");
  const time = startedAt.getTime();
  const d = { startedAt, previousFileVersion: time - 60000 };
  const status = {
    pictureSynced: true,
    fileVersion: time,
    lastReachableAgo: time + 1000,
  };
  const latest = {
    startedAt,
    status: "uploaded",
    triggerMetadata: { integrationRevision: "request" },
  };
  expect(confirmsVersion(d, status, latest, "request")).toBe(true);
  expect(
    confirmsVersion(d, { ...status, pictureSynced: false }, latest, "request")
  ).toBe(false);
  expect(
    confirmsVersion(
      d,
      { ...status, fileVersion: time - 60000 },
      latest,
      "request"
    )
  ).toBe(false);
  expect(confirmsVersion(d, status, latest, "another")).toBe(false);
});
it("keeps callback events pending on outage and uses the same event ID for retries", async () => {
  await processPushRequests();
  const ids = [...m.events.keys()];
  m.send.mockRejectedValue(new Error("offline"));
  await deliverPushEvents();
  expect(
    [...m.events.values()].every(
      (e) => e.state === "pending" && e.attempts === 1
    )
  ).toBe(true);
  m.send.mockResolvedValue(undefined);
  await deliverPushEvents();
  expect([...m.events.keys()]).toEqual(ids);
  expect([...m.events.values()].every((e) => e.state === "sent")).toBe(true);
});
it("does not overwrite newer content when an older request is retried", async () => {
  m.current = {
    revision: "newer",
    receivedAt: new Date(Date.now() + 1000),
    text: "New",
  };
  await processPushRequests();
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.current.text).toBe("New");
  expect(m.requests[0].state).toBe("superseded");
});
it("does not deliver to a removed member or send callbacks after revocation", async () => {
  m.authorize.mockRejectedValue(new ApiError(403, "revoked"));
  await processPushRequests();
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.requests[0].state).toBe("revoked");
  m.events.set("event", {
    connectionId: "connection",
    state: "pending",
    _id: "event",
  });
  await deliverPushEvents();
  expect(m.send).not.toHaveBeenCalled();
  expect(m.events.get("event").state).toBe("cancelled");
});

it("queued content from a former integration must not run after connection reuse", async () => {
  m.connection = {
    _id: "connection",
    source: "new-integration",
    generation: "new-generation",
    revoked: false,
    callbackUrl: "https://new.example/status",
    callbackToken: "new-secret",
  };
  m.requests[0].source = "former-integration";
  await processPushRequests();
  expect(m.upload).not.toHaveBeenCalled();
});
it("old pending callbacks must not go to the newly connected provider", async () => {
  m.connection = {
    _id: "connection",
    source: "new-integration",
    generation: "new-generation",
    revoked: false,
    callbackUrl: "https://new.example/status",
    callbackToken: "new-secret",
  };
  m.events.set("old-event", {
    _id: "old-event",
    connectionId: "connection",
    state: "pending",
    connectionGeneration: "generation",
    source: "trusted",
    payload: {
      paperId: "paper",
      frameName: "Old private frame name",
      messageId: "old-provider-message",
    },
  });
  await deliverPushEvents();
  expect(m.send).not.toHaveBeenCalled();
});
it("does not mistake a renderer API error for revoked connection access", async () => {
  m.upload.mockRejectedValue(new ApiError(400, "Invalid render input"));
  for (let attempt = 0; attempt < 4; attempt++) {
    m.requests[0].nextCheckAt = new Date(0);
    await processPushRequests();
  }
  expect(m.requests[0].state).toBe("active");
  expect([...m.deliveries.values()].map((delivery) => delivery.state)).toEqual([
    "failed",
    "failed",
  ]);
});
it("the 41st paper must make progress under 40 active older papers", async () => {
  vi.useFakeTimers();
  try {
    const now = Date.now();
    m.devices = [];
    m.separatePapers = true;
    m.paperSources.clear();
    m.requests = Array.from({ length: 41 }, (_, i) => ({
      ...req(),
      _id: `request-${i}`,
      paperId: `paper-${i}`,
      state: i === 40 ? "accepted" : "active",
      createdAt: new Date(now - 3600000 + i),
      nextCheckAt: new Date(now),
    }));
    for (let sweep = 0; sweep < 10; sweep++) {
      await processPushRequests();
      vi.advanceTimersByTime(30000);
    }
    expect(m.requests[40].state).toBe("active");
  } finally {
    m.separatePapers = false;
    vi.useRealTimers();
  }
});

it("does not revive an old request after reconnecting the same provider", async () => {
  m.connection.generation = "reconnected";
  await processPushRequests();
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.current).toBeNull();
  expect(m.requests[0].state).toBe("revoked");
});
it("rejects unversioned legacy callbacks", async () => {
  m.events.set("legacy", {
    _id: "legacy",
    connectionId: "connection",
    source: "trusted",
    state: "pending",
  });
  await deliverPushEvents();
  expect(m.send).not.toHaveBeenCalled();
  expect(m.events.get("legacy").state).toBe("cancelled");
});
it("checks the connection generation again before uploading", async () => {
  m.status.mockImplementationOnce(async () => {
    m.connection.generation = "reconnected";
    return {};
  });
  await processPushRequests();
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.requests[0].state).toBe("revoked");
});
it("retries a request after a temporary authorization outage recovers", async () => {
  m.authorize.mockRejectedValueOnce(new Error("database unavailable"));
  await processPushRequests();
  expect(m.requests[0].state).toBe("accepted");
  expect(m.upload).not.toHaveBeenCalled();
  m.requests[0].nextCheckAt = new Date(0);
  await processPushRequests();
  expect(m.upload).toHaveBeenCalledTimes(2);
  expect(m.requests[0].state).toBe("active");
});

it("continues image processing while a callback in the separate queue is stalled", async () => {
  await startIntegrationPushWorker();
  const callbackSweep = [...m.sweeps.entries()].find(([name]) =>
    name.endsWith("Callbacks")
  )![1];
  const contentSweep = [...m.sweeps.entries()].find(
    ([name]) => !name.endsWith("Callbacks")
  )![1];
  m.events.set("event", {
    _id: "event",
    connectionId: "connection",
    connectionGeneration: "generation",
    source: "trusted",
    state: "pending",
    attempts: 0,
  });
  m.send.mockImplementationOnce(() => new Promise(() => {}));
  void callbackSweep();
  await vi.waitFor(() => expect(m.send).toHaveBeenCalledOnce());
  await contentSweep();
  expect(m.upload).toHaveBeenCalledTimes(2);
});
it("retries a callback after a temporary authorization outage recovers", async () => {
  m.events.set("event", {
    _id: "event",
    connectionId: "connection",
    connectionGeneration: "generation",
    source: "trusted",
    state: "pending",
    attempts: 0,
  });
  m.authorize.mockRejectedValueOnce(new Error("database unavailable"));
  await deliverPushEvents();
  expect(m.events.get("event").state).toBe("pending");
  expect(m.send).not.toHaveBeenCalled();
  expect(+m.events.get("event").nextAttemptAt).toBeGreaterThan(Date.now());
  await deliverPushEvents();
  expect(m.send).toHaveBeenCalledOnce();
  expect(m.events.get("event").state).toBe("sent");
});
