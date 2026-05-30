import {
  faChevronLeft,
  faChevronRight,
  faPen,
  faPlus,
  faTrashAlt,
} from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, InlineLoading, Modal } from "@progressiveui/react";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { papersApi } from "ducks/ePaper/papersApi";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { RRule, rrulestr } from "rrule";
import PaperSelectionGrid from "../components/PaperSelectionGrid";
import useEditor from "../ImageEditor/useEditor";
import styles from "./playlistSchedule.module.scss";

type RepeatKind = "none" | "daily" | "weekly" | "monthly";

type PlaylistEntry = {
  id: string;
  paperId: string;
  startsAt: string;
  durationMinutes: number;
  rrule?: string;
  repeat?: RepeatKind;
};

type DraftEntry = {
  id?: string;
  paperId: string;
  date: string;
  time: string;
  durationMinutes: number;
  repeat: RepeatKind;
};

const repeatOptions: Array<{ value: RepeatKind; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAY_MINUTES = 24 * 60;
const TIME_SLOT_MINUTES = 30;

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

const buildRrule = (startsAt: string, repeat: RepeatKind) => {
  if (repeat === "none") return undefined;

  const freqByRepeat = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
  };

  return new RRule({
    freq: freqByRepeat[repeat],
    interval: 1,
    dtstart: new Date(startsAt),
  }).toString();
};

const inferRepeat = (entry?: PlaylistEntry): RepeatKind => {
  if (entry?.repeat) return entry.repeat;
  if (!entry?.rrule) return "none";

  try {
    const rule = rrulestr(entry.rrule) as RRule;
    const freq = rule.options.freq;
    if (freq === RRule.DAILY) return "daily";
    if (freq === RRule.WEEKLY) return "weekly";
    if (freq === RRule.MONTHLY) return "monthly";
  } catch (error) {
    console.warn("Could not infer playlist repeat", error);
  }

  return "none";
};

const getDayStart = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getMinutesSinceDayStart = (date: Date) =>
  date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

const getDateAtMinutes = (day: Date, minutes: number) => {
  const result = getDayStart(day);
  result.setMinutes(minutes);
  return result;
};

const maxDate = (...dates: Date[]) =>
  new Date(Math.max(...dates.map((date) => date.getTime())));

const minDate = (...dates: Date[]) =>
  new Date(Math.min(...dates.map((date) => date.getTime())));

const uniqueDates = (dates: Date[]) => {
  const seen = new Set<number>();
  return dates.filter((date) => {
    const time = date.getTime();
    if (seen.has(time)) return false;
    seen.add(time);
    return true;
  });
};

const getEntryOccurrencesForRange = (
  entry: PlaylistEntry,
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const startsAt = new Date(entry.startsAt);
  if (Number.isNaN(startsAt.getTime())) return [];

  if (!entry.rrule) {
    return startsAt.getTime() < rangeEnd.getTime() ? [startsAt] : [];
  }

  try {
    const rule = rrulestr(entry.rrule) as RRule;
    return uniqueDates([
      rule.before(rangeStart, true),
      ...rule.between(rangeStart, rangeEnd, true),
    ].filter(Boolean) as Date[]);
  } catch (error) {
    console.warn("Could not expand playlist recurrence", error);
    return [];
  }
};

const buildCalendarSegments = (
  entries: PlaylistEntry[],
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const occurrences = entries
    .flatMap((entry, index) =>
      getEntryOccurrencesForRange(entry, rangeStart, rangeEnd).map(
        (occurrence) => ({
          entry,
          index,
          occurrence,
        }),
      ),
    )
    .filter(({ entry, occurrence }) => {
      return Boolean(
        entry.paperId && occurrence.getTime() < rangeEnd.getTime(),
      );
    })
    .sort((a, b) => {
      const timeDifference = a.occurrence.getTime() - b.occurrence.getTime();
      return timeDifference || a.index - b.index;
    });

  return occurrences.flatMap((item, itemIndex) => {
    const nextItem = occurrences[itemIndex + 1];
    const intervalStart = item.occurrence;
    const intervalEnd = nextItem?.occurrence || rangeEnd;
    if (intervalEnd.getTime() <= rangeStart.getTime()) return [];
    if (intervalStart.getTime() >= rangeEnd.getTime()) return [];

    const segments = [];
    let cursor = maxDate(intervalStart, rangeStart);

    while (cursor.getTime() < intervalEnd.getTime()) {
      const dayStart = getDayStart(cursor);
      const nextDayStart = addDays(dayStart, 1);
      const segmentEnd = minDate(intervalEnd, nextDayStart, rangeEnd);

      segments.push({
        entry: item.entry,
        occurrence: item.occurrence,
        start: cursor,
        end: segmentEnd,
        dayKey: format(cursor, "yyyy-MM-dd"),
        isCarryOver: intervalStart.getTime() < cursor.getTime(),
        isContinuing: intervalEnd.getTime() > segmentEnd.getTime(),
      });

      cursor = segmentEnd;
    }

    return segments;
  });
};

