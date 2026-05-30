"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  // Require typing this exact value to enable the confirm button.
  // Useful for irreversible deletes.
  requireTextMatch?: string;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

let openDialog: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (!openDialog) {
    // Fall back to native confirm if the host hasn't mounted yet.
    return Promise.resolve(window.confirm(`${opts.title}${opts.description ? `\n\n${opts.description}` : ""}`));
  }
  return openDialog(opts);
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(
    (result: boolean) => {
      setState((prev) => {
        prev?.resolve(result);
        return null;
      });
      setTyped("");
    },
    []
  );

  useEffect(() => {
    openDialog = (opts) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      });
    return () => {
      openDialog = null;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      } else if (event.key === "Enter" && !state.requireTextMatch) {
        event.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  if (!state) return null;

  const matched = !state.requireTextMatch || typed === state.requireTextMatch;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => close(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{state.title}</h3>
        {state.description ? <div className="modal-body">{state.description}</div> : null}
        {state.requireTextMatch ? (
          <label className="modal-input">
            Type <span className="kbd">{state.requireTextMatch}</span> to confirm
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matched) {
                  e.preventDefault();
                  close(true);
                }
              }}
            />
          </label>
        ) : null}
        <div className="modal-actions">
          <button className="button ghost" type="button" onClick={() => close(false)}>
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            className={`button ${state.variant === "danger" ? "danger" : ""}`}
            type="button"
            disabled={!matched}
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
