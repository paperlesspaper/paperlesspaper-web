import React from "react";
import Select, { components } from "react-select";
import styles from "./styles.module.scss";

import { useHistory, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsersCog } from "@fortawesome/pro-solid-svg-icons";
import Avatar from "components/Avatar";
import { useActiveUserDevice, useUsersRequest } from "helpers/useUsers";
import { UserNameNew } from "components/UserName";
import useQs from "helpers/useQs";
import classnames from "classnames";
import { useIsDesktop } from "@internetderdinge/web";
import useCalendarUrl from "helpers/urls/useCalendarUrl";
import { devicesApi } from "ducks/devices";
import DeviceName from "components/DeviceName";
import { Trans } from "react-i18next";
//import { useActiveDevice } from "../../helpers/devices/useDevices";
import { format } from "date-fns";
import DeviceIcon from "components/DeviceIcon";
import AddIcon from "components/Settings/components/AddIcon";
import NewEntryButton from "components/Calendar/NewEntryButton";
import { deviceKindHasFeature } from "helpers/devices/deviceList";

const NoOptionsMessage = () => (
  <div className={styles.noEntryFound}>
    <Trans>No entry found</Trans>
  </div>
);

const GroupHeading = (props) => (
  <div className={styles.groupHeading}>
    <components.GroupHeading {...props} />
  </div>
);

const SingleValue = (props: any) => {
  //TODO: const activeUserDevice: any = useActiveUserDevice();

  if (props.data?.kind === "device") {
    return (
      <components.SingleValue {...props}>
        <div className={styles.valueWrapper}>
          <div className={styles.avatar}>
            <DeviceIcon
              device={props.data?.data?.kind}
              className={styles.deviceIcon}
            />
          </div>
          <div className={styles.valueContent}>
            <h2 className={styles.title}>
              <DeviceName device={props.data.data} />
            </h2>
            <p className={styles.subTitle}>
              <Trans>{props.data?.data?.kind}</Trans>
            </p>
          </div>
        </div>
      </components.SingleValue>
    );
  }

  return (
    <>
      <components.SingleValue {...props}>
        <div className={styles.valueWrapper}>
          <div className={styles.avatar}>
            <Avatar user={props.data?.data} />
          </div>
          <div className={styles.valueContent}>
            <h2 className={styles.title}>
              <UserNameNew user={props.data?.data} />
            </h2>
            <p className={styles.subTitle}>
              {props.data?.data?.meta?.birthdate &&
                format(
                  new Date(props.data?.data?.meta?.birthdate),
                  "dd.MM.yyyy",
                )}
            </p>
          </div>
        </div>
      </components.SingleValue>
    </>
  );
};

const ControlComponent = ({ ...props }: any) => {
  const activeUserDevice = useActiveUserDevice();
  const { trayDate, timeCategory } = useQs();
  const { kind } = useParams();
  const hasEpaperFeature = deviceKindHasFeature(
    "epaper",
    activeUserDevice.data?.kind,
  );

  return (
    <div className={styles.control}>
      <components.Control {...props} />
      {kind === "device" && hasEpaperFeature && (
        <NewEntryButton
          className={styles.addButton}
          icon={<AddIcon />}
          newDate={trayDate}
          newTimeCategory={timeCategory}
          kind="primary"
          small={false}
          iconReverse={false}
        >
          <Trans>New picture</Trans>
        </NewEntryButton>
      )}
      {kind === "user" && (
        <NewEntryButton
          className={styles.addButton}
          icon={<AddIcon />}
          newDate={trayDate}
          newTimeCategory={timeCategory}
          kind="primary"
          small={false}
          iconReverse={false}
        >
          <Trans>Intake</Trans>
        </NewEntryButton>
      )}
    </div>
  );
};

const Option = (props: any) => {
  const { data } = props;
  if (data.value === "all") {
    return (
      <components.Option {...props}>
        <h2 className={styles.title}>Patient overview</h2>
      </components.Option>
    );
  }
  if (data.value === "manage") {
    return (
      <components.Option {...props}>
        <h2 className={styles.title}>
          <FontAwesomeIcon icon={faUsersCog} /> Manage patients
        </h2>
      </components.Option>
    );
  }

  if (data?.kind === "device") {
    return (
      <components.Option {...props}>
        <div
          className={
            props.isSelected
              ? `${styles.optionWrapper} ${styles.optionWrapperSelected}`
              : styles.optionWrapper
          }
        >
          <DeviceIcon device={data.data?.kind} className={styles.deviceIcon} />
          <div>
            <h2 className={styles.title}>
              <DeviceName device={data.data} />
            </h2>
            <p className={styles.subTitle}>
              <Trans>{data.data?.kind}</Trans>
            </p>
          </div>
        </div>
      </components.Option>
    );
  }
  return (
    <components.Option {...props}>
      <div
        className={
          props.isSelected
            ? `${styles.optionWrapper} ${styles.optionWrapperSelected}`
            : styles.optionWrapper
        }
      >
        <Avatar
          kind="medium"
          user={data.data}
          className={styles.avatarSelect}
        />

        <div>
          <h2 className={styles.title}>
            <UserNameNew user={data?.data} />
          </h2>
          <p className={styles.subTitle}>
            {data.data?.meta?.birthdate &&
              format(new Date(data.data?.meta?.birthdate), "d.MM.yyyy")}
          </p>
        </div>
      </div>
    </components.Option>
  );
};

