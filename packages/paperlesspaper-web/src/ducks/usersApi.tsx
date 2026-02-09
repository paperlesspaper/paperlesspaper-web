import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const usersApi: any = generateCrudApi({
  name: "users",
  endpoints: (builder) => ({
    updateInvite: builder.mutation({
      query: (request) => {
        return {
          url: `users/invite`,
          body: request.values,
          method: "post",
        };
      },
    }),
    getInvite: builder.query({
      query: (request) => {
        return {
          url: `users/invite/${request.token}`,
          method: "get",
        };
      },
    }),
    sendVerificationEmail: builder.mutation({
      query: () => ({
        url: `users/current/send-verification-email`,
        method: "post",
      }),
    }),
    getCurrentUser: builder.query({
      query: (request) => ({
        url: `users/current`,
        method: "get",
        params: { organization: request },
      }),
      providesTags: (result, error, id) => [
        { type: "users", id: result?.id },
        { type: "organizations", id },
      ],
    }),
  }),
});
