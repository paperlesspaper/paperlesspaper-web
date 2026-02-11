import React from "react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ButtonRouter from "components/ButtonRouter";
import { NavLink } from "react-router-dom";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import { usersApi } from "ducks/usersApi";
import { devicesApi } from "ducks/devices";
import JsonViewer from "components/JsonViewer";
import { UserNameNew } from "components/UserName";
import DeviceName from "components/DeviceName";
import { Callout, Link, TextArea, TextInput } from "@progressiveui/react";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { Controller } from "react-hook-form";
import ReactSelect from "react-select";
import MultiSelect from "components/inputs/MultiSelect";
import { Trans } from "react-i18next";

export default function SettingsNotificationsDetail() {
  const prepareSubmit = (values, entryData) => {
    return {
      payment: {
        customer: values.payment.customer,
        id: values.payment.id,
      },
      iotDevice: {
        meta: {
          description: values.iotDevice.meta.description,
          tags: values.iotDevice.meta.tags /* .map((e) => e.value) */,
          shipping: values.iotDevice.meta.shipping,
        },
      },
      organization: values.organization,
      /* iotDevice: {
        meta: {
          description: entry?.meta?.description,
        },
      },*/
    };
  };

  const store = useSettingsForm({
    api: devicesApi,
    prepareSubmit,
    withOrganization: false,
  });

  const { entryData } = store;

  const { data: usersData } = usersApi.useGetSingleUsersQuery(
    entryData?.patient,
  );

  /*
  const { data: devicesData } = devicesApi.useGetAllDevicesQuery({
    organizationId: entry,
  }); */

  const options = ["home", "work", "other"].map((e) => ({
    value: e,
    label: e,
  }));

  return (
    <SettingsContentWrapper
      {...store}
      hideDelete
      title={
        <DeviceName device={entryData} />
      } /*components={{ SettingsMobileHeader }}*/
    >
      {entryData?.deviceId && (
        <>
          <TextArea
            labelText={<Trans>Meta Information</Trans>}
            value={entryData?.meta?.description}
            {...store.form.register("iotDevice.meta.description")}
          />
          <Controller
            control={store.form.control}
            name="iotDevice.meta.tags"
            render={({ field }) => (
              <MultiSelect
                options={options}
                {...field}
                onChange={(e) => {
                  field.onChange(e.map((e) => e.value));
                }}
                value={options.filter((option) =>
                  field.value?.includes(option.value),
                )}
                labelText="Tags"
              />
            )}
          />

          {/* <TextInput
            labelText="Stripe Customer"
            value={entryData?.meta?.description}
            helperText={
              <>
                Stripe Customer id, starts with cus_{" "}
                <Link
                  href={`https://dashboard.stripe.com/customers/${customer}`}
                  target="_blank"
                >
                  Visit customer
                </Link>
              </>
            }
            {...store.form.register("payment.customer")}
          /> */}

          {/* <TextInput
            labelText="Stripe Customer Live id"
            //value={entryData?.meta?.description}
            {...store.form.register("payment.id")}
          /> */}

          <TextInput
            labelText={<Trans>Tracking number</Trans>}
            helperText={
              <>
                <Trans>Tracking number for the device, e.g. from UPS</Trans>{" "}
                <Link
                  href={`https://www.ups.com/track?loc=de_DE&tracknum`}
                  target="_blank"
                >
                  <Trans>Visit Tracking</Trans>
                </Link>
              </>
            }
            // value={entryData?.meta?.shipping}
            {...store.form.register("iotDevice.meta.shipping")}
          />
        </>
      )}
      <br />
      <SettingsSubmitButton {...store} />
      <ButtonRouter
        isLink
        to={`/${entryData?.organization}/devices/${entryData?.id}`}
        icon={<FontAwesomeIcon icon={faChevronRight} />}
        kind="tertiary"
      >
        <Trans>Visit device</Trans>
      </ButtonRouter>
      <br />
      <Callout title="Debug Informations">
        Here you can find the raw data of the device and the user connected to
        it.
      </Callout>
      <h3>
        <Trans>Device</Trans>
      </h3>
      <JsonViewer src={entryData} />
      <h3>
        <Trans>User</Trans>
      </h3>
      {usersData?.id ? (
        <NavLink to={`/${entryData?.organization}/users/${usersData?.id}`}>
          <UserNameNew user={usersData} />
        </NavLink>
      ) : (
        <Trans>No user connected</Trans>
      )}
      <br /> <br />
      <JsonViewer src={usersData} />
    </SettingsContentWrapper>
  );
}
