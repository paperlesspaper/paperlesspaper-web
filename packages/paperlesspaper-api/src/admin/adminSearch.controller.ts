import type { Request, Response } from "express";
import httpStatus from "http-status";
import { ApiError, catchAsync } from "@internetderdinge/api";
import {
  getAdminDevices,
  getAdminIotDevices,
  getAdminStats,
  searchAdminCollections,
} from "./adminSearch.service";

const ADMIN_ROLE_CLAIM = "https://memo.wirewire.de/roles";

type AuthRequest = Request & {
  auth?: Record<string, unknown>;
};

const hasAdminRole = (auth: Record<string, unknown> | undefined): boolean => {
  const roles = auth?.[ADMIN_ROLE_CLAIM];
  return Array.isArray(roles) && roles.includes("admin");
};

const readListQuery = (
  req: Request,
): {
  page: number;
  perPage: number;
  updatedSince: string | null;
} => {
  const rawPage = Number(req.query.page);
  const rawPerPage = Number(req.query.perPage);
  const updatedSince = String(req.query.updatedSince ?? "").trim() || null;

  return {
    page: Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1,
    perPage: Number.isFinite(rawPerPage)
      ? Math.max(1, Math.min(500, Math.floor(rawPerPage)))
      : 100,
    updatedSince,
  };
};

export const searchAdmin = catchAsync(
  async (req: AuthRequest, res: Response) => {
    if (!hasAdminRole(req.auth)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "User is not part of the admin group",
      );
    }

    const search = String(req.query.search || "").trim();
    if (search.length < 2) {
      return res.send({
        query: search,
        organizations: [],
        users: [],
        devices: [],
        total: 0,
        tookMs: 0,
      });
    }

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(50, Math.floor(rawLimit)))
      : 12;

    const result = await searchAdminCollections({ search, limit });
    res.send(result);
  },
);

export const getStats = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!hasAdminRole(req.auth)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "User is not part of the admin group",
    );
  }

  const result = await getAdminStats();
  res.send(result);
});

export const getIotDevices = catchAsync(
  async (req: AuthRequest, res: Response) => {
    if (!hasAdminRole(req.auth)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "User is not part of the admin group",
      );
    }

    const result = await getAdminIotDevices(readListQuery(req));
    res.send(result);
  },
);

export const getDevices = catchAsync(
  async (req: AuthRequest, res: Response) => {
    if (!hasAdminRole(req.auth)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "User is not part of the admin group",
      );
    }

    const result = await getAdminDevices(readListQuery(req));
    res.send(result);
  },
);
