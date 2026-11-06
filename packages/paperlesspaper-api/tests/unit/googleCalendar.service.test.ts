import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tokenEndpoint = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({ default: { post: tokenEndpoint } }));

const googleApisMock = vi.hoisted(() => {
  const oAuth2Client = {
    setCredentials: vi.fn(),
    on: vi.fn(),
  };
  const calendarListList = vi.fn();
  const eventsList = vi.fn();

  return {
    oAuth2Client,
    calendarListList,
    eventsList,
    google: {
      auth: {
        OAuth2: vi.fn(function OAuth2() {
          return oAuth2Client;
        }),
      },
      calendar: vi.fn(() => ({
        calendarList: {
          list: calendarListList,
        },
        events: {
          list: eventsList,
        },
      })),
    },
  };
});

vi.mock("googleapis", () => ({
  google: googleApisMock.google,
}));

import { getCalendarEvents, updateGoogleCalendarEvents } from "../../src/papers/googleCalendar.service";

describe("googleCalendar.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T07:00:00.000Z"));

    googleApisMock.oAuth2Client.setCredentials.mockClear();
    googleApisMock.oAuth2Client.on.mockClear();
    googleApisMock.calendarListList.mockReset();
    googleApisMock.eventsList.mockReset();
    googleApisMock.google.auth.OAuth2.mockClear();
    googleApisMock.google.calendar.mockClear();
    tokenEndpoint.mockReset();

    googleApisMock.calendarListList.mockResolvedValue({
      data: {
        items: [
          { id: "primary", summary: "Primary" },
          { id: "work.example.com", summary: "Work" },
        ],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a legacy refresh token across repeated expiry and save cycles", async () => {
    googleApisMock.eventsList.mockResolvedValue({ data: { items: [] } });
    let paper: any = {
      kind: "google-calendar",
      meta: {
        selectedCalendars: { primary: true },
        googleCalendar: {
          access_token: "expired-access",
          refresh_token: "legacy-refresh",
          expiry_date: Date.now() - 1,
        },
      },
    };
    for (let cycle = 1; cycle <= 2; cycle++) {
      tokenEndpoint.mockResolvedValueOnce({ data: { access_token: `access-${cycle}`, expires_in: 3600 } });
      const result = await updateGoogleCalendarEvents(paper);
      // Persist the same metadata patch used by the paper controller and editor.
      paper = JSON.parse(JSON.stringify({ ...paper, meta: {
        ...paper.meta,
        googleCalendar: { ...paper.meta.googleCalendar, ...result.calendarAuth },
      } }));
      expect(paper.meta.googleCalendar.refresh_token).toBe("legacy-refresh");
      expect(paper.meta.googleCalendar.access_token).toBe(`access-${cycle}`);
      expect(paper.meta.googleCalendar.expiry_date).toBe(Date.now() + 3600000);
      const request = new URLSearchParams(tokenEndpoint.mock.calls[cycle - 1][1]);
      expect(request.get("grant_type")).toBe("refresh_token");
      expect(request.get("refresh_token")).toBe("legacy-refresh");
      vi.setSystemTime(Date.now() + 3600001);
    }
    expect(tokenEndpoint).toHaveBeenCalledTimes(2);
  });

  it.each([
    "https://web.dev.paperlesspaper.de",
    "https://web.paperlesspaper.de",
    "http://localhost:3200",
  ])("exchanges popup codes using the calling origin %s", async (webRedirectUri) => {
    tokenEndpoint.mockResolvedValueOnce({ data: { access_token: "new-access", expires_in: 3600 } });
    await updateGoogleCalendarEvents({ kind: "plugin", meta: {
      pluginManifest: { requiredPermissions: ["googleCalendar"] },
      code: "popup-code",
      googleCalendar: { webRedirectUri, redirect_uri: "native-redirect" },
    } });
    const request = new URLSearchParams(tokenEndpoint.mock.calls[0][1]);
    expect(request.get("redirect_uri")).toBe(webRedirectUri);
    expect(request.get("code")).toBe("popup-code");
  });

  it("preserves the configured redirect for older browser clients", async () => {
    tokenEndpoint.mockResolvedValueOnce({ data: { access_token: "new-access", expires_in: 3600 } });
    await updateGoogleCalendarEvents({ kind: "google-calendar", meta: { code: "legacy-code" } });
    const request = new URLSearchParams(tokenEndpoint.mock.calls[0][1]);
    expect(request.get("redirect_uri")).toBe(process.env.GOOGLE_REDIRECT_URI || "http://localhost:3200");
  });

  it("keeps native code redirects independent of previous browser logins", async () => {
    tokenEndpoint.mockResolvedValueOnce({ data: { access_token: "new-access", expires_in: 3600 } });
    await updateGoogleCalendarEvents({ kind: "google-calendar", meta: { googleCalendar: {
      serverAuthCode: "native-code",
      redirect_uri: "native-redirect",
      webRedirectUri: "https://web.dev.paperlesspaper.de",
    } } });
    const request = new URLSearchParams(tokenEndpoint.mock.calls[0][1]);
    expect(request.get("redirect_uri")).toBe("native-redirect");
  });

  it("adopts a rotated refresh token returned by Google", async () => {
    tokenEndpoint.mockResolvedValueOnce({ data: { access_token: "new-access", refresh_token: "rotated-refresh", expires_in: 3600 } });
    const result = await updateGoogleCalendarEvents({ kind: "google-calendar", meta: {
      googleCalendar: { access_token: "expired", refresh_token: "old-refresh", expiry_date: Date.now() - 1 },
    } });
    expect(result.calendarAuth.refresh_token).toBe("rotated-refresh");
  });

  it("does not attach a previous account's refresh token to a fresh code exchange", async () => {
    tokenEndpoint.mockResolvedValueOnce({ data: { access_token: "other-account-access", expires_in: 3600 } });
    const result = await updateGoogleCalendarEvents({ kind: "google-calendar", meta: {
      code: "fresh-account-code",
      googleCalendar: { access_token: "old-access", refresh_token: "old-account-refresh" },
    } });
    expect(result.calendarAuth.refresh_token).toBeUndefined();
    expect(googleApisMock.oAuth2Client.setCredentials).toHaveBeenLastCalledWith({
      access_token: "other-account-access", refresh_token: undefined,
    });
  });

  it("returns the earliest events across selected calendars before applying maxEvents", async () => {
    googleApisMock.eventsList.mockImplementation(async ({ calendarId }) => {
      const eventsByCalendar: Record<
        string,
        Array<{ id: string; summary: string; start: { dateTime: string } }>
      > = {
        primary: [
          {
            id: "primary-mid",
            summary: "Primary mid-morning",
            start: { dateTime: "2026-06-08T10:00:00+02:00" },
          },
          {
            id: "primary-late",
            summary: "Primary late",
            start: { dateTime: "2026-06-08T16:00:00+02:00" },
          },
        ],
        "work.example.com": [
          {
            id: "work-early",
            summary: "Work early",
            start: { dateTime: "2026-06-08T09:00:00+02:00" },
          },
        ],
      };

      return {
        data: {
          items: eventsByCalendar[calendarId] || [],
        },
      };
    });

    const result = await getCalendarEvents({
      meta: {
        googleCalendar: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
        selectedCalendars: {
          primary: true,
          "work_%_example_%_com": true,
        },
        dayRange: 1,
        maxEvents: 2,
      },
    });

    expect(result.events.map((event: { id?: string }) => event.id)).toEqual([
      "work-early",
      "primary-mid",
    ]);
    expect(googleApisMock.eventsList).toHaveBeenCalledTimes(2);
    expect(googleApisMock.eventsList).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        calendarId: "primary",
        maxResults: 2,
        orderBy: "startTime",
        singleEvents: true,
      }),
    );
    expect(googleApisMock.eventsList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        calendarId: "work.example.com",
        maxResults: 2,
        orderBy: "startTime",
        singleEvents: true,
      }),
    );
  });
  it("lists calendars and events with an access token even without a refresh token", async () => {
    googleApisMock.eventsList.mockResolvedValue({ data: { items: [] } });
    const result = await getCalendarEvents({ meta: {
      googleCalendar: { access_token: "access-token" },
      selectedCalendars: { primary: true },
    } });
    expect(result.calendars).toHaveLength(2);
    expect(googleApisMock.eventsList).toHaveBeenCalledOnce();
  });

  it.each([
    ["2026-03-29T00:30:00Z", "2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z"],
    ["2026-10-25T00:30:00Z", "2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z"],
  ])("queries only the display day across DST at %s", async (now, timeMin, timeMax) => {
    vi.setSystemTime(new Date(now));
    googleApisMock.eventsList.mockResolvedValue({ data: { items: [] } });
    await getCalendarEvents({
      kind: "google-calendar",
      meta: {
        googleCalendar: { access_token: "access-token" },
        selectedCalendars: { primary: true },
        timezone: "Europe/Berlin", highlightToday: true, dayRange: 30,
      },
    });
    expect(googleApisMock.eventsList).toHaveBeenCalledWith(expect.objectContaining({timeMin, timeMax}));
  });

});
