import { organizationsApi } from "ducks/organizationsApi";
import { useParams } from "react-router-dom";

export default function useCurrentOrganization() {
  const params = useParams();
  const allQuery = organizationsApi.useGetSingleOrganizationsQuery(
    params.organization
  );
  return allQuery;
}
