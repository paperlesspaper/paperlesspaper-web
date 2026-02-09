import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const notificationsApi: any = generateCrudApi({
  name: "notifications",
  endpoints: (builder) => ({
    getAllNotificationsList: builder.query({
      query: () => ({
        url: `notifications/`,
        method: "get",
      }),
    }),
    sendDefaultNotification: builder.mutation({
      query: (request) => ({
        url: `notifications/test`,
        body: request.data,
        method: "post",
      }),
    }),
  }),
});
