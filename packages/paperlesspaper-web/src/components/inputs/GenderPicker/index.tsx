import React from "react";
import { InputGroup } from "@progressiveui/react";
import MultiCheckbox from "components/MultiCheckbox";
import { Trans } from "react-i18next";

export default function GenderPicker({
  register,
  name = "gender",
  options,
}: any) {
  return (
    <InputGroup labelText={<Trans>Gender</Trans>}>
      <MultiCheckbox
        labelText={<Trans>male</Trans>}
        id="gender-male"
        value="male"
        type="radio"
        {...register(name, options)}
      />
      <MultiCheckbox
        labelText={<Trans>female</Trans>}
        id="gender-female"
        value="female"
        type="radio"
        {...register(name, options)}
      />
      <MultiCheckbox
        labelText={<Trans>non-binary</Trans>}
        id="gender-diverse"
        value="divers"
        type="radio"
        {...register(name, options)}
      />
    </InputGroup>
  );
}
