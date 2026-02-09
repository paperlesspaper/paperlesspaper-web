import React, { useEffect } from "react";
import {
  Button,
  Checkbox,
  BlockNotification,
  Tag,
  TextInput,
  InputGroup,
  Link,
  Story,
  useTheme,
  InlineLoading,
  Select,
  SelectItem,
  Callout,
} from "@progressiveui/react";
import MultiCheckbox from "components/MultiCheckbox";
import { accountsApi } from "ducks/accounts";
import { Trans, useTranslation } from "react-i18next";
import useQs from "helpers/useQs";
import useSettingsForm from "helpers/useSettingsFormNew";
import { SettingsGlobal } from "components/Settings/SettingsWithSidebar";
import styles from "./styles.module.scss";
import { useHistory } from "react-router";
// import SettingsSubmitButton from "components/SettingsContent/SettingsSubmitButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrochipAi,
  faScrewdriverWrench,
  faSignOut,
} from "@fortawesome/pro-solid-svg-icons";

//import { faEnvelope } from "@fortawesome/pro-regular-svg-icons";
import FormRow from "components/FormRow";
import { Col } from "react-flexbox-grid";
//import GenderPicker from "components/GenderPicker";
import { notificationsApi } from "ducks/notificationsApi";
import Status from "components/Status";
import ButtonRouter from "components/ButtonRouter";
import DeleteModal from "components/DeleteModal";
import { useCurrentAccount, useDebug, useDemo } from "helpers/useCurrentUser";
import { providerList } from "helpers/providerLookup";
import useAccount from "helpers/useAccount";
import { devicesNotificationsApi } from "ducks/devicesNotificationsApi";
import HelmetTitle from "components/HelmetMeta/HelmetTitle";
// import LoginImage from "components/Login/LoginImage";
import JsonViewer from "components/JsonViewer";
// import ReactJson from "react-json-view";
import { usersApi } from "ducks/usersApi";
import languages from "translation/languages";
import EnableMfaButton from "components/Mfa";
import ApiManager from "./ApiManager";
import DeviceIdFormatted from "components/SettingsDevices/DeviceIdFormatted";
import {
  faMoon,
  faRotate,
  faSunBright,
} from "@fortawesome/pro-light-svg-icons";

