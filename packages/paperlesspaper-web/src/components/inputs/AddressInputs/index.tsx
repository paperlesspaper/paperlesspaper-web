import React from "react";
import { TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import FormRow from "components/FormRow";
import styles from "./styles.module.scss";

export default function AdressInput({ register }: any) {
  return (
    <>
      <TextInput
        labelText={<Trans>Street</Trans>}
        {...register("meta.street")}
      />
      <FormRow>
        <div className={styles.rowCol}>
          <TextInput
            labelText={<Trans>City</Trans>}
            {...register("meta.city")}
          />
        </div>
        <div className={styles.rowCol}>
          <TextInput
            labelText={<Trans>Postal code</Trans>}
            {...register("meta.postal")}
          />
        </div>
      </FormRow>
      <TextInput
        labelText={<Trans>Phone number</Trans>}
        {...register("meta.phone")}
      />
    </>
  );
}
