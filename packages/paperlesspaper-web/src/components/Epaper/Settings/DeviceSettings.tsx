import {
  faGauge,
  faGaugeLow,
  faGaugeMax,
  faGaugeHigh,
  faGaugeMin,
  faTruckFast,
  faCalendarDay,
} from "@fortawesome/pro-light-svg-icons";
import { faPlus, faTrashAlt } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Callout, Checkbox, InputGroup } from "@progressiveui/react";
import { addDays, format, startOfWeek } from "date-fns";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Controller } from "react-hook-form";
import { RRule } from "rrule";
import TimezoneSelect from "components/inputs/TimezoneSelect";
import SleepTimeSlider from "./SleepTimeSlider";
import styles from "./deviceSettings.module.scss";

const times = [
  {
    key: 180,
    name: "3 minutes",
    nameShort: "3m",
    description: "Warning: Battery life will be only approx. 5 days",
    expectedBatteryLife: 5,
    icon: faTruckFast,
  },
  {
    key: 300,
    name: "5 minutes",
    nameShort: "5m",
    description: "Battery life: approx. 2 weeks",
    expectedBatteryLife: 14,
    icon: faGaugeMax,
  },
  {
    key: 600,
    name: "10 minutes",
    nameShort: "10m",
    description: "Battery life: approx. 1 month",
    expectedBatteryLife: 30,
    icon: faGaugeMax,
  },
  {
    key: 1800,
    name: "30 minutes",
    nameShort: "30m",
    description: "Battery life: approx. 3 months",
    expectedBatteryLife: 90,
    icon: faGaugeHigh,
  },
  {
    key: 3600,
    name: "60 minutes",
    nameShort: "1h",
    description: "Battery life: approx. 6 months",
    expectedBatteryLife: 180,
    icon: faGauge,
  },
  {
    key: 7200,
    name: "2 hours",
    nameShort: "2h",
    description: "Battery life: approx. 10 months",
    expectedBatteryLife: 300,
    icon: faGaugeLow,
  },
  {
    key: 28800,
    name: "8 hours",
    nameShort: "8h",
    description: "Battery life: approx. 1 year",
    expectedBatteryLife: 365,
    icon: faGaugeMin,
  },
  {
    key: 43200,
    name: "12 hours",
    nameShort: "12h",
    description: "Battery life: approx. 1.2 years",
    expectedBatteryLife: 427,
    icon: faGaugeMin,
  },
  {
    key: 57600,
    name: "16 hours",
    nameShort: "16h",
    description: "Battery life: approx. 1.4 year",
    expectedBatteryLife: 498,
    icon: faGaugeMin,
  },
  {
    key: 86400,
    name: "1 day",
    nameShort: "1d",
    description: "Battery life: approx. 1.5 years",
    expectedBatteryLife: 547,
    icon: faCalendarDay,
  },
];

type RepeatKind = "none" | "daily" | "weekly" | "monthly";

type UpdateWindow = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  repeat: RepeatKind;
  rrule?: string;
};

type DraftUpdateWindow = {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  repeat: RepeatKind;
};

const repeatOptions: Array<{ value: RepeatKind; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const defaultTimezone = "Europe/Berlin";
const DAY_MINUTES = 24 * 60;
const TIME_SLOT_MINUTES = 30;
const calendarHours = [0, 6, 12, 18, 24];

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toInputDate = (date: Date) => format(date, "yyyy-MM-dd");
const toInputTime = (date: Date) => format(date, "HH:mm");
const getWeekStart = (date = new Date()) =>
  startOfWeek(date, { weekStartsOn: 1 });

const buildStartsAt = (date: string, time: string) =>
  new Date(`${date}T${time || "00:00"}:00`).toISOString();

const toRruleDate = (date: string, time: string) =>
  `${date.replace(/-/g, "")}T${(time || "00:00").replace(":", "")}00`;

const buildRrule = ({
  date,
  startTime,
  repeat,
  timezone,
}: {
  date: string;
  startTime: string;
  repeat: RepeatKind;
  timezone: string;
}) => {
  if (repeat === "none") return undefined;

  const freqByRepeat = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
  };

  return [
    `DTSTART;TZID=${timezone}:${toRruleDate(date, startTime)}`,
    new RRule({
      freq: freqByRepeat[repeat],
      interval: 1,
    })
      .toString()
      .replace(/^DTSTART.*\n?/m, ""),
  ].join("\n");
};

const getMinutesFromTime = (time: string) => {
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
};

const getDurationMinutes = (startTime: string, endTime: string) => {
  const start = getMinutesFromTime(startTime);
  const end = getMinutesFromTime(endTime);
  const duration = end > start ? end - start : end + 24 * 60 - start;
  return Math.max(1, duration);
};

