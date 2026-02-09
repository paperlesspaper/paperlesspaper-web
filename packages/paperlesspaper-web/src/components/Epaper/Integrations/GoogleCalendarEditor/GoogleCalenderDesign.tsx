import { faGlobe } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, Input, NumberInput } from "@progressiveui/react";
import React, { useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import EditorButton from "../ImageEditor/EditorButton";
import useEditor from "../ImageEditor/useEditor";
import styles from "./googleCalendarDesign.module.scss";
import LanguageSelector from "../../Fields/LanguageSelector";
import ColorSelector from "../../Fields/ColorSelector";
import GoogleLoginWrapper from "./GoogleLogin";
import { papersApi } from "ducks/ePaper/papersApi";
import { useParams } from "react-router-dom";
import { Controller, useWatch } from "react-hook-form";

const DEFAULT_DAY_RANGE = 3;
const DEFAULT_HIGHLIGHT_SCALE = 1.35;
const DEFAULT_MAX_EVENTS = 50;

const ModalComponent = () => {
  const { form, onSubmit }: any = useEditor();
  const watchAll = form.watch();
  const calendarState = form.watch("meta.calendarState");
  const isCalendarPreviewLoading = Boolean(calendarState?.loading);
  const calendarPreviewErrored = Boolean(calendarState?.error);
  const highlightToday = form.watch("meta.highlightToday");

  const { t } = useTranslation();

  /*   useEffect(() => {
    onSubmit({ ...watchAll, draft: true }, true);
  }, [watchAll.meta.selectedCalendars]); */

  /* const handleRefreshCalendars = () => {
    if (!isExistingPaper) {
      return;
    }
    fetchCalendarPreview({
      id: paperId,
      body: {
        selectedCalendars: form.getValues("meta.selectedCalendars"),
      },
    });
  };
  */
  const accessToken = form.watch("meta.googleCalendar.access_token");

  return (
    <>
      <GoogleLoginWrapper />
      <LanguageSelector />

      {/* <TextInput
        labelText="Kind"
        className={styles.input}
        {...form.register("meta.kind")}
      /> */}

      <ColorSelector />

      <Controller
        name="meta.dayRange"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={1}
            max={100}
            step={1}
            value={field.value ?? DEFAULT_DAY_RANGE}
            labelText={t("Day range")}
            helperText={t("How many days of events should be displayed?")}
            className={styles.input}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const parsedValue = parseInt(event?.target?.value || "", 10);
              field.onChange(Number.isNaN(parsedValue) ? "" : parsedValue);
            }}
          />
        )}
      />

      <Checkbox
        labelText={
          <>
            <Trans>Highlight today&apos;s appointments</Trans>
            <div className={styles.helperText}>
              <Trans>Emphasize entries happening today</Trans>
            </div>
          </>
        }
        className={styles.input}
        {...form.register("meta.highlightToday")}
      />

      {highlightToday && (
        <Controller
          name="meta.highlightScale"
          control={form.control}
          render={({ field }) => (
            <NumberInput
              {...field}
              min={1}
              max={3}
              step={0.1}
              value={field.value ?? DEFAULT_HIGHLIGHT_SCALE}
              labelText={t("Today highlight scale")}
              helperText={t("Higher values make today&apos;s events larger")}
              className={styles.input}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const parsedValue = parseFloat(event?.target?.value || "");
                field.onChange(Number.isNaN(parsedValue) ? "" : parsedValue);
              }}
            />
          )}
        />
      )}

      <Controller
        name="meta.maxEvents"
        control={form.control}
        render={({ field }) => (
          <NumberInput
            {...field}
            min={1}
            max={200}
            step={1}
            value={field.value ?? DEFAULT_MAX_EVENTS}
            labelText={t("Total events limit")}
            helperText={t("Maximum number of appointments to render")}
            className={styles.input}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const parsedValue = parseInt(event?.target?.value || "", 10);
              field.onChange(Number.isNaN(parsedValue) ? "" : parsedValue);
            }}
          />
        )}
      />

      {watchAll.meta?.calendarData?.calendars ? (
        <>
          {Boolean(calendarState?.isExistingPaper) && (
            <div className={styles.refreshRow}>
              {/* <Button
                kind="tertiary"
                size="small"
                onClick={handleRefreshCalendars}
                disabled={isCalendarPreviewLoading}
              >
                {isCalendarPreviewLoading ? (
                  <Trans>Refreshing…</Trans>
                ) : (
                  <Trans>Refresh calendars</Trans>
                )}
              </Button> */}
              {calendarPreviewErrored && (
                <div className={styles.refreshError}>
                  <Trans>Calendar refresh failed</Trans>
                </div>
              )}
            </div>
          )}
          <Input
            labelText={<Trans>Select calendars</Trans>}
            className={styles.calendars}
            helperText={
              <Trans>Choose the calendars that should be displayed</Trans>
            }
          />
          {watchAll.meta.calendarData.calendars.map(
            (calendar: any, index: number) => {
              const fieldName = `meta.selectedCalendars[${calendar.id?.replaceAll(
                ".",
                "_%_"
              )}]`;

              return (
                <Checkbox
                  key={index}
                  labelText={
                    <>
                      {calendar.summary}
                      <div
                        className={styles.color}
                        style={{ background: calendar.backgroundColor }}
                      ></div>
                    </>
                  }
                  className={styles.input}
                  {...form.register(fieldName)}
                />
              );
            }
          )}
        </>
      ) : accessToken ? (
        <Trans>No calendars found</Trans>
      ) : null}
    </>
  );
};

