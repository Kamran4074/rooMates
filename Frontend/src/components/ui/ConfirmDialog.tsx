"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

// An in-app replacement for window.confirm(): styled like the rest of the app,
// readable on phones, and keyboard/screen-reader friendly (it's a Modal).
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this photo?", confirmLabel: "Delete", danger: true }))) return;

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button, for things that can't be undone. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  // The element that asked (e.g. a "Delete" button). The dialog's confirm
  // button takes focus with autoFocus, so the Modal can't see the opener -
  // we remember it here and hand focus back after closing.
  const opener = useRef<HTMLElement | null>(null);

  const confirm = useCallback<Confirm>((opts) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
    // After the dialog has unmounted. If the opener is gone (e.g. the item was
    // deleted), focus whatever dialog is still open, if any.
    const target = opener.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLElement>("[role=dialog]")?.focus();
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!options} onClose={() => close(false)} title={options?.title ?? ""}>
        {options?.message && <p className="text-sm text-foreground/70 -mt-2 mb-6">{options.message}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={options?.danger ? "danger" : "dark"} onClick={() => close(true)} autoFocus>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
