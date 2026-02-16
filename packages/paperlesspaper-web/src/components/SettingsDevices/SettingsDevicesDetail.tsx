import React from "react";

import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { devicesApi } from "ducks/devices";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  InputGroup,
  TextInput,
  BlockNotification,
  Checkbox,
} from "@progressiveui/react";
import styles from "./settingsDevicesDetail.module.scss";
import MultiCheckbox from "components/MultiCheckbox";
import deviceList, {
  deviceByKind,
  deviceKindHasFeature,
} from "helpers/devices/deviceList";
import DeviceIcon from "components/DeviceIcon";
import UserSelect from "components/inputs/UserSelect";
import DeviceIdFormatted from "./DeviceIdFormatted";
import DebugDevice from "./DebugDevice";
import { useDebug } from "helpers/useCurrentUser";
import ButtonRouter from "components/ButtonRouter";
import DeviceStatus from "./DeviceStatus";
import pick from "helpers/pickValues";
import DeviceSettings from "components/Epaper/Settings/DeviceSettings";
import { isDesktop } from "react-device-detect";

function NewEntrySuccess() {
  return <Trans>The device was added successfully</Trans>;
}

function UpdateEntrySuccess() {
  return <Trans>The device has been successfully updated</Trans>;
}

export default function SettingsDevicesDetail() {
  const params = useParams();

  const prepareFormEntry = (values) => {
    if (!values)
      return {
        meta: {
          showOverlay: true,
        },
      };

    const ensureEpaperDefaults = (payload) => {
      if (!deviceKindHasFeature("epaper", values?.kind) || !payload)
        return payload;

      const meta = { ...(payload.meta || {}) };

      meta.sleepTime = meta.sleepTime || "3600";
      if (meta.showOverlay === undefined) {
        meta.showOverlay = true;
      }

      return {
        ...payload,
        meta,
      };
    };

    // eslint-disable-next-line no-var
    var filteredValues = pick(
      values,
      "deviceId",
      "organization",
      "meta",
      "patient",
      "alarmEnable",
      "takeOffsetTime",
    );

    const shadows = values?.shadow?.state?.reported;

    filteredValues = ensureEpaperDefaults(filteredValues);

    if (shadows)
      return {
        ...filteredValues,
        name: values.name,
        proxyReport: shadows.proxy_report ? true : false,
        alarmEnable:
          shadows.alarm_enable !== undefined
            ? `alarm-${shadows.alarm_enable.toString()}`
            : "alarm-2",
        takeOffsetTime: shadows.take_offset_time
          ? shadows.take_offset_time / 60 / 60
          : "10800",
      };

    return ensureEpaperDefaults(values);
  };

  const prepareSubmit = (values) => {
    const submitValues = pick(
      values,
      "deviceId",
      "organization",
      "kind",
      "meta",
      "patient",
      "alarmEnable",
      "takeOffsetTime",
    );

    console.log("prepareSubmit values", values);

    if (values.deviceId) {
      submitValues.deviceId = values.deviceId.replace(/\s/g, "");
    }
    if (values.deviceId) {
      delete submitValues.kind;
    } else {
      delete submitValues.deviceId;
    }

    if (values.patient === "") {
      submitValues.patient = null;
    }

    if (values.alarmEnable)
      submitValues.alarmEnable = parseInt(
        values.alarmEnable.replace("alarm-", ""),
      );

    if (values.takeOffsetTime)
      submitValues.takeOffsetTime = parseInt(values.takeOffsetTime) * 60 * 60;
    return submitValues;
  };

  const store = useSettingsForm({
    api: devicesApi,
    prepareFormEntry,
    prepareSubmit,
  });

  const {
    entryData,
    urlId,
    form: {
      formState: { errors },
      control,
      register,
    },
  } = store;

  const hasEpaperFeature = deviceKindHasFeature("epaper", entryData?.kind);

  const debug = useDebug();

  const deviceMeta = deviceByKind(entryData?.kind);

  const devicesApiGetAll = devicesApi.useGetAllDevicesQuery(
    {
      organizationId: params.organization,
    },
    { skip: !params.organization },
  );

  const filterData = (data) => {
    if (!data || !devicesApiGetAll.data) return [];
    return data.map((u) => {
      if (
        devicesApiGetAll.data.find(
          (d) =>
            (d.patient === u.id || u.category !== "patient") &&
            d.patient !== entryData?.patient,
        )
      ) {
        return { ...u, disabled: true };
      }
      return u;
    });
  };
  const { t } = useTranslation();

  const deviceKind = deviceByKind(entryData?.kind);

  console.log("urlId", urlId);

  return (
    <SettingsContentWrapper
      {...store}
      title={
        urlId === "new" && isDesktop ? (
          <Trans>Add new analoge device</Trans>
        ) : urlId === "new" ? (
          <Trans>New device</Trans>
        ) : (
          <Trans>Edit device</Trans>
        )
      }
      deleteValidationQuestionValue={entryData?.meta?.name || t("delete")}
      components={{ NewEntrySuccess, UpdateEntrySuccess }}
      afterContent={
        urlId !== "new" && debug ? <DebugDevice id={entryData?.id} /> : null
      }
    >
      {urlId === "new" ? (
        <>
          <InputGroup
            labelText={<Trans>Which product do you want add?</Trans>}
            className={styles.alarmWrapper}
          >
            {deviceList
              .filter((e) => e.features?.includes("analog"))
              .map((e, i) => (
                <MultiCheckbox
                  key={i}
                  className={styles.medicationRadio}
                  description={<Trans>{e.description}</Trans>}
                  kind="vertical"
                  icon={
                    <img
                      src={e.image}
                      className={styles.deviceImage}
                      alt={e.name}
                    />
                  }
                  labelText={e.name}
                  /* labelText={
                    <div>
                      <img
                        src={e.image}
                        className={styles.deviceImage}
                        alt={e.name}
                      />
                      <span className={styles.deviceDescription}>{e.name}</span>
                    </div>
                  } */
                  type="radio"
                  id={e.id}
                  value={e.id}
                  {...register("kind")}
                />
              ))}
          </InputGroup>

          {/*  <SettingsSubmitButton {...store} title={<Trans>Add device</Trans>} /> */}

          <ButtonRouter isPlain to={`./new`}>
            <Trans>Add digital device</Trans>
          </ButtonRouter>
        </>
      ) : (
        <>
          <BlockNotification
            icon={
              <DeviceIcon
                device={entryData?.kind}
                className={styles.deviceIconDetails}
              />
            }
            lowContrast
            kind="info"
            hideCloseButton
            title={<Trans>{deviceMeta?.name}</Trans>}
            subtitle={
              hasEpaperFeature ? (
                <>
                  <Trans>{deviceKind?.description}</Trans>
                  <br />
                  <DeviceIdFormatted title={"ID:"} kind={entryData?.kind}>
                    {entryData?.deviceId}
                  </DeviceIdFormatted>
                </>
              ) : (
                <Trans>{deviceKind?.description}</Trans>
              )
            }
          />
          <DeviceStatus id={entryData?.id} className={styles.deviceStatus} />
          <TextInput
            labelText="Name"
            helperText={<Trans>A description for the device</Trans>}
            {...register("meta.name")}
          />
          {!hasEpaperFeature && (
            <UserSelect
              filterData={filterData}
              category="patient"
              control={control}
              name="patient"
              helperText={<Trans>Name of the devices user</Trans>}
            />
          )}
          {hasEpaperFeature && (
            <DeviceSettings
              {...store}
              entryData={entryData}
              register={register}
              control={control}
              errors={errors}
            />
          )}
          {hasEpaperFeature && (
            <>
              <h3>
                <Trans>Advanced settings</Trans>
              </h3>
              <InputGroup
                labelText={<Trans>Warning overlays</Trans>}
                helperText={
                  <Trans>
                    Toggle the &apos;No Wifi&apos; and &apos;Battery low&apos;
                    overlay on the picture frame.
                  </Trans>
                }
              >
                <Checkbox
                  type="checkbox"
                  id="settings-device-show-overlay"
                  labelText={<Trans>Show overlay on picture frame</Trans>}
                  {...register("meta.showOverlay")}
                />
              </InputGroup>
            </>
          )}
        </>
      )}
    </SettingsContentWrapper>
  );
}
