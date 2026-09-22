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
  defaultResponsible,
  periodHeading,
  onValueChange,
  onCommentChange,
  onActionsChange,
  onStatusChange,
  onOpenAssistant,
}) {
  const outOfTarget = isOutOfTarget(value, kpi.low_limit, kpi.high_limit, kpi.good_direction);
  const requiresCorrectiveAction = correctiveActionsEnabled && outOfTarget;
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
        <div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-slate-600">Current Value</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={value ?? ""}
                onChange={(event) => onValueChange(event.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-blue-400 ${
                  touched && isEmpty ? "border-red-300 bg-red-50/40" : "border-slate-200"
                }`}
              />
              {kpi.unit && (
                <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-500">
                  {kpi.unit}
                </span>
              )}
            </div>
          </label>
          {touched && isEmpty && (
            <div className="mt-1 text-xs font-semibold text-red-600">
              Current Value is required.
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">High Limit</div>
              <div className="mt-0.5 text-sm font-bold text-slate-700">
                {formatNumber(kpi.high_limit)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Target</div>
              <div className="mt-0.5 text-sm font-bold text-slate-700">
                {formatNumber(kpi.target)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Low Limit</div>
              <div className="mt-0.5 text-sm font-bold text-slate-700">
                {formatNumber(kpi.low_limit)}
              </div>
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1.5 text-sm">
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
            className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            AI Support
          </button>
        </div>

        <KpiEntryFormChart kpi={kpi} typedValue={value} />
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