const formatGroupLabel = (data: any) => (
  <div className={styles.groupTitle}>
    <span className={styles.groupLabel}>
      <Trans>{data.label}</Trans>
    </span>
    {/*<Tag className={styles.groupCount}>{data.options.length}</Tag>*/}
  </div>
);

const customStyles = {
  control: (base) => ({
    ...base,
    //height: 68,
    //minHeight: 68,
  }),
};

export default function SelectCase() {
  const { entry, organization }: any = useParams();
  const allUsers = useUsersRequest(/*{ category: "patient" }*/);

  const allDevices = devicesApi.useGetAllDevicesQuery(
    {
      organizationId: organization,
    },
    { skip: !organization },
  );

  // const currentPatient = useActiveUser();
  // const activeDevice = useActiveDevice();

  const history = useHistory();

  const allUsersOptions: any = allUsers.data
    ? Object.values(allUsers.data).map((e: any) => {
        return {
          data: e,
          value: e.id,
          kind: "user",
          label: `${e.meta?.firstName} ${e.meta?.lastName}`,
        };
      })
    : [];

  const allDevicesOptions = allDevices.data
    ? allDevices.data.map((e) => {
        return {
          data: e,
          value: e.id,
          kind: "device",
          label: `${e.meta?.firstName} ${e.meta?.lastName}`,
        };
      })
    : [];

  /*const allUsersOptionsFiltered = allUsersOptions; .sort((u) =>
    allDevicesOptions.find((d) => d.data.patient === u.data.id)
  )*/

  const allUsersOptionsFiltered = allUsersOptions.filter(
    (d) => d.data.category === "patient",
  );
  const allDevicesOptionsFiltered = allDevicesOptions.filter(
    (d) => !d.data.patient,
  );

  const selectListTotal = [
    ...allUsersOptionsFiltered,
    ...allDevicesOptionsFiltered,
  ];

  const formatedcurrentPatient = selectListTotal.find((e) => e.value === entry);

  /* const formatedcurrentPatient =
    kind === "device"
      ? {
          data: activeDevice.data,
          value: activeDevice.data?.id,
          label: `Device`,
        }
      : currentPatient
      ? {
          data: currentPatient,
          value: currentPatient.id,
          label: `${currentPatient.meta?.firstName} ${currentPatient.meta?.lastName}`,
        }
      : undefined; */

  //const qsElements = useQs();
  // const { trayDate } = qsElements;
  //const trayDateSelected = trayDate || new Date().toISOString();

  const calendarUrl: any = useCalendarUrl();

  /* const queryString = qs.stringify({
    ...qsElements,
    trayDate: trayDateSelected,
  }); */

  const classes = classnames(styles.select, {
    [styles.oneOption]: selectListTotal.length <= 1,
  });

  const isDesktop = useIsDesktop();

  const groupedOptions = [
    {
      label: "Users",
      options: allUsersOptionsFiltered,
    },
    {
      label: "Devices",
      options: allDevicesOptionsFiltered,
    },
  ];

  return (
    <Select
      options={groupedOptions}
      className={classes}
      classNamePrefix="react-select"
      maxMenuHeight={490}
      isSearchable={selectListTotal.length > 3 && isDesktop}
      styles={customStyles}
      value={formatedcurrentPatient}
      formatGroupLabel={formatGroupLabel}
      // menuIsOpen
      // isDisabled={selectListTotal.length <= 1 ? true : false}
      components={{
        Control: ControlComponent,
        SingleValue,
        Option,
        GroupHeading,
        NoOptionsMessage,
      }}
      onChange={(e) => {
        if (e.value === "manage") {
          history.push(`/${organization}/users`);
        } else {
          history.push(calendarUrl({ entry: e.value, kind: e.kind }));
        }
      }}
    />
  );
}
