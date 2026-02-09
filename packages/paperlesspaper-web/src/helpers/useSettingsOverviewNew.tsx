import { useHistory, useLocation, useParams } from "react-router-dom";
import qs from "qs";
import capitalizeFirstLetter from "./capitalizeFirstLetter";

interface UseSettingsOverviewProps {
  getEntryById?: any;
  name?: string;
  getStatus?: any;
  api?: any;
  allQuery?: any;
  queryOptions?: any;
  queryOptionsFunction?: any;
}

function useSettingsOverview({
  // name,
  api,
  allQuery,
  queryOptions,
  queryOptionsFunction = ({ search }) => {
    return { search: search ? search.search : undefined };
  },
}: UseSettingsOverviewProps) {
  const { organization, entry } = useParams();
  const history = useHistory();
  const organizationId = organization;

  const name = api.name;

  const location = useLocation();
  const search = qs.parse(location.search, { ignoreQueryPrefix: true });

  /*const medicationSearch = useSelector((state) =>
    duck.selectors.byId(state, search.new ? search.new : search.updated)
  );*/

  const allQueryEl = allQuery
    ? allQuery({
        organizationId,
        queryOptions: queryOptionsFunction
          ? queryOptionsFunction({ search })
          : queryOptions,
      })
    : api[`useGetAll${capitalizeFirstLetter(name)}Query`]({
        organizationId,
        queryOptions: queryOptionsFunction
          ? queryOptionsFunction({ search })
          : queryOptions,
      });
  const { data = [] } = allQueryEl;

  // Debounce timer for updateSearch
  let updateSearchTimeout;
  const updateSearch = (e, now) => {
    console.log("updateSearch in SettingsOverview", e);
    if (updateSearchTimeout) {
      clearTimeout(updateSearchTimeout);
    }
    if (now === true) {
      history.replace({ search: qs.stringify({ search: e.target.value }) });
    } else {
      updateSearchTimeout = setTimeout(() => {
        history.replace({ search: qs.stringify({ search: e.target.value }) });
      }, 1000);
    }
  };

  const filteredDataArray = data;

  const url = `/${organizationId}/${name}/`;

  const [deleteSingle, resultDeleteSingle] =
    api[`useDeleteSingle${capitalizeFirstLetter(name)}Mutation`]();

  const deleteEntry = async (urlId) => {
    try {
      await deleteSingle({
        id: urlId,
      });
    } catch (err) {
      console.error("Failed to save the post: ", err);
    }
  };

  return {
    dataArray: data,
    filteredDataArray,
    organizationId,
    deleteEntry,
    entry,
    data,
    allQuery: allQueryEl,
    updateSearch,
    search: location.search,
    searchObject: search,
    name,
    url,
    deleteSingle,
    resultDeleteSingle,
  };
}
export default useSettingsOverview;
