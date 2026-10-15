"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, useCloseDialog } from "@/components/ui/dialog";
import { Field, inputClass } from "@/components/ui/field";
import { ApiError, errorMessage } from "@/lib/api";
import { useCreateLead } from "@/lib/queries";
import type { LeadDetail, NewLead } from "@/lib/types";
import { LIMITS, validateLead, type LeadFormErrors } from "@/lib/validation";

interface AddLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: LeadDetail) => void;
}

export function AddLeadDialog({ open, onClose, onCreated }: AddLeadDialogProps) {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      initialFocus={nameRef}
      className="sm:max-w-md"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Add new lead
        </h2>
        <DialogCloseButton />
      </header>
      <AddLeadForm nameRef={nameRef} onCreated={onCreated} />
    </Dialog>
  );
}

type Values = Record<keyof NewLead, string>;

const FIELDS: (keyof NewLead)[] = ["name", "company", "phone"];

function AddLeadForm({
  nameRef,
  onCreated,
}: {
  nameRef: RefObject<HTMLInputElement | null>;
  onCreated: (lead: LeadDetail) => void;
}) {
  const id = useId();
  const close = useCloseDialog();
  const createLead = useCreateLead();
  const [values, setValues] = useState<Values>({ name: "", company: "", phone: "" });
  const [errors, setErrors] = useState<LeadFormErrors>({});

  const fieldId = (field: keyof NewLead) => `${id}-${field}`;

  function update(field: keyof NewLead) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function showErrors(found: LeadFormErrors) {
    setErrors(found);
    const first = FIELDS.find((field) => found[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createLead.isPending) return;

    const input: NewLead = {
      name: values.name.trim(),
      company: values.company.trim() || null,
      phone: values.phone.trim() || null,
    };
    const found = validateLead(input);
    if (Object.keys(found).length > 0) return showErrors(found);

    createLead.mutate(input, {
      onSuccess: (lead) => {
        onCreated(lead);
        close();
      },
      onError: (error) => {
        if (error instanceof ApiError) showErrors(error.fieldErrors);
      },
    });
  }

  const formError =
    createLead.isError && !FIELDS.some((field) => errors[field])
      ? errorMessage(createLead.error)
      : null;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        <Field id={fieldId("name")} label="Full name" required error={errors.name}>
          {(control) => (
            <input
              {...control}
              ref={nameRef}
              required
              autoComplete="off"
              maxLength={LIMITS.name}
              value={values.name}
              onChange={update("name")}
              placeholder="e.g. John Doe"
              className={inputClass}
            />
          )}
        </Field>
        <Field id={fieldId("company")} label="Company" hint="(Optional)" error={errors.company}>
          {(control) => (
            <input
              {...control}
              autoComplete="off"
              maxLength={LIMITS.company}
              value={values.company}
              onChange={update("company")}
              placeholder="e.g. Stark Industries"
              className={inputClass}
            />
          )}
        </Field>
        <Field id={fieldId("phone")} label="Phone" hint="(Optional)" error={errors.phone}>
          {(control) => (
            <input
              {...control}
              type="tel"
              autoComplete="off"
              maxLength={LIMITS.phone}
              value={values.phone}
              onChange={update("phone")}
              placeholder="e.g. 555-0123"
              className={inputClass}
            />
          )}
        </Field>
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
      </div>
      <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={createLead.isPending}>
          Save lead
        </Button>
      </footer>
    </form>
  );
}
