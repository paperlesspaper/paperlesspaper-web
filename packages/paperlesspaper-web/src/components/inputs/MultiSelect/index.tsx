import React from "react";
import { Input } from "@progressiveui/react";
import styles from "./styles.module.scss";
import ReactSelect, { components } from "react-select";

export default function MultiSelect({
  labelText,
  helperText,
  onChange,
  options,
  value,
  ...other
}: any) {
  //const value = "Europe/Berlin";

  const Option = (props: any) => {
    return <components.Option {...props}>{props.data.text}</components.Option>;
  };

  return (
    <Input labelText={labelText} helperText={helperText}>
      <ReactSelect
        isMulti
        className={`wfp--react-select-container ${styles.timezoneSelect}`}
        classNamePrefix="wfp--react-select"
        options={options}
        value={value}
        // components={{ Option /*SingleValue */ }}
        // getOptionLabel={(e) => e.text}
        onChange={onChange}
        {...other}
      />
    </Input>
  );
}