export default function GoogleCalendarDesign() {
  const { form }: any = useEditor();
  const params = useParams<{ paper?: string }>();
  const paperId = params?.paper;
  const isExistingPaper = Boolean(paperId && paperId !== "new");
  const kind = form.watch("kind");
  const availableCalendars = useWatch({
    control: form.control,
    name: "meta.calendarData.calendars",
  });
  const selectedCalendars = useWatch({
    control: form.control,
    name: "meta.selectedCalendars",
  });
  const dayRange = useWatch({
    control: form.control,
    name: "meta.dayRange",
  });
  const maxEvents = useWatch({
    control: form.control,
    name: "meta.maxEvents",
  });
  const [fetchCalendarPreview] = papersApi.useGetCalendarPreviewMutation();
  const silentUpdateOptions = useMemo(
    () =>
      ({
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      }) as const,
    []
  );

  const normalizedDayRange = useMemo(() => {
    const parsed = Number(dayRange);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(100, Math.round(parsed)));
    }
    return DEFAULT_DAY_RANGE;
  }, [dayRange]);

  const normalizedMaxEvents = useMemo(() => {
    const parsed = Number(maxEvents);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(200, Math.round(parsed)));
    }
    return DEFAULT_MAX_EVENTS;
  }, [maxEvents]);

  useEffect(() => {
    if (form.getValues("meta.dayRange") == null) {
      form.setValue("meta.dayRange", DEFAULT_DAY_RANGE, silentUpdateOptions);
    }

    if (form.getValues("meta.highlightScale") == null) {
      form.setValue(
        "meta.highlightScale",
        DEFAULT_HIGHLIGHT_SCALE,
        silentUpdateOptions
      );
    }

    if (typeof form.getValues("meta.highlightToday") === "undefined") {
      form.setValue("meta.highlightToday", false, silentUpdateOptions);
    }

    if (form.getValues("meta.maxEvents") == null) {
      form.setValue("meta.maxEvents", DEFAULT_MAX_EVENTS, silentUpdateOptions);
    }
  }, [form, silentUpdateOptions]);

  useEffect(() => {
    if (kind && kind !== "google-calendar") {
      return;
    }

    let isCancelled = false;
    const selectionPayload = form.getValues("meta.selectedCalendars") || {};
    const updateOptions = silentUpdateOptions;

    form.setValue(
      "meta.calendarState",
      { loading: true, error: null, isExistingPaper },
      updateOptions
    );

    fetchCalendarPreview({
      id: paperId,
      body: {
        selectedCalendars: selectionPayload,
        dayRange: normalizedDayRange,
        maxEvents: normalizedMaxEvents,
      },
    })
      .unwrap()
      .then((data) => {
        if (isCancelled) {
          return;
        }
        const { calendarData, calendarAuth } = data || {};

        if (calendarData) {
          form.setValue("meta.calendarData", calendarData, updateOptions);
          form.setValue(
            "meta.calendarData.events",
            calendarData.events ?? [],
            updateOptions
          );
        }

        if (calendarAuth) {
          const currentGoogle = form.getValues("meta.googleCalendar") || {};
          form.setValue(
            "meta.googleCalendar",
            { ...currentGoogle, ...calendarAuth },
            updateOptions
          );
        }

        form.setValue(
          "meta.calendarState",
          { loading: false, error: null, isExistingPaper },
          updateOptions
        );
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        form.setValue(
          "meta.calendarState",
          {
            loading: false,
            error: error?.message || "failed",
            isExistingPaper,
          },
          updateOptions
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [
    fetchCalendarPreview,
    form,
    isExistingPaper,
    paperId,
    selectedCalendars,
    kind,
    normalizedDayRange,
    normalizedMaxEvents,
    silentUpdateOptions,
  ]);

  useEffect(() => {
    if (!availableCalendars?.length) {
      return;
    }

    const selectionEntries = Object.entries(selectedCalendars || {});
    const hasAnySelection = selectionEntries.some(([, value]) =>
      Boolean(value)
    );

    if (selectionEntries.length === 0 || !hasAnySelection) {
      const allSelected = availableCalendars.reduce(
        (acc: Record<string, boolean>, calendar: any) => {
          if (!calendar?.id) {
            return acc;
          }

          const key = calendar.id.replaceAll(".", "_%_");
          acc[key] = true;
          return acc;
        },
        {}
      );

      if (Object.keys(allSelected).length > 0) {
        form.setValue(
          "meta.selectedCalendars",
          allSelected,
          silentUpdateOptions
        );
      }
    }
  }, [availableCalendars, form, selectedCalendars, silentUpdateOptions]);

  return (
    <EditorButton
      id="settings"
      kind="secondary"
      text={<Trans>Settings</Trans>}
      icon={<FontAwesomeIcon icon={faGlobe} />}
      modalComponent={ModalComponent}
      // modalHeading={<Trans>Website</Trans>}
    />
  );
}
