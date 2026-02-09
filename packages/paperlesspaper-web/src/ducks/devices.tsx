import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const devicesApi: any = generateCrudApi({
  name: "devices",
  invalidatesTags: ({ name, id }) => {
    return [
      { type: name, id: name + "LIST" },
      { type: name, id: name + "SEARCH" },
      { type: name, id },
      { type: "calendars", id: "calendarsSEARCH" },
    ];
  },
  endpoints: (builder) => ({
    getAllDevicesAdmin: builder.query({
      query: ({ queryOptions }) => ({
        url: `devices`,
        method: "get",
        params: {
          ...queryOptions,
        },
      }),
      transformResponse: (response) => response.results,
    }),
    getEvents: builder.query({
      query: (request) => ({
        url: `devices/events/${request.id}`,
        method: "get",
        params: request.params,
      }),
      transformResponse: (response) => response,
    }),
    getImage: builder.query({
      query: (request) => ({
        url: `devices/image/${request.id}/${request.uuid}`,
        method: "get",
      }),
      transformResponse: (response) => response,
    }),
    createCustomerPortalSession: builder.query({
      query: (request) => ({
        url: `devices/create-customer-portal-session/${request?.deviceId}`,
        method: "post",
        body: request.data,
      }),
      transformResponse: (response) => response,
    }),
    createCheckoutSession: builder.query({
      query: (request) => ({
        url: `devices/create-checkout-session/${request?.deviceId}`,
        method: "post",
        body: request.data,
      }),
    }),
    subscription: builder.query({
      query: (request) => ({
        url: `devices/subscription/${request?.deviceId}`,
        method: "get",
      }),
    }),
    getAlarms: builder.mutation({
      query: (id) => ({
        url: `devices/alarms/${id}`,
        method: "get",
      }),
      //transformResponse: (response) => response,
    }),
    updateLedLightByDeviceId: builder.mutation({
      query: (request) => ({
        url: `devices/ledlight/${request.id}`,
        body: request.data,
        method: "post",
      }),
    }),
    updatePindByDeviceId: builder.mutation({
      query: (request) => ({
        url: `devices/ping/${request.id}`,
        params: request.data,
        method: "get",
      }),
    }),
    rebootDevice: builder.mutation({
      query: (id) => ({
        url: `devices/reboot/${id}`,
        method: "post",
      }),
    }),
    resetDevice: builder.mutation({
      query: (id) => ({
        url: `devices/reset/${id}`,
        method: "post",
      }),
    }),
    updateCaseStatus: builder.mutation({
      query: (id) => ({
        url: `devices/casestatus/${id}`,
        method: "post",
      }),
    }),
    getDeviceStatus: builder.mutation({
      query: (id) => ({
        url: `devices/getDeviceStatus/${id}`,
        method: "post",
      }),
    }),

    uploadSingleImage: builder.mutation({
      query(request) {
        return {
          url: `devices/uploadSingleImage/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "devices", id }],
    }),

    updateSingleImageMeta: builder.mutation({
      query(request) {
        return {
          url: `devices/updateSingleImageMeta/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "devices", id }],
    }),

    updateShadowLight: builder.mutation({
      query: (request) => ({
        url: `devices/shadowAlarmUpdate/${request.id}`,
        method: "post",
        body: request.body,
      }),
    }),
    registerDevice: builder.mutation({
      query: (request) => ({
        url: `devices/registerdevice/${request.id}`,
        method: "post",
        body: request.body,
      }),
      invalidatesTags: (result) =>
        result?.activation_status === "success"
          ? [{ type: "devices", id: "devices" + "LIST" }]
          : [],
    }),
  }),
});
