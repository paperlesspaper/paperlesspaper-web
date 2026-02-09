import React from "react";
import { Input } from "@progressiveui/react";
import timezones from "timezones.json";
import styles from "./styles.module.scss";
import ReactSelect, { components } from "react-select";

export default function TimezoneSelect({
  value,
  labelText,
  helperText,
  onChange,
}: any) {
  //const value = "Europe/Berlin";

  const selectedTimezone = timezones.find((t) => t.utc.includes(value));

  const Option = (props: any) => {
    return <components.Option {...props}>{props.data.text}</components.Option>;
  };

  return (
    <Input labelText={labelText} helperText={helperText}>
      <ReactSelect
        className={`wfp--react-select-container ${styles.timezoneSelect}`}
        classNamePrefix="wfp--react-select"
        options={timezones}
        components={{ Option /*SingleValue */ }}
        getOptionLabel={(e) => e.text}
        onChange={onChange}
        value={selectedTimezone}
      />
    </Input>
  );
}
