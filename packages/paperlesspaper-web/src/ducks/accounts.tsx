import { generateCrudApi } from "helpers/crudGeneratorExtend";
export const accountsApi: any = generateCrudApi({
  name: "accounts",

  endpoints: (builder) => ({
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
