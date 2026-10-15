import { cn } from "@/lib/cn";
import { followUpState, timeAgo } from "@/lib/time";
import type { Lead } from "@/lib/types";

import { FollowUpBadge } from "./follow-up-badge";
import { isClosed, StatusBadge } from "./status-badge";

export const leadCardId = (id: number) => `lead-${id}`;

const CARD_TONES = {
  overdue: "border-red-200 bg-red-50/50 hover:border-red-300",
  today: "border-blue-200 bg-blue-50/60 hover:border-blue-300",
  upcoming: "border-slate-200 bg-white hover:border-slate-300",
};

export function LeadCard({
  lead,
  now,
  onOpen,
}: {
  lead: Lead;
  now: number;
  onOpen: (id: number) => void;
}) {
  const closed = isClosed(lead.status);
  const tone = lead.follow_up_at ? followUpState(lead.follow_up_at, now) : "upcoming";

  return (
    <article
      className={cn(
        "relative rounded-lg border px-4 py-3.5 shadow-xs transition hover:shadow-md has-focus-visible:ring-2 has-focus-visible:ring-blue-600 sm:px-5",
        closed && tone === "upcoming" ? "border-slate-200 bg-slate-50/80" : CARD_TONES[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base leading-6">
          {/* The button's ::after stretches over the whole card, so the card is one click target. */}
          <button
            id={leadCardId(lead.id)}
            type="button"
            aria-haspopup="dialog"
            onClick={() => onOpen(lead.id)}
            className={cn(
              "cursor-pointer text-left font-semibold after:absolute after:inset-0 after:rounded-lg focus:outline-none",
              closed ? "text-slate-600" : "text-slate-900",
            )}
          >
            {lead.name}
          </button>{" "}
          {lead.company && (
            <span className="inline-block max-w-full truncate align-bottom text-sm font-normal text-slate-600">
              ({lead.company})
            </span>
          )}
        </h3>
        <StatusBadge status={lead.status} />
      </div>

      <p className="mt-1 flex min-w-0 items-baseline gap-2 text-sm">
        <span className="min-w-0 truncate text-slate-600">
          <span className="font-semibold text-slate-700">Last note:</span>{" "}
          {lead.last_note ?? <span className="italic">No discussions yet</span>}
        </span>
        <span className="shrink-0 text-xs text-slate-600">
          {lead.last_note_at
            ? timeAgo(lead.last_note_at, now)
            : `Added ${timeAgo(lead.created_at, now)}`}
        </span>
      </p>

      {lead.follow_up_at && <FollowUpBadge at={lead.follow_up_at} now={now} className="mt-2.5" />}
    </article>
  );
}
