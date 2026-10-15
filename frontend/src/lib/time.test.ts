import { beforeAll, describe, expect, it } from "vitest";

import {
  dayPhrase,
  describeFollowUp,
  followUpState,
  formatDateTime,
  groupLeads,
  parseLocalDateTime,
  timeAgo,
  toDateInputValue,
} from "./time";
import type { Lead } from "./types";

// Wednesday 6 May 2026, 12:00 in Asia/Kolkata (the test timezone, see vitest.global-setup.ts).
const NOW = Date.parse("2026-05-06T12:00:00+05:30");

beforeAll(() => {
  expect(new Date(NOW).getTimezoneOffset()).toBe(-330);
});

function lead(id: number, followUpAt: string | null): Lead {
  return {
    id,
    name: `Lead ${id}`,
    company: null,
    phone: null,
    status: "new",
    follow_up_at: followUpAt,
    last_note: null,
    last_note_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };
}

describe("timeAgo", () => {
  it.each([
    ["2026-05-06T11:59:30+05:30", "just now"],
    ["2026-05-06T11:55:00+05:30", "5 minutes ago"],
    ["2026-05-06T10:00:00+05:30", "2 hours ago"],
    ["2026-05-04T12:00:00+05:30", "2 days ago"],
    ["2026-04-29T12:00:00+05:30", "1 week ago"],
    ["2026-04-15T12:00:00+05:30", "3 weeks ago"],
    ["2026-02-01T12:00:00+05:30", "3 months ago"],
    ["2025-03-01T12:00:00+05:30", "1 year ago"],
    ["2026-05-06T15:00:00+05:30", "in 3 hours"],
  ])("%s is %s", (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });
});

describe("formatDateTime", () => {
  it("shows month, day and time in the local timezone", () => {
    expect(formatDateTime("2026-05-04T05:00:00Z", NOW)).toBe("May 4, 10:30 AM");
  });

  it("adds the year for other years", () => {
    expect(formatDateTime("2025-12-31T09:00:00+05:30", NOW)).toBe("Dec 31, 2025, 9:00 AM");
  });
});

describe("dayPhrase", () => {
  it.each([
    ["2026-05-06T00:10:00+05:30", "today"], // still 5 May in UTC
    ["2026-05-06T23:59:00+05:30", "today"],
    ["2026-05-07T09:00:00+05:30", "tomorrow"],
    ["2026-05-05T09:00:00+05:30", "yesterday"],
    ["2026-05-10T09:00:00+05:30", "May 10"],
  ])("%s is %s", (iso, expected) => {
    expect(dayPhrase(iso, NOW)).toBe(expected);
  });
});

describe("follow-ups", () => {
  it.each([
    ["2026-05-06T11:00:00+05:30", "overdue"],
    ["2026-05-06T12:00:00+05:30", "overdue"],
    ["2026-05-06T18:00:00+05:30", "today"],
    ["2026-05-06T23:59:59+05:30", "today"],
    ["2026-05-07T00:00:00+05:30", "upcoming"],
  ] as const)("%s is %s", (iso, expected) => {
    expect(followUpState(iso, NOW)).toBe(expected);
  });

  it("describes when a follow-up is due", () => {
    expect(describeFollowUp("2026-05-06T14:00:00+05:30", NOW)).toBe("Follow-up today at 2:00 PM");
    expect(describeFollowUp("2026-05-05T09:00:00+05:30", NOW)).toBe(
      "Overdue · yesterday at 9:00 AM",
    );
    expect(describeFollowUp("2026-05-10T10:00:00+05:30", NOW)).toBe("Follow-up May 10 at 10:00 AM");
  });
});

describe("groupLeads", () => {
  it("pins overdue and today's follow-ups, sorted by time, and keeps API order for the rest", () => {
    const leads = [
      lead(1, null),
      lead(2, "2026-05-05T09:00:00+05:30"), // yesterday
      lead(3, "2026-05-06T18:00:00+05:30"), // later today
      lead(4, "2026-05-07T10:00:00+05:30"), // tomorrow
      lead(5, "2026-05-06T09:00:00+05:30"), // earlier today
      lead(6, "2026-05-03T09:00:00+05:30"), // three days ago
      lead(7, "2026-05-06T00:00:00+05:30"), // local midnight counts as today
    ];

    const { overdue, today, others } = groupLeads(leads, NOW);

    expect(overdue.map((l) => l.id)).toEqual([6, 2]);
    expect(today.map((l) => l.id)).toEqual([7, 5, 3]);
    expect(others.map((l) => l.id)).toEqual([1, 4]);
  });

  it("returns empty groups for no leads", () => {
    expect(groupLeads([], NOW)).toEqual({ overdue: [], today: [], others: [] });
  });
});

describe("date inputs", () => {
  it("formats local dates for <input type=date>", () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("combines date and time inputs as local time", () => {
    expect(parseLocalDateTime("2026-05-06", "14:30")?.toISOString()).toBe(
      "2026-05-06T09:00:00.000Z",
    );
  });

  it.each([
    ["", "10:00"],
    ["2026-05-06", ""],
    ["06/05/2026", "10:00"],
    ["2026-05-06", "2pm"],
  ])("rejects %j %j", (date, time) => {
    expect(parseLocalDateTime(date, time)).toBeNull();
  });
});
