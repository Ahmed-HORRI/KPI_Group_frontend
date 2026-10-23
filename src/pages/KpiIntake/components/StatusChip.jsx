import { STATUS_META } from "../intakeUtils.js";

const TONES = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
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
