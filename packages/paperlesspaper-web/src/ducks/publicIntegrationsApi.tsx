import React from "react";

import { emptySplitApi } from "ducks/emptyApi";
import {
  AppIntegration,
  PublicIntegrationDocument,
  cachePublicIntegrations,
  getCachedPublicIntegrations,
  getPublicIntegrationsUrl,
  mapIntegration,
  normalizePublicIntegrationsLocale,
  sortIntegrations,
} from "helpers/publicIntegrations";

const isPublicIntegrationDocument = (
  value: unknown,
): value is PublicIntegrationDocument =>
  Boolean(value && typeof value === "object");

const getPayloadDocs = (payload: unknown): PublicIntegrationDocument[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isPublicIntegrationDocument);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const docs = (payload as { docs?: unknown }).docs;

  return Array.isArray(docs) ? docs.filter(isPublicIntegrationDocument) : [];
};

const isAppIntegration = (
  integration: AppIntegration | null,
): integration is AppIntegration => Boolean(integration);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to load integrations";

const fetchPublicIntegrations = async (
  locale: string | undefined,
  signal?: AbortSignal,
) => {
  const response = await fetch(getPublicIntegrationsUrl(locale), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load integrations: ${response.status}`);
  }

  const payload = await response.json();

  return sortIntegrations(
    getPayloadDocs(payload).map(mapIntegration).filter(isAppIntegration),
  );
};

export const publicIntegrationsApi = emptySplitApi.injectEndpoints({
  endpoints: (builder) => ({
    getPublicIntegrations: builder.query<AppIntegration[], string | undefined>({
      queryFn: async (locale, { signal }) => {
        try {
          const data = await fetchPublicIntegrations(locale, signal);

          return { data };
        } catch (error) {
          return {
            error: {
              status: "FETCH_ERROR",
              error: getErrorMessage(error),
            },
          };
        }
      },
      onQueryStarted: async (locale, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          cachePublicIntegrations(locale, data);
        } catch {
          // Keep the last localStorage result when the live request fails.
        }
      },
    }),
  }),
});

export function usePublicIntegrations(locale?: string) {
  const normalizedLocale = normalizePublicIntegrationsLocale(locale);
  const cachedData = React.useMemo(
    () => getCachedPublicIntegrations(normalizedLocale),
    [normalizedLocale],
  );
  const query =
    publicIntegrationsApi.useGetPublicIntegrationsQuery(normalizedLocale);

  return {
    ...query,
    data: query.data || cachedData,
  };
}