const getSegmentStyle = (start: Date, end: Date) => {
  const startMinutes = getMinutesSinceDayStart(start);
  const durationMinutes = Math.max(
    1,
    (end.getTime() - start.getTime()) / 1000 / 60,
  );

  return {
    top: `${(startMinutes / DAY_MINUTES) * 100}%`,
    height: `max(58px, ${(durationMinutes / DAY_MINUTES) * 100}%)`,
  };
};

const PlaylistPaperArtwork = ({ paper }: { paper: any }) => {
  const image = papersApi.useGenerateImageUrlQuery(
    {
      id: paper?.id,
      body: { kind: "original.png" },
    },
    { skip: !paper?.id || !paper?.imageUpdatedAt },
  );

  if (image.data?.signedUrl) {
    return (
      <>
        <div
          className={styles.entryBackdrop}
          style={{ backgroundImage: `url("${image.data.signedUrl}")` }}
        />
        <div className={styles.entryPreview}>
          <img
            className={styles.entryPreviewImage}
            src={image.data.signedUrl}
            alt={paper?.name || paper?.kind || "Paper preview"}
          />
        </div>
      </>
    );
  }

  return (
    <div className={styles.entryPreview}>
      <div className={styles.entryPreviewFallback}>
        {paper?.name?.charAt(0) || paper?.kind?.charAt(0) || "P"}
      </div>
    </div>
  );
};

