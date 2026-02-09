import { devicesApi } from "ducks/devices";
import { usersApi } from "ducks/usersApi";
import { useActiveDevice } from "./devices/useDevices";
import { useParams } from "react-router-dom";

export default function useUsers({ kind }: { kind?: string } = {}) {
  const { organization } = useParams();
  const results = usersApi.useGetAllUsersQuery({
    organizationId: organization,
  });
  const { data } = results;
  if (kind && data) data.filter((e) => e.role === kind);
  return data;
}

export function useUsersNew({
  category,
}: { kind?: string; category?: string } = {}) {
  const { organization } = useParams();
  const results = usersApi.useGetAllUsersQuery({
    organizationId: organization,
  });
  const { data } = results;
  let dataFiltered = data;
  if (category && data) {
    dataFiltered = data.filter((e) => e.category === category);
  }
  return { ...results, dataFiltered };
}

export function useUsersRequest() {
  const { organization } = useParams();
  return usersApi.useGetAllUsersQuery({ organizationId: organization });
}

export function useUsersWithCurrentOrganization({ category, role }: any) {
  const { organization } = useParams();
  const { data = [] } = usersApi.useGetAllUsersQuery({
    organizationId: organization,
  });

  if (role || category)
    return data.filter(
      (e) =>
        (!role || e.role === role) && (!category || e.category === category)
    );
  return data;
}

export function useLatestUser({ category, role }) {
  const userWithCurrentOrganization = useUsersWithCurrentOrganization({
    category,
    role,
  });
  return userWithCurrentOrganization[0];
}

export function useActiveUser(activeUserId?: string) {
  const { entry, kind } = useParams();
  const activeUser = activeUserId ? activeUserId : entry;
  const { data } = usersApi.useGetSingleUsersQuery(activeUser, {
    skip: activeUser === undefined || kind === "device",
  });
  return data;
}

export function useActiveUserNew(activeUserId?: any) {
  const { entry, kind } = useParams();

  const activeUser = activeUserId ? activeUserId : entry;
  const activeUserElement = usersApi.useGetSingleUsersQuery(activeUser, {
    skip: activeUser === undefined || kind === "device",
  });
  return activeUserElement;
}

export function useUserById(id?: string) {
  const { data } = usersApi.useGetSingleUsersQuery(id, {
    skip: id === undefined,
  });
  return data;
}

export function useActiveUserDevice(id?: string) {
  const { entry, kind } = useParams();

  const directDeviceId = id
    ? id
    : kind === "device"
    ? entry
    : kind === "user"
    ? false
    : false;

  const directDevice = useActiveDevice(directDeviceId);

  const { data, ...devicesData } = devicesApi.useSearchDevicesQuery(
    { patient: entry },
    { skip: directDeviceId || !entry || entry === "new" }
  );

  return directDeviceId
    ? directDevice
    : {
        ...devicesData,
        data: data && data.length ? data[0] : null,
        noDevice: true,
      };
}
