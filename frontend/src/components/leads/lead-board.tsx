"use client";

import { Inbox, Pin, Plus, SearchX, TrendingUp, TriangleAlert } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useDebouncedValue, useNow } from "@/lib/hooks";
import { useLeads } from "@/lib/queries";
import { groupLeads } from "@/lib/time";
import type { Lead } from "@/lib/types";

import { AddLeadDialog } from "./add-lead-dialog";
import { LeadCard, leadCardId } from "./lead-card";
import { LeadDialog } from "./lead-dialog";
import { LeadFilters, type StatusFilter } from "./lead-filters";

export function LeadBoard() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const now = useNow();

  const q = useDebouncedValue(search.trim(), 250);
  const leadsQuery = useLeads({ status: status === "all" ? undefined : status, q: q || undefined });
  const leads = leadsQuery.data;
  const filtering = status !== "all" || q !== "";

  function clearFilters() {
    setStatus("all");
    setSearch("");
  }

  function renderLeads() {
    if (!leads) {
      return leadsQuery.isError ? (
        <ErrorState
          message={errorMessage(leadsQuery.error)}
          onRetry={() => void leadsQuery.refetch()}
        />
      ) : (
        <ListSkeleton />
      );
    }

    if (leads.length === 0) {
      return filtering ? (
        <EmptyState
          icon={<SearchX />}
          title="No leads match your filters"
          description="Try another status or search term."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Inbox />}
          title="No leads yet"
          description="Add your first lead to start tracking conversations and follow-ups."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Add new lead
            </Button>
          }
        />
      );
    }

    const { overdue, today, others } = groupLeads(leads, now);
    const cards = (items: Lead[]) =>
      items.map((lead) => (
        <li key={lead.id}>
          <LeadCard lead={lead} now={now} onOpen={setOpenLeadId} />
        </li>
      ));

    return (
      <div
        className={cn("space-y-8 transition-opacity", leadsQuery.isPlaceholderData && "opacity-60")}
      >
        {overdue.length > 0 && (
          <LeadSection
            title="Overdue follow-ups"
            icon={<TriangleAlert />}
            count={overdue.length}
            danger
          >
            {cards(overdue)}
          </LeadSection>
        )}
        {(today.length > 0 || !filtering) && (
          <LeadSection
            title="Today's follow-ups"
            icon={<Pin className="text-blue-600" />}
            count={today.length}
            empty={
              overdue.length > 0
                ? "Nothing else is due today."
                : "Nothing due today. You're all caught up."
            }
          >
            {cards(today)}
          </LeadSection>
        )}
        {others.length > 0 && (
          <LeadSection title={filtering ? "Matching leads" : "All leads"} count={others.length}>
            {cards(others)}
          </LeadSection>
        )}
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-blue-600">
            <TrendingUp aria-hidden className="size-6" strokeWidth={2.5} />
            LeadFlow
          </h1>
          <Button aria-haspopup="dialog" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add new lead
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <LeadFilters
          status={status}
          onStatusChange={setStatus}
          search={search}
          onSearchChange={setSearch}
        />
        <p aria-live="polite" className="sr-only">
          {leads && `${leads.length} ${leads.length === 1 ? "lead" : "leads"} shown`}
        </p>
        {renderLeads()}
      </main>

      {openLeadId !== null && (
        <LeadDialog
          leadId={openLeadId}
          initialLead={leads?.find((lead) => lead.id === openLeadId)}
          onClose={() => {
            // The dialog restores focus to the card that opened it, but that card remounts
            // when the lead moved to another section (e.g. a new follow-up for today).
            if (document.activeElement === document.body) {
              document.getElementById(leadCardId(openLeadId))?.focus();
            }
            setOpenLeadId(null);
          }}
        />
      )}
      <AddLeadDialog open={adding} onClose={() => setAdding(false)} onCreated={clearFilters} />
    </>
  );
}

function LeadSection({
  title,
  icon,
  count,
  danger = false,
  empty,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count: number;
  danger?: boolean;
  empty?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2
        id={headingId}
        className={cn(
          "flex items-center gap-2 text-xs font-semibold tracking-wider uppercase [&_svg]:size-3.5",
          danger ? "text-red-700" : "text-slate-500",
        )}
      >
        {icon}
        {title}
        <span className="rounded-full bg-slate-200/80 px-2 py-px text-[11px] tracking-normal text-slate-700">
          {count}
        </span>
      </h2>
      {count > 0 ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
          {empty}
        </p>
      )}
    </section>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Loading leads…</span>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="h-4 w-48 rounded bg-slate-200 motion-safe:animate-pulse" />
          <div className="mt-3 h-3 w-3/4 rounded bg-slate-100 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
