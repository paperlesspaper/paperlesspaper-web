import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import styles from "./dateInput.module.scss";
import { format, getMonth, getYear } from "date-fns";
import classnames from "classnames";
import { Button, Input, Modal, Select, SelectItem } from "@progressiveui/react";
import { Controller } from "react-hook-form";
import { faCalendarAlt, faClock } from "@fortawesome/pro-regular-svg-icons";
import { Trans, useTranslation } from "react-i18next";
import { faCalendar } from "@fortawesome/pro-regular-svg-icons";
import { useLocaleDate } from "@internetderdinge/web";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/pro-solid-svg-icons";

function DateComponent({ dateProps, field, fullWidth, other }: any) {
  const { value, ...others } = field;
  // TODO: fix this
  const [, /*calendarOpen,*/ setCalendarOpen] = useState<boolean>(false);
  const localeDate = useLocaleDate();
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

  const inputClasses = classnames(
    styles.dateRangePickerInput,
    "wfp--text-input",
    {
      [`${styles.fullWidth}`]: fullWidth,
    }
  );

  const timeAsDate =
    typeof internalValue === "string"
      ? new Date(internalValue)
      : internalValue; /*? new Date(internalValue) : undefined*/

  const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, i) => start + i);
  };

  const years = range(1920, getYear(new Date()) + 1);

  const months = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2000, i), "LLLL", localeDate)
  );

  const input = (
    <>
      <Input
        {...other}
        labelText={undefined}
        addonAfter={
          <FontAwesomeIcon
            icon={faCalendarAlt}
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
              timeIntervals={15}
              timeCaption={<Trans>Time</Trans>}
              dateFormat="dd.MM.yyyy"
              locale="de"
              onCalendarClose={() => setCalendarOpen(false)}
              onCalendarOpen={() => setCalendarOpen(true)}
              //withPortal={!isDesktop}

              onChange={(value) => {
                setInternalValue(value);
              }}
              autoComplete="off"
              popperClassName={styles.noPopout}
              {...dateProps}
            />
          </>
        </div>
      </Input>
      <div className={styles.datePickerExtended}>
        <DatePicker
          selected={timeAsDate}
          {...others}
          //timeIntervals={15}
          //timeCaption={<Trans>Time</Trans>}
          dateFormat="dd.MM.yyyy"
          locale="de"
          onCalendarClose={() => setCalendarOpen(false)}
          onCalendarOpen={() => setCalendarOpen(true)}
          onChange={(value) => {
            setInternalValue(value);
          }}
          inline
          autoComplete="off"
          renderCustomHeader={({
            date,
            changeYear,
            changeMonth,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled,
          }) => (
            <div className={styles.header}>
              <Button
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                kind="tertiary"
                icon={<FontAwesomeIcon icon={faChevronLeft} />}
              />

              <Select
                value={months[getMonth(date)]}
                onChange={({ target: { value } }) =>
                  changeMonth(months.indexOf(value))
                }
              >
                {months.map((option) => (
                  <SelectItem key={option} value={option} text={option} />
                ))}
              </Select>
              <Select
                value={getYear(date)}
                onChange={({ target: { value } }) => changeYear(value)}
              >
                {years.map((option: any) => (
                  <SelectItem
                    key={option}
                    value={option}
                    text={option as string}
                  />
                ))}
              </Select>

              <Button
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                kind="tertiary"
                icon={<FontAwesomeIcon icon={faChevronRight} />}
              />
            </div>
          )}
          {...dateProps}
        />
      </div>
    </>
  );

  const submitInput = () => {
    field.onChange(internalValue);
    setOpen(false);
  };

  const valueAsDate = typeof value === "string" ? new Date(value) : value;

  const { t } = useTranslation();

  return (
    <>
      <Modal
        modalHeading={<Trans>Set the date</Trans>}
        primaryButtonText={<Trans>Apply</Trans>}
        secondaryButtonText={<Trans>Cancel</Trans>}
        open={open}
        onRequestSubmit={submitInput}
        onRequestClose={() => setOpen(false)}
        className={styles.datePickerModal}
      >
        {input}
      </Modal>

      <Input {...other}>
        <Button
          kind="tertiary"
          onClick={() => setOpen(true)}
          iconReverse
          icon={<FontAwesomeIcon icon={faCalendar} />}
        >
          {valueAsDate ? format(valueAsDate, "dd.MM.yyyy") : t("Select date")}
        </Button>
      </Input>
    </>
  );
}
export default function DateInput({
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
          <DateComponent
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
