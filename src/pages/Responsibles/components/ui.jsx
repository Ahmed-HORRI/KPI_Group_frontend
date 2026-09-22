// Small shared presentation primitives for the Responsible dashboard page.
// Same visual language as the other migrated pages (Tailwind utility classes).

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

export const readonlyInputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 shadow-sm outline-none";

export function Field({ label, hint, required, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-slate-600">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        {hint ? <span className="text-xs font-normal text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function SectionTitle({ children }) {
  return (
    <div className="border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, footer, wide, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className={`flex w-full ${wide ? "max-w-6xl" : "max-w-3xl"} flex-col rounded-3xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl leading-none text-slate-500 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, description, warning, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <p className="mt-1 text-sm font-semibold text-red-600">{warning}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-red-700"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function IconButton({ title, onClick, tone = "slate", children, disabled }) {
  const tones = {
    slate: "border-slate-200 text-slate-600 hover:bg-slate-100",
    blue: "border-blue-200 text-blue-600 hover:bg-blue-50",
    red: "border-red-200 text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export const EditIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 20h4l10-10a2.12 2.12 0 1 0-4-4L4 16v4" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

export const ViewIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
