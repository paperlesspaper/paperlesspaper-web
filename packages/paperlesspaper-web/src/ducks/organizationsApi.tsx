import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const organizationsApi: any = generateCrudApi({
  name: "organizations",
  endpoints: (builder) => ({
    getAllOrganizationsAdmin: builder.query({
      query: ({ queryOptions }) => ({
        url: `organizations/all`,
        method: "get",
        params: {
          ...queryOptions,
        },
      }),
      transformResponse: (response) => response.results,
    }),
  }),
});
