import React from "react";
import { /*Control, */ Controller } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { Input } from "@progressiveui/react";
import styles from "./styles.module.scss";

interface PhoneInputWrapperProps {
  name: string;
  onChange?: (value: string) => void;
  control: any;
}

export default function PhoneInputWrapper(props: PhoneInputWrapperProps) {
  const { name, control } = props;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value } }) => (
        <Input labelText="Phone number">
          <PhoneInput
            containerClass={styles.phoneInput}
            placeholder="Enter phone number"
            value={value}
            onlyCountries={[
              "be",
              "bg",
              "cz",
              "dk",
              "de",
              "ee",
              "ie",
              "el",
              "es",
              "fr",
              "hr",
              "it",
              "cy",
              "lv",
              "lt",
              "lu",
              "hu",
              "mt",
              "nl",
              "at",
              "pl",
              "pt",
              "ro",
              "si",
              "sk",
              "fi",
              "se",
            ]}
            onChange={props.onChange}
          />
        </Input>
      )}
    />
  );
}

/*

    <Controller
      as={
        <PhoneInput
          id="pNum"
          placeholder="Enter phone number"
          value={value}
          onChange={onChange}
        />
      }
      name="phoneNumber"
      control={control}
      rules={{ required: true }}
    />
    */
