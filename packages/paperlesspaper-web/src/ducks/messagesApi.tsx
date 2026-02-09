import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const messagesApi: any = generateCrudApi({
  name: "messages",
  endpoints: (builder) => ({
    getAllNotifications: builder.query({
      query: () => ({
        url: `messages/`,
        method: "get",
      }),
    }),
    updateStatus: builder.mutation({
      query: (request) => ({
        url: `messages/${request.id}/status`,
        body: request.data,
        method: "post",
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "messages", id }],
    }),
  }),
});