export default function AccountPage() {
  const history = useHistory();
  //const { getTokenSilently, } = useAuth0();
  const account = useAccount();
  const accountWithMeta = useCurrentAccount();
  const { getAccessTokenSilently, logout, user } = account;

  const updateMetadata = async () => {
    await getAccessTokenSilently({ ignoreCache: true });
    accountWithMeta.refetch();
  };

  const settings = useTheme();

  const store = useSettingsForm({
    api: accountsApi,
    id: user.sub,
    //preventReset: true,
    prepareFormEntry: (values) => {
      return {
        ...values?.app_metadata,
        colorscheme: settings.theme,
        family_name:
          values?.app_metadata?.last_name ||
          values?.family_name ||
          values?.last_name,
        given_name:
          values?.app_metadata?.first_name ||
          values?.given_name ||
          values?.first_name,
        email: values?.email,
        notification: values?.notification,
      };
    },
    idElement: (entry) => entry?.user_id,
    prepareSubmit: (values, entryData) => {
      settings.setTheme(values?.colorscheme);
      return {
        // gender: values.gender,
        language: values.language,
        family_name: values.family_name,
        given_name: values.given_name,
        debug: values.debug,
        email: values.email,
        demo: values.demo,
        id: entryData.user_id,
        notification: values?.notification,
      };
    },
    customDeleteRedirect: () => {
      history.push("/?show=always&action=userDeleted");
    },
    customOverviewUrl: `/`,
  });

  const {
    singleQuery,
    resultUpdateSingle,
    form: {
      register,
      watch,
      formState: { errors },
    },
  } = store;

  useEffect(() => {
    updateMetadata();
  }, [resultUpdateSingle.data?.app_metadata?.language]);

  const provider = singleQuery.data?.identities?.[0]?.provider;

  const { previousPath, organization } = useQs();
  const debug = watch("debug");
  const theme = watch("colorscheme");
  const language = watch("language");
  const { t, i18n } = useTranslation();

  useEffect(() => {
    settings.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (
      resultUpdateSingle.isSuccess &&
      language &&
      i18n.language !== language
    ) {
      i18n.changeLanguage(language);
    }
  }, [i18n, language, resultUpdateSingle.isSuccess]);

  const [sendDefaultNotification, sendDefaultNotificationResult] =
    notificationsApi.useSendDefaultNotificationMutation();

  const [deleteUser, deleteUserResult] =
    accountsApi.useDeleteCurrentUserMutation();

  const notifications =
    devicesNotificationsApi.useGetAllDevicesnotificationsQuery();

  const [useSendVerificationEmail, useSendVerificationEmailResult] =
    usersApi.useSendVerificationEmailMutation();

  const isDebug = useDebug();
  const isDemo = useDemo();

  useEffect(() => {
    if (deleteUserResult.isSuccess === true) {
      logout();
    }
  }, [deleteUserResult.isSuccess]);

  const backLink = previousPath
    ? (previousPath as string)
    : organization
      ? `${organization}/advanced`
      : "/";
  /*  showBackLink
      // hideImageMobile
      
    
      backLinkIconReverse={true}
      // rightSide={<LoginImage />}
      rightSide={false} */
  return (
    <>
      <HelmetTitle>Account Settings-DU</HelmetTitle>
      <SettingsGlobal
        {...store}
        overviewUrl={backLink}
        sidebarBackButtonTitle={
          <Trans>{previousPath || organization ? `Back` : "Overview"}</Trans>
        }
        title={<Trans>Account Settings-DU</Trans>}
        customDelete={
          <div>
            <Button
              kind="tertiary"
              icon={<FontAwesomeIcon icon={faSignOut} />}
              onClick={() => logout()}
            >
              <Trans>Logout</Trans>
            </Button>
          </div>
        }
      >
        <>
          {account?.user?.email_verified === false && (
            <BlockNotification
              onClick={() => useSendVerificationEmail()}
              actions={
                useSendVerificationEmailResult.isSuccess ? (
                  <InlineLoading success />
                ) : useSendVerificationEmailResult.isLoading ? (
                  <InlineLoading />
                ) : (
                  <Button
                  //icon={<FontAwesomeIcon icon={faEnvelope} />}
                  >
                    <Trans>Resend</Trans>
                  </Button>
                )
              }
              kind="warning"
              title={<Trans>Email confirmation pending</Trans>}
            >
              <Trans>Please confirm your email address.</Trans>
            </BlockNotification>
          )}
          {isDebug && (
            <BlockNotification
              kind="info"
              title={<Trans>Debug mode enabled</Trans>}
            ></BlockNotification>
          )}
          {isDemo && <div>Demo mode enabled</div>}

          <FormRow>
            <Col xs={12} md={6}>
              <TextInput
                labelText={<Trans>First name</Trans>}
                {...register("given_name", {
                  //  required: t("Enter a first name"),
                })}
                invalid={errors?.given_name}
              />
            </Col>
            <Col xs={12} md={6}>
              <TextInput
                labelText={<Trans>Last name</Trans>}
                {...register("family_name", {
                  // required: t("Enter a last name"),
                })}
                invalid={errors?.family_name}
              />
            </Col>
          </FormRow>

          {provider === "apple" ||
          provider === "google" ||
          provider === "google-oauth2" ? (
            <div className={styles.loginProvider}>
              <FontAwesomeIcon
                icon={providerList[provider]?.icon}
                className={styles.loginProviderIcon}
              />
              <span>
                Angemeldet mit <Trans>{providerList[provider]?.name}</Trans>
                <br />
                <Link
                  href={providerList[provider]?.manageLink}
                  target="_blank"
                  className={styles.manageLink}
                >
                  <Trans>Manage account</Trans>
                </Link>
              </span>
            </div>
          ) : (
            <TextInput
              formItemClassName={styles.name}
              labelText={<Trans>Email</Trans>}
              {...register("email")}
            />
          )}
          {/* } <GenderPicker
            register={register}
            options={
              {
                //required: "Please enter a name",
              }
            }
          /> */}

          <InputGroup
            labelText={<Trans>Appearance</Trans>}
            className={styles.colorscheme + ` wfp--input-group`}
            /*helperText={
              <Trans>Select the language you want to use memo.</Trans>
            }*/
          >
            <MultiCheckbox
              labelText={<Trans>Light</Trans>}
              value="light"
              type="radio"
              icon={<FontAwesomeIcon icon={faSunBright} />}
              {...register("colorscheme")}
            />
            <MultiCheckbox
              labelText={<Trans>Dark</Trans>}
              value="dark"
              type="radio"
              icon={<FontAwesomeIcon icon={faMoon} />}
              {...register("colorscheme")}
            />
            <MultiCheckbox
              labelText={<Trans>Auto</Trans>}
              value="auto"
              type="radio"
              icon={<FontAwesomeIcon icon={faRotate} />}
              {...register("colorscheme")}
            />
          </InputGroup>

          <Select
            labelText={
              <>
                <Trans>Language</Trans>
                {i18n.language !== "en" && " (language)"}
              </>
            }
            {...register("language")}
          >
            {Object.entries(languages).map(([key, language]: any) => (
              <SelectItem
                text={`${language.original} (${t(language.name)})${
                  language.experimental ? ` [experimental]` : ""
                }`}
                key={key}
                value={key}
              />
            ))}
          </Select>

          {/*<InputGroup
            kind="vertical"
            labelText={<Trans>Benachrichtigungen</Trans>}
            helperText={
              <>
                <Trans>
                  Wählen Sie welche Benachrichtigungen Sie erhalten möchten
                </Trans>{" "}
              </>
            }
          >*/}

          {/* <Callout kind="info" title={<Trans>ID of the group</Trans>}>
            <Trans>The Group has the</Trans>{" "}
            <DeviceIdFormatted title={"ID:"} kind="objectId">
              {account?.user?.sub}

              <br />
            </DeviceIdFormatted>
          </Callout> */}
          {/*</InputGroup>*/}
          {(import.meta.env.MODE === "development" || account.isDebug) && (
            <>
              <h3>Developers</h3>
              <Checkbox
                labelText={<Trans>Enable debug and developer settings</Trans>}
                type="checkbox"
                id="debug"
                placeholder="debug"
                {...register("debug", {})}
              />
            </>
          )}
          {/*<Checkbox
            labelText={<Trans>Demo mode</Trans>}
            type="checkbox"
            id="demo"
            placeholder="demo"
            {...register("demo", {})}
          />*/}
          <BlockNotification
            kind="error"
            title={<Trans>Delete Account</Trans>}
            icon={false}
            // advancedActions
            actions={
              <DeleteModal
                customDeleteQuestionTitle={<Trans>Delete Account</Trans>}
                customDeleteQuestion={
                  <Trans>
                    This will delete your user account and will remove the
                    connection to all the data inside your groups/organizations.
                  </Trans>
                }
                deleteValidationQuestionValue={t("Delete Account")}
                customButton={
                  <Button
                    kind="danger--primary"
                    type="button"
                    className={styles.mobileRemove}
                  >
                    <Trans>Delete Account</Trans>
                  </Button>
                }
                deleteEntry={deleteUser}
              />
            }
            subtitle={
              <>
                <Trans>
                  Deleting your account will delete this user and removes all
                  access.
                </Trans>
              </>
            }
          />
          <h3>
            <Trans>Advanced Settings</Trans>
          </h3>

          <EnableMfaButton />
          {account.user["https://memo.wirewire.de/roles"] &&
            account.user["https://memo.wirewire.de/roles"].includes(
              "admin",
            ) && (
              <div>
                <ButtonRouter
                  to="/admin"
                  icon={<FontAwesomeIcon icon={faScrewdriverWrench} />}
                >
                  Admin
                </ButtonRouter>
              </div>
            )}

          <ApiManager />

          {account.user["https://memo.wirewire.de/roles"] &&
            account.user["https://memo.wirewire.de/roles"].includes(
              "admin",
            ) && (
              <div>
                <ButtonRouter
                  to="/ai"
                  icon={<FontAwesomeIcon icon={faMicrochipAi} />}
                >
                  AI
                </ButtonRouter>
              </div>
            )}
          {debug && (
            <Story className={styles.developer}>
              <h2>
                <Trans>Developer Settings</Trans>
              </h2>
              {user["https://memo.wirewire.de/roles"] && (
                <>
                  {user["https://memo.wirewire.de/roles"].map((e, i) => (
                    <Tag key={i}>{e}</Tag>
                  ))}
                </>
              )}
              <h3>
                <Trans>Notifications</Trans>
              </h3>
              <JsonViewer src={notifications} collapsed />
              <h3>
                <Trans>Current User</Trans>
              </h3>
              <JsonViewer src={user} collapsed />
              <h3>
                <Trans>Management</Trans>
              </h3>

              <InputGroup
                labelText={<Trans>API version</Trans>}
                helperText={<Trans>Override the API endpoint</Trans>}
              >
                <MultiCheckbox
                  labelText={<Trans>Standard</Trans>}
                  value="default"
                  type="radio"
                  {...register("env")}
                />
                <MultiCheckbox
                  labelText={<Trans>Development</Trans>}
                  value="dev"
                  type="radio"
                  {...register("env")}
                />
                <MultiCheckbox
                  labelText={<Trans>Production</Trans>}
                  value="prod"
                  type="radio"
                  {...register("env")}
                />
              </InputGroup>
              <Button onClick={sendDefaultNotification}>
                <Trans>sendPushNotification</Trans>
              </Button>
              <JsonViewer src={sendDefaultNotificationResult?.data} />
              <Status
                fetching={
                  <div className={styles.loading}>
                    <Trans>Loading...</Trans>
                  </div>
                }
                query={sendDefaultNotificationResult}
                showContent
              ></Status>
              <br />
              <br />
              <h3>
                <Trans>Release version:</Trans> {import.meta.env.REACT_APP_NAME}{" "}
                {import.meta.env.REACT_APP_VERSION}
              </h3>
              <JsonViewer src={import.meta.env} />
            </Story>
          )}
          {/* <SettingsSubmitButton
            {...store}
            title={<Trans>Update Account</Trans>}
          /> */}
        </>
      </SettingsGlobal>
    </>
  );
}
