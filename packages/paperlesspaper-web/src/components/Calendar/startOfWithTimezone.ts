import { endOfDay, isPast, isSameDay, startOfDay } from "date-fns";
import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";
import { tz } from "@date-fns/tz";

/*
TrayOverview.range = (date, timezone = "Europe/Berlin") => {
  const start = startOfISOWeekDateFns(date);
  const end = addDays(start, 6);

  const startDateZoned = transformDateToTimezone(start, timezone);
  const endDateZoned = transformDateToTimezone(end, timezone);

  console.log(
    "TrayOverview",
    startDateZoned.getTime(),
    endDateZoned.toISOString()
  );
  return { start: startDateZoned, end: endDateZoned };
};
*/
