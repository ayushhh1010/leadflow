"use client";

import { CalendarClock, Check, Phone } from "lucide-react";
import { useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks";
import { useLead, useUpdateLead } from "@/lib/queries";
import { describeFollowUp, followUpState, formatDateTime, timeAgo } from "@/lib/time";
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  type Discussion,
  type Lead,
  type LeadStatus,
} from "@/lib/types";

import { FOLLOW_UP_ICONS } from "./follow-up-badge";
import { NoteForm } from "./note-form";

interface LeadDialogProps {
  leadId: number;
  /** The list row, shown while the full timeline loads. */
  initialLead?: Lead;
  onClose: () => void;
}

export function LeadDialog({ leadId, initialLead, onClose }: LeadDialogProps) {
  const leadQuery = useLead(leadId);
  const lead = leadQuery.data ?? initialLead;
  const now = useNow();
  const titleId = useId();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      initialFocus={noteRef}
      className="sm:max-w-2xl"
    >
      {/* On phones the status select drops to its own full-width row. */}
      <header className="flex shrink-0 flex-wrap items-start gap-3 border-b border-slate-200 px-5 py-4 sm:flex-nowrap sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl leading-7 font-bold break-words text-slate-900">
            {lead?.name ?? (leadQuery.isError ? "Lead unavailable" : "Loading lead…")}{" "}
            {lead?.company && (
              <span className="inline-block max-w-full truncate align-bottom font-normal text-slate-500">
                ({lead.company})
              </span>
            )}
          </h2>
          {lead?.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="mt-1 inline-flex items-center gap-1.5 rounded text-sm text-slate-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Phone aria-hidden className="size-3.5" />
              {lead.phone}
            </a>
          )}
        </div>
        {lead && <StatusSelect lead={lead} />}
        <DialogCloseButton className="mt-0.5" />
      </header>

      {lead?.follow_up_at && <FollowUpBanner lead={lead} at={lead.follow_up_at} now={now} />}

      {/* Focusable so keyboard users can scroll a long history. */}
      <div
        ref={timelineRef}
        role="region"
        aria-label="Timeline"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:px-6"
      >
        {leadQuery.data ? (
          <Timeline discussions={leadQuery.data.discussions} now={now} />
        ) : leadQuery.isError ? (
          <ErrorState
            message={errorMessage(leadQuery.error)}
            onRetry={() => void leadQuery.refetch()}
          />
        ) : (
          <TimelineSkeleton />
        )}
      </div>

      <NoteForm
        leadId={leadId}
        textareaRef={noteRef}
        onSaved={() => timelineRef.current?.scrollTo({ top: 0 })}
      />
    </Dialog>
  );
}

function StatusSelect({ lead }: { lead: Lead }) {
  const id = useId();
  const update = useUpdateLead(lead.id);
  // Show the chosen value straight away; it reverts if the request fails.
  const value = (update.isPending && update.variables.status) || lead.status;

  return (
    <div className="order-last flex basis-full flex-col gap-1 sm:order-none sm:basis-auto sm:items-end">
      <label htmlFor={id} className="sr-only">
        Status
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => update.mutate({ status: event.target.value as LeadStatus })}
        aria-describedby={update.isError ? `${id}-error` : undefined}
        className={cn(inputClass, "h-9 cursor-pointer py-1 pr-8 font-medium sm:w-auto")}
      >
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      {update.isError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-red-600 sm:max-w-48 sm:text-right"
        >
          {errorMessage(update.error)}
        </p>
      )}
    </div>
  );
}

const BANNER_TONES = {
  overdue: "border-red-200 bg-red-50 text-red-800",
  today: "border-blue-100 bg-blue-50 text-blue-800",
  upcoming: "border-slate-200 bg-white text-slate-700",
};

function FollowUpBanner({ lead, at, now }: { lead: Lead; at: string; now: number }) {
  const update = useUpdateLead(lead.id);
  const state = followUpState(at, now);
  const Icon = FOLLOW_UP_ICONS[state];

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2.5 sm:px-6",
        BANNER_TONES[state],
      )}
    >
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
        <Icon aria-hidden className="size-4 shrink-0" />
        <time dateTime={at}>{describeFollowUp(at, now)}</time>
      </p>
      {update.isError && (
        <p role="alert" className="text-xs text-red-700">
          {errorMessage(update.error)}
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        loading={update.isPending}
        onClick={() => update.mutate({ follow_up_at: null })}
      >
        {!update.isPending && <Check aria-hidden />}
        Mark done
      </Button>
    </div>
  );
}

function Timeline({ discussions, now }: { discussions: Discussion[]; now: number }) {
  const latestNote = discussions.find((discussion) => discussion.kind === "note");

  return (
    <>
      {!latestNote && (
        <p className="mb-5 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
          No discussions yet. Log your first conversation below.
        </p>
      )}
      <ol
        aria-label="Discussion history, newest first"
        className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-slate-200"
      >
        {discussions.map((discussion) =>
          discussion.kind === "note" ? (
            <NoteEntry
              key={discussion.id}
              discussion={discussion}
              latest={discussion === latestNote}
              now={now}
            />
          ) : (
            <EventEntry key={discussion.id} discussion={discussion} now={now} />
          ),
        )}
      </ol>
    </>
  );
}

function NoteEntry({
  discussion,
  latest,
  now,
}: {
  discussion: Discussion;
  latest: boolean;
  now: number;
}) {
  return (
    <li className="relative pl-8">
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0 size-[15px] rounded-full border-[3px] border-slate-50",
          latest ? "bg-blue-500 ring-1 ring-blue-500" : "bg-slate-300",
        )}
      />
      <p className="text-xs text-slate-500">
        <time dateTime={discussion.created_at} className="font-medium text-slate-700">
          {formatDateTime(discussion.created_at, now)}
        </time>{" "}
        ({timeAgo(discussion.created_at, now)})
      </p>
      <div className="mt-1.5 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <p className="text-sm leading-6 break-words whitespace-pre-wrap text-slate-800">
          {discussion.body}
        </p>
        {discussion.follow_up_at && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
            <CalendarClock aria-hidden className="size-3.5" />
            <span>
              Follow-up set for{" "}
              <time dateTime={discussion.follow_up_at}>
                {formatDateTime(discussion.follow_up_at, now)}
              </time>
            </span>
          </p>
        )}
      </div>
    </li>
  );
}

function EventEntry({ discussion, now }: { discussion: Discussion; now: number }) {
  return (
    <li className="relative pl-8">
      <span
        aria-hidden
        className="absolute top-[5px] left-1 size-[7px] rounded-full bg-slate-400 ring-4 ring-slate-50"
      />
      <p className="text-xs text-slate-500">
        <span className="text-slate-600 italic">{discussion.body}</span>
        <span aria-hidden> · </span>
        <time dateTime={discussion.created_at}>{formatDateTime(discussion.created_at, now)}</time>
      </p>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Loading discussions…</span>
      {[0, 1, 2].map((key) => (
        <div key={key} className="pl-8">
          <div className="h-3 w-40 rounded bg-slate-200 motion-safe:animate-pulse" />
          <div className="mt-2 h-14 rounded-lg bg-slate-200/60 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
