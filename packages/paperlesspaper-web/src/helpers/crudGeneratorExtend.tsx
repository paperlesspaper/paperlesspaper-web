import { emptySplitApi, tagTypes } from "../ducks/emptyApi";
import capitalizeFirstLetter from "./capitalizeFirstLetter";

export function generateCrudApi({
  name,
  // id,
  invalidatesTags,
  endpoints = () => {},
}: {
  name: tagTypes;
  // id?: string;
  invalidatesTags?: any;
  endpoints?: any;
}) {
  const invalidatesTagsFunction = invalidatesTags
    ? invalidatesTags
    : ({ name, kind, id }) => {
        if (kind === "delete") {
          return [
            { type: name, id: name + "LIST" },
            { type: name, id: name + "SEARCH" },
          ];
        }
        return [
          { type: name, id: name + "LIST" },
          { type: name, id: name + "SEARCH" },
          { type: name, id },
        ];
      };

  const myNameCapitialized = capitalizeFirstLetter(name);
  const api = emptySplitApi.injectEndpoints({
    overrideExisting: true,
    endpoints: (builder) => ({
      ...endpoints(builder),
      [`getAll${myNameCapitialized}`]: builder.query({
        query: ({ organizationId, queryOptions }: any = {}) => {
          return {
            url: `${name}`,
            method: "get",
            params: {
              organization: organizationId,
              ...queryOptions,
            },
          };
        },
        transformResponse: (response: any) => response.results,
        providesTags: (result) => {
          const output = result
            ? [
                ...result.map(({ id }) => ({ type: name, id })),
                { type: name, id: name + "LIST" },
              ]
            : [{ type: name, id: name + "LIST" }];

          return output;
        },
      }),
      [`search${myNameCapitialized}`]: builder.query({
        query: (params) => ({
          url: `${name}`,
          method: "get",
          params: { ...params },
        }),
        transformResponse: (response: any) => response.results,
        providesTags: (result) => {
          const output = result
            ? [
                ...result.map(({ id }) => ({ type: name, id })),
                { type: name, id: name + "SEARCH" },
              ]
            : [{ type: name, id: name + "SEARCH" }];

          return output;
        },
      }),
      [`createSingle${myNameCapitialized}`]: builder.mutation({
        query: (initialPost) => ({
          url: `${name}`,
          body: initialPost.values,
          method: "post",
        }),
        invalidatesTags: (result, error, entry) => {
          return invalidatesTagsFunction({ name, id: entry.id, entry, result });
        },
      }),
      [`getSingle${myNameCapitialized}`]: builder.query({
        query: (request) => ({
          url: `${name}/${request}`,
          method: "get",
        }),

        providesTags: (result, error, id) => {
          // const newName = name === "devices" ? name : "devices";
          return [
            { type: name, id: name + "SINGLE" },
            { type: name, id },
          ];
        },
      }),

      [`updateSingle${myNameCapitialized}`]: builder.mutation({
        query: (initialPost) => ({
          url: `${name}/${initialPost.id}`,
          body: initialPost.values,
          method: "post",
        }),
        invalidatesTags: (result, error, entry) => {
          return invalidatesTagsFunction({ name, id: entry.id, entry, result });
        },
      }),
      [`deleteSingle${myNameCapitialized}`]: builder.mutation({
        query: (initialPost) => ({
          url: `${name}/${initialPost.id}`,
          method: "DELETE",
        }),
        invalidatesTags: () => {
          return invalidatesTagsFunction({ name, kind: "delete" });
        },
      }),
    }),
  });
  return { ...api, name };
}
