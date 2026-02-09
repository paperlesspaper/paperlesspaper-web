import React from "react";
import { useHistory, useParams } from "react-router-dom";
import LoginWrapper, { LoginWrapperTitle } from "components/AuthWrapper";
import styles from "./createOrganization.module.scss";
import { InputGroup } from "@progressiveui/react";
import hospitalIllustration from "./hospital-illustration.svg";
import houseIllustration from "./house.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome, faHospitalUser } from "@fortawesome/pro-light-svg-icons";
import { faChevronRight } from "@fortawesome/pro-solid-svg-icons";
import { TextInput } from "@progressiveui/react";
import useSettingsForm from "helpers/useSettingsFormNew";
import SettingsSubmitButton from "components/SettingsContent/components/SettingsSubmitButton";
import { Trans } from "react-i18next";
import ButtonRouter from "components/ButtonRouter";
import MultiCheckbox from "components/MultiCheckbox";
import classNames from "classnames";
import i18next from "i18next";
import { organizationsApi } from "ducks/organizationsApi";
import { isAppWirewire } from "helpers/useAppIdentifier";

export default function CreateOrganization() {
  const prepareSubmit = (values) => {
    const { action, ...other } = values;
    return { ...other, kind: action };
  };
  const store = useSettingsForm({
    api: organizationsApi,
    url: `/createOrganization`,
    //hideTitle: true,
    //hideHeaderRight: true,
    prepareSubmit,
    //preventRedirect: true,
    newEntryData: { action: isAppWirewire() ? "private-wirewire" : "private" },
  });

  const {
    entryData,
    register,
    handleSubmit,
    onSubmit,
    resultCreateSingle,
    search,
    regularFormStyle,
    form,
  } = store;

  const {
    watch,
    formState: { errors },
  } = form;

  const history = useHistory();

  const { detail } = useParams();
  const action = watch("action");

  const classes = classNames(styles.loginContent, {
    [`${styles.loginContentProfessional}`]: action === "professional",
  });

  const professionalClasses = classNames(styles.professionalWrapper, {
    [`${styles.professionalWrapperActive}`]: action === "professional",
  });

  if (resultCreateSingle.data) {
    if (isAppWirewire()) {
      history.push(
        `/${resultCreateSingle.data?.id}/onboarding/device/?show=always`
      );
    } else {
      history.push(
        `/${resultCreateSingle.data?.id}/onboarding/patient/?show=always`
      );
    }
  }

  return (
    <>
      <LoginWrapper
        showBackLink
        backLink="/?show=always"
        backLinkText={<Trans>Overview</Trans>}
        //hideContentMobile
        rightSide={
          <div className={classes}>
            <img
              alt="Illustration of a house"
              className={styles.private}
              src={houseIllustration}
            />
            <img
              alt="Illustration of a hospital"
              className={styles.professional}
              src={hospitalIllustration}
            />
          </div>
        }
      >
        <LoginWrapperTitle kind="small">
          {search.urlId !== "new" && detail === "first" ? (
            <Trans>Welcome!</Trans>
          ) : search.urlId !== "new" ? (
            <Trans>Create new group</Trans>
          ) : (
            <Trans>Organization successfully created!</Trans>
          )}
        </LoginWrapperTitle>

        <div className={regularFormStyle}>
          {/*submitSuccess === true && <Redirect to="/" />*/}
          <form onSubmit={handleSubmit(onSubmit)}>
            {search.urlId === "new" ? (
              <>
                <ButtonRouter
                  isLink
                  to={`/${entryData?.id}`}
                  icon={<FontAwesomeIcon icon={faChevronRight} />}
                >
                  Visit {entryData?.name} organization
                </ButtonRouter>
              </>
            ) : isAppWirewire() ? (
              <>
                <p className={styles.setupText}>
                  <Trans>
                    The setup wizard helps you to set up your first device.
                  </Trans>
                </p>
                <SettingsSubmitButton
                  {...store}
                  icon={<FontAwesomeIcon icon={faChevronRight} />}
                  kind={
                    action === "professional" ? "danger--primary" : undefined
                  }
                  title={<Trans>Continue</Trans>}
                />
              </>
            ) : (
              <>
                {detail !== "first" && (
                  <InputGroup className={styles.usageKind}>
                    <MultiCheckbox
                      labelText={
                        <Trans>
                          Private
                          <br />
                          Nutzung
                        </Trans>
                      }
                      id="private"
                      value="private"
                      icon={<FontAwesomeIcon icon={faHome} />}
                      type="radio"
                      className={styles.usageEntry}
                      {...register("action")}
                    />
                    <MultiCheckbox
                      labelText={
                        <Trans>
                          Professionelle
                          <br />
                          Nutzung
                        </Trans>
                      }
                      id="professional"
                      value="professional"
                      icon={<FontAwesomeIcon icon={faHospitalUser} />}
                      type="radio"
                      className={styles.usageEntry}
                      {...register("action")}
                    />
                  </InputGroup>
                )}

                <div className={professionalClasses}>
                  <div>
                    {action === "professional" /*|| detail !== "first" */ ? ( // TODO: Check
                      <>
                        <TextInput
                          invalid={errors.name}
                          invalidText={errors.name?.message}
                          labelText={<Trans>Name of the organization</Trans>}
                          {...register("name", {
                            required: i18next.t(
                              "Please enter a name"
                            ) as string,
                          })}
                        />
                        <Trans>
                          This feature is currently a beta test only.
                        </Trans>
                      </>
                    ) : (
                      <div className={styles.privateText}>
                        {/* Im Einrichtungsassistent können Sie jetzt den ersten
                        Benutzer und Ihr erstes Gerät anlegen.
                      Die Private Organisation ist ideal, wenn Sie einen
                        Medikamentenspender für sich oder für Ihre Angehörigen
                    einrichten möchten.*/}
                      </div>
                    )}
                  </div>
                </div>

                <SettingsSubmitButton
                  {...store}
                  large
                  icon={<FontAwesomeIcon icon={faChevronRight} />}
                  kind={
                    action === "professional" ? "danger--primary" : undefined
                  }
                  title={
                    action === "professional" ? (
                      <>
                        <Trans>Create organization</Trans>{" "}
                      </>
                    ) : (
                      <Trans>Continue</Trans>
                    )
                  }
                />
              </>
            )}
          </form>
        </div>
      </LoginWrapper>
    </>
  );
}
