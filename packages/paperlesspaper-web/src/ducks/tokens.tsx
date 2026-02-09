import { generateCrudApi } from "helpers/crudGeneratorExtend";

export const tokensApi: any = generateCrudApi({
  name: "tokens",
  invalidatesTags: ({ name, id }) => {
    return [
      { type: name, id: name + "LIST" },
      { type: name, id: name + "SEARCH" },
      { type: name, id },
    ];
  },
});
