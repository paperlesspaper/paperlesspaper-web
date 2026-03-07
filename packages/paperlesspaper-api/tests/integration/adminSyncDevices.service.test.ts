import { describe, expect, it, vi, beforeEach } from "vitest";

const deviceFindMock = vi.fn();
const deviceCountDocumentsMock = vi.fn();
const getDeviceStatusListMock = vi.fn();

vi.mock("@internetderdinge/api", () => {
  return {
    Device: {
      find: deviceFindMock,
      countDocuments: deviceCountDocumentsMock,
    },
    Organization: {},
    User: {},
    iotDevicesService: {
      getDeviceStatusList: getDeviceStatusListMock,
    },
    auth0: {
      users: {
        getAll: vi.fn(),
      },
    },
  };
});

type QueryChain<T> = {
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
  rows: T[];
};

const createQueryChain = <T>(rows: T[]): QueryChain<T> => {
  const chain = {
    rows,
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(async () => rows),
  } as QueryChain<T>;

  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  return chain;
};

describe("admin sync device services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginates and filters admin devices by updatedSince", async () => {
    const rows = [
      {
        _id: "device-1",
        deviceId: "dev-1",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ];

    const queryChain = createQueryChain(rows);
    deviceFindMock.mockReturnValue(queryChain);
    deviceCountDocumentsMock.mockResolvedValue(3);

    const { getAdminDevices } =
      await import("../../src/admin/adminSearch.service");

    const result = await getAdminDevices({
      page: 2,
      perPage: 1,
      updatedSince: "2026-02-01T00:00:00.000Z",
    });

    expect(deviceFindMock).toHaveBeenCalledWith({
      updatedAt: { $gte: new Date("2026-02-01T00:00:00.000Z") },
    });
    expect(queryChain.sort).toHaveBeenCalledWith({ updatedAt: -1 });
    expect(queryChain.skip).toHaveBeenCalledWith(1);
    expect(queryChain.limit).toHaveBeenCalledWith(1);

    expect(result.page).toBe(2);
    expect(result.perPage).toBe(1);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.results).toHaveLength(1);
  });

  it("filters and paginates iot devices in memory", async () => {
    getDeviceStatusListMock.mockResolvedValue([
      {
        id: "recent",
        updatedAt: "2026-03-04T00:00:00.000Z",
      },
      {
        id: "old",
        updatedAt: "2026-01-10T00:00:00.000Z",
      },
      {
        id: "without-date",
      },
    ]);

    const { getAdminIotDevices } =
      await import("../../src/admin/adminSearch.service");

    const result = await getAdminIotDevices({
      page: 1,
      perPage: 2,
      updatedSince: "2026-02-01T00:00:00.000Z",
    });

    expect(getDeviceStatusListMock).toHaveBeenCalledTimes(1);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.total).toBe(2);
    expect(result.results.map((entry) => entry.id)).toEqual([
      "recent",
      "without-date",
    ]);
  });
});
