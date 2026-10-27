// Small shared presentation primitives for the Responsible dashboard page.
// Same visual language as the other migrated pages (Tailwind utility classes).

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none dark:focus:border-blue-500 dark:focus:ring-blue-500/20 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500";

export const readonlyInputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 shadow-sm outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:shadow-none";

export function Field({ label, hint, required, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          {label}
          {required ? <span className="text-red-500 dark:text-red-400"> *</span> : null}
        </span>
        {hint ? <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
      {icon ? <span className="text-sm not-italic">{icon}</span> : null}
      {children}
    </div>
  );
}

// A titled, tinted card grouping a set of related fields -- used to break long
// forms (KPI editor, target allocation) into visually distinct steps instead
// of one continuous column of fields.
export function SectionPanel({ icon, title, compact = false, children }) {
  return (
    <section className={`rounded-2xl border border-slate-100 bg-slate-50/60 ${compact ? "p-3 sm:p-4" : "p-4 sm:p-5"} dark:border-slate-800 dark:bg-slate-800/30`}>
      <div className={`${compact ? "mb-2" : "mb-4"} flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400`}>
        {icon ? <span className="text-sm not-italic">{icon}</span> : null}
        {title}
      </div>
      <div className={`flex flex-col ${compact ? "gap-3" : "gap-4"}`}>{children}</div>
    </section>
  );
}

export function Modal({ title, subtitle, onClose, footer, wide, compact = false, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className={`flex w-full ${wide ? "max-w-6xl" : "max-w-3xl"} flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl leading-none text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={`flex flex-col ${compact ? "gap-3 px-4 py-4 sm:px-5 [&_label]:min-w-0 [&_label]:gap-1 [&_label>span:first-child]:flex-wrap [&_label>span:first-child]:gap-x-2 [&_label>span:first-child]:gap-y-0" : "gap-5 px-6 py-6"}`}>{children}</div>

        {footer ? (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, description, warning, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">{warning}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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

const STAT_TILE_TONES = {
  slate:
    "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100",
  muted:
    "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-500",
  navy:
    "border-blue-200 bg-blue-100/70 text-blue-900 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
  blue:
    "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  orange:
    "border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  green:
    "border-green-100 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  red: "border-red-100 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

export function StatTile({ label, value, tone = "slate" }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${STAT_TILE_TONES[tone] || STAT_TILE_TONES.slate}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

export function StatusPill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
    red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
    navy: "bg-blue-100 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
    sky: "bg-white text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-transparent dark:text-blue-300 dark:ring-blue-500/30",
    brand: "bg-blue-600 text-white",
  };
  if (!children) return <span className="text-slate-300 dark:text-slate-600">-</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

// Common free-text values worth color-coding; anything else falls back to a
// neutral slate pill rather than guessing a color for it.
export function toneForStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["active", "approved", "on track", "published"].includes(value)) return "green";
  if (["draft", "pending", "waiting for validation", "to validate"].includes(value)) return "amber";
  if (["inactive", "rejected", "closed", "archived"].includes(value)) return "red";
  return "slate";
}

// Allocation scope type (Multisite / Individual / Zone / Product Line / Role)
// -- an identity/category, not a good/bad state, so it gets a distinguishing
// tone rather than a status color.
export function toneForAllocationType(type) {
  const value = String(type || "").trim().toLowerCase();
  if (value === "multisite") return "orange";
  if (value === "individual") return "blue";
  if (value === "zone") return "amber";
  if (value === "role") return "green";
  return "slate";
}

export function toneForDirection(direction) {
  const value = String(direction || "").trim().toLowerCase();
  if (value === "up") return "blue";
  if (value === "down") return "orange";
  return "slate";
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500">
      {children}
    </div>
  );
}

export function IconButton({ title, onClick, tone = "slate", children, disabled }) {
  const tones = {
    slate: "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700",
    blue: "border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10",
    red: "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10",
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

export const DuplicateIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

export function GroupToggle({ expanded }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold text-slate-400 shadow-sm transition-transform duration-200 dark:bg-slate-700 dark:text-slate-300 ${
        expanded ? "rotate-90" : ""
      }`}
    >
      ▸
    </span>
  );
}

export const ViewIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
