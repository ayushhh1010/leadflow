"use client";

import { useEffect, useId, useState, type FormEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAddDiscussion } from "@/lib/queries";
import { addDays, parseLocalDateTime, startOfDay, toDateInputValue } from "@/lib/time";
import { LIMITS } from "@/lib/validation";

interface Draft {
  body: string;
  withFollowUp: boolean;
  date: string;
  time: string;
}

const EMPTY_DRAFT: Draft = { body: "", withFollowUp: false, date: "", time: "" };

// Unsaved notes survive closing the dialog, per lead, until the page reloads.
const drafts = new Map<number, Draft>();

interface NoteFormProps {
  leadId: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSaved: () => void;
}

export function NoteForm({ leadId, textareaRef, onSaved }: NoteFormProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => drafts.get(leadId) ?? EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const addDiscussion = useAddDiscussion(leadId, () => drafts.delete(leadId));

  useEffect(() => {
    if (draft === EMPTY_DRAFT) drafts.delete(leadId);
    else drafts.set(leadId, draft);
  }, [leadId, draft]);

  function change(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function toggleFollowUp(checked: boolean) {
    if (checked && !draft.date) {
      const tomorrow = toDateInputValue(addDays(startOfDay(Date.now()), 1));
      change({ withFollowUp: true, date: tomorrow, time: draft.time || "10:00" });
    } else {
      change({ withFollowUp: checked });
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addDiscussion.isPending) return;

    const body = draft.body.trim();
    if (!body) {
      setError("Write a note before saving.");
      textareaRef.current?.focus();
      return;
    }

    let followUpAt: string | undefined;
    if (draft.withFollowUp) {
      const when = parseLocalDateTime(draft.date, draft.time);
      if (!when) return setError("Choose a follow-up date and time.");
      if (when.getTime() <= Date.now()) return setError("Choose a follow-up time in the future.");
      followUpAt = when.toISOString();
    }

    addDiscussion.mutate(
      { body, follow_up_at: followUpAt },
      {
        onSuccess: () => {
          setDraft(EMPTY_DRAFT);
          onSaved();
          textareaRef.current?.focus();
        },
      },
    );
  }

  const message = error ?? (addDiscussion.isError ? errorMessage(addDiscussion.error) : null);
  const errorId = `${id}-error`;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"
    >
      <label htmlFor={`${id}-note`} className="sr-only">
        New discussion note
      </label>
      <textarea
        id={`${id}-note`}
        ref={textareaRef}
        rows={3}
        maxLength={LIMITS.note}
        value={draft.body}
        readOnly={addDiscussion.isPending}
        onChange={(event) => change({ body: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Log a new discussion…"
        aria-invalid={error && !draft.body.trim() ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        className={cn(inputClass, "min-h-20 resize-y")}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={draft.withFollowUp}
            onChange={(event) => toggleFollowUp(event.target.checked)}
            className="size-4 cursor-pointer accent-blue-600"
          />
          Set follow-up
        </label>
        <div className="flex gap-2 max-sm:w-full">
          <input
            type="date"
            aria-label="Follow-up date"
            min={toDateInputValue(new Date())}
            value={draft.date}
            disabled={!draft.withFollowUp}
            onChange={(event) => change({ date: event.target.value })}
            className={cn(inputClass, "h-9 w-auto py-1 max-sm:flex-1")}
          />
          <input
            type="time"
            aria-label="Follow-up time"
            value={draft.time}
            disabled={!draft.withFollowUp}
            onChange={(event) => change({ time: event.target.value })}
            className={cn(inputClass, "h-9 w-auto py-1 max-sm:flex-1")}
          />
        </div>
        <span className="ml-auto hidden text-xs text-slate-500 md:inline">
          Ctrl + Enter to save
        </span>
        <Button
          type="submit"
          variant="dark"
          loading={addDiscussion.isPending}
          className="max-sm:w-full max-md:ml-auto"
        >
          Save note
        </Button>
      </div>

      {message && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
          {message}
        </p>
      )}
    </form>
  );
}
