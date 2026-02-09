import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const iotDevicesApi: any = generateCrudApi({
  name: "iotDevices",
  endpoints: (builder) => ({
    getEvents: builder.query({
      query: (request) => ({
        url: `iotdevice/events/${request.id}`,
        method: "get",
        params: request.params,
      }),
    }),
    getShadowIotDevices: builder.query({
      query: (request) => ({
        url: `iotdevice/shadow/${request.id}/${request.shadowName}`,
        method: "get",
      }),
    }),
    shadowAlarmUpdate: builder.mutation({
      query: (request) => ({
        url: `iotdevice/device/shadowAlarmUpdate/${request.id}`,
        method: "post",
        body: request.body,
      }),
      //transformResponse: (response) => response,
    }),
  }),
});
