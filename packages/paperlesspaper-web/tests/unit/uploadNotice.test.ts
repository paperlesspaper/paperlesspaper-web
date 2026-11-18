// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.restoreAllMocks();
});
const notice = {
  organization: "org",
  frameIds: ["frame"],
  addedToSlideshow: false,
};
it("shows uploads 1 through 10, hides 11, and persists the limit across reloads", async () => {
  let store = await import("../../src/helpers/uploadNotice");
  for (let i = 1; i <= 10; i++) {
    store.recordSuccessfulUpload("alice", notice);
    expect(store.getUploadNotice("alice"), `upload ${i}`).toEqual(notice);
  }
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toBeUndefined();
  vi.resetModules();
  store = await import("../../src/helpers/uploadNotice");
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toBeUndefined();
  store.recordSuccessfulUpload("bob", notice);
  expect(store.getUploadNotice("bob")).toEqual(notice);
});
it("dismissal clears the hint without resetting the counter or replaying on reload", async () => {
  let store = await import("../../src/helpers/uploadNotice");
  for (let i = 0; i < 9; i++) store.recordSuccessfulUpload("alice", notice);
  store.dismissUploadNotice("alice");
  expect(store.getUploadNotice("alice")).toBeUndefined();
  vi.resetModules();
  store = await import("../../src/helpers/uploadNotice");
  expect(store.getUploadNotice("alice")).toBeUndefined();
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toEqual(notice);
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toBeUndefined();
});
it("retains the session limit if browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  const store = await import("../../src/helpers/uploadNotice");
  for (let i = 0; i < 10; i++) store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toEqual(notice);
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toBeUndefined();
});
it("does not create anonymous hints and treats corrupted counters as exhausted", async () => {
  const store = await import("../../src/helpers/uploadNotice");
  store.recordSuccessfulUpload(undefined, notice);
  expect(localStorage.length).toBe(0);
  localStorage.setItem("paperlesspaper:upload-notice:v1:alice", "NaN");
  store.recordSuccessfulUpload("alice", notice);
  expect(store.getUploadNotice("alice")).toBeUndefined();
});
