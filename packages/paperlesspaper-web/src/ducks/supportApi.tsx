import { emptySplitApi } from "ducks/emptyApi";

type ChatwootIdentity = {
  email?: string;
  identifier: string;
  identifierHash?: string;
  identityValidationConfigured: boolean;
};

export const supportApi = emptySplitApi.injectEndpoints({
  endpoints: (builder) => ({
    getChatwootIdentity: builder.query<ChatwootIdentity, void>({
      query: () => ({
        url: "support/chatwoot/identity",
        method: "get",
      }),
    }),
  }),
});
