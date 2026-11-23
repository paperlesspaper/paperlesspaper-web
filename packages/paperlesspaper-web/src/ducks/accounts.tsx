import { generateCrudApi } from "helpers/crudGeneratorExtend";
export const accountsApi: any = generateCrudApi({
  name: "accounts",

  endpoints: (builder) => ({
    updateAccountSettings: builder.mutation({
      // One form submission, with success only after both writes complete.
      queryFn: async ({ id, values }, _api, _options, baseQuery) => {
        const { batteryNotifications, ...profile } = values;
        const account = await baseQuery({
          url: `accounts/${id}`,
          method: "post",
          body: profile,
        });
        if (account.error) return { error: account.error };
        if (batteryNotifications !== undefined) {
          const notifications = await baseQuery({
            url: "accounts/current/notifications/battery",
            method: "put",
            body: batteryNotifications,
          });
          if (notifications.error) return { error: notifications.error };
        }
        return { data: account.data };
      },
      // A profile write may succeed even when the notification write fails.
      invalidatesTags: (_result, _error, { id }) => [
        { type: "accounts", id },
        { type: "accounts", id: "accountsLIST" },
        { type: "accounts", id: "accountsSEARCH" },
        { type: "accounts", id: "BATTERY_NOTIFICATIONS" },
      ],
    }),
    getBatteryNotificationPreference: builder.query({
      query: () => ({ url: "accounts/current/notifications/battery", method: "get" }),
      providesTags: [{ type: "accounts", id: "BATTERY_NOTIFICATIONS" }],
    }),
    updateBatteryNotificationPreference: builder.mutation({
      query: (body) => ({ url: "accounts/current/notifications/battery", method: "put", body }),
      invalidatesTags: (_result, error) => error ? [] : [{ type: "accounts", id: "BATTERY_NOTIFICATIONS" }],
    }),
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
