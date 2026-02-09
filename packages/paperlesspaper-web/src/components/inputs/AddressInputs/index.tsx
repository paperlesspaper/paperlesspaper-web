import React from "react";
import { TextInput } from "@progressiveui/react";
import { Trans } from "react-i18next";
import { Col } from "react-flexbox-grid";
import FormRow from "components/FormRow";

export default function AdressInput({ register }: any) {
  return (
    <>
      <TextInput
        labelText={<Trans>Street</Trans>}
        {...register("meta.street")}
      />
      <FormRow>
        <Col xs={12} md={6}>
          <TextInput
            labelText={<Trans>City</Trans>}
            {...register("meta.city")}
          />
        </Col>
        <Col xs={12} md={6}>
          <TextInput
            labelText={<Trans>Postal code</Trans>}
            {...register("meta.postal")}
          />
        </Col>
      </FormRow>
      <TextInput
        labelText={<Trans>Phone number</Trans>}
        {...register("meta.phone")}
      />
    </>
  );
}
