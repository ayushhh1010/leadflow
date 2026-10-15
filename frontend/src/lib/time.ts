import type { Lead } from "./types";

// All formatting happens in the viewer's local timezone; the API always speaks UTC.
const LOCALE = "en-US";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: "always" });
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY],
  ["month", 30 * DAY],
  ["week", 7 * DAY],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

export function startOfDay(time: number | Date): Date {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** "just now", "5 minutes ago", "2 days ago", "in 3 hours". */
export function timeAgo(iso: string, now: number): string {
  const elapsed = now - Date.parse(iso);
  for (const [unit, size] of UNITS) {
    if (Math.abs(elapsed) >= size) return relativeFormat.format(-Math.trunc(elapsed / size), unit);
  }
  return "just now";
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

function formatDay(date: Date, now: number): string {
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayFormat : dayYearFormat).format(date);
}

/** "May 4, 10:30 AM" (year added when it isn't the current one). */
export function formatDateTime(iso: string, now: number): string {
  return `${formatDay(new Date(iso), now)}, ${formatTime(iso)}`;
}

/** "today", "tomorrow", "yesterday" or "Oct 21". */
export function dayPhrase(iso: string, now: number): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return formatDay(date, now);
}

export type FollowUpState = "overdue" | "today" | "upcoming";

export function followUpState(iso: string, now: number): FollowUpState {
  const at = Date.parse(iso);
  if (at <= now) return "overdue";
  return at < addDays(startOfDay(now), 1).getTime() ? "today" : "upcoming";
}

/** "Follow-up today at 2:00 PM", "Overdue · yesterday at 9:00 AM". */
export function describeFollowUp(iso: string, now: number): string {
  const when = `${dayPhrase(iso, now)} at ${formatTime(iso)}`;
  return followUpState(iso, now) === "overdue" ? `Overdue · ${when}` : `Follow-up ${when}`;
}

export interface LeadGroups {
  /** Follow-up due before today. */
  overdue: Lead[];
  /** Follow-up due at any time today, including hours that already passed. */
  today: Lead[];
  others: Lead[];
}

/** Splits leads for pinning; pinned groups are sorted by follow-up time, others keep API order. */
export function groupLeads(leads: Lead[], now: number): LeadGroups {
  const todayStart = startOfDay(now).getTime();
  const tomorrowStart = addDays(startOfDay(now), 1).getTime();
  const groups: LeadGroups = { overdue: [], today: [], others: [] };

  for (const lead of leads) {
    const at = lead.follow_up_at ? Date.parse(lead.follow_up_at) : Number.POSITIVE_INFINITY;
    if (at < todayStart) groups.overdue.push(lead);
    else if (at < tomorrowStart) groups.today.push(lead);
    else groups.others.push(lead);
  }

  const byFollowUp = (a: Lead, b: Lead) =>
    Date.parse(a.follow_up_at!) - Date.parse(b.follow_up_at!);
  groups.overdue.sort(byFollowUp);
  groups.today.sort(byFollowUp);
  return groups;
}

/** Local `YYYY-MM-DD`, the value format of `<input type="date">`. */
export function toDateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Combines `<input type="date">` and `<input type="time">` values as local time. */
export function parseLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}`); // no offset → parsed as local time
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
