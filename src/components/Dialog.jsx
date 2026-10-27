import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons.jsx";

export const buttonClasses = {
  primary:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl btn-brand px-5 py-2.5 text-sm font-bold shadow-md shadow-blue-500/20 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:shadow-none dark:focus-visible:ring-blue-500/30",
  secondary:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-slate-600/50",
  danger:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/20 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none dark:focus-visible:ring-red-500/30",
  warning:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none dark:focus-visible:ring-amber-500/30",
};

const ICON_TONES = {
  brand: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/10",
  orange: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/10",
  warning: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/10",
  danger: "bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/10",
  success: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/10",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
  );
}

// Modal dialog: Escape and the backdrop close it (unless busy), focus stays
// inside while open and goes back to where it was afterwards.
export default function Dialog({
  title,
  subtitle,
  icon: Icon,
  tone = "brand",
  size = "md",
  busy = false,
  onClose,
  footer,
  footerHint,
  children,
}) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  // Captured on the first render, before any autoFocus field takes the focus.
  const restoreFocusRef = useRef(typeof document === "undefined" ? null : document.activeElement);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = busy ? null : onClose;

  useEffect(() => {
    const previouslyFocused = restoreFocusRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    if (!panel?.contains(document.activeElement)) {
      const initial =
        panel?.querySelector("[data-autofocus]") || bodyRef.current?.querySelector(FOCUSABLE) || panel;
      initial?.focus({ preventScroll: true });
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-[2px] animate-kpi-fade sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative my-auto flex max-h-[calc(100dvh-2rem)] w-full ${size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-2xl" : "max-w-lg"} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/25 outline-none animate-kpi-dialog sm:max-h-[calc(100dvh-3rem)] dark:bg-slate-900 dark:shadow-black/50 dark:ring-1 dark:ring-slate-800`}
      >
        <div className="flex shrink-0 items-start gap-4 px-6 pb-4 pt-6 sm:px-7">
          {Icon ? (
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4 ${ICON_TONES[tone] || ICON_TONES.brand}`}>
              <Icon size={20} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-lg font-bold leading-6 text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current?.()}
            disabled={busy}
            className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 dark:focus-visible:ring-slate-700"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {children ? (
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1 sm:px-7">
            {children}
          </div>
        ) : (
          <div className="pb-2" />
        )}

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">{footerHint}</div>
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

// Confirmation of a sensitive action; the confirm button shows progress while
// onConfirm (async) runs.
export function ConfirmDialog({ tone = "danger", icon, title, description, details, confirmLabel, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      subtitle={description}
      icon={icon}
      tone={tone}
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonClasses.secondary} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClasses[tone === "brand" ? "primary" : tone] || buttonClasses.danger}
            onClick={confirm}
            disabled={busy}
            data-autofocus
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {details ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm leading-5 ${
            tone === "danger"
              ? "border-red-100 bg-red-50/70 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
              : tone === "warning"
                ? "border-amber-100 bg-amber-50/70 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                : "border-blue-100 bg-blue-50/60 text-slate-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-200"
          }`}
        >
          {details}
        </div>
      ) : null}
    </Dialog>
  );
}
