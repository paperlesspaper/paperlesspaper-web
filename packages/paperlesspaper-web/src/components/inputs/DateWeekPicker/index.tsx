import React, { useEffect } from "react";
// import "react-dates/initialize";
// import "react-dates/lib/css/_datepicker.css";

import DatePicker, { registerLocale } from "react-datepicker";
import { de } from "date-fns/locale";
import { startOfISOWeek } from "date-fns";
//import "react-datepicker/dist/react-datepicker.min.css";
import "./styles.scss";
import { useLocaleDate } from "@internetderdinge/web";
import { useTranslation } from "react-i18next";
import { tz } from "@date-fns/tz";

registerLocale("de", de);

export default function DateWeekPicker({ startDate, onChange }: any) {
  const localeDate = useLocaleDate();
  const { i18n } = useTranslation();

  useEffect(() => {
    registerLocale(i18n.language, localeDate.locale);
  }, [i18n.language]);

  return (
    <div className="week-picker">
      <DatePicker
        selected={startDate?.from}
        onChange={(date) => onChange(date)}
        inline
        minDate={startOfISOWeek(new Date(), {
          in: tz("Europe/Berlin"),
        })}
        /* dayClassName={(date) => {
          const { timeIsBaked } = isBakedTime({
            eventsBakedReduced,
            from: startOfDay(date),
            to: endOfDay(date),
          });

          return timeIsBaked
            ? "react-datepicker__baked"
            : "react-datepicker__unbaked";
        }}*/
        startDate={startDate?.from}
        endDate={startDate?.to}
        locale={i18n.language}
      />
    </div>
  );
}