export default function PlaylistSchedule() {
  const { form }: any = useEditor();
  const { organization } = useParams<{ organization: string }>();
  const { t } = useTranslation();
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(
    null,
  );
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [weekStart, setWeekStart] = React.useState(() => getWeekStart());
  const [draft, setDraft] = React.useState<DraftEntry>(() => {
    const now = new Date();
    return {
      paperId: "",
      date: toInputDate(now),
      time: toInputTime(now),
      durationMinutes: 60,
      repeat: "none",
    };
  });

  const entries = (form.watch("meta.playlistEntries") || []) as PlaylistEntry[];

  const papers = papersApi.useGetAllPapersQuery(
    {
      queryOptions: {
        organization,
        sortBy: "updatedAt:desc",
      },
    },
    { skip: !organization },
  );

  const selectablePapers =
    papers.data?.filter((paper: any) => paper.kind !== "playlist") ?? [];

  const paperById = React.useMemo(() => {
    const lookup: Record<string, any> = {};
    selectablePapers.forEach((paper: any) => {
      lookup[paper.id] = paper;
    });
    return lookup;
  }, [selectablePapers]);

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekEnd = React.useMemo(() => addDays(weekStart, 7), [weekStart]);

  const calendarSegments = React.useMemo(
    () => buildCalendarSegments(entries, weekStart, weekEnd),
    [entries, weekEnd, weekStart],
  );

  const setEntries = (nextEntries: PlaylistEntry[]) => {
    form.setValue("meta.playlistEntries", nextEntries, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const openNewEntry = () => {
    const now = new Date();
    setEditingEntryId(null);
    setDraft({
      paperId: selectablePapers[0]?.id || "",
      date: toInputDate(now),
      time: toInputTime(now),
      durationMinutes: 60,
      repeat: "none",
    });
    setModalOpen(true);
  };

  const openNewEntryAt = (date: Date) => {
    setEditingEntryId(null);
    setDraft({
      paperId: selectablePapers[0]?.id || "",
      date: toInputDate(date),
      time: toInputTime(date),
      durationMinutes: 60,
      repeat: "none",
    });
    setModalOpen(true);
  };

  const openEditEntry = (entry: PlaylistEntry) => {
    const startsAt = new Date(entry.startsAt);
    setEditingEntryId(entry.id);
    setDraft({
      id: entry.id,
      paperId: entry.paperId,
      date: toInputDate(startsAt),
      time: toInputTime(startsAt),
      durationMinutes: entry.durationMinutes || 60,
      repeat: inferRepeat(entry),
    });
    setModalOpen(true);
  };

  const saveEntry = () => {
    if (!draft.paperId) return;
    const startsAt = buildStartsAt(draft.date, draft.time);
    const nextEntry: PlaylistEntry = {
      id: draft.id || makeId(),
      paperId: draft.paperId,
      startsAt,
      durationMinutes: Number(draft.durationMinutes) || 60,
      repeat: draft.repeat,
      rrule: buildRrule(startsAt, draft.repeat),
    };

    const withoutCurrent = entries.filter((entry) => entry.id !== nextEntry.id);
    setEntries([...withoutCurrent, nextEntry]);
    setModalOpen(false);
  };

  const deleteEntry = (entryId: string) => {
    setEntries(entries.filter((entry) => entry.id !== entryId));
  };

  const selectedDraftPaper = draft.paperId ? { [draft.paperId]: true } : {};
  const weekLabel = `${format(weekStart, "MMM d")} - ${format(
    addDays(weekStart, 6),
    "MMM d",
  )}`;

  return (
    <div className={styles.playlist}>
      <div className={styles.header}>
        <div>
          <h3>
            <Trans>Playlist</Trans>
          </h3>
          <div className={styles.weekLabel}>{weekLabel}</div>
        </div>
        <div className={styles.headerActions}>
          <Button
            kind="secondary"
            onClick={() => setWeekStart((current) => subWeeks(current, 1))}
            className={styles.iconButton}
            aria-label={t("Previous week")}
            iconDescription={t("Previous week")}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </Button>
          <Button kind="secondary" onClick={() => setWeekStart(getWeekStart())}>
            <Trans>Today</Trans>
          </Button>
          <Button
            kind="secondary"
            onClick={() => setWeekStart((current) => addWeeks(current, 1))}
            className={styles.iconButton}
            aria-label={t("Next week")}
            iconDescription={t("Next week")}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </Button>
          <Button onClick={openNewEntry} disabled={!selectablePapers.length}>
            <FontAwesomeIcon icon={faPlus} />
            <span>
              <Trans>Add</Trans>
            </span>
          </Button>
        </div>
      </div>

      {papers.isLoading ? (
        <InlineLoading description={<Trans>Loading papers...</Trans>} />
      ) : (
        <div className={styles.calendar}>
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const daySegments = calendarSegments.filter(
              (item) => item.dayKey === dayKey,
            );

            return (
              <section key={dayKey} className={styles.day}>
                <div className={styles.dayHeader}>
                  <strong>{format(day, "EEE")}</strong>
                  <span>{format(day, "MMM d")}</span>
                </div>
                <div
                  className={styles.dayEntries}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (!selectablePapers.length) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(
                      0.999,
                      Math.max(0, (event.clientY - rect.top) / rect.height),
                    );
                    const minutes = Math.floor(
                      (ratio * DAY_MINUTES) / TIME_SLOT_MINUTES,
                    ) * TIME_SLOT_MINUTES;
                    openNewEntryAt(getDateAtMinutes(day, minutes));
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openNewEntryAt(getDateAtMinutes(day, 9 * 60));
                  }}
                >
                  {daySegments.map(
                    ({
                      entry,
                      occurrence,
                      start,
                      end,
                      isCarryOver,
                      isContinuing,
                    }) => {
                      const paper = paperById[entry.paperId];

                      return (
                        <article
                          key={`${entry.id}-${start.toISOString()}-${end.toISOString()}`}
                          className={styles.entry}
                          style={getSegmentStyle(start, end)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <PlaylistPaperArtwork paper={paper} />
                          <div className={styles.entryContent}>
                            <div className={styles.entryTime}>
                              {isCarryOver ? (
                                <Trans>Continues</Trans>
                              ) : (
                                format(occurrence, "HH:mm")
                              )}
                            </div>
                            <div className={styles.entryTitle}>
                              {paper?.name ||
                                paper?.kind ||
                                t("Untitled paper")}
                            </div>
                            <div className={styles.entryMeta}>
                              {isContinuing ? (
                                <Trans>continues</Trans>
                              ) : (
                                <>
                                  <Trans>until</Trans> {format(end, "HH:mm")}
                                </>
                              )}
                              {entry.repeat && entry.repeat !== "none"
                                ? ` - ${t(entry.repeat)}`
                                : ""}
                            </div>
                          </div>
                          <div className={styles.entryActions}>
                            <button
                              type="button"
                              onClick={() => openEditEntry(entry)}
                              aria-label={t("Edit")}
                            >
                              <FontAwesomeIcon icon={faPen} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry.id)}
                              aria-label={t("Delete")}
                            >
                              <FontAwesomeIcon icon={faTrashAlt} />
                            </button>
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!entries.length && (
        <div className={styles.empty}>
          <Trans>No playlist entries yet</Trans>
        </div>
      )}

      {isModalOpen && (
        <Modal
          open
          modalHeading={
            editingEntryId ? (
              <Trans>Edit playlist entry</Trans>
            ) : (
              <Trans>Add playlist entry</Trans>
            )
          }
          primaryButtonText={<Trans>Continue</Trans>}
          primaryButtonDisabled={!draft.paperId}
          onRequestSubmit={saveEntry}
          onRequestClose={() => setModalOpen(false)}
          onSecondarySubmit={() => setModalOpen(false)}
          overscrollBehavior="inside"
          kindMobile="fullscreen"
        >
          <div className={styles.form}>
            <div className={styles.paperPicker}>
              <span>
                <Trans>Paper</Trans>
              </span>
              <PaperSelectionGrid
                papers={selectablePapers}
                organization={organization}
                selectedPaperIds={selectedDraftPaper}
                inputType="radio"
                inputName="playlist-entry-paper"
                onTogglePaper={(paperId) =>
                  setDraft((current) => ({
                    ...current,
                    paperId,
                  }))
                }
              />
            </div>
            <div className={styles.formGrid}>
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
                  <Trans>Time</Trans>
                </span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className={styles.formGrid}>
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
          </div>
        </Modal>
      )}
    </div>
  );
}
