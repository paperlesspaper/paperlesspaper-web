import axios, { AxiosError } from 'axios';
import { addDays } from 'date-fns';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { isPast } from 'date-fns';

type GenerateAuthTokenParams = {
  code?: string;
  refreshToken?: string;
  redirectUri?: string;
};

type GenerateAuthTokenResult = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  expiry_date?: number;
  error?: string;
  error_description?: string;
  lastExchangedServerAuthCode?: string;
};

const DEFAULT_GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3200';
const DEFAULT_DAY_RANGE = 3;
const MAX_DAY_RANGE = 100;
const DEFAULT_MAX_EVENTS = 50;
const MAX_EVENTS_LIMIT = 200;

const toExpiryDate = (expiresIn?: number, explicitExpiry?: number): number | undefined => {
  if (explicitExpiry) {
    return explicitExpiry;
  }

  if (!expiresIn) {
    return undefined;
  }

  return Date.now() + expiresIn * 1000;
};

const safeDateFromValue = (value?: string | number | Date): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const isInsufficientPermissionError = (error: unknown): boolean => {
  const statusCode = (error as any)?.code ?? (error as any)?.response?.status;
  const reason = (error as any)?.errors?.[0]?.reason || (error as any)?.response?.data?.error?.status;
  const message = ((error as Error)?.message || '').toLowerCase();

  if (statusCode === 403) {
    return true;
  }

  if (typeof reason === 'string' && reason.toLowerCase().includes('insufficient')) {
    return true;
  }

  return message.includes('insufficient permission');
};

export async function generateAuthToken(params: GenerateAuthTokenParams): Promise<GenerateAuthTokenResult> {
  const { code, refreshToken, redirectUri = DEFAULT_GOOGLE_REDIRECT_URI } = params || {};

  if (!code && !refreshToken) {
    return { error: 'Authorization code or refresh token not provided.' };
  }

  const payload = new URLSearchParams();
  payload.append('client_id', process.env.GOOGLE_CLIENT_ID || '');
  payload.append('client_secret', process.env.GOOGLE_CLIENT_SECRET || '');

  if (code) {
    payload.append('code', code);
    payload.append('redirect_uri', redirectUri);
    payload.append('grant_type', 'authorization_code');
  } else if (refreshToken) {
    payload.append('refresh_token', refreshToken);
    payload.append('grant_type', 'refresh_token');
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, id_token, expires_in, expiry_date } = tokenResponse.data;
    return {
      access_token,
      refresh_token,
      id_token,
      expires_in,
      expiry_date: toExpiryDate(expires_in, expiry_date),
    };
  } catch (error) {
    const axiosError = error as AxiosError<any>;
    const responseData = axiosError.response?.data || {};
    console.error('Error getting Google token:', responseData?.error_description || axiosError.message);
    return {
      error: responseData?.error || 'Error getting token',
      error_description: responseData?.error_description,
    };
  }
}

