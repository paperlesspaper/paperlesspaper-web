import { devicesApi } from "ducks/devices";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import useUsers from "./useUsers";

export default function useLatestOpenEntry() {
  const { organization } = useParams();

  const { lastUser, lastQueryArguments } = useSelector(
    (state: any) => state.globalState
  );

  const getPatients = useUsers({ kind: "patient" }); // TODO: use usePatients

  const devices = devicesApi.useGetAllDevicesQuery(
    {
      organizationId: organization,
    },
    { skip: !organization }
  );

  let exists = false;

  if (
    lastUser?.kind === "user" &&
    getPatients &&
    getPatients.find(
      (e) => e.id === lastUser?.entry && e.category === "patient"
    )
  ) {
    exists = true;
  }

  if (
    lastUser?.kind === "device" &&
    devices?.data &&
    devices.data.find((e) => e.id === lastUser.entry)
  ) {
    exists = true;
  }

  return { ...lastUser, exists, lastQueryArguments };
}
