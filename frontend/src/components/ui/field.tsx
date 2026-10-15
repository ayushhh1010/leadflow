import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/25 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/25";

interface FieldProps {
  id: string;
  label: string;
  /** Shown after the label, e.g. "(Optional)". */
  hint?: string;
  required?: boolean;
  error?: string;
  /** Receives the props the control needs to be wired to its label and error. */
  children: (control: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

export function Field({ id, label, hint, required, error, children }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span aria-hidden className="text-red-600">
            {" "}
            *
          </span>
        )}
        {hint && <span className="font-normal text-slate-500"> {hint}</span>}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