export async function getCalendarEvents(paper: any): Promise<any> {
  const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

  let googleCalendarMeta = paper.meta?.googleCalendar ? { ...paper.meta.googleCalendar } : {};
  let accessToken = googleCalendarMeta.access_token;
  let refreshToken = googleCalendarMeta.refresh_token;
  const hasNewServerAuthCode = Boolean(
    googleCalendarMeta.serverAuthCode &&
      googleCalendarMeta.serverAuthCode !== googleCalendarMeta.lastExchangedServerAuthCode,
  );

  const refreshAccessTokenIfNeeded = async (): Promise<void> => {
    const expiryDate = safeDateFromValue(googleCalendarMeta?.expiry_date);
    const tokenExpired = expiryDate ? isPast(expiryDate) : false;
    const missingAccessToken = !accessToken;

    if ((!tokenExpired && !missingAccessToken) || !refreshToken) {
      return;
    }

    try {
      const refreshedTokens = await generateAuthToken({ refreshToken });

      if (refreshedTokens?.error) {
        console.error(
          'Unable to refresh Google Calendar access token:',
          refreshedTokens.error_description || refreshedTokens.error,
        );
        return;
      }

      await updateGoogleCalendarMeta({
        access_token: refreshedTokens.access_token || accessToken,
        refresh_token: refreshedTokens.refresh_token || refreshToken,
        expires_in: refreshedTokens.expires_in ?? googleCalendarMeta.expires_in,
        expiry_date: refreshedTokens.expiry_date ?? toExpiryDate(refreshedTokens.expires_in, undefined),
      });
    } catch (refreshError) {
      console.error('Failed to refresh Google Calendar access token:', refreshError);
    }
  };

  const persistGoogleCalendarMetaIfPossible = async (): Promise<void> => {
    if (typeof paper?.save !== 'function') {
      return;
    }

    try {
      paper.markModified?.('meta');
      await paper.save();
    } catch (persistError) {
      console.error(`Failed to persist Google Calendar meta for paper ${paper._id}`, persistError);
    }
  };

  const updateGoogleCalendarMeta = async (patch: Record<string, any>): Promise<void> => {
    googleCalendarMeta = {
      ...googleCalendarMeta,
      ...patch,
    };

    if (!paper.meta) {
      paper.meta = {};
    }

    paper.meta.googleCalendar = { ...googleCalendarMeta };
    accessToken = paper.meta.googleCalendar.access_token;
    refreshToken = paper.meta.googleCalendar.refresh_token;
    await persistGoogleCalendarMetaIfPossible();
  };

  // serverAuthCode (mostly from iOS) needs to be exchanged before we can talk to Google APIs.
  if (hasNewServerAuthCode) {
    try {
      const exchangedTokens = await generateAuthToken({
        code: googleCalendarMeta.serverAuthCode,
        redirectUri: googleCalendarMeta.redirect_uri || DEFAULT_GOOGLE_REDIRECT_URI,
      });

      if (!exchangedTokens.error) {
        await updateGoogleCalendarMeta({
          access_token: exchangedTokens.access_token || accessToken,
          refresh_token: exchangedTokens.refresh_token || refreshToken,
          id_token: exchangedTokens.id_token ?? googleCalendarMeta.id_token,
          expires_in: exchangedTokens.expires_in ?? googleCalendarMeta.expires_in,
          expiry_date: exchangedTokens.expiry_date ?? googleCalendarMeta.expiry_date,
          lastExchangedServerAuthCode: googleCalendarMeta.serverAuthCode,
        });
      } else {
        console.error('Unable to exchange serverAuthCode for Google tokens:', exchangedTokens.error);
      }
    } catch (error) {
      console.error('Error converting serverAuthCode to Google tokens:', error);
    }
  }

  await refreshAccessTokenIfNeeded();

  if (!accessToken || !refreshToken) {
    console.error('Google Calendar access token or refresh token not found in paper meta.');
    return {
      calendars: [],
      events: [],
    };
  }

  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  oAuth2Client.on('tokens', async (tokens) => {
    const metaPatch: Record<string, any> = {};

    if (tokens.access_token) {
      metaPatch.access_token = tokens.access_token;
    }

    if (tokens.refresh_token) {
      metaPatch.refresh_token = tokens.refresh_token;
    }

    if (tokens.expiry_date || tokens.expires_in) {
      metaPatch.expiry_date = toExpiryDate(tokens.expires_in, tokens.expiry_date);
    }

    if (Object.keys(metaPatch).length > 0) {
      await updateGoogleCalendarMeta(metaPatch);
    }
  });

  const calendar = google.calendar({
    version: 'v3',
    auth: oAuth2Client,
  });

  let calendarsData: calendar_v3.Schema$CalendarListListResponse | null = null;

  try {
    const calendarsResponse = await calendar.calendarList.list();
    calendarsData = calendarsResponse.data;
  } catch (error) {
    if (isInsufficientPermissionError(error)) {
      console.error('Google Calendar insufficient permission when listing calendars.', error);
      await updateGoogleCalendarMeta({
        access_token: undefined,
        refresh_token: undefined,
        serverAuthCode: undefined,
        lastExchangedServerAuthCode: undefined,
      });
      return {
        calendars: [],
        events: [],
        error: 'insufficient-permission',
        error_description: 'Google did not grant the calendar scope. Please sign in again and accept calendar access.',
      };
    }

    throw error;
  }

  const configuredDayRange = Number(paper.meta?.dayRange);
  const safeDayRange = Number.isFinite(configuredDayRange) ? Math.round(configuredDayRange) : DEFAULT_DAY_RANGE;
  const clampedDayRange = Math.max(1, Math.min(MAX_DAY_RANGE, safeDayRange));
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const configuredMaxEvents = Number(paper.meta?.maxEvents);
  const safeMaxEvents = Number.isFinite(configuredMaxEvents) ? Math.round(configuredMaxEvents) : DEFAULT_MAX_EVENTS;
  const clampedMaxEvents = Math.max(1, Math.min(MAX_EVENTS_LIMIT, safeMaxEvents));
  const endDate = addDays(startDate, Math.max(clampedDayRange - 1, 0));
  endDate.setHours(23, 59, 59, 999);
  const startOfDay = startDate.toISOString();
  const endOfDay = endDate.toISOString();

  const selectedCalendars = paper.meta?.selectedCalendars || {};

  const eventPromises = Object.entries(selectedCalendars)
    .filter(([key, value]) => value)
    .map(async ([key]) => {
      const calendarId = key.replaceAll('_%_', '.');

      try {
        const eventsResult = await calendar.events.list({
          calendarId,
          timeMin: startOfDay,
          timeMax: endOfDay,
          singleEvents: true,
          orderBy: 'startTime',
        });

        return eventsResult.data.items;
      } catch (error) {
        console.error(`Error fetching events for calendar ${calendarId}:`, error);
        return [];
      }
    });

  const eventsArray = await Promise.all(eventPromises);

  let events = eventsArray.flat();
  events = events.slice(0, clampedMaxEvents);

  // console.log('Fetched events:', events?.length);
  // console.log('Fetched calendars:', calendarsData?.items?.length);

  return {
    calendars: calendarsData?.items || [],
    events: events,
  };
}

