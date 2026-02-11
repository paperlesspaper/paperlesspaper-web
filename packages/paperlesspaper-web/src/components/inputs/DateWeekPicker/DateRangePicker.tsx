import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import DatePicker from "react-datepicker";
import styles from "./dateRangePicker.module.scss";
import { faArrowRight } from "@fortawesome/pro-regular-svg-icons";
import { isValid } from "date-fns";
import classnames from "classnames";
import { useIsDesktop } from "@internetderdinge/web";
import { Trans } from "react-i18next";

export default function DateRangePicker({
  startDate,
  endDate,
  clearEndDate,
  fullWidth,
  onChangeStart,
  onChangeEnd,
  startDateProps,
  endDateProps,
}: any) {
  const wrapperClasses = classnames(styles.dateRangePicker, {
    [`${styles.fullWidthWrapper}`]: fullWidth,
  });

  const inputClasses = classnames(
    styles.dateRangePickerInput,
    "wfp--text-input",
    {
      [`${styles.fullWidth}`]: fullWidth,
    },
  );

  const isDesktop = useIsDesktop();

  //return null;
  if (!startDate || (isValid(startDate) && (!startDate || isValid(startDate))))
    return (
      <div className={wrapperClasses}>
        <div>
          <DatePicker
            selected={startDate}
            className={inputClasses}
            onChange={onChangeStart}
            dateFormat="dd.MM.yyyy"
            selectsStart
            startDate={startDate}
            endDate={endDate}
            // open
            withPortal={!isDesktop}
            //onFocus={!isDesktop ? (e) => e.target.blur() : undefined}
            locale="de"
            todayButton={<Trans>Today</Trans>}
            {...startDateProps}
          />
        </div>
        <FontAwesomeIcon
          icon={faArrowRight}
          className={`${styles.dateRangePickerIcon}`}
        />
        <DatePicker
          selected={endDate}
          className={inputClasses}
          onChange={onChangeEnd}
          dateFormat="dd.MM.yyyy"
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate}
          withPortal={!isDesktop}
          //onFocus={!isDesktop ? (e) => e.target.blur() : undefined}
          isClearable={endDate && clearEndDate}
          locale="de"
          {...endDateProps}
        />
        {/*clearEndDate && (
          <Button onClick={() => onChangeEnd(undefined)}>clear</Button>
        )*/}
      </div>
    );
  return null;
}
