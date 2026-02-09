import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import ReactDatePicker from "react-datepicker";
import styles from "./styles.module.scss";
import { isValid } from "date-fns";
import classnames from "classnames";
import { Input } from "@progressiveui/react";
import { Controller } from "react-hook-form";
import { faCalendarDays } from "@fortawesome/pro-regular-svg-icons";

export default function DatePicker({
  control,
  name,
  fullWidth,
  dateProps = {},
  ...other
}: any) {
  const wrapperClasses = classnames(styles.dateRangePicker, {
    [`${styles.fullWidthWrapper}`]: fullWidth,
  });

  const inputClasses = classnames(
    styles.dateRangePickerInput,
    "wfp--text-input",
    {
      [`${styles.fullWidth}`]: fullWidth,
    }
  );

  return (
    <Controller
      name={name}
      control={control}
      //rules={{ required: true }}
      render={({ field }) => {
        const { value, ...others } = field;

        const formatedDate =
          value && isValid(new Date(value)) ? new Date(value) : undefined;

        // format(new Date(value), "YYY-MM-dd")
        return (
          <Input
            {...other}
            addonAfter={
              <FontAwesomeIcon
                icon={faCalendarDays}
                className={`${styles.dateRangePickerIcon}`}
              />
            }
          >
            <div className={wrapperClasses}>
              <>
                {/*formatedDate*/}
                <ReactDatePicker
                  selected={formatedDate}
                  className={inputClasses}
                  {...others}
                  //showTimeInput
                  showDate
                  dateFormat="dd.MM.yyyy"
                  //onFocus={!isDesktop ? (e) => e.target.blur() : undefined}
                  locale="de"
                  {...dateProps}
                />
              </>
            </div>
          </Input>
        );
      }}
    />
  );
}
