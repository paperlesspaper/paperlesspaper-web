import {
  Button,
  TextInput,
  BlockNotification,
  // TextArea,
  // Checkbox,
} from "@progressiveui/react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsContentWrapper from "components/SettingsContent/SettingsContentWrapper";
import { Trans, useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useDispatch } from "react-redux";
import styles from "./styles.module.scss";
import React, { useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import Avatar from "components/Avatar";
import {
  faCheckCircle,
  faTimesCircle,
  faChevronRight,
  faUserCircle,
} from "@fortawesome/pro-solid-svg-icons";
import useCurrentUser from "helpers/useCurrentUser";
import {
  useActiveUserDevice,
  useUsersWithCurrentOrganization,
} from "helpers/useUsers";
import ButtonRouter from "components/ButtonRouter";
import DeviceIcon from "components/DeviceIcon";
import FormRow from "components/FormRow";
import DeleteModal from "components/DeleteModal";
import { usersApi } from "ducks/usersApi";
import { UserName, UserNameNew, userNameString } from "components/UserName";
import TimezoneSelect from "components/inputs/TimezoneSelect";
import { Controller } from "react-hook-form";

import globalState from "ducks/globalState";
import InlineLoadingLarge from "components/InlineLoadingLarge";
import GenderPicker from "components/inputs/GenderPicker";
import AddIcon from "components/Settings/components/AddIcon";
import DateInput from "components/inputs/TimeInput/DateInput";
import { DeleteQuestionTitle as DeleteQuestionTitleOriginal } from "components/DeleteModal";
import { generateUserName } from "components/UserName/generateUserName";
import TextInputWithCopy from "components/inputs/TextInputWithCopy";

function EntryName({ entry }: any) {
  return <UserName id={entry?.id} />;
}

function NewEntrySuccess(props: any) {
  const { entryData, defaultComponents } = props;
  if (entryData?.role === "patient")
    return <defaultComponents.NewEntrySuccess {...props} />;
  return <div>Die Einladung wurde versendet.</div>;
}

function DeleteQuestion(props: any) {
  const { entryData, urlId } = props;
  const activeUserDevice = useActiveUserDevice();
  const adminUsers = useUsersWithCurrentOrganization({ role: "admin" });
  const currentUser = useCurrentUser();

  const USERNAME = generateUserName(entryData);

  return activeUserDevice.data && activeUserDevice.data.length !== 0 ? (
    <Trans>Please remove the connected device first.</Trans>
  ) : adminUsers.length < 2 && entryData && entryData.role === "admin" ? (
    <Trans>You need to add another admin first.</Trans>
  ) : currentUser.data?.id === urlId ? (
    <Trans>Do you want to leave the organization?</Trans>
  ) : entryData?.status === "invited" ? (
    <Trans>Are you sure that you want to remove the invitation?</Trans>
  ) : (
    <Trans i18nKey="deleteQuestionRemove" values={{ USERNAME: USERNAME }}>
      Are you sure that you want to remove <b>{USERNAME}</b> from the
      organization?
    </Trans>
  );
}

function DeleteQuestionTitle(props: any) {
  const { entryData, urlId } = props;
  const activeUserDevice = useActiveUserDevice();
  const adminUsers = useUsersWithCurrentOrganization({ role: "admin" });
  const currentUser = useCurrentUser();

  return activeUserDevice.data && activeUserDevice.data.length !== 0 ? (
    <Trans>User still has connected devices</Trans>
  ) : adminUsers.length < 2 && entryData && entryData.role === "admin" ? (
    <Trans>Last Admin can not be removed</Trans>
  ) : currentUser.data?.id === urlId ? (
    <Trans>Exit organization</Trans>
  ) : (
    <DeleteQuestionTitleOriginal {...props} />
  );
}

export default function SettingsUsersDetail() {
  const { entry, organization } = useParams();
  const history = useHistory();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const activeUserDevice = useActiveUserDevice();
  const adminUsers = useUsersWithCurrentOrganization({ role: "admin" });
  const currentUser = useCurrentUser();

  const prepareSubmit = (values, entryData, { urlId }) => {
    if (role !== "patient" && urlId === "new") {
      return { email: values.email, category: "relative", role: "user" };
    }
    delete values.owner;
    delete values.status;
    delete values.auth0User;
    const { ...newValues } = values;
    return newValues;
  };

  const store = useSettingsForm({
    api: usersApi,
    url: `/${organization}/users`,
    prepareSubmit,
    newEntryData: { role: "invite" },
    prepareFormEntry: (values) => {
      const timezone = values?.timezone ? values?.timezone : "Europe/Berlin";
      const role = values?.role ? values?.role : "patient";
      const category = values?.category ? values?.category : "patient";
      return { ...values, timezone, role, category };
    },
    entryName: (entry) => userNameString({ id: entry?.id }),
    customDeleteRedirect: ({ defaultRedirect, urlId }) => {
      if (currentUser.data?.id === urlId) history.push(`/`);
      else history.push(defaultRedirect);
    },
  });

  const {
    urlId,
    entryData,
    organizationId,
    form: {
      setValue,
      control,
      register,
      watch,
      formState: { errors },
    },
  } = store;

  const role = watch("role");
  const categoryWatch = watch("category");

  useEffect(() => {
    if (role === "patient" && urlId === "new") setValue("category", "patient");
  }, [role]);

  useEffect(() => {
    if (entry && categoryWatch === "patient")
      dispatch(globalState.actions.setLastUser({ entry, kind: "user" }));
  }, [entry]);

  const [updateSingleUser] = usersApi.useUpdateSingleUsersMutation();

  const acceptOrganizationInvite = () => {
    updateSingleUser({
      values: {
        userId: urlId,
        organizationId: organizationId,
        status: "accept",
      },
    });
  };

  const disableDelete =
    (activeUserDevice.data && activeUserDevice.data.length !== 0) ||
    (adminUsers.length < 2 && entryData && entryData.role === "admin")
      ? true
      : false;

  return (
    <SettingsContentWrapper
      {...store}
      disableDelete={disableDelete}
      components={{
        EntryName,
        NewEntrySuccess,
        DeleteQuestion,
        DeleteQuestionTitle,
      }}
      primaryButtonText={<Trans>Remove</Trans>}
      submitButtonTitle={
        urlId === "new" && role !== "patient" ? (
          <Trans>Invite</Trans>
        ) : undefined
      }
      customDeleteButtonText={<Trans>Remove user</Trans>}
      title={
        urlId === "new" && role === "patient" ? (
          <Trans>New user</Trans>
        ) : urlId === "new" ? (
          <Trans>Invite user</Trans>
        ) : (
          <UserNameNew user={entryData} />
        )
      }
    >
      {!entryData ? (
        <InlineLoadingLarge />
      ) : (
        <>
          {urlId !== "new" && (
            <>
              {entryData?.role === "onlyself" && (
                <BlockNotification
                  kind="warning"
                  title={
                    <>
                      <Trans>Experimental feature</Trans>:{" "}
                      <Trans>Limited access</Trans>
                    </>
                  }
                  subtitle={
                    <Trans>
                      The user can only view its own data and device.
                    </Trans>
                  }
                />
              )}
              {activeUserDevice.data?.id ? (
                <BlockNotification
                  actions={
                    <ButtonRouter
                      withOrganization
                      isLink
                      icon={<FontAwesomeIcon icon={faChevronRight} />}
                      to={`/devices/${activeUserDevice.data.id}`}
                    >
                      <Trans>Go to device</Trans>
                    </ButtonRouter>
                  }
                  // advancedActions
                  title={<Trans>Associated device</Trans>}
                  subtitle={
                    <Trans i18nKey="userConnectedDevice">
                      The user has a connected{" "}
                      {{ NAME: t(activeUserDevice.data.kind) }}.
                    </Trans>
                  }
                  kind="info"
                  icon={
                    <DeviceIcon
                      device={activeUserDevice.data.kind}
                      className={styles.deviceIcon}
                    />
                  }
                />
              ) : entryData.category === "patient" ? (
                <BlockNotification
                  kind="info"
                  actions={
                    <ButtonRouter
                      withOrganization
                      isLink
                      to={`/devices/new/?patient=${entryData.id}`}
                      icon={<AddIcon />}
                    >
                      <Trans>Add device</Trans>
                    </ButtonRouter>
                  }
                  // advancedActions
                  title={<Trans>No device setup</Trans>}
                  subtitle={<Trans>Add a device to this patient</Trans>}
                />
              ) : (
                <></>
              )}
            </>
          )}

          {currentUser.data?.id === urlId && (
            <BlockNotification
              title={<Trans>This is your account</Trans>}
              subtitle={
                <Trans>
                  Change your language, etc. in the account settings.
                </Trans>
              }
              kind="info"
              actions={
                <ButtonRouter
                  isLink
                  to={`/account?previousPath=/${currentUser.data.organization}/users/${currentUser.data.id}`}
                  icon={<FontAwesomeIcon icon={faUserCircle} />}
                >
                  <Trans>Account settings</Trans>
                </ButtonRouter>
              }
              // advancedActions
            />
          )}
          {currentUser.data?.id === urlId &&
          entryData.status === "invited" &&
          urlId !== "new" ? (
            <BlockNotification
              kind="info"
              actions={
                <>
                  <Button
                    onClick={acceptOrganizationInvite}
                    icon={<FontAwesomeIcon icon={faCheckCircle} />}
                  >
                    <Trans>Accept</Trans>
                  </Button>
                  <DeleteModal
                    {...store}
                    customButton={
                      <Button
                        kind="danger--primary"
                        icon={<FontAwesomeIcon icon={faTimesCircle} />}
                      >
                        <Trans>Reject</Trans>
                      </Button>
                    }
                  />
                </>
              }
              title={<Trans>Membership</Trans>}
              subtitle={<Trans>You are invited to join the group.</Trans>}
            />
          ) : entryData.status === "invited" ? (
            <>
              <BlockNotification
                kind="info"
                title={<Trans>Waiting to join the group</Trans>}
                subtitle={
                  <Trans>
                    The user is invited to join the group, but has not yet
                    accepted to join this group.
                  </Trans>
                }
              />

              <TextInputWithCopy
                labelText={<Trans>Invite via link</Trans>}
                helperText={
                  <Trans>
                    The person with the unique link can join your group
                  </Trans>
                }
                copyButtonText={<Trans>Copy invite link</Trans>}
                tooltipContent={(copied) =>
                  copied ? (
                    <Trans>Link copied</Trans>
                  ) : (
                    <Trans>Click to copy link...</Trans>
                  )
                }
                value={`${import.meta.env.REACT_APP_AUTH_REDIRECT_URL}/${
                  entryData.organization
                }/invite/${entryData.inviteCode}`}
              />
            </>
          ) : null}

          {((urlId === "new" && role === "patient") || urlId !== "new") &&
          entryData.status !== "invited" ? (
            <>
              {(urlId === "new" || !entryData.owner) && (
                <FormRow>
                  <div className={styles.formRowCol}>
                    <TextInput
                      labelText={<Trans>First name</Trans>}
                      {...register("meta.firstName")}
                    />
                  </div>
                  <div className={styles.formRowCol}>
                    <TextInput
                      labelText={<Trans>Last name</Trans>}
                      {...register("meta.lastName")}
                    />
                  </div>
                </FormRow>
              )}

              {role === "patient" && (
                <>
                  <DateInput
                    control={control}
                    name="meta.birthdate"
                    dateProps={{
                      showYearDropdown: true,
                      dropdownMode: "select",
                      openToDate: entryData.meta?.birthdate
                        ? undefined
                        : new Date("1950/01/01"),
                    }}
                    labelText={<Trans>Birthdate</Trans>}
                  />
                  <GenderPicker register={register} name="meta.gender" />
                </>
              )}

              {categoryWatch === "patient" && (
                <>
                  <Controller
                    control={control}
                    name="timezone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TimezoneSelect
                        onChange={(e) => onChange(e.utc[0])}
                        onBlur={onBlur}
                        value={value}
                        labelText={<Trans>Timezone</Trans>}
                        helperText={
                          <Trans>
                            Select the timezone where the device is in use
                          </Trans>
                        }
                      />
                    )}
                  />
                </>
              )}
              <div>
                {urlId !== "new" && (
                  <>
                    {entryData && entryData.avatar ? (
                      <>
                        <Avatar
                          alt="avatar"
                          image={entryData.avatar}
                          className={styles.currentImage}
                        />
                      </>
                    ) : (
                      <>
                        {/*<div className={styles.noImage}>
                          <Trans>No photo set</Trans>
                        </div>
                    <br />*/}
                      </>
                    )}
                    {/*<UploadButton
                  userImage={entryData?.avatar}
                  onUpload={(file) => {
                    dispatch(
                      users.actions.updateUserImage({
                        user: urlId,
                        bodyFormData: file,
                      })
                    );
                  }}
                />*/}
                  </>
                )}
              </div>
            </>
          ) : (
            <div>
              <TextInput
                labelText={<Trans>email</Trans>}
                helperText={
                  <Trans>Enter the email of an user you want to invite.</Trans>
                }
                {...register("email", {
                  required: true,
                })}
                invalid={errors?.email}
                placeholder={t("placeholder@placeholder.de")}
                invalidText={t("Please enter an email address")}
              />
            </div>
          )}
          {/* <SettingsSubmitButton
            {...store}
            title={
              urlId === "new" && role === "patient" ? (
                <Trans>Create patient</Trans>
              ) : urlId === "new" ? (
                <Trans>Invite user</Trans>
              ) : entryData?.status === "invited" ? (
                <Trans>Send again</Trans>
              ) : undefined
            }
          /> */}
        </>
      )}
    </SettingsContentWrapper>
  );
}
