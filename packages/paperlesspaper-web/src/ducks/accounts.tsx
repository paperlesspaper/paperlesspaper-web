import { generateCrudApi } from "helpers/crudGeneratorExtend";
export const accountsApi: any = generateCrudApi({
  name: "accounts",

  endpoints: (builder) => ({
    getAccountSecurity: builder.query({
      query: () => ({ url: "accounts/current/security", method: "get" }),
      providesTags: [{ type: "accounts", id: "SECURITY" }],
    }),
    updateAccountSecurity: builder.mutation({
      query: ({ action, body, method = "post" }) => ({
        url: `accounts/current/security/${action}`,
        method,
        body,
      }),
      invalidatesTags: (_result, error) =>
        error ? [] : [{ type: "accounts", id: "SECURITY" }],
    }),
    confirmAccountEmail: builder.mutation({
      query: (token) => ({
        url: "accounts/confirm-email",
        method: "post",
        body: { token },
      }),
      invalidatesTags: (_result, error) => (error ? [] : ["accounts"]),
    }),
    invalidatesTags: ({ name }) => {
      return [
        { type: name, id: name + "LIST" },
        { type: name, id: name + "SEARCH" },
      ];
    },
    deleteCurrentUser: builder.mutation({
      query: () => ({
        url: `accounts/deleteCurrent`,
        method: "delete",
      }),
    }),
    getCurrentAccount: builder.query({
      query: () => ({
        url: `accounts/current`,
        method: "get",
      }),
    }),
    getMfaEnrollment: builder.mutation({
      query: () => ({
        url: `accounts/current/mfa/enroll`,
        method: "post",
      }),
    }),
    disableMfa: builder.mutation({
      query: () => ({
        url: `accounts/current/mfa/disable`,
        method: "post",
      }),
    }),
  }),
});
