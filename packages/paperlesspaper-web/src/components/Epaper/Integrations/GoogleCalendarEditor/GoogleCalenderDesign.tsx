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
const CALENDAR_PREVIEW_DEBOUNCE_MS = 350;

const buildDefaultCalendarSelection = (calendars?: any[]) => {
  return (calendars || []).reduce((acc: Record<string, boolean>, calendar) => {
    if (!calendar?.id) {
      return acc;
    }

    acc[calendar.id.replaceAll(".", "_%_")] = true;
    return acc;
  }, {});
};

const hasSelectedCalendar = (selectedCalendars?: Record<string, unknown>) => {
  return Object.values(selectedCalendars || {}).some((value) =>
    Boolean(value),
  );
};

const ModalComponent = () => {
  const { form }: any = useEditor();
  const watchAll = form.watch();
  const calendarState = form.watch("meta.calendarState");
  const calendarPreviewErrored = Boolean(calendarState?.error);
  const calendarPreviewLoading = Boolean(calendarState?.loading);
  const highlightToday = form.watch("meta.highlightToday");
  const googleCalendarMeta = form.watch("meta.googleCalendar");
  const code = form.watch("meta.code");

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
  const hasCalendarCredentials = Boolean(
    code ||
      googleCalendarMeta?.access_token ||
      googleCalendarMeta?.refresh_token ||
      googleCalendarMeta?.serverAuthCode,
  );

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
              {calendarPreviewLoading && (
                <div className={styles.refreshStatus}>
                  <Trans>Refreshing calendars…</Trans>
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
                "_%_",
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
            },
          )}
        </>
      ) : hasCalendarCredentials ? (
        <div className={styles.refreshStatus}>
          {calendarPreviewLoading ? (
            <Trans>Loading calendars…</Trans>
          ) : (
            <Trans>No calendars found</Trans>
          )}
        </div>
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
  const code = useWatch({
    control: form.control,
    name: "meta.code",
  });
  const googleCalendarMeta = useWatch({
    control: form.control,
    name: "meta.googleCalendar",
  });
  const [fetchCalendarPreview] = papersApi.useGetCalendarPreviewMutation();
  const silentUpdateOptions = useMemo(
    () =>
      ({
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      }) as const,
    [],
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

  const selectedCalendarsKey = useMemo(
    () => JSON.stringify(selectedCalendars || {}),
    [selectedCalendars],
  );

  const availableCalendarsKey = useMemo(
    () =>
      JSON.stringify(
        (availableCalendars || []).map((calendar: any) => calendar?.id || ""),
      ),
    [availableCalendars],
  );

  const defaultSelectedCalendars = useMemo(
    () =>
      buildDefaultCalendarSelection(
        JSON.parse(availableCalendarsKey).map((id: string) => ({ id })),
      ),
    [availableCalendarsKey],
  );

  const googleCalendarCredentialsKey = useMemo(
    () =>
      JSON.stringify({
        access_token: googleCalendarMeta?.access_token || null,
        refresh_token: googleCalendarMeta?.refresh_token || null,
        serverAuthCode: googleCalendarMeta?.serverAuthCode || null,
        lastExchangedServerAuthCode:
          googleCalendarMeta?.lastExchangedServerAuthCode || null,
        code: code || null,
      }),
    [googleCalendarMeta, code],
  );

  const hasCalendarCredentials = Boolean(
    code ||
      googleCalendarMeta?.access_token ||
      googleCalendarMeta?.refresh_token ||
      googleCalendarMeta?.serverAuthCode,
  );

  useEffect(() => {
    if (form.getValues("meta.dayRange") == null) {
      form.setValue("meta.dayRange", DEFAULT_DAY_RANGE, silentUpdateOptions);
    }

    if (form.getValues("meta.highlightScale") == null) {
      form.setValue(
        "meta.highlightScale",
        DEFAULT_HIGHLIGHT_SCALE,
        silentUpdateOptions,
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

    if (!isExistingPaper || !paperId || !hasCalendarCredentials) {
      form.setValue(
        "meta.calendarState",
        { loading: false, error: null, isExistingPaper },
        silentUpdateOptions,
      );
      return;
    }

    let isCancelled = false;
    let previewRequest: any;
    const currentSelection = form.getValues("meta.selectedCalendars") || {};
    const selectionPayload = hasSelectedCalendar(currentSelection)
      ? currentSelection
      : defaultSelectedCalendars;
    const updateOptions = silentUpdateOptions;

    if (
      !hasSelectedCalendar(currentSelection) &&
      Object.keys(selectionPayload).length > 0
    ) {
      form.setValue(
        "meta.selectedCalendars",
        selectionPayload,
        silentUpdateOptions,
      );
    }

    form.setValue(
      "meta.calendarState",
      { loading: true, error: null, isExistingPaper },
      updateOptions,
    );

    const previewTimer = window.setTimeout(() => {
      previewRequest = fetchCalendarPreview({
        id: paperId,
        body: {
          selectedCalendars: selectionPayload,
          dayRange: normalizedDayRange,
          maxEvents: normalizedMaxEvents,
          code,
          googleCalendar: googleCalendarMeta,
        },
      });

      previewRequest
        .unwrap()
        .then((data: any) => {
          if (isCancelled) {
            return;
          }
          const { calendarData, calendarAuth } = data || {};

          if (calendarData) {
            form.setValue("meta.calendarData", calendarData, updateOptions);
            form.setValue(
              "meta.calendarData.events",
              calendarData.events ?? [],
              updateOptions,
            );
          }

          if (calendarAuth) {
            const currentGoogle = form.getValues("meta.googleCalendar") || {};
            form.setValue(
              "meta.googleCalendar",
              { ...currentGoogle, ...calendarAuth },
              updateOptions,
            );

            if (!calendarAuth.error && code) {
              form.setValue("meta.code", undefined, updateOptions);
            }
          }

          form.setValue(
            "meta.calendarState",
            { loading: false, error: null, isExistingPaper },
            updateOptions,
          );
        })
        .catch((error: any) => {
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
            updateOptions,
          );
        });
    }, CALENDAR_PREVIEW_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(previewTimer);
      previewRequest?.abort?.();
    };
  }, [
    defaultSelectedCalendars,
    fetchCalendarPreview,
    form,
    hasCalendarCredentials,
    isExistingPaper,
    paperId,
    selectedCalendarsKey,
    kind,
    normalizedDayRange,
    normalizedMaxEvents,
    silentUpdateOptions,
    googleCalendarCredentialsKey,
  ]);

  useEffect(() => {
    if (!availableCalendars?.length) {
      return;
    }

    const selectionEntries = Object.entries(selectedCalendars || {});
    const hasAnySelection = hasSelectedCalendar(selectedCalendars);

    if (selectionEntries.length === 0 || !hasAnySelection) {
      if (Object.keys(defaultSelectedCalendars).length > 0) {
        form.setValue(
          "meta.selectedCalendars",
          defaultSelectedCalendars,
          silentUpdateOptions,
        );
      }
    }
  }, [
    availableCalendars,
    defaultSelectedCalendars,
    form,
    selectedCalendars,
    silentUpdateOptions,
  ]);

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
