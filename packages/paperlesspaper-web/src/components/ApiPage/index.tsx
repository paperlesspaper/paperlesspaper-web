import React from "react";
import { useForm } from "react-hook-form";
import { BlockNotification, Button, TextInput } from "@progressiveui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignIn } from "@fortawesome/pro-solid-svg-icons";
import SettingsTitle from "../SettingsTitle";
import { Trans } from "react-i18next";
export default function ApiPage() {
  const { handleSubmit } = useForm();
  const onSubmit = () => {
    console.log("submit");
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SettingsTitle>
          <Trans>Connected Apps</Trans>
        </SettingsTitle>
        <BlockNotification
          title={<Trans>You are currently not authentificated to a API</Trans>}
        />
        <TextInput name="username" labelText={<Trans>API URL</Trans>} />
        <Button type="submit">
          <Trans>Save</Trans>
        </Button>{" "}
        <Button
          type="submit"
          kind="tertiary"
          icon={<FontAwesomeIcon icon={faSignIn} />}
        >
          <Trans>Go to authentication</Trans>
        </Button>
      </form>
    </div>
  );
}
