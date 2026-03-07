import mongoose from "mongoose";
import {
  Device,
  Organization,
  User,
  iotDevicesService,
} from "@internetderdinge/api";
import { auth0 } from "@internetderdinge/api";

type SearchParams = {
  search: string;
  limit: number;
};

type OrganizationResult = {
  id: string;
  name?: string;
  kind?: string;
};

type UserResult = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  organization?: OrganizationResult;
};

type DeviceResult = {
  id: string;
  name?: string;
  deviceId?: string;
  kind?: string;
  timezone?: string;
  eventDate?: string;
  createdAt?: string;
  updatedAt?: string;
  serialNumber?: string;
  paymentId?: string;
  batteryStatus?: string;
  batteryLevel?: number;
  lastReachableAgo?: string;
  organization?: OrganizationResult;
  patient?: {
    id: string;
    name?: string;
  };
};

export type AdminSearchResponse = {
  query: string;
  organizations: OrganizationResult[];
  users: UserResult[];
  devices: DeviceResult[];
  total: number;
  tookMs: number;
};

export type AdminStatsResponse = {
  users: number;
  auth0Users: number;
  devices: number;
  organizations: number;
  total: number;
  tookMs: number;
};

export type AdminIotDevicesResponse = {
  results: Array<Record<string, unknown>>;
  page: number;
  perPage: number;
  totalPages: number;
  total: number;
  tookMs: number;
};

export type AdminDevicesResponse = {
  results: Array<Record<string, unknown>>;
  page: number;
  perPage: number;
  totalPages: number;
  total: number;
  tookMs: number;
};

type AdminListQuery = {
  page: number;
  perPage: number;
  updatedSince: string | null;
};

const toRegex = (search: string): RegExp => {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
};

const getNestedString = (
  source: Record<string, unknown> | undefined,
  path: string,
): string | undefined => {
  const value = path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, source);

  return typeof value === "string" ? value : undefined;
};

const getFirstNestedString = (
  source: Record<string, unknown> | undefined,
  paths: string[],
): string | undefined => {
  for (const path of paths) {
    const value = getNestedString(source, path);
    if (value) {
      return value;
    }
  }
  return undefined;
};

const userMetaEmailPaths = [
  "email",
  "data.email",
  "user_metadata.email",
  "app_metadata.email",
  "auth0.email",
  "auth0.data.email",
  "auth0.user_metadata.email",
  "auth0.app_metadata.email",
];

const scoreMatch = (
  search: string,
  candidates: Array<string | undefined>,
): number => {
  const query = search.trim().toLowerCase();
  let score = 0;

  for (const rawCandidate of candidates) {
    const candidate = rawCandidate?.toLowerCase().trim();
    if (!candidate) {
      continue;
    }
    if (candidate === query) {
      score = Math.max(score, 100);
      continue;
    }
    if (candidate.startsWith(query)) {
      score = Math.max(score, 70);
      continue;
    }
    if (candidate.includes(query)) {
      score = Math.max(score, 40);
    }
  }

  return score;
};

const sortByScore = <T extends { score: number }>(
  items: T[],
  limit: number,
): T[] => {
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
};

type ScoredUserResult = UserResult & { score: number };

const AUTH0_COUNT_PAGE_SIZE = 100;
const MAX_AUTH0_COUNT_PAGES = 10;

type Auth0TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type Auth0TotalUsersResponse = {
  total?: number;
};

let cachedAuth0ManagementToken: string | null = null;
let cachedAuth0ManagementTokenExpiresAt: number | null = null;

const getAuth0ManagementDomainUrl = (): string | null => {
  const raw = process.env.AUTH0_MANAGEMENT_DOMAIN;
  if (!raw) {
    return null;
  }

  const normalized =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;

  try {
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return normalized;
  }
};