const getEndTimeFromDuration = (startTime: string, durationMinutes: number) => {
  const start = getMinutesFromTime(startTime);
  const total = (start + (Number(durationMinutes) || 60)) % (24 * 60);
  const hours = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (total % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getTimeFromMinutes = (minutes: number) => {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const nextMinutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${nextMinutes}`;
};

const toDraft = (window: UpdateWindow): DraftUpdateWindow => {
  const startsAt = new Date(window.startsAt);
  const safeDate = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt;
  const startTime = toInputTime(safeDate);

  return {
    id: window.id,
    date: toInputDate(safeDate),
    startTime,
    endTime: getEndTimeFromDuration(startTime, window.durationMinutes || 60),
    repeat: window.repeat || "none",
  };
};

const getDayIndex = (date: Date) => (date.getDay() + 6) % 7;

const getWindowDayIndexes = (window: UpdateWindow) => {
  if (window.repeat === "daily") return [0, 1, 2, 3, 4, 5, 6];

  const startsAt = new Date(window.startsAt);
  if (Number.isNaN(startsAt.getTime())) return [];

  return [getDayIndex(startsAt)];
};

const getWindowSegments = (window: UpdateWindow) => {
  const startsAt = new Date(window.startsAt);
  if (Number.isNaN(startsAt.getTime())) return [];

  const startMinutes = getMinutesFromTime(toInputTime(startsAt));
  const durationMinutes = Math.max(1, Number(window.durationMinutes) || 60);
  const dayIndexes = getWindowDayIndexes(window);

  return dayIndexes.flatMap((dayIndex) => {
    const endMinutes = startMinutes + durationMinutes;
    const segments = [
      {
        dayIndex,
        startMinutes,
        endMinutes: Math.min(endMinutes, DAY_MINUTES),
      },
    ];

    if (endMinutes > DAY_MINUTES) {
      segments.push({
        dayIndex: (dayIndex + 1) % 7,
        startMinutes: 0,
        endMinutes: Math.min(endMinutes - DAY_MINUTES, DAY_MINUTES),
      });
    }

    return segments.map((segment) => ({
      ...segment,
      window,
    }));
  });
};

const getSegmentStyle = (startMinutes: number, endMinutes: number) => ({
  top: `${(startMinutes / DAY_MINUTES) * 100}%`,
  height: `max(32px, ${((endMinutes - startMinutes) / DAY_MINUTES) * 100}%)`,
});

export default function DeviceSettings({ control }: any) {
  const timesFiltered = times;

  return (
    <InputGroup
      labelText={<Trans>Update interval</Trans>}
      helperText={
        <Trans>
          Sleep interval before the next update. Longer intervals extend battery
          life. Shake the device or press the button on the back to trigger an
          immediate update.
        </Trans>
      }
    >
      <Controller
        control={control}
        name="meta.sleepTime"
        defaultValue={(
          timesFiltered.find((option) => option.key === 3600)?.key ??
          timesFiltered[0].key
        ).toString()}
        render={({ field, fieldState }) => (
          <>
            <SleepTimeSlider
              options={timesFiltered}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
            />
          </>
        )}
      />
    </InputGroup>
  );
}

export function DeviceUpdateScheduleSettings({
  control,
  form,
  entryData,
}: any) {
  const { t } = useTranslation();
  const updateSchedule = form?.watch("meta.updateSchedule") || {};
  const windows = (updateSchedule.windows || []) as UpdateWindow[];
  const enabled = updateSchedule.enabled === true;
  const timezone =
    updateSchedule.timezone || entryData?.timezone || defaultTimezone;
  const [draft, setDraft] = React.useState<DraftUpdateWindow>(() => {
    const now = new Date();
    return {
      date: toInputDate(now),
      startTime: "08:00",
      endTime: "17:00",
      repeat: "daily",
    };
  });
  const weekStart = React.useMemo(() => getWeekStart(), []);
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const windowSegments = React.useMemo(
    () => windows.flatMap((window) => getWindowSegments(window)),
    [windows],
  );

  const setScheduleValue = (value: Record<string, unknown>) => {
    form?.setValue(
      "meta.updateSchedule",
      {
        enabled,
        timezone,
        windows,
        ...updateSchedule,
        ...value,
      },
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  const saveDraft = () => {
    const startsAt = buildStartsAt(draft.date, draft.startTime);
    const nextWindow: UpdateWindow = {
      id: draft.id || makeId(),
      startsAt,
      durationMinutes: getDurationMinutes(draft.startTime, draft.endTime),
      repeat: draft.repeat,
      rrule: buildRrule({
        date: draft.date,
        startTime: draft.startTime,
        repeat: draft.repeat,
        timezone,
      }),
    };
    const remaining = windows.filter((entry) => entry.id !== nextWindow.id);
    setScheduleValue({ windows: [...remaining, nextWindow] });
    setDraft({
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      repeat: draft.repeat,
    });
  };

  const editWindow = (window: UpdateWindow) => {
    setDraft(toDraft(window));
  };

  const removeWindow = (id: string) => {
    setScheduleValue({ windows: windows.filter((entry) => entry.id !== id) });
  };

  const addWeekdayPreset = () => {
    const monday = new Date();
    const dayOffset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dayOffset);

    const presetWindows = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const inputDate = toInputDate(date);
      const startTime = "08:00";
      return {
        id: makeId(),
        startsAt: buildStartsAt(inputDate, startTime),
        durationMinutes: 9 * 60,
        repeat: "weekly" as RepeatKind,
        rrule: buildRrule({
          date: inputDate,
          startTime,
          repeat: "weekly",
          timezone,
        }),
      };
    });

    setScheduleValue({ windows: presetWindows });
  };

  const addEverydayPreset = () => {
    const date = new Date();
    const inputDate = toInputDate(date);
    const startTime = "08:00";

    setScheduleValue({
      windows: [
        {
          id: makeId(),
          startsAt: buildStartsAt(inputDate, startTime),
          durationMinutes: 9 * 60,
          repeat: "daily",
          rrule: buildRrule({
            date: inputDate,
            startTime,
            repeat: "daily",
            timezone,
          }),
        },
      ],
    });
  };

  const addAlwaysAllowedPreset = () => {
    const date = new Date();
    const inputDate = toInputDate(date);
    const startTime = "00:00";

    setScheduleValue({
      windows: [
        {
          id: makeId(),
          startsAt: buildStartsAt(inputDate, startTime),
          durationMinutes: DAY_MINUTES,
          repeat: "daily",
          rrule: buildRrule({
            date: inputDate,
            startTime,
            repeat: "daily",
            timezone,
          }),
        },
      ],
    });
  };

  const clearAllowedWindows = () => {
    setScheduleValue({ windows: [] });
  };

  const draftWindowFromCalendar = (
    day: Date,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      0.999,
      Math.max(0, (event.clientY - rect.top) / rect.height),
    );
    const startMinutes =
      Math.floor((ratio * DAY_MINUTES) / TIME_SLOT_MINUTES) * TIME_SLOT_MINUTES;

    setDraft({
      date: toInputDate(day),
      startTime: getTimeFromMinutes(startMinutes),
      endTime: getTimeFromMinutes(startMinutes + 60),
      repeat: "weekly",
    });
  };

  /* const sleepTime = form.watch("meta.sleepTime");

  useEffect(() => {
    if (entryData.meta?.sleepTime === undefined && sleepTime === undefined) {
      form.setValue("meta.sleepTime", "3600");
    }
  }, [entryData?.id, sleepTime]); */

  return (
    <InputGroup
      labelText={<Trans>Device may update during</Trans>}
      helperText={
        <Trans>
          When enabled, the device only checks for updates during the marked
          times. Outside them it sleeps until the next allowed time.
        </Trans>
      }
    >
      <div className={styles.updateSchedule}>
        <Callout kind="warning" title={<Trans>Beta</Trans>}>
          <Trans>
            The custom device schedule is a beta feature and might not work as
            expected. Please report any issues you encounter to help us improve
            it.
          </Trans>
        </Callout>

        <Controller
          control={control}
          name="meta.updateSchedule.enabled"
          defaultValue={false}
          render={({ field }) => (
            <Checkbox
              id="settings-device-update-schedule-enabled"
              labelText={<Trans>Only update during allowed times</Trans>}
              checked={field.value === true}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                field.onChange(event.target.checked);
                setScheduleValue({ enabled: event.target.checked });
              }}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />

        {enabled && (
          <>
            <Controller
              control={control}
              name="meta.updateSchedule.timezone"
              defaultValue={timezone}
              render={({ field }) => (
                <TimezoneSelect
                  labelText={<Trans>Timezone</Trans>}
                  helperText={
                    <Trans>Timezone used for recurring windows</Trans>
                  }
                  value={field.value || timezone}
                  onChange={(selected: { utc?: string[] }) => {
                    const nextTimezone = selected?.utc?.[0] || defaultTimezone;
                    field.onChange(nextTimezone);
                    setScheduleValue({ timezone: nextTimezone });
                  }}
                />
              )}
            />

            <div className={styles.presetSection}>
              <div className={styles.presetHeader}>
                <Trans>Quick presets</Trans>
              </div>
              <div className={styles.presetActions}>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={addWeekdayPreset}
                >
                  <strong>
                    <Trans>Workdays</Trans>
                  </strong>
                  <span>
                    <Trans>Only Mon-Fri, 08:00-17:00</Trans>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={addEverydayPreset}
                >
                  <strong>
                    <Trans>Daily daytime</Trans>
                  </strong>
                  <span>
                    <Trans>Only every day, 08:00-17:00</Trans>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={addAlwaysAllowedPreset}
                >
                  <strong>
                    <Trans>Always allowed</Trans>
                  </strong>
                  <span>
                    <Trans>All day, every day</Trans>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={clearAllowedWindows}
                >
                  <strong>
                    <Trans>Pause automatic updates</Trans>
                  </strong>
                  <span>
                    <Trans>No allowed update windows</Trans>
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.weekCalendar}>
              <div className={styles.calendarHeader} aria-hidden>
                <div />
                {weekDays.map((day) => (
                  <div key={day.toISOString()}>{format(day, "EEE")}</div>
                ))}
              </div>
              <div className={styles.calendarBody}>
                <div className={styles.timeRail} aria-hidden>
                  {calendarHours.map((hour) => (
                    <span key={hour} style={{ top: `${(hour / 24) * 100}%` }}>
                      {hour.toString().padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                {weekDays.map((day, dayIndex) => {
                  const daySegments = windowSegments.filter(
                    (segment) => segment.dayIndex === dayIndex,
                  );

                  return (
                    <div
                      key={day.toISOString()}
                      className={styles.dayColumn}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => draftWindowFromCalendar(day, event)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        setDraft({
                          date: toInputDate(day),
                          startTime: "08:00",
                          endTime: "17:00",
                          repeat: "weekly",
                        });
                      }}
                    >
                      {daySegments.map((segment) => {
                        const startTime = getTimeFromMinutes(
                          segment.startMinutes,
                        );
                        const endTime = getTimeFromMinutes(segment.endMinutes);
                        const isAllDay =
                          segment.startMinutes === 0 &&
                          segment.endMinutes >= DAY_MINUTES;
                        return (
                          <button
                            key={`${segment.window.id}-${dayIndex}-${segment.startMinutes}`}
                            type="button"
                            className={styles.calendarWindow}
                            style={getSegmentStyle(
                              segment.startMinutes,
                              segment.endMinutes,
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              editWindow(segment.window);
                            }}
                          >
                            <strong>
                              {isAllDay ? (
                                <Trans>All day</Trans>
                              ) : (
                                `${startTime} - ${endTime}`
                              )}
                            </strong>
                            <span>
                              {segment.window.repeat === "daily"
                                ? t("Daily")
                                : segment.window.repeat === "weekly"
                                  ? t("Weekly")
                                  : segment.window.repeat === "monthly"
                                    ? t("Monthly")
                                    : t("Once")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.windowEditor}>
              <div className={styles.windowGrid}>
                <label>
                  <span>
                    <Trans>Date</Trans>
                  </span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>
                    <Trans>From</Trans>
                  </span>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>
                    <Trans>Until</Trans>
                  </span>
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>
                    <Trans>Repeat</Trans>
                  </span>
                  <select
                    value={draft.repeat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        repeat: event.target.value as RepeatKind,
                      }))
                    }
                  >
                    {repeatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.windowActions}>
                <Button type="button" onClick={saveDraft}>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>
                    {draft.id ? (
                      <Trans>Update window</Trans>
                    ) : (
                      <Trans>Add window</Trans>
                    )}
                  </span>
                </Button>
              </div>
            </div>

            <div className={styles.windowList}>
              {windows.length ? (
                windows.map((window) => {
                  const startsAt = new Date(window.startsAt);
                  const startTime = Number.isNaN(startsAt.getTime())
                    ? ""
                    : toInputTime(startsAt);
                  const endTime = startTime
                    ? getEndTimeFromDuration(startTime, window.durationMinutes)
                    : "";
                  return (
                    <div key={window.id} className={styles.windowItem}>
                      <button
                        type="button"
                        onClick={() => editWindow(window)}
                        className={styles.windowSummary}
                      >
                        <strong>
                          {startTime} - {endTime}
                        </strong>
                        <span>
                          {window.repeat && window.repeat !== "none"
                            ? t(window.repeat)
                            : t("Does not repeat")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWindow(window.id)}
                        className={styles.removeWindow}
                        aria-label={t("Delete")}
                      >
                        <FontAwesomeIcon icon={faTrashAlt} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <Trans>
                    No allowed windows configured. Automatic updates stay paused
                    until you add a window.
                  </Trans>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </InputGroup>
  );
}
