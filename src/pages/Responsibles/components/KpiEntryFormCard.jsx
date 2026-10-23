import KpiEntryFormChart from "./KpiEntryFormChart";
import KpiEntryFormCorrectiveActions from "./KpiEntryFormCorrectiveActions";
import KpiEntryFormHistory from "./KpiEntryFormHistory";
import { formatNumber, isCompleteCorrectiveAction, isOutOfTarget } from "../kpiEntryFormUtils";

// One KPI card of the entry form: value input + manager comment on the left,
// mini trend chart on the right, then the corrective-action editor and the
// history panels.
//
// The original's HIGH LIMIT / TARGET / LOW LIMIT tiles are shown here. They
// were generated in the original markup too, but its stylesheet set
// .kpi-mini-stats{display:none}, so nobody ever saw them -- the numbers are
// exactly what decides whether a corrective action is required, so hiding
// them was a bug rather than an intent.
export default function KpiEntryFormCard({
  kpi,
  value,
  comment,
  actions,
  touched,
  correctiveActionsEnabled,
  correctiveActionsRequired,
  defaultResponsible,
  periodHeading,
  onValueChange,
  onCommentChange,
  onActionsChange,
  onStatusChange,
  onOpenAssistant,
}) {
  const outOfTarget = isOutOfTarget(value, kpi.low_limit, kpi.high_limit, kpi.good_direction);
  const requiresCorrectiveAction = correctiveActionsRequired && outOfTarget;
  const hasValidAction = actions.some(isCompleteCorrectiveAction);
  const isEmpty = String(value ?? "").trim() === "";
  const blocked = requiresCorrectiveAction && !hasValidAction;

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        blocked ? "border-red-300" : "border-slate-200"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-slate-800">{kpi.title}</div>
          {kpi.subject && <div className="text-xs text-slate-400">{kpi.subject}</div>}
          {kpi.definition && (
            <div className="mt-1 max-w-2xl text-xs text-slate-400">{kpi.definition}</div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            isEmpty
              ? "bg-slate-100 text-slate-500"
              : outOfTarget
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600"
          }`}
        >
          {isEmpty ? "No value yet" : outOfTarget ? "Outside limits" : "On target"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          <KpiEntryFormChart kpi={kpi} typedValue={value} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Current Value
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={value ?? ""}
                onChange={(event) => onValueChange(event.target.value)}
                className={`w-full rounded-xl border bg-white/70 px-3 py-2.5 text-2xl font-black text-slate-900 outline-none focus:border-blue-400 ${
                  touched && isEmpty ? "border-red-300 bg-red-50/40" : "border-blue-100"
                }`}
              />
              {kpi.unit && (
                <span className="shrink-0 rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  {kpi.unit}
                </span>
              )}
            </div>
            {touched && isEmpty && (
              <div className="mt-1 text-xs font-semibold text-red-600">
                Current Value is required.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-blue-100 pt-3 text-xs font-semibold text-slate-500">
              <span>
                High <span className="text-slate-700">{formatNumber(kpi.high_limit)}</span>
              </span>
              <span>
                Target <span className="text-slate-700">{formatNumber(kpi.target)}</span>
              </span>
              <span>
                Low <span className="text-slate-700">{formatNumber(kpi.low_limit)}</span>
              </span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-slate-600">Manager Comment (Optional)</span>
            <textarea
              value={comment ?? ""}
              onChange={(event) => onCommentChange(event.target.value)}
              className="min-h-[72px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            />
          </label>

          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-2 self-start rounded-full btn-brand py-2 pl-2 pr-4 text-xs font-bold shadow-md shadow-blue-500/20 transition hover:-translate-y-0.5"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">
              🤖
            </span>
            AI Support
          </button>
        </div>
      </div>

      {correctiveActionsEnabled && (
        <KpiEntryFormCorrectiveActions
          actions={actions}
          defaultResponsible={defaultResponsible}
          required={requiresCorrectiveAction}
          onChange={onActionsChange}
        />
      )}

      <KpiEntryFormHistory
        kpi={kpi}
        periodHeading={periodHeading}
        correctiveActionsEnabled={correctiveActionsEnabled}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
