vi.mock("../../src/storage/storage.service.js", () => ({
  getStorageUsage: vi.fn(),
}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  createPaper: vi.fn(),
  updateById: vi.fn(),
  updateGoogleCalendarEvents: vi.fn(),
}));

vi.mock("@internetderdinge/api", () => ({
  catchAsync: (handler: unknown) => handler,
  ApiError: Error,
  Token: {},
  createToken: vi.fn(),
  devicesService: {},
  iotDevicesService: {},
  pick: vi.fn(),
}));
vi.mock("../../src/papers/papers.service", () => ({ default: mocks }));
vi.mock("../../src/papers/googleCalendar.service", () => ({
  default: {
    paperRequiresGoogleCalendar: () => true,
    updateGoogleCalendarEvents: mocks.updateGoogleCalendarEvents,
  },
}));
vi.mock("../../src/render/render.service", () => ({ default: {} }));
vi.mock("../../src/iotdevice/iotdevice.service", () => ({ default: {} }));
vi.mock("epdoptimize", () => ({ aitjcizeSpectra6Palette: vi.fn() }));

import {
  createEntry,
  getCalendarPreview,
  updateEntry,
} from "../../src/papers/papers.controller";

const tokens = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
};

describe("Calendar authorization code lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({
      _id: "paper-id",
      meta: { code: "already-consumed-code", googleCalendar: tokens },
    });
    mocks.updateGoogleCalendarEvents.mockResolvedValue({
      calendarAuth: tokens,
      calendarData: { calendars: [], events: [] },
    });
    mocks.createPaper.mockImplementation(async (paper) => paper);
    mocks.updateById.mockImplementation(async (_id, paper) => paper);
  });

  const response = () => {
    const res = { send: vi.fn(), status: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  it("previews with existing tokens without replaying a legacy stored code", async () => {
    await getCalendarPreview(
      { params: { paperId: "paper-id" }, body: {} } as any,
      response() as any,
      vi.fn()
    );
    expect(mocks.updateGoogleCalendarEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          code: undefined,
          googleCalendar: tokens,
        }),
      })
    );
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("still exchanges a freshly supplied reauthorization code", async () => {
    await getCalendarPreview(
      { params: { paperId: "paper-id" }, body: { code: "fresh-code" } } as any,
      response() as any,
      vi.fn()
    );
    expect(mocks.updateGoogleCalendarEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ code: "fresh-code" }),
      })
    );
  });

  it.each(["create", "update"])(
    "does not retain the single-use code after %s",
    async (operation) => {
      const request = {
        params: { paperId: "paper-id" },
        body: {
          meta: { code: "fresh-code", selectedCalendars: { demo: true } },
        },
      };
      const handler = operation === "create" ? createEntry : updateEntry;
      await handler(request as any, response() as any, vi.fn());
      expect(mocks.updateGoogleCalendarEvents).toHaveBeenCalledWith(
        request.body
      );
      const saved =
        operation === "create"
          ? mocks.createPaper.mock.calls[0][0]
          : mocks.updateById.mock.calls[0][1];
      expect(saved.meta.code).toBeUndefined();
      expect(saved.meta.googleCalendar).toEqual(tokens);
      expect(saved.meta.selectedCalendars).toEqual({ demo: true });
    }
  );
});
