import { getGoogleAccessToken } from "./auth.js";

// Fetch Google Calendar events between two Date objects (inclusive).
// Returns [] (and sets connectionIssue) if there's no Google token yet,
// or if the token has expired.
export async function fetchCalendarEvents(timeMin, timeMax) {
  const token = await getGoogleAccessToken();
  if (!token) {
    return { events: [], issue: "not_connected" };
  }

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 401) {
    // Token expired. Supabase doesn't auto-refresh Google's own token,
    // so ask the user to reconnect.
    return { events: [], issue: "expired" };
  }
  if (!res.ok) {
    console.error("Calendar fetch failed", res.status, await res.text());
    return { events: [], issue: "error" };
  }

  const data = await res.json();
  const events = (data.items || []).map(normalizeEvent).filter(Boolean);
  return { events, issue: null };
}

function normalizeEvent(item) {
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  if (!startRaw) return null;
  const allDay = !item.start?.dateTime;
  return {
    id: item.id,
    title: item.summary || "(No title)",
    start: new Date(startRaw),
    end: endRaw ? new Date(endRaw) : null,
    allDay,
    location: item.location || "",
    hangoutLink: item.hangoutLink || item.htmlLink || "",
    isMeeting: !!(item.hangoutLink || item.attendees?.length),
  };
}

export function formatEventTime(event) {
  if (event.allDay) return "All day";
  const opts = { hour: "numeric", minute: "2-digit" };
  const start = event.start.toLocaleTimeString([], opts);
  const end = event.end ? event.end.toLocaleTimeString([], opts) : "";
  return end ? `${start} – ${end}` : start;
}
