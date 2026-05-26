import { expect, test } from "@playwright/test";
import {
  createTemporaryOrganization,
  maybeDeleteOrganization,
} from "./utils/app";
import { apiJson } from "./utils/api";

type OrganizationRole = "admin" | "user";

type ApiRecord = {
  id?: string;
  _id?: string;
};

type UserRecord = ApiRecord & {
  owner?: string;
  role?: OrganizationRole | "patient";
  category?: string;
  organization?: string;
  meta?: Record<string, unknown>;
};

type DeviceRecord = ApiRecord & {
  organization?: string;
  patient?: string | null;
  kind?: string;
  meta?: Record<string, unknown>;
};

type Paginated<T> = {
  results: T[];
};

function recordId(record: ApiRecord, label: string): string {
  const id = record.id ?? record._id;

  expect(id, `${label} should include an id`).toBeTruthy();
  return id!;
}

test.describe("Role permission matrix", () => {
  let createdOrganizationId: string | undefined;
  let currentUserId: string | undefined;
  let managedUserId: string | undefined;
  let patientUserId: string | undefined;
  let deviceId: string | undefined;

  async function setCurrentRole(
    page: Parameters<typeof apiJson>[0],
    request: Parameters<typeof apiJson>[1],
    role: OrganizationRole,
  ) {
    if (!createdOrganizationId || !currentUserId) {
      throw new Error("Cannot set role before organization and current user exist.");
    }

    return apiJson<UserRecord>(page, request, `/users/${currentUserId}`, {
      method: "PATCH",
      data: {
        organization: createdOrganizationId,
        role,
      },
    });
  }

  test.afterEach(async ({ page, request }) => {
    if (createdOrganizationId && currentUserId) {
      await setCurrentRole(page, request, "admin");
    }

    if (deviceId) {
      await apiJson(page, request, `/devices/${deviceId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
      deviceId = undefined;
    }

    for (const userId of [managedUserId, patientUserId]) {
      if (!userId) continue;

      await apiJson(page, request, `/users/${userId}`, {
        method: "DELETE",
        expectedStatus: [200, 404],
      });
    }
    managedUserId = undefined;
    patientUserId = undefined;

    if (createdOrganizationId) {
      await maybeDeleteOrganization(page, createdOrganizationId);
      createdOrganizationId = undefined;
    }
    currentUserId = undefined;
  });

  test("admin and user can manage organization users and devices", async ({
    page,
    request,
  }) => {
    createdOrganizationId = await createTemporaryOrganization(page);

    const currentUser = await apiJson<UserRecord>(
      page,
      request,
      `/users/current?organization=${createdOrganizationId}`,
    );
    currentUserId = recordId(currentUser, "Current user");

    const managedUser = await apiJson<UserRecord>(page, request, "/users", {
      method: "POST",
      data: {
        organization: createdOrganizationId,
        role: "user",
        category: "relative",
        meta: {
          firstName: "Managed",
          lastName: "User",
        },
      },
      expectedStatus: 201,
    });
    managedUserId = recordId(managedUser, "Managed user");

    const patientUser = await apiJson<UserRecord>(page, request, "/users", {
      method: "POST",
      data: {
        organization: createdOrganizationId,
        role: "patient",
        category: "patient",
        meta: {
          firstName: "Matrix",
          lastName: "Patient",
        },
      },
      expectedStatus: 201,
    });
    patientUserId = recordId(patientUser, "Patient user");

    await setCurrentRole(page, request, "admin");

    const createdDevice = await apiJson<DeviceRecord>(page, request, "/devices", {
      method: "POST",
      data: {
        organization: createdOrganizationId,
        patient: patientUserId,
        kind: "paper-display",
      },
      expectedStatus: 201,
    });
    deviceId = recordId(createdDevice, "Device");

    const roleMatrix: Array<{
      role: OrganizationRole;
      canManageDevices: boolean;
      canSeeOtherUsers: boolean;
      canSeeOtherPatientDevices: boolean;
    }> = [
      {
        role: "admin",
        canManageDevices: true,
        canSeeOtherUsers: true,
        canSeeOtherPatientDevices: true,
      },
      {
        role: "user",
        canManageDevices: true,
        canSeeOtherUsers: true,
        canSeeOtherPatientDevices: true,
      },
    ];

    for (const matrix of roleMatrix) {
      await setCurrentRole(page, request, matrix.role);

      const users = await apiJson<Paginated<UserRecord>>(
        page,
        request,
        `/users?organization=${createdOrganizationId}`,
      );
      const visibleUserIds = users.results.map((user) =>
        recordId(user, "Listed user"),
      );

      expect(visibleUserIds).toContain(currentUserId);
      expect(visibleUserIds.includes(managedUserId)).toBe(
        matrix.canSeeOtherUsers,
      );
      expect(visibleUserIds.includes(patientUserId)).toBe(
        matrix.canSeeOtherUsers,
      );

      const devices = await apiJson<Paginated<DeviceRecord>>(
        page,
        request,
        `/devices?organization=${createdOrganizationId}`,
      );
      const visibleDeviceIds = devices.results.map((device) =>
        recordId(device, "Listed device"),
      );
      expect(visibleDeviceIds.includes(deviceId)).toBe(
        matrix.canSeeOtherPatientDevices,
      );

      await apiJson(page, request, `/devices/${deviceId}`, {
        method: "PATCH",
        data: {
          organization: createdOrganizationId,
          meta: {
            name: `${matrix.role} updated display`,
          },
        },
        expectedStatus: matrix.canManageDevices ? 200 : 403,
      });

      const createAttempt = await apiJson<DeviceRecord>(
        page,
        request,
        "/devices",
        {
          method: "POST",
          data: {
            organization: createdOrganizationId,
            patient: patientUserId,
            kind: "paper-display",
          },
          expectedStatus: matrix.canManageDevices ? 201 : 403,
        },
      );

      if (matrix.canManageDevices) {
        const extraDeviceId = recordId(createAttempt, "Extra device");
        await apiJson(page, request, `/devices/${extraDeviceId}`, {
          method: "DELETE",
          expectedStatus: 200,
        });
      }
    }
  });
});
