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
