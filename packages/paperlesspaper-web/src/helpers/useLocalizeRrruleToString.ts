import React from "react";

const strings = {
  every: "alle",
  until: "endet am",
  day: "Tag",
  days: "Tage",
  week: "Wochen",
  weeks: "Wochen",
  on: "am",
  in: "in",
  "on the": "am",
  for: "für",
  and: "und",
  or: "oder",
  at: "bei",
  last: "zuletzt",
  st: ".,",
  nd: ".,",
  rd: ".,",
  th: ".,",
  "(~ approximate)": "(~ ungefähr)",
  times: "Zeiten",
  time: "Zeit",
  minutes: "Minuten",
  hours: "Stunden",
  weekdays: "Wochentag",
  weekday: "Wochentag",
  months: "Monate",
  month: "Monate",
  years: "Jahre",
  year: "Jahre",
};
export const useLocalizeRrruleToString = (): any => {
  const result = {
    getText: (id) => strings[id] || id,
    language: {
      dayNames: [
        "Sonntag",
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
      ],
      monthNames: [
        "Januar",
        "Februar",
        "März",
        "April",
        "Mai",
        "Juni",
        "Juli",
        "August",
        "September",
        "Oktober",
        "November",
        "Dezember",
      ],
    },
    dateFormat: (year, month, day) => `${day}. ${month} ${year}`,
  };
  return result;
};

export const replaceDays = (text: string) => {
  let newText = text.replace(
    "am Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag, Sonntag",
    ""
  );
  newText = newText.replace("alle Tag", "täglich");
  return newText;
};