export async function updateGoogleCalendarEvents(body: any): Promise<any> {
  let calendarAuth: GenerateAuthTokenResult = {};
  let calendarData = undefined;

  if (body.kind === 'google-calendar') {
    const googleCalendarMeta = body?.meta?.googleCalendar || {};
    const authorizationCode = body?.meta?.code;
    const expiryDate = safeDateFromValue(googleCalendarMeta?.expiry_date);
    const tokenExpired = expiryDate ? isPast(expiryDate) : false;
    const hasNewServerAuthCode = Boolean(
      googleCalendarMeta.serverAuthCode &&
        googleCalendarMeta.serverAuthCode !== googleCalendarMeta.lastExchangedServerAuthCode,
    );
    const shouldRefreshToken =
      Boolean(authorizationCode) || hasNewServerAuthCode || !googleCalendarMeta?.access_token || tokenExpired;

    if (shouldRefreshToken) {
      console.log('Refreshing auth token for Google Calendar...');

      if (authorizationCode) {
        calendarAuth = await generateAuthToken({ code: authorizationCode });
      } else if (googleCalendarMeta.refresh_token) {
        calendarAuth = await generateAuthToken({ refreshToken: googleCalendarMeta.refresh_token });
      } else if (hasNewServerAuthCode && googleCalendarMeta.serverAuthCode) {
        calendarAuth = await generateAuthToken({
          code: googleCalendarMeta.serverAuthCode,
          redirectUri: googleCalendarMeta.redirect_uri || DEFAULT_GOOGLE_REDIRECT_URI,
        });
      }

      if (hasNewServerAuthCode && !calendarAuth?.error) {
        calendarAuth = {
          ...calendarAuth,
          lastExchangedServerAuthCode: googleCalendarMeta.serverAuthCode,
        };
      }

      if (calendarAuth?.expires_in || calendarAuth?.expiry_date) {
        calendarAuth = {
          ...calendarAuth,
          expiry_date: calendarAuth.expiry_date ?? toExpiryDate(calendarAuth.expires_in, undefined),
        };
      }
    }

    const mergedGoogleCalendarMeta = calendarAuth?.error ? googleCalendarMeta : { ...googleCalendarMeta, ...calendarAuth };

    calendarData = await getCalendarEvents({
      ...body,
      meta: { ...body.meta, googleCalendar: mergedGoogleCalendarMeta },
    });
  }

  return { calendarAuth, calendarData };
}

export default {
  generateAuthToken,
  getCalendarEvents,
  updateGoogleCalendarEvents,
};
