import { emptySplitApi } from "./emptyApi";

export const updateInfo: any = emptySplitApi.injectEndpoints({
  endpoints: (builder) => ({
    [`getOnlineInfo`]: builder.query({
      query: () => {
        return {
          url: `organizations/all`,
          method: "get",
        };
      },
      transformResponse: (response) => response,
    }),
    [`getUpdateInfo`]: builder.query({
      query: () => {
        return {
          url: `${import.meta.env.REACT_APP_AUTH_REDIRECT_URL}/appInfo.json`,
          method: "get",
        };
      },
      transformResponse: (response) => response,
    }),
  }),
});
