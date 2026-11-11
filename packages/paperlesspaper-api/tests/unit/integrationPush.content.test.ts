import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
const m = vi.hoisted(() => ({
  requests: new Map<string, any>(),
  upload: vi.fn(),
  current: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@internetderdinge/api", () => ({
  ApiError: class extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
  getSignedFileUrl: m.sign,
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = m.upload;
  },
  PutObjectCommand: class {
    constructor(public input: any) {}
  },
}));
vi.mock("../../src/integrationPush/access.js", () => ({
  integrationIdentity: (paper: any) => ({ source: paper.source }),
}));
vi.mock("../../src/integrationPush/models.js", () => ({
  PushContent: { findById: m.current },
  PushRequest: {
    findById: async (id: string) => m.requests.get(id),
    findOneAndUpdate: async (filter: any, update: any) => {
      let entry = m.requests.get(filter._id);
      if (!entry && update.$setOnInsert) {
        entry = { _id: filter._id, ...update.$setOnInsert };
        m.requests.set(filter._id, entry);
      }
      if (filter.state && entry?.state !== filter.state) return null;
      Object.assign(entry, update.$set);
      return entry;
    },
  },
}));
import {
  acceptContent,
  getIntegrationRenderContent,
} from "../../src/integrationPush/content.js";
const connection = {
  _id: "connection",
  paperId: "paper",
  source: "trusted",
  generation: "generation",
};
beforeEach(() => {
  m.requests.clear();
  vi.clearAllMocks();
});
it("stores content per paper and makes retried message IDs idempotent", async () => {
  const first = await acceptContent(connection, {
    messageId: "one",
    text: "Hallo",
  });
  expect(first).toMatchObject({
    paperId: "paper",
    text: "Hallo",
    state: "accepted",
  });
  expect(
    await acceptContent(connection, { messageId: "one", text: "Hallo" })
  ).toBe(first);
  await expect(
    acceptContent(connection, { messageId: "one", text: "Changed" })
  ).rejects.toMatchObject({ statusCode: 409 });
});
it("normalizes real photos and stores them privately before acknowledging", async () => {
  const photo = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  const result = await acceptContent(connection, {
    messageId: "photo",
    imageBase64: photo.toString("base64"),
    text: "Caption",
  });
  const uploaded = m.upload.mock.calls[0][0].input;
  expect(uploaded.Key).toBe(result.imageKey);
  expect(uploaded.ACL).toBeUndefined();
  expect(await sharp(uploaded.Body).metadata()).toMatchObject({
    width: 1600,
    height: 800,
    format: "png",
  });
  await acceptContent(connection, {
    messageId: "photo",
    imageBase64: photo.toString("base64"),
    text: "Caption",
  });
  expect(m.upload).toHaveBeenCalledTimes(1);
});
it("rejects empty, malformed and disguised images", async () => {
  await expect(
    acceptContent(connection, { messageId: "empty", text: " " })
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(
    acceptContent(connection, { messageId: "invalid", imageBase64: "!" })
  ).rejects.toMatchObject({ statusCode: 400 });
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
  );
  await expect(
    acceptContent(connection, {
      messageId: "svg",
      imageBase64: svg.toString("base64"),
    })
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(m.upload).not.toHaveBeenCalled();
});
it("does not disclose stored content when a paper changes renderer", async () => {
  m.current.mockResolvedValue({
    source: "trusted",
    text: "Private",
    revision: "one",
    imageKey: "photo.png",
  });
  m.sign.mockResolvedValue("https://private.example/signed");
  expect(
    await getIntegrationRenderContent({ _id: "paper", source: "other" })
  ).toBeUndefined();
  expect(m.sign).not.toHaveBeenCalled();
  expect(
    await getIntegrationRenderContent({ _id: "paper", source: "trusted" })
  ).toMatchObject({
    revision: "one",
    text: "Private",
    imageUrl: "https://private.example/signed",
  });
});

it("scopes message idempotency to the connection generation", async () => {
  const old = await acceptContent(connection, {
    messageId: "one",
    text: "Before reconnect",
  });
  const current = await acceptContent(
    { ...connection, generation: "next" },
    { messageId: "one", text: "After reconnect" }
  );
  expect(current._id).not.toBe(old._id);
  expect(current.connectionGeneration).toBe("next");
});
it("requires reconnecting legacy connections", async () => {
  await expect(
    acceptContent(
      { ...connection, generation: undefined },
      { messageId: "one", text: "Hello" }
    )
  ).rejects.toMatchObject({ statusCode: 401 });
  expect(m.requests.size).toBe(0);
});

it("resumes a partially received photo after storage recovers", async () => {
  const imageBase64 = (
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
  const input = { messageId: "retry-photo", imageBase64, text: "Caption" };
  m.upload.mockRejectedValueOnce(new Error("S3 unavailable"));
  await expect(acceptContent(connection, input)).rejects.toThrow(
    "S3 unavailable"
  );
  const pending = [...m.requests.values()][0];
  expect(pending.state).toBe("receiving");
  const accepted = await acceptContent(connection, input);
  expect(accepted._id).toBe(pending._id);
  expect(accepted.state).toBe("accepted");
  expect(m.requests.size).toBe(1);
});
