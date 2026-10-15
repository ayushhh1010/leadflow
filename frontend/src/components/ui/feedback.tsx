import { RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <TriangleAlert aria-hidden className="size-6 text-red-600" />
      <p className="text-sm text-red-800">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-1 rounded-full bg-slate-100 p-3 text-slate-500 [&_svg]:size-6">{icon}</div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="max-w-sm text-sm text-slate-600">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
