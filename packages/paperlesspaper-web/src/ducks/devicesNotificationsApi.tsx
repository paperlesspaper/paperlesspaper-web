import { generateCrudApi } from "helpers/crudGeneratorExtend";
export const devicesNotificationsApi: any = generateCrudApi({
  name: "devicesNotifications",
  endpoints: (builder) => ({
    setDeviceToken: builder.mutation({
      query: (request) => ({
        url: `devicesNotifications/setDeviceToken`,
        body: request.values,
        method: "post",
      }),
    }),
    removeDeviceToken: builder.mutation({
      query: (request) => ({
        url: `devicesNotifications/removeDeviceToken`,
        body: request.values,
        method: "post",
      }),
    }),
  }),
});
