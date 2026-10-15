"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/cn";

const CloseDialogContext = createContext<() => void>(() => {});

/** Closes the surrounding dialog the native way, so focus returns to whatever opened it. */
export const useCloseDialog = () => useContext(CloseDialogContext);

interface DialogProps {
  open: boolean;
  /** Fired after the dialog closed (Escape, backdrop click, close button or `useCloseDialog`). */
  onClose: () => void;
  /** id of the element that names the dialog. */
  labelledBy: string;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * Modal built on the native <dialog>: the browser handles the focus trap, Escape,
 * inert background and focus restore. Content is only mounted while open.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  initialFocus,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const close = useCallback(() => ref.current?.close(), []);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // A click whose press started inside the panel (e.g. selecting text) must not close it.
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) close();
      }}
      className={cn(
        "m-auto w-full flex-col overflow-hidden bg-white text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-[2px] open:flex motion-safe:open:animate-dialog-in",
        "max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full",
        "sm:max-h-[min(88dvh,52rem)] sm:w-[calc(100%-2rem)] sm:rounded-xl",
        className,
      )}
    >
      <CloseDialogContext value={close}>{open && children}</CloseDialogContext>
    </dialog>
  );
}

export function DialogCloseButton({ className }: { className?: string }) {
  const close = useCloseDialog();
  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close"
      className={cn(
        "-m-1.5 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600",
        className,
      )}
    >
      <X aria-hidden className="size-5" />
    </button>
  );
}
