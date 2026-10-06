"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: focus moves into it when it opens (an autoFocus element,
// else the first form field), Tab stays inside it, Escape closes it, focus returns to
// whatever opened it, and the page behind doesn't scroll.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  // onClose often changes identity every render; read the latest without
  // re-running the effect (which would steal focus back on every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    // Where focus goes back to on close. If a child's autoFocus already moved
    // focus inside, we can't know the opener here - the caller restores it
    // (ConfirmDialog does).
    const active = document.activeElement as HTMLElement | null;
    const previouslyFocused = active && !node.contains(active) ? active : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    // A child using autoFocus has already taken focus (React does that before
    // effects run) - keep it. Otherwise start at the first form field, so the
    // close button isn't what a keyboard user lands on.
    if (!node.contains(document.activeElement)) {
      (node.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ?? node).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      // With a dialog opened on top of another (e.g. a confirm over a form),
      // only the one holding focus reacts - Escape closes just that one. If
      // focus is in no dialog at all, the topmost one handles it.
      const focusInDialog = document.activeElement?.closest("[role=dialog]");
      const dialogs = document.querySelectorAll("[role=dialog]");
      const isTopmost = dialogs[dialogs.length - 1] === node;
      if (focusInDialog ? focusInDialog !== node : !isTopmost) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card rounded-3xl shadow-2xl p-5 sm:p-7 outline-none"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-foreground/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
