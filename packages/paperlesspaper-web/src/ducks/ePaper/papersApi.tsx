import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const papersApi: any = generateCrudApi({
  name: "papers",
  invalidatesTags: ({ name, id, result, entry }) => {
    console.log("updateSingleImageMeta invalidatesTags", {
      name,
      id,
      result,
      entry,
    });

    return [
      { type: name, id: name + "LIST" },
      { type: name, id: name + "SEARCH" },
      { type: name, id },
      { type: "papers", id: "papersSEARCH" },
      // { type: "devices", id: entry?.values?.deviceId },
    ];
  },
  endpoints: (builder) => ({
    getAllPapersAdmin: builder.query({
      query: () => ({
        url: `papers`,
        method: "get",
      }),
      transformResponse: (response) => response.results,
    }),
    generateImageUrl: builder.query({
      query: (request) => ({
        url: `papers/image/${request.id}`,
        method: "post",
        body: request.body,
      }),
      transformResponse: (response) => response,
      providesTags: (result, error, { id }) => [{ type: "papers", id }],
      invalidatesTags: (result, error, { id }) => {
        return [{ type: "papers", id }];
      },
    }),

    generateImageUrlAlt: builder.mutation({
      query(request) {
        return {
          url: `papers/image/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      providesTags: (result, error, { id }) => [{ type: "papers", id }],
      invalidatesTags: (result, error, { id }) => [{ type: "papers", id }],
    }),

    generateCalendar: builder.mutation({
      query(request) {
        return {
          url: `papers/calendar/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      providesTags: (result, error, { id }) => [{ type: "papers", id }],
      invalidatesTags: (result, error, { id }) => [{ type: "papers", id }],
    }),

    getCalendarPreview: builder.mutation({
      query(request) {
        return {
          url: `papers/${request.id}/calendar-preview`,
          method: "post",
          body: request.body,
        };
      },
      providesTags: (result, error, { id }) => [{ type: "papers", id }],
    }),

    uploadSingleImage: builder.mutation({
      query(request) {
        return {
          url: `papers/uploadSingleImage/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      invalidatesTags: (result, error, entry) => {
        const tags = [{ type: "papers", id: entry.id }];
        if (entry?.deviceId) {
          tags.push({ type: "devices", id: entry.deviceId });
        }
        return tags;
      },
    }),

    updateSingleImageMeta: builder.mutation({
      query(request) {
        return {
          url: `papers/updateSingleImageMeta/${request.id}`,
          method: "post",
          body: request.body,
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "papers", id }],
    }),

    createPluginRedirectToken: builder.mutation({
      query(request) {
        return {
          url: `papers/${request.id}/plugin-redirect-token`,
          method: "post",
          body: request.body || {},
        };
      },
    }),

    redeemPluginRedirectToken: builder.mutation({
      query(request) {
        return {
          url: `papers/${request.id}/plugin-redirect-redeem`,
          method: "post",
          body: request.body,
        };
      },
    }),
  }),
});
