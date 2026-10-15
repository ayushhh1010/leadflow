import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-blue-600 text-white shadow-xs hover:bg-blue-700 focus-visible:outline-blue-600",
  dark: "bg-slate-900 text-white shadow-xs hover:bg-slate-700 focus-visible:outline-slate-900",
  secondary:
    "bg-white text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-blue-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-blue-600",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  icon: "size-9",
} as const;

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Shows a spinner and blocks clicks (prevents double submits). */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
      {children}
    </button>
  );
}
