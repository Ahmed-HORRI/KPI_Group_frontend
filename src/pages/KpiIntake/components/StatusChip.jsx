import { STATUS_META } from "../intakeUtils.js";

const TONES = {
  slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700",
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/25",
  red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/25",
  amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/25",
  blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/25",
};

const DOTS = {
  slate: "bg-slate-400",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

export default function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${TONES[meta.tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[meta.tone]}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
