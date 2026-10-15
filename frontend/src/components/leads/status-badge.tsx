import { cn } from "@/lib/cn";
import { STATUS_LABELS, type LeadStatus } from "@/lib/types";

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  contacted: "bg-amber-50 text-amber-800 ring-amber-600/25",
  qualified: "bg-sky-50 text-sky-700 ring-sky-600/20",
  proposal_sent: "bg-violet-50 text-violet-700 ring-violet-600/20",
  won: "bg-slate-100 text-slate-700 ring-slate-500/20",
  lost: "bg-rose-50 text-rose-700 ring-rose-600/15",
};

export function isClosed(status: LeadStatus): boolean {
  return status === "won" || status === "lost";
}

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
