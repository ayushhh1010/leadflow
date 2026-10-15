import { Search } from "lucide-react";

import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from "@/lib/types";

export type StatusFilter = LeadStatus | "all";

const OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...LEAD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

interface LeadFiltersProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function LeadFilters({ status, onStatusChange, search, onSearchChange }: LeadFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Native radios: arrow keys move between options for free. */}
      <div
        role="radiogroup"
        aria-label="Filter by status"
        className="flex flex-wrap items-center gap-2"
      >
        <span
          aria-hidden
          className="mr-1 text-xs font-semibold tracking-wider text-slate-500 uppercase"
        >
          Filters:
        </span>
        {OPTIONS.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name="status-filter"
              value={option.value}
              checked={status === option.value}
              onChange={() => onStatusChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3.5 text-sm transition-colors",
                "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                "peer-checked:border-slate-800 peer-checked:bg-slate-800 peer-checked:text-white",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <div className="relative lg:w-72">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or company"
          aria-label="Search leads by name or company"
          maxLength={100}
          className={cn(inputClass, "h-9 pl-9")}
        />
      </div>
    </div>
  );
}
