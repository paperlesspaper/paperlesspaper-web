import { emptySplitApi } from "ducks/emptyApi";

type SearchItem = {
  id: string;
  sourceId: string;
  kind: "organization" | "user" | "device";
  title: string;
  subtitle?: string;
  additional?: string;
  data: any;
};

const toSearchItems = (response: any): SearchItem[] => {
  const organizations = (response?.organizations || []).map((entry) => ({
    id: `organization:${entry.id}`,
    sourceId: entry.id,
    kind: "organization" as const,
    title: entry.name || entry.id,
    subtitle: entry.kind || "organization",
    additional: "Organization",
    data: entry,
  }));

  const users = (response?.users || []).map((entry) => ({
    id: `user:${entry.id}`,
    sourceId: entry.id,
    kind: "user" as const,
    title: entry.name || entry.email || entry.id,
    subtitle: entry.email || entry.role || "user",
    additional: entry.organization?.name || "User",
    data: entry,
  }));

  const devices = (response?.devices || []).map((entry) => ({
    id: `device:${entry.id}`,
    sourceId: entry.id,
    kind: "device" as const,
    title: entry.deviceId || entry.id,
    subtitle: entry.kind || "device",
    additional: entry.organization?.name || "Device",
    data: entry,
  }));

  return [...organizations, ...users, ...devices];
};

const api = emptySplitApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getAllAdminSearch: builder.query({
      query: ({ queryOptions }) => ({
        url: "admin/search",
        method: "get",
        params: {
          search: queryOptions?.search,
          limit: queryOptions?.limit || 20,
        },
      }),
      transformResponse: (response: any) => toSearchItems(response),
    }),
  }),
});

export const adminSearchApi: any = {
  ...api,
  name: "search",
};
