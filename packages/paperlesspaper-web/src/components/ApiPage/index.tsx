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
        <SettingsTitle>Connected Apps</SettingsTitle>
        <BlockNotification
          title={<Trans>You are currently not authentificated to a API</Trans>}
        />
        <TextInput name="username" labelText="Api url" />
        <Button type="submit">Save</Button>{" "}
        <Button
          type="submit"
          kind="tertiary"
          icon={<FontAwesomeIcon icon={faSignIn} />}
        >
          Go to authentification
        </Button>
      </form>
    </div>
  );
}
