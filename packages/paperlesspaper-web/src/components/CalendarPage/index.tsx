import React, { useEffect } from "react";
import Sidebar from "../Sidebar";
import Wrapper from "../Wrapper";
import { useParams, useHistory, Route } from "react-router-dom";
import PatientsEmpty from "components/PatientsEmpty";
import {
  useActiveUserDevice,
  useActiveUserNew,
  useUsersNew,
} from "helpers/useUsers";
import { useDispatch } from "react-redux";
import globalState from "ducks/globalState";
import { Trans } from "react-i18next";
import InlineLoadingLarge from "components/InlineLoadingLarge";
import useCalendarUrl from "helpers/urls/useCalendarUrl";
import useQs from "helpers/useQs";
import EpaperOverview from "components/Epaper";
import { devicesApi } from "ducks/devices";
import useLatestOpenEntry from "helpers/useLatestOpenEntry";
import { Button, Empty } from "@progressiveui/react";
import ButtonRouter from "components/ButtonRouter";
import styles from "./styles.module.scss";
import addUser from "./add-user.svg";
import sadCat from "./sad-cat.svg";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
import { deviceKindHasFeature } from "helpers/devices/deviceList";

export default function CalendarPageWrapper() {
  const params = useParams();

  const activeUser = useActiveUserNew();
  const currentUserDevices = useActiveUserDevice();

  const dispatch = useDispatch();

  const queryArguments = useQs();

  const device = devicesApi.useGetAllDevicesQuery(
    {
      organizationId: params.organization,
    },
    { skip: !params.organization },
  );

  useEffect(() => {
    document.body.classList.add("disable-scroll");

    return () => {
      document.body.classList.remove("disable-scroll");
    };
  }, []);

  // const getLatestPatient = useLatestUser({ category: "patient" });

  const getPatients = useUsersNew({ category: "patient" });
  const getLatestPatient = getPatients.dataFiltered?.[0];

  const latestOpenEntry = useLatestOpenEntry();

  const history = useHistory();

  const calendarUrl: any = useCalendarUrl();

  // Jump to latest patient
  useEffect(() => {
    if (params.entry === undefined) {
      if (latestOpenEntry?.kind && latestOpenEntry?.exists === true) {
        history.push(
          calendarUrl({
            entry: latestOpenEntry.entry,
            kind: latestOpenEntry.kind,
          }),
        );
      } else if (getPatients.isSuccess && getLatestPatient) {
        history.push(calendarUrl({ entry: getLatestPatient.id, kind: "user" }));
      } else if (getPatients.isSuccess && device.data?.length >= 1) {
        history.push(calendarUrl({ entry: device.data[0].id, kind: "device" }));
      }
    }
  }, [activeUser?.data, getLatestPatient, latestOpenEntry, history]);

  useEffect(() => {
    if (params.entry !== latestOpenEntry.entry)
      dispatch(
        globalState.actions.setLastUser({
          entry: params.entry,
          kind: params.kind,
        }),
      );
  }, [params.entry]);

  useEffect(() => {
    if (params.entry !== latestOpenEntry.entry)
      dispatch(globalState.actions.setLastQueryArguments(queryArguments));
  }, [queryArguments]);

  const hasEpaperFeature = deviceKindHasFeature(
    "epaper",
    currentUserDevices?.data?.kind,
  );

  return (
    <Wrapper
      sidebar={
        <Route
          path="/:organization/calendar/:kind/:entry?"
          component={Sidebar}
        />
      }
    >
      <HelmetTitle>Overview</HelmetTitle>
      {currentUserDevices.isError || getPatients.isError ? (
        <Empty
          kind="large"
          icon={<img src={sadCat} alt="Add user" className={styles.addIcon} />}
          button={
            <Button onClick={() => window.location.reload()}>
              <Trans>Reload</Trans>
            </Button>
          }
          title={<Trans>No internet connection</Trans>}
        >
          <Trans>
            The backend server was not found. This is most likely a problem with
            your internet connection.
          </Trans>
        </Empty>
      ) : (currentUserDevices.isLoading === true ||
          (currentUserDevices.isUninitialized === true &&
            currentUserDevices.noDevice !== true)) &&
        params.entry ? (
        <InlineLoadingLarge
          description={<Trans>Overview is loading...</Trans>}
        />
      ) : hasEpaperFeature && params.kind === "device" ? (
        <EpaperOverview />
      ) : params.kind === "device" ? (
        <Empty
          kind="large"
          icon={<img src={addUser} alt="Add user" className={styles.addIcon} />}
          button={
            <ButtonRouter withOrganization to={`/devices/${params.entry}`}>
              <Trans>Assign user</Trans>
            </ButtonRouter>
          }
          title={<Trans>The device is not yet assigned to any account</Trans>}
        >
          <Trans>Please assign it to a user first</Trans>
        </Empty>
      ) : /*activeUser.data === undefined &&
        activeDevice.data === undefined &&*/
      params.kind === undefined && getPatients.isSuccess ? (
        <PatientsEmpty />
      ) : null}
    </Wrapper>
  );
}