const getAuth0ManagementTokenDirect = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (
    cachedAuth0ManagementToken &&
    cachedAuth0ManagementTokenExpiresAt &&
    now < cachedAuth0ManagementTokenExpiresAt - 60
  ) {
    return cachedAuth0ManagementToken;
  }

  const domainUrl = getAuth0ManagementDomainUrl();
  const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
  const audience = process.env.AUTH0_MANAGEMENT_AUDIENCE;

  if (!domainUrl || !clientId || !clientSecret || !audience) {
    throw new Error("Missing Auth0 Management API credentials in environment.");
  }

  const response = await fetch(`${domainUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth0 token request failed (${response.status}).`);
  }

  const payload = (await response.json()) as Auth0TokenResponse;
  if (!payload.access_token) {
    throw new Error("Auth0 token response did not include access_token.");
  }

  const expiresIn = payload.expires_in ?? 3600;
  cachedAuth0ManagementToken = payload.access_token;
  cachedAuth0ManagementTokenExpiresAt = now + expiresIn;

  return cachedAuth0ManagementToken;
};

const getAuth0UsersTotalViaManagementApi = async (): Promise<number> => {
  const domainUrl = getAuth0ManagementDomainUrl();
  if (!domainUrl) {
    throw new Error("Missing AUTH0_MANAGEMENT_DOMAIN in environment.");
  }

  const token = await getAuth0ManagementTokenDirect();
  const response = await fetch(
    `${domainUrl}/api/v2/users?page=0&per_page=1&include_totals=true`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Auth0 users total request failed (${response.status}).`);
  }

  const payload = (await response.json()) as Auth0TotalUsersResponse;
  if (typeof payload.total !== "number" || !Number.isFinite(payload.total)) {
    throw new Error("Auth0 users response did not include a valid total.");
  }

  return payload.total;
};

const getUsersFromAuth0Response = (
  auth0Response: unknown,
): Array<Record<string, unknown>> => {
  if (Array.isArray(auth0Response)) {
    return auth0Response as Array<Record<string, unknown>>;
  }

  if (
    auth0Response &&
    typeof auth0Response === "object" &&
    Symbol.iterator in (auth0Response as Record<string, unknown>)
  ) {
    return Array.from(auth0Response as Iterable<Record<string, unknown>>);
  }

  if (Array.isArray((auth0Response as { data?: unknown[] })?.data)) {
    return (auth0Response as { data: unknown[] }).data as Array<
      Record<string, unknown>
    >;
  }

  if (Array.isArray((auth0Response as { users?: unknown[] })?.users)) {
    return (auth0Response as { users: unknown[] }).users as Array<
      Record<string, unknown>
    >;
  }

  if (Array.isArray((auth0Response as { items?: unknown[] })?.items)) {
    return (auth0Response as { items: unknown[] }).items as Array<
      Record<string, unknown>
    >;
  }

  return [];
};

const getTotalFromAuth0Response = (
  auth0Response: unknown,
): number | undefined => {
  if (!auth0Response || typeof auth0Response !== "object") {
    return undefined;
  }

  const maybeNumber = (auth0Response as { total?: unknown }).total;
  if (typeof maybeNumber === "number" && Number.isFinite(maybeNumber)) {
    return maybeNumber;
  }

  const data = (auth0Response as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const nested = (data as { total?: unknown }).total;
    if (typeof nested === "number" && Number.isFinite(nested)) {
      return nested;
    }
  }

  return undefined;
};

const getAuth0UsersTotal = async (): Promise<number> => {
  try {
    return await getAuth0UsersTotalViaManagementApi();
  } catch (error) {
    console.warn(
      "Admin stats Auth0 total-users API failed, fallback to list",
      error,
    );
  }

  try {
    const seenUserIds = new Set<string>();
    let countByLength = 0;

    for (let page = 0; page < MAX_AUTH0_COUNT_PAGES; page += 1) {
      let response: unknown;
      try {
        response = await auth0.users.list({
          page,
          per_page: AUTH0_COUNT_PAGE_SIZE,
          include_totals: false,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";

        if (message.includes("invalid_paging")) {
          break;
        }

        throw error;
      }

      const users = getUsersFromAuth0Response(response);
      countByLength += users.length;

      for (const entry of users) {
        const userId =
          typeof entry.user_id === "string"
            ? entry.user_id
            : typeof entry.id === "string"
              ? entry.id
              : undefined;
        if (userId) {
          seenUserIds.add(userId);
        }
      }

      if (users.length < AUTH0_COUNT_PAGE_SIZE) {
        break;
      }
    }

    return seenUserIds.size > 0 ? seenUserIds.size : countByLength;
  } catch (error) {
    console.warn("Admin stats Auth0 total query failed", error);
    return 0;
  }
};

const normalizeEmail = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeDateString = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return undefined;
};

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
};

const buildUserResult = (
  search: string,
  user: Record<string, unknown>,
): ScoredUserResult => {
  const organizationData = user.organizationData as
    | Record<string, unknown>
    | undefined;
  const userMeta = user.meta as Record<string, unknown> | undefined;
  const firstName = user.meta
    ? (user.meta as Record<string, unknown>).firstName
    : undefined;
  const lastName = user.meta
    ? (user.meta as Record<string, unknown>).lastName
    : undefined;
  const metadataEmail = getFirstNestedString(userMeta, userMetaEmailPaths);

  return {
    score: scoreMatch(search, [
      user.name as string,
      user.email as string,
      metadataEmail,
      firstName as string,
      lastName as string,
      organizationData?.name as string,
    ]),
    id: String(user._id),
    name: user.name as string | undefined,
    email: (user.email as string | undefined) || metadataEmail,
    role: user.role as string | undefined,
    organization: organizationData
      ? {
          id: String(organizationData._id),
          name: organizationData.name as string | undefined,
          kind: organizationData.kind as string | undefined,
        }
      : undefined,
  };
};

const searchUsersInAuth0 = async (
  search: string,
  limit: number,
): Promise<ScoredUserResult[]> => {
  const trimmedSearch = search.trim();
  const escaped = search.replace(/"/g, '\\"');

  const auth0Query = [
    `email:"${escaped}"`,
    `user_metadata.email:"${escaped}"`,
    `app_metadata.email:"${escaped}"`,
    `email:*${escaped}*`,
  ].join(" OR ");

  try {
    let auth0ListResponse: unknown = [];
    try {
      auth0ListResponse = await auth0.users.list({
        search_engine: "v3",
        q: auth0Query,
        per_page: Math.min(limit * 2, 50),
        page: 0,
      });
    } catch (error) {
      console.warn("Admin search Auth0 list query failed", error);
    }

    let auth0ExactEmailResponse: unknown = [];
    if (trimmedSearch.includes("@")) {
      try {
        auth0ExactEmailResponse = await auth0.users.listUsersByEmail({
          email: trimmedSearch,
        });
      } catch (error) {
        console.warn("Admin search Auth0 exact-email query failed", error);
      }
    }

    const auth0UsersById = new Map<string, Record<string, unknown>>();
    for (const entry of [
      ...getUsersFromAuth0Response(auth0ListResponse),
      ...getUsersFromAuth0Response(auth0ExactEmailResponse),
    ]) {
      const userId =
        typeof entry.user_id === "string"
          ? entry.user_id
          : typeof entry.id === "string"
            ? entry.id
            : undefined;
      if (!userId) {
        continue;
      }
      auth0UsersById.set(userId, entry);
    }

    const auth0Users = Array.from(auth0UsersById.values());

    const auth0Ids = auth0Users
      .map((entry) =>
        typeof entry.user_id === "string" ? entry.user_id : undefined,
      )
      .filter((entry): entry is string => Boolean(entry));

    const auth0Emails = auth0Users
      .map((entry) => normalizeEmail(entry.email))
      .filter((entry): entry is string => Boolean(entry));

    if (!auth0Ids.length && !auth0Emails.length) {
      return [];
    }

    const filterOr: Array<Record<string, unknown>> = [];
    if (auth0Ids.length) {
      filterOr.push({ owner: { $in: auth0Ids } });
    }
    if (auth0Emails.length) {
      filterOr.push(
        { email: { $in: auth0Emails } },
        { "meta.email": { $in: auth0Emails } },
        { "meta.data.email": { $in: auth0Emails } },
      );
    }

    const mongoUsersRaw = await User.find({ $or: filterOr })
      .select("_id name email role organization owner meta")
      .populate("organizationData", "_id name kind")
      .limit(limit * 2)
      .lean<Array<Record<string, unknown>>>();

    const mongoUsers = mongoUsersRaw.map((user) =>
      buildUserResult(search, user),
    );

    const mappedOwners = new Set<string>(
      mongoUsersRaw
        .map((user) =>
          typeof user.owner === "string" ? (user.owner as string) : undefined,
        )
        .filter((entry): entry is string => Boolean(entry)),
    );

    const mappedEmails = new Set<string>();
    for (const user of mongoUsersRaw) {
      const topLevelEmail = normalizeEmail(user.email);
      if (topLevelEmail) {
        mappedEmails.add(topLevelEmail);
      }

      const meta = user.meta as Record<string, unknown> | undefined;
      const metaEmail = normalizeEmail(
        getFirstNestedString(meta, userMetaEmailPaths),
      );
      if (metaEmail) {
        mappedEmails.add(metaEmail);
      }
    }

    const auth0OnlyUsers: ScoredUserResult[] = auth0Users
      .map((entry) => {
        const userId =
          typeof entry.user_id === "string"
            ? entry.user_id
            : typeof entry.id === "string"
              ? entry.id
              : undefined;
        if (!userId) {
          return undefined;
        }

        const email = normalizeEmail(entry.email);
        const userMetadata = entry.user_metadata as
          | Record<string, unknown>
          | undefined;
        const appMetadata = entry.app_metadata as
          | Record<string, unknown>
          | undefined;
        const metadataEmail =
          normalizeEmail(userMetadata?.email) ||
          normalizeEmail(appMetadata?.email);
        const finalEmail = email || metadataEmail;

        if (mappedOwners.has(userId)) {
          return undefined;
        }
        if (finalEmail && mappedEmails.has(finalEmail)) {
          return undefined;
        }

        const name =
          (typeof entry.name === "string" && entry.name) ||
          (typeof entry.nickname === "string" && entry.nickname) ||
          finalEmail ||
          userId;

        return {
          id: `auth0:${userId}`,
          name,
          email: finalEmail,
          role: "auth0",
          score: scoreMatch(search, [
            name,
            finalEmail,
            userId,
            normalizeEmail(userMetadata?.email),
            normalizeEmail(appMetadata?.email),
          ]),
        };
      })
      .filter((entry): entry is ScoredUserResult => Boolean(entry));

    return [...mongoUsers, ...auth0OnlyUsers];
  } catch (error) {
    console.warn("Admin search Auth0 fallback failed", error);
    return [];
  }
};

export const searchAdminCollections = async ({
  search,
  limit,
}: SearchParams): Promise<AdminSearchResponse> => {
  const startedAt = Date.now();
  const regex = toRegex(search);
  const objectId = mongoose.Types.ObjectId.isValid(search)
    ? new mongoose.Types.ObjectId(search)
    : undefined;

  const organizationFilter: Record<string, unknown> = {
    $or: [{ name: regex }, { kind: regex }, { "meta.name": regex }],
  };

  const userFilter: Record<string, unknown> = {
    $or: [
      { name: regex },
      { email: regex },
      { owner: regex },
      { "meta.email": regex },
      { "meta.data.email": regex },
      { "meta.user_metadata.email": regex },
      { "meta.app_metadata.email": regex },
      { "meta.auth0.email": regex },
      { "meta.auth0.data.email": regex },
      { "meta.auth0.user_metadata.email": regex },
      { "meta.auth0.app_metadata.email": regex },
      { "meta.firstName": regex },
      { "meta.lastName": regex },
    ],
  };

  const deviceFilter: Record<string, unknown> = {
    $or: [
      { name: regex },
      { deviceId: regex },
      { kind: regex },
      { "meta.name": regex },
      { "meta.serialNumber": regex },
      { "payment.id": regex },
    ],
  };

  if (objectId) {
    (organizationFilter.$or as Array<Record<string, unknown>>).push({
      _id: objectId,
    });
    (userFilter.$or as Array<Record<string, unknown>>).push(
      { _id: objectId },
      { organization: objectId },
    );
    (deviceFilter.$or as Array<Record<string, unknown>>).push(
      { _id: objectId },
      { organization: objectId },
      { patient: objectId },
    );
  }

  const [organizationsRaw, usersRaw, devicesRaw] = await Promise.all([
    Organization.find(organizationFilter)
      .select("_id name kind")
      .limit(limit * 2)
      .lean<Array<Record<string, unknown>>>(),
    User.find(userFilter)
      .select("_id name email role organization meta")
      .populate("organizationData", "_id name kind")
      .limit(limit * 2)
      .lean<Array<Record<string, unknown>>>(),
    Device.find(deviceFilter)
      .select(
        "_id name deviceId kind timezone eventDate payment organization patient meta createdAt updatedAt",
      )
      .populate("organization", "_id name kind")
      .populate("patient", "_id name email meta")
      .limit(limit * 2)
      .lean<Array<Record<string, unknown>>>(),
  ]);

  const iotStatusByDeviceId = new Map<string, Record<string, unknown>>();
  await Promise.all(
    devicesRaw.map(async (device) => {
      const deviceId =
        typeof device.deviceId === "string" ? String(device.deviceId) : "";
      if (!deviceId) {
        return;
      }

      try {
        const iotStatus = await iotDevicesService.getDeviceStatus(
          deviceId,
          device.kind as string | undefined,
        );
        const normalized = toRecord(iotStatus);
        if (normalized) {
          iotStatusByDeviceId.set(deviceId, normalized);
        }
      } catch (error) {
        console.warn(`Admin search iot status failed for ${deviceId}`, error);
      }
    }),
  );

  const organizations = sortByScore(
    organizationsRaw.map((organization) => ({
      score: scoreMatch(search, [
        organization.name as string,
        organization.kind as string,
      ]),
      id: String(organization._id),
      name: organization.name as string | undefined,
      kind: organization.kind as string | undefined,
    })),
    limit,
  ).map(({ score, ...entry }) => entry);

  const mongoUsers = usersRaw.map((user) => buildUserResult(search, user));
  const shouldSearchAuth0 = search.includes("@") || search.includes(".");
  const auth0Users = shouldSearchAuth0
    ? await searchUsersInAuth0(search, limit)
    : [];

  const mergedUsers = new Map<string, ScoredUserResult>();
  for (const user of [...mongoUsers, ...auth0Users]) {
    const existing = mergedUsers.get(user.id);
    if (!existing || user.score > existing.score) {
      mergedUsers.set(user.id, user);
    }
  }

  const users = sortByScore(Array.from(mergedUsers.values()), limit).map(
    ({ score, ...entry }) => entry,
  );

  const devices = sortByScore(
    devicesRaw.map((device) => {
      const organizationData = device.organization as
        | Record<string, unknown>
        | undefined;
      const patientData = device.patient as Record<string, unknown> | undefined;
      const deviceMeta = device.meta as Record<string, unknown> | undefined;
      const iotStatus = toRecord(
        typeof device.deviceId === "string"
          ? iotStatusByDeviceId.get(String(device.deviceId))
          : undefined,
      );
      const patientMeta = patientData?.meta as
        | Record<string, unknown>
        | undefined;
      const patientName = patientData?.name
        ? String(patientData.name)
        : [patientMeta?.firstName, patientMeta?.lastName]
            .filter(Boolean)
            .join(" ");

      const batteryLevel =
        normalizeNumber(iotStatus?.batLevel) ??
        normalizeNumber(iotStatus?.batteryLevel) ??
        normalizeNumber(iotStatus?.battery) ??
        normalizeNumber(device.batLevel) ??
        normalizeNumber(deviceMeta?.batLevel) ??
        normalizeNumber(deviceMeta?.batteryLevel) ??
        normalizeNumber(deviceMeta?.battery);

      const batteryStatus =
        getFirstNestedString(iotStatus, [
          "batteryStatus",
          "battery.status",
          "status.battery",
        ]) ||
        getFirstNestedString(deviceMeta, [
          "batteryStatus",
          "battery.status",
          "status.battery",
        ]) ||
        (typeof batteryLevel === "number"
          ? batteryLevel < 3450
            ? "empty"
            : batteryLevel < 3500
              ? "low"
              : "ok"
          : undefined);

      const lastReachableAgo =
        normalizeDateString(iotStatus?.lastReachableAgo) ||
        normalizeDateString(iotStatus?.lastReachable) ||
        normalizeDateString(device.lastReachableAgo) ||
        getFirstNestedString(deviceMeta, [
          "lastReachableAgo",
          "reachability.last",
        ]);

      const serialNumber =
        getFirstNestedString(iotStatus, ["serialNumber", "serial", "sn"]) ||
        getFirstNestedString(deviceMeta, ["serialNumber"]);

      const signalStrength =
        normalizeNumber(iotStatus?.rssi) ??
        normalizeNumber(iotStatus?.signalStrength) ??
        normalizeNumber(iotStatus?.signal);

      return {
        score: scoreMatch(search, [
          device.deviceId as string,
          device.kind as string,
          device.name as string,
          serialNumber,
          batteryStatus,
          signalStrength !== undefined ? String(signalStrength) : undefined,
          organizationData?.name as string,
          patientName,
        ]),
        id: String(device._id),
        name: device.name as string | undefined,
        deviceId: device.deviceId as string | undefined,
        kind: device.kind as string | undefined,
        timezone: device.timezone as string | undefined,
        eventDate: normalizeDateString(device.eventDate),
        createdAt: normalizeDateString(device.createdAt),
        updatedAt: normalizeDateString(device.updatedAt),
        serialNumber,
        paymentId: (device.payment as Record<string, unknown> | undefined)
          ?.id as string | undefined,
        batteryStatus,
        batteryLevel,
        signalStrength,
        lastReachableAgo,
        organization: organizationData
          ? {
              id: String(organizationData._id),
              name: organizationData.name as string | undefined,
              kind: organizationData.kind as string | undefined,
            }
          : undefined,
        patient: patientData
          ? {
              id: String(patientData._id),
              name: patientName,
            }
          : undefined,
      };
    }),
    limit,
  ).map(({ score, ...entry }) => entry);

  return {
    query: search,
    organizations,
    users,
    devices,
    total: organizations.length + users.length + devices.length,
    tookMs: Date.now() - startedAt,
  };
};

export const getAdminStats = async (): Promise<AdminStatsResponse> => {
  const startedAt = Date.now();

  const [users, auth0Users, devices, organizations] = await Promise.all([
    User.countDocuments({}),
    getAuth0UsersTotal(),
    Device.countDocuments({}),
    Organization.countDocuments({}),
  ]);

  return {
    users,
    auth0Users,
    devices,
    organizations,
    total: users + auth0Users + devices + organizations,
    tookMs: Date.now() - startedAt,
  };
};

export const getAdminIotDevices = async (
  query: AdminListQuery,
): Promise<AdminIotDevicesResponse> => {
  const startedAt = Date.now();

  const iotDevices = await iotDevicesService.getDeviceStatusList();
  const updatedSinceMs = query.updatedSince
    ? new Date(query.updatedSince).getTime()
    : null;

  const normalized = Array.isArray(iotDevices)
    ? iotDevices
        .map((entry) => toRecord(entry))
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
    : [];

  const filtered =
    updatedSinceMs && Number.isFinite(updatedSinceMs)
      ? normalized.filter((entry) => {
          const updatedAtValue =
            entry.updatedAt ??
            entry.lastSeenAt ??
            entry.lastSeen ??
            entry.createdAt;

          if (
            typeof updatedAtValue !== "string" &&
            typeof updatedAtValue !== "number"
          ) {
            return true;
          }

          const timestamp = new Date(String(updatedAtValue)).getTime();
          if (!Number.isFinite(timestamp)) {
            return true;
          }

          return timestamp >= updatedSinceMs;
        })
      : normalized;

  const total = filtered.length;
  const page = Math.max(1, query.page);
  const perPage = Math.max(1, Math.min(500, query.perPage));
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageIndex = Math.min(page, totalPages) - 1;
  const start = pageIndex * perPage;
  const end = start + perPage;
  const results = filtered.slice(start, end);

  return {
    results,
    page,
    perPage,
    totalPages,
    total,
    tookMs: Date.now() - startedAt,
  };
};

export const getAdminDevices = async (
  query: AdminListQuery,
): Promise<AdminDevicesResponse> => {
  const startedAt = Date.now();

  const updatedSinceMs = query.updatedSince
    ? new Date(query.updatedSince).getTime()
    : null;

  const filter: Record<string, unknown> = {};
  if (updatedSinceMs && Number.isFinite(updatedSinceMs)) {
    filter.updatedAt = { $gte: new Date(updatedSinceMs) };
  }

  const page = Math.max(1, query.page);
  const perPage = Math.max(1, Math.min(500, query.perPage));
  const skip = (page - 1) * perPage;

  const [devices, total] = await Promise.all([
    Device.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Device.countDocuments(filter),
  ]);

  const results = Array.isArray(devices)
    ? devices
        .map((entry) => toRecord(entry))
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
    : [];

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    results,
    page,
    perPage,
    totalPages,
    total,
    tookMs: Date.now() - startedAt,
  };
};
