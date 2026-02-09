import React from "react";
import "./_date-input.scss";

export default function InputWrapper(props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, react/prop-types
  const { control, component, error, ...other } = props;
  const Component = component;

  /*var invalid = control ? lodash.get(control.errorsRef.current, props.name) : undefined;
  invalid = invalid
    ? invalid
    : error && Array.isArray(error)
    ? error.find((e) => e.name === props.name)
    : undefined;

    invalid={invalid}
    invalidText={invalid && invalid.message}*/

  return <Component {...other} />;
}
