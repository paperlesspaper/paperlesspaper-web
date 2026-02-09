import { createApi, fetchBaseQuery, retry } from "@reduxjs/toolkit/query/react";
import headersWithAuth0Token from "helpers/headersWithAuth0Token";

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
  if (error.status === 409 || error.status === 404) {
    return false;
  }
  return settings.attempt < 1;
};

export const emptySplitApi = createApi({
  baseQuery: retry(
    fetchBaseQuery({
      baseUrl: `${import.meta.env.REACT_APP_SERVER_BASE_URL}`,
      prepareHeaders: headersWithAuth0Token,
    }),
    { retryCondition },
  ),
  // TODO: Generate types for these tags automatically
  tagTypes: tagTypesB,

  endpoints: () => ({}),
});
