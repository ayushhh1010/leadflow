import { BellRing, CalendarClock, CircleAlert } from "lucide-react";

import { cn } from "@/lib/cn";
import { describeFollowUp, followUpState, type FollowUpState } from "@/lib/time";

export const FOLLOW_UP_TONES: Record<FollowUpState, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-600/25",
  today: "bg-blue-50 text-blue-700 ring-blue-600/20",
  upcoming: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export const FOLLOW_UP_ICONS = {
  overdue: CircleAlert,
  today: BellRing,
  upcoming: CalendarClock,
} satisfies Record<FollowUpState, unknown>;

export function FollowUpBadge({
  at,
  now,
  className,
}: {
  at: string;
  now: number;
  className?: string;
}) {
  const state = followUpState(at, now);
  const Icon = FOLLOW_UP_ICONS[state];
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset",
        FOLLOW_UP_TONES[state],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <time dateTime={at}>{describeFollowUp(at, now)}</time>
    </p>
  );
}
