import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import styles from "./styles.module.scss";
import { format, setHours, setMinutes } from "date-fns";
import classnames from "classnames";
import { Button, Input, Modal } from "@progressiveui/react";
import { Controller } from "react-hook-form";
import { faClock } from "@fortawesome/pro-regular-svg-icons";
import { Trans } from "react-i18next";

/* interface TimeComponentProps {
  dateProps: any;
  field: any;
  form: any;
  fullWidth?: boolean;
  other?: any;
} */

export function TimeComponent({ dateProps, field, fullWidth, other }: any) {
  const { value, ...others } = field;
  //const [calendarOpen, setCalendarOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperClasses = classnames(styles.dateRangePicker, {
    [`${styles.fullWidthWrapper}`]: fullWidth,
  });

  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    if (internalValue !== value) {
      setInternalValue(value);
    }
  }, [value]);

  /*useEffect(() => {
    // setTimeout(() => {
    if (
      document.getElementsByClassName(
        "react-datepicker__time-list-item--selected"
      )[0]
    ) {

      document
        .getElementsByClassName("react-datepicker__time-list-item--selected")[0]
        .scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest",
        });
    }
    // }, 1000);
  }, [internalValue]);*/

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (
          document.getElementsByClassName(
            "react-datepicker__time-list-item--selected"
          )[0]
        )
          document
            .getElementsByClassName(
              "react-datepicker__time-list-item--selected"
            )[0]
            .scrollIntoView({
              behavior: "auto",
              block: "center",
              inline: "nearest",
            });
      }, 10);
    }
  }, [open]);

  const inputClasses = classnames(
    styles.dateRangePickerInput,
    "wfp--text-input",
    {
      [`${styles.fullWidth}`]: fullWidth,
    }
  );

  const timeAsDate = internalValue
    ? setMinutes(
        setHours(new Date(), internalValue.split(":")[0]),
        internalValue.split(":")[1]
      )
    : undefined;

  const input = (
    <>
      <Input
        //formItemClassName={calendarOpen ? styles.portal : undefined}
        {...other}
        addonAfter={
          <FontAwesomeIcon
            icon={faClock}
            className={`${styles.dateRangePickerIcon}`}
          />
        }
      >
        <div className={wrapperClasses}>
          <>
            <DatePicker
              selected={timeAsDate}
              className={inputClasses}
              {...others}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={15}
              timeCaption={<Trans>Time</Trans>}
              dateFormat="HH:mm"
              locale="de"
              //onCalendarClose={() => setCalendarOpen(false)}
              //onCalendarOpen={() => setCalendarOpen(true)}
              //withPortal={!isDesktop}

              onChange={(value) => {
                setInternalValue(format(new Date(value), "HH:mm"));
                console.log(
                  "onChangeddd",
                  value,
                  format(new Date(value), "HH:mm")
                );

                /*setTimeout(() => {
                  if (
                    document.getElementsByClassName(
                      "react-datepicker__time-list-item--selected"
                    )[0]
                  ) {
                    console.log(
                      "scroll into view",
                      value,
                      document.getElementsByClassName(
                        "react-datepicker__time-list-item--selected"
                      )[1]
                    );
                    alert("dasadsds");
                    document
                      .getElementsByClassName(
                        "react-datepicker__time-list-item--selected"
                      )[0]
                      .scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                        inline: "center",
                      });
                  }
                }, 500);*/
              }}
              autoComplete="off"
              popperClassName={styles.noPopout}
              {...dateProps}
            />
          </>
        </div>
      </Input>
      <div className={styles.timePicker}>
        <DatePicker
          selected={timeAsDate}
          // className={inputClasses}
          {...others}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeCaption={<Trans>Time</Trans>}
          dateFormat="HH:mm"
          locale="de"
          //onCalendarClose={() => setCalendarOpen(false)}
          //onCalendarOpen={() => setCalendarOpen(true)}
          onChange={(value) => {
            console.log(
              "onChangeeeeee",
              value,
              format(new Date(value), "HH:mm")
            );

            setInternalValue(format(new Date(value), "HH:mm"));
          }}
          inline
          autoComplete="off"
          {...dateProps}
        />
      </div>
    </>
  );

  const submitInput = () => {
    console.log("submitInput", internalValue);
    field.onChange(internalValue);
    setOpen(false);
  };

  return (
    <>
      <Modal
        modalHeading={<Trans>Set the time</Trans>}
        primaryButtonText={<Trans>Apply</Trans>}
        secondaryButtonText={<Trans>Cancel</Trans>}
        open={open}
        onRequestSubmit={submitInput}
        onRequestClose={() => setOpen(false)}
      >
        {input}
      </Modal>

      <Button
        kind="tertiary"
        type="button"
        onClick={() => setOpen(true)}
        iconReverse
        icon={<FontAwesomeIcon icon={faClock} />}
      >
        {value} Uhr
      </Button>
    </>
  );
}
export default function TimeInput({
  control,
  name,
  fullWidth,
  dateProps = {},
  ...other
}: any) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        return (
          <TimeComponent
            dateProps={dateProps}
            field={field}
            fullWidth={fullWidth}
            other={other}
          />
        );
      }}
    />
  );
}
