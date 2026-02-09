import { organizationsApi } from "ducks/organizationsApi";
import { useParams } from "react-router-dom";

export function useActiveOrganzation() {
  const params = useParams();

  const { data }: any = organizationsApi.useGetSingleOrganizationsQuery(
    params.organization,
    {
      skip: params.organization === undefined,
    }
  );

  return data;
}
