import { createApi, fetchBaseQuery, retry } from "@reduxjs/toolkit/query/react";
import headersWithAuth0Token from "helpers/headersWithAuth0Token";
import { buildPaperlesspaperBackendUrl } from "helpers/backendBaseUrl";

export type tagTypes =
  | "ai"
  | "abdas"
  | "accounts"
  | "ais"
  | "devices"
  | "devicesNotifications"
  | "fills"
  | "iotDevices"
  | "messages"
  | "notifications"
  | "organizations"
  | "papers"
  | "payments"
  | "pdf"
  | "tokens"
  | "users"
  | "questions";

export const tagTypesB = [
  "abdas",
  "ais",
  "accounts",
  "devices",
  "devicesNotifications",
  "fills",
  // "iotdevice", //TODO: Check if right
  "iotDevices",
  "messages",
  "notifications",
  "organizations",
  "papers",
  "payments",
  "pdf",
  "tokens",
  "users",
  "questions",
];
// initialize an empty api service that we'll inject endpoints into later as needed

const retryCondition = (error: any, request: any, settings: any) => {
  const method =
    typeof request === "string"
      ? "GET"
      : (request?.method || "GET").toUpperCase();
  const isTemporaryNetworkError =
    error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR";

  // Retrying mutations can duplicate writes. Retry only idempotent reads and
  // only for transient connection failures. The first failed request has
  // attempt === 1, so <= 2 allows two actual retries with RTK's backoff.
  return method === "GET" && isTemporaryNetworkError && settings.attempt <= 2;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "",
  prepareHeaders: headersWithAuth0Token,
});

const dynamicBaseQuery = (args: any, api: any, extraOptions: any) => {
  const requestArgs = typeof args === "string" ? { url: args } : { ...args };
  requestArgs.url = buildPaperlesspaperBackendUrl(requestArgs.url || "");
  return rawBaseQuery(requestArgs, api, extraOptions);
};

export const emptySplitApi = createApi({
  baseQuery: retry(dynamicBaseQuery, { retryCondition }),
  // TODO: Generate types for these tags automatically
  tagTypes: tagTypesB,

  endpoints: () => ({}),
});
